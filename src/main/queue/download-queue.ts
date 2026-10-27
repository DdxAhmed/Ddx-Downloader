import { DatabaseService } from '../database';
import { MediaEngine } from '../media/media-engine';
import { DownloadJob, DownloadHistoryEntry } from '../../types';

export class DownloadQueue {
  private db: DatabaseService;
  private mediaEngine: MediaEngine;
  private maxConcurrent: number;
  private activeJobsCount = 0;
  private suspended = false;
  private activeJobIds = new Set<string>();
  private jobAttemptTokens = new Map<string, number>();

  private onJobProgress?: (job: DownloadJob) => void;
  private onQueueChange?: (jobs: DownloadJob[]) => void;
  private onJobCompletedNotification?: (job: DownloadJob) => void;
  private onJobFailedNotification?: (job: DownloadJob) => void;

  constructor(
    db: DatabaseService,
    mediaEngine: MediaEngine,
    maxConcurrent = 3,
    private isAutoRetryEnabled: () => boolean = () => true
  ) {
    this.db = db;
    this.mediaEngine = mediaEngine;
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  public setCallbacks(
    onJobProgress: (job: DownloadJob) => void,
    onQueueChange: (jobs: DownloadJob[]) => void,
    onJobCompletedNotification?: (job: DownloadJob) => void,
    onJobFailedNotification?: (job: DownloadJob) => void
  ): void {
    this.onJobProgress = onJobProgress;
    this.onQueueChange = onQueueChange;
    this.onJobCompletedNotification = onJobCompletedNotification;
    this.onJobFailedNotification = onJobFailedNotification;
  }

  public setMaxConcurrent(limit: number): void {
    this.maxConcurrent = Math.max(1, limit);
    this.processNext();
  }

  public getQueue(): DownloadJob[] {
    return this.db.getAllJobs();
  }

  public prepareForShutdown(): void {
    this.suspended = true;
    for (const job of this.db.getAllJobs()) {
      if (['queued', 'retrying', 'preparing', 'analyzing', 'downloading', 'processing', 'merging'].includes(job.status)) {
        this.jobAttemptTokens.set(job.id, (this.jobAttemptTokens.get(job.id) || 0) + 1);
        job.status = 'paused';
        job.downloadSpeed = '';
        this.db.saveJob(job);
      }
    }
    this.activeJobIds.clear();
    this.activeJobsCount = 0;
    this.notifyQueueChange();
  }

  public recoverFromShutdown(): void { this.suspended = false; }

  public addJob(job: DownloadJob): void {
    if (this.suspended) throw new Error('Application is preparing to exit.');
    this.db.saveJob(job);
    this.notifyQueueChange();
    this.processNext();
  }

  public addBatch(jobs: DownloadJob[]): void {
    if (this.suspended) throw new Error('Application is preparing to exit.');
    for (const job of jobs) {
      this.db.saveJob(job);
    }
    this.notifyQueueChange();
    this.processNext();
  }

  public pauseJob(jobId: string): boolean {
    const job = this.db.getJob(jobId);
    if (!job) return false;

    // Increment attempt token to invalidate any stale process callbacks
    const newTok = (this.jobAttemptTokens.get(jobId) || 0) + 1;
    this.jobAttemptTokens.set(jobId, newTok);

    if (this.activeJobIds.has(jobId)) {
      this.mediaEngine.cancelDownload(jobId);
      this.activeJobIds.delete(jobId);
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
    }

    job.status = 'paused';
    job.downloadSpeed = 'Paused';
    this.db.saveJob(job);
    this.notifyJobProgress(job);
    this.notifyQueueChange();
    this.processNext();
    return true;
  }

  public resumeJob(jobId: string): boolean {
    if (this.suspended) return false;
    const job = this.db.getJob(jobId);
    if (!job || job.status !== 'paused') return false;

    const newTok = (this.jobAttemptTokens.get(jobId) || 0) + 1;
    this.jobAttemptTokens.set(jobId, newTok);

    job.status = 'queued';
    job.downloadSpeed = '';
    this.db.saveJob(job);
    this.notifyJobProgress(job);
    this.notifyQueueChange();
    this.processNext();
    return true;
  }

  public cancelJob(jobId: string): boolean {
    const job = this.db.getJob(jobId);
    if (!job) return false;

    // Invalidate inflight callbacks
    const newTok = (this.jobAttemptTokens.get(jobId) || 0) + 1;
    this.jobAttemptTokens.set(jobId, newTok);

    if (this.activeJobIds.has(jobId)) {
      this.mediaEngine.cancelDownload(jobId);
      this.activeJobIds.delete(jobId);
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
    }

    job.status = 'cancelled';
    job.errorMessage = 'Cancelled by user';
    this.db.saveJob(job);
    this.notifyJobProgress(job);
    this.notifyQueueChange();
    this.processNext();
    return true;
  }

  public retryJob(jobId: string): boolean {
    if (this.suspended) return false;
    const job = this.db.getJob(jobId);
    if (!job) return false;

    const newTok = (this.jobAttemptTokens.get(jobId) || 0) + 1;
    this.jobAttemptTokens.set(jobId, newTok);

    if (this.activeJobIds.has(jobId)) {
      this.mediaEngine.cancelDownload(jobId);
      this.activeJobIds.delete(jobId);
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
    }

    job.status = 'queued';
    job.progress = 0;
    job.downloadedBytes = 0;
    job.downloadSpeed = '';
    job.eta = '';
    job.errorMessage = undefined;
    job.errorDetails = undefined;
    job.retryCount = 0;
    job.startedAt = undefined;
    job.completedAt = undefined;

    this.db.saveJob(job);
    this.notifyJobProgress(job);
    this.notifyQueueChange();
    this.processNext();
    return true;
  }

  public retryAllFailed(): number {
    if (this.suspended) return 0;
    const all = this.db.getAllJobs();
    const failed = all.filter((j) => j.status === 'failed' || j.status === 'cancelled');

    for (const job of failed) {
      const newTok = (this.jobAttemptTokens.get(job.id) || 0) + 1;
      this.jobAttemptTokens.set(job.id, newTok);

      job.status = 'queued';
      job.progress = 0;
      job.downloadedBytes = 0;
      job.downloadSpeed = '';
      job.eta = '';
      job.errorMessage = undefined;
      job.errorDetails = undefined;
      job.retryCount = 0;
      job.startedAt = undefined;
      job.completedAt = undefined;
      this.db.saveJob(job);
    }

    if (failed.length > 0) {
      this.notifyQueueChange();
      this.processNext();
    }

    return failed.length;
  }

  public clearCompleted(): void {
    this.db.clearCompletedJobs();
    this.notifyQueueChange();
  }

  /**
   * Loops until all concurrency slots are filled or no queued jobs remain
   */
  private processNext(): void {
    if (this.suspended) return;
    while (this.activeJobsCount < this.maxConcurrent) {
      const allJobs = this.db.getAllJobs();
      const queuedJob = allJobs.find(
        (j) => j.status === 'queued' && !this.activeJobIds.has(j.id)
      );

      if (!queuedJob) {
        break;
      }

      this.activeJobsCount++;
      this.activeJobIds.add(queuedJob.id);
      this.startJobAttempt(queuedJob);
    }
  }

  private startJobAttempt(queuedJob: DownloadJob): void {
    const attemptToken = (this.jobAttemptTokens.get(queuedJob.id) || 0) + 1;
    this.jobAttemptTokens.set(queuedJob.id, attemptToken);

    let slotReleased = false;
    const releaseSlotOnce = () => {
      if (!slotReleased) {
        slotReleased = true;
        this.activeJobIds.delete(queuedJob.id);
        this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
      }
    };

    const isCurrentAttempt = () => {
      return this.jobAttemptTokens.get(queuedJob.id) === attemptToken;
    };

    try {
      const startResult = this.mediaEngine.startDownload(
        queuedJob,
        (progressJob) => {
          if (!isCurrentAttempt()) return;
          this.db.saveJob(progressJob);
          this.notifyJobProgress(progressJob);
        },
        (completedJob) => {
          if (!isCurrentAttempt()) return;
          releaseSlotOnce();
          this.db.saveJob(completedJob);

          // Add to history
          const historyEntry: DownloadHistoryEntry = {
            id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            jobId: completedJob.id,
            mediaTitle: completedJob.mediaTitle,
            sourceUrl: completedJob.sourceUrl,
            sourcePlatform: completedJob.sourcePlatform,
            filePath: completedJob.outputPath,
            fileSize: completedJob.totalBytes,
            format: completedJob.selectedQuality || completedJob.selectedFormat,
            duration: completedJob.mediaDuration || 0,
            thumbnailUrl: completedJob.thumbnailUrl,
            completedAt: completedJob.completedAt || new Date().toISOString(),
            timeRange: completedJob.timeRange,
          };
          this.db.addHistory(historyEntry);

          // Update course item if this job belongs to a course
          if (completedJob.courseItemId) {
            try {
              const courseItems = this.db.getCourseItems(completedJob.courseId || '');
              const target = courseItems.find((i) => i.id === completedJob.courseItemId);
              if (target) {
                target.status = 'downloaded';
                target.localFilePath = completedJob.outputPath;
                target.updatedAt = new Date().toISOString();
                this.db.saveCourseItem(target);
              }
            } catch {}
          }

          this.notifyJobProgress(completedJob);
          this.notifyQueueChange();

          if (this.onJobCompletedNotification) {
            this.onJobCompletedNotification(completedJob);
          }

          this.processNext();
        },
        (failedJob, _err) => {
          if (!isCurrentAttempt()) return;
          releaseSlotOnce();

          if (failedJob.courseItemId) {
            try {
              const courseItems = this.db.getCourseItems(failedJob.courseId || '');
              const target = courseItems.find((i) => i.id === failedJob.courseItemId);
              if (target) {
                target.status = 'failed';
                target.updatedAt = new Date().toISOString();
                this.db.saveCourseItem(target);
              }
            } catch {}
          }

          // Check if eligible for bounded automatic retry
          const isTransient = failedJob.errorDetails?.isTransient === true;
          const currentRetries = failedJob.retryCount || 0;
          const maxRetries = 3;

          if (this.isAutoRetryEnabled() && isTransient && currentRetries < maxRetries) {
            failedJob.retryCount = currentRetries + 1;
            failedJob.status = 'retrying';
            failedJob.downloadSpeed = `Auto-retrying (${failedJob.retryCount}/${maxRetries})...`;
            this.db.saveJob(failedJob);
            this.notifyJobProgress(failedJob);
            this.notifyQueueChange();

            const delay = Math.min(10000, Math.pow(2, failedJob.retryCount) * 1500);
            setTimeout(() => {
              if (!isCurrentAttempt()) return;
              const current = this.db.getJob(failedJob.id);
              if (current && current.status === 'retrying') {
                current.status = this.isAutoRetryEnabled() ? 'queued' : 'failed';
                current.downloadSpeed = '';
                this.db.saveJob(current);
                this.notifyJobProgress(current);
                this.notifyQueueChange();
                this.processNext();
              }
            }, delay);
          } else {
            this.db.saveJob(failedJob);
            this.notifyJobProgress(failedJob);
            this.notifyQueueChange();

            if (this.onJobFailedNotification) {
              this.onJobFailedNotification(failedJob);
            }
          }

          this.processNext();
        }
      );

      if (startResult && typeof (startResult as any).catch === 'function') {
        (startResult as any).catch((asyncErr: any) => {
          if (!isCurrentAttempt()) return;
          releaseSlotOnce();
          queuedJob.status = 'failed';
          queuedJob.errorMessage = asyncErr?.message || 'Download startup failed asynchronously';
          this.db.saveJob(queuedJob);
          this.notifyJobProgress(queuedJob);
          this.notifyQueueChange();
          this.processNext();
        });
      }
    } catch (syncErr: any) {
      if (!isCurrentAttempt()) return;
      releaseSlotOnce();
      queuedJob.status = 'failed';
      queuedJob.errorMessage = syncErr?.message || 'Download startup failed';
      this.db.saveJob(queuedJob);
      this.notifyJobProgress(queuedJob);
      this.notifyQueueChange();
      this.processNext();
    }
  }

  private notifyJobProgress(job: DownloadJob): void {
    if (this.onJobProgress) {
      this.onJobProgress(job);
    }
  }

  private notifyQueueChange(): void {
    if (this.onQueueChange) {
      this.onQueueChange(this.getQueue());
    }
  }
}
