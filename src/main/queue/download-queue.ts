import { DatabaseService } from '../database';
import { MediaEngine } from '../media/media-engine';
import { DownloadJob, DownloadHistoryEntry } from '../../types';

export class DownloadQueue {
  private db: DatabaseService;
  private mediaEngine: MediaEngine;
  private maxConcurrent: number;
  private activeJobsCount = 0;
  private activeJobIds = new Set<string>();
  private onJobProgress?: (job: DownloadJob) => void;
  private onQueueChange?: (jobs: DownloadJob[]) => void;
  private onJobCompletedNotification?: (job: DownloadJob) => void;
  private onJobFailedNotification?: (job: DownloadJob) => void;

  constructor(db: DatabaseService, mediaEngine: MediaEngine, maxConcurrent = 3) {
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

  public addJob(job: DownloadJob): void {
    this.db.saveJob(job);
    this.notifyQueueChange();
    this.processNext();
  }

  public addBatch(jobs: DownloadJob[]): void {
    for (const job of jobs) {
      this.db.saveJob(job);
    }
    this.notifyQueueChange();
    this.processNext();
  }

  public pauseJob(jobId: string): boolean {
    const job = this.db.getJob(jobId);
    if (!job) return false;

    if (job.status === 'downloading' || job.status === 'processing' || job.status === 'merging') {
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
    const job = this.db.getJob(jobId);
    if (!job || job.status !== 'paused') return false;

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

    if (
      job.status === 'downloading' ||
      job.status === 'processing' ||
      job.status === 'merging' ||
      job.status === 'retrying'
    ) {
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
    const job = this.db.getJob(jobId);
    if (!job) return false;

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
    const all = this.db.getAllJobs();
    const failed = all.filter((j) => j.status === 'failed' || j.status === 'cancelled');

    for (const job of failed) {
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

  private processNext(): void {
    if (this.activeJobsCount >= this.maxConcurrent) {
      return;
    }

    const allJobs = this.db.getAllJobs();
    const queuedJob = allJobs.find(
      (j) => j.status === 'queued' && !this.activeJobIds.has(j.id)
    );

    if (!queuedJob) {
      return;
    }

    this.activeJobsCount++;
    this.activeJobIds.add(queuedJob.id);

    this.mediaEngine.startDownload(
      queuedJob,
      (progressJob) => {
        this.db.saveJob(progressJob);
        this.notifyJobProgress(progressJob);
      },
      (completedJob) => {
        this.activeJobIds.delete(completedJob.id);
        this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
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
        };
        this.db.addHistory(historyEntry);

        this.notifyJobProgress(completedJob);
        this.notifyQueueChange();

        if (this.onJobCompletedNotification) {
          this.onJobCompletedNotification(completedJob);
        }

        this.processNext();
      },
      (failedJob, _err) => {
        this.activeJobIds.delete(failedJob.id);
        this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);

        // Check if eligible for bounded automatic retry
        const isTransient = failedJob.errorDetails?.isTransient === true;
        const currentRetries = failedJob.retryCount || 0;
        const maxRetries = 3;

        if (isTransient && currentRetries < maxRetries) {
          failedJob.retryCount = currentRetries + 1;
          failedJob.status = 'retrying';
          failedJob.downloadSpeed = `Auto-retrying (${failedJob.retryCount}/${maxRetries})...`;
          this.db.saveJob(failedJob);
          this.notifyJobProgress(failedJob);
          this.notifyQueueChange();

          const delay = Math.min(10000, Math.pow(2, failedJob.retryCount) * 1500);
          setTimeout(() => {
            const current = this.db.getJob(failedJob.id);
            if (current && current.status === 'retrying') {
              current.status = 'queued';
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
