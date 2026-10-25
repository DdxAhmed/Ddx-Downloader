import { DatabaseService } from '../database';
import { MediaEngine } from '../media/media-engine';
import { DownloadJob, DownloadHistoryEntry } from '../../types';

export class DownloadQueue {
  private db: DatabaseService;
  private mediaEngine: MediaEngine;
  private maxConcurrent: number;
  private activeJobsCount = 0;
  private onJobProgress?: (job: DownloadJob) => void;
  private onQueueChange?: (jobs: DownloadJob[]) => void;

  constructor(db: DatabaseService, mediaEngine: MediaEngine, maxConcurrent = 3) {
    this.db = db;
    this.mediaEngine = mediaEngine;
    this.maxConcurrent = maxConcurrent;
  }

  public setCallbacks(
    onJobProgress: (job: DownloadJob) => void,
    onQueueChange: (jobs: DownloadJob[]) => void
  ): void {
    this.onJobProgress = onJobProgress;
    this.onQueueChange = onQueueChange;
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

  public cancelJob(jobId: string): boolean {
    const job = this.db.getJob(jobId);
    if (!job) return false;

    if (job.status === 'downloading' || job.status === 'processing') {
      this.mediaEngine.cancelDownload(jobId);
      job.status = 'cancelled';
      job.errorMessage = 'Cancelled by user';
      this.db.saveJob(job);
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
      this.notifyJobProgress(job);
      this.notifyQueueChange();
      this.processNext();
      return true;
    } else if (job.status === 'queued') {
      job.status = 'cancelled';
      job.errorMessage = 'Cancelled by user';
      this.db.saveJob(job);
      this.notifyJobProgress(job);
      this.notifyQueueChange();
      return true;
    }

    return false;
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
    job.startedAt = undefined;
    job.completedAt = undefined;

    this.db.saveJob(job);
    this.notifyJobProgress(job);
    this.notifyQueueChange();
    this.processNext();
    return true;
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
    const queuedJob = allJobs.find((j) => j.status === 'queued');

    if (!queuedJob) {
      return;
    }

    this.activeJobsCount++;
    this.mediaEngine.startDownload(
      queuedJob,
      (progressJob) => {
        this.db.saveJob(progressJob);
        this.notifyJobProgress(progressJob);
      },
      (completedJob) => {
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
        this.processNext();
      },
      (failedJob, _err) => {
        this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
        this.db.saveJob(failedJob);
        this.notifyJobProgress(failedJob);
        this.notifyQueueChange();
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
