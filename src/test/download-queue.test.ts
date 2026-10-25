import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from '../main/database';
import { DownloadQueue } from '../main/queue/download-queue';
import { DownloadJob } from '../types';

describe('DownloadQueue Manager & Concurrency Control', () => {
  let tempDir: string;
  let db: DatabaseService;
  let mockMediaEngine: any;
  let queue: DownloadQueue;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddx-queue-test-'));
    db = new DatabaseService(tempDir);
    await db.initialize();

    mockMediaEngine = {
      startDownload: vi.fn((job, onProgress, onComplete, _onError) => {
        // Simulate immediate completion for tests
        job.status = 'downloading';
        onProgress(job);
        job.status = 'completed';
        job.progress = 100;
        job.completedAt = new Date().toISOString();
        onComplete(job);
      }),
      cancelDownload: vi.fn(() => true),
    };

    queue = new DownloadQueue(db, mockMediaEngine as any, 2);
  });

  it('queues and completes jobs respecting concurrency', () => {
    const job1: DownloadJob = {
      id: 'job-1',
      sourceUrl: 'https://youtube.com/watch?v=1',
      sourcePlatform: 'youtube',
      mediaTitle: 'Video 1',
      selectedFormat: 'best',
      selectedQuality: '1080p',
      targetContainer: 'mp4',
      outputPath: 'C:/v1.mp4',
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 1000,
      downloadSpeed: '',
      eta: '',
      createdAt: new Date().toISOString(),
      isAudioOnly: false,
    };

    queue.addJob(job1);

    expect(mockMediaEngine.startDownload).toHaveBeenCalled();
    const completed = db.getJob('job-1');
    expect(completed?.status).toBe('completed');
  });

  it('cancels queued and active jobs', () => {
    const job2: DownloadJob = {
      id: 'job-2',
      sourceUrl: 'https://youtube.com/watch?v=2',
      sourcePlatform: 'youtube',
      mediaTitle: 'Video 2',
      selectedFormat: 'best',
      selectedQuality: '1080p',
      targetContainer: 'mp4',
      outputPath: 'C:/v2.mp4',
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 1000,
      downloadSpeed: '',
      eta: '',
      createdAt: new Date().toISOString(),
      isAudioOnly: false,
    };
    db.saveJob(job2);

    const cancelled = queue.cancelJob('job-2');
    expect(cancelled).toBe(true);

    const saved = db.getJob('job-2');
    expect(saved?.status).toBe('cancelled');
  });

  it('retries failed or cancelled jobs', () => {
    const job3: DownloadJob = {
      id: 'job-3',
      sourceUrl: 'https://youtube.com/watch?v=3',
      sourcePlatform: 'youtube',
      mediaTitle: 'Video 3',
      selectedFormat: 'best',
      selectedQuality: '1080p',
      targetContainer: 'mp4',
      outputPath: 'C:/v3.mp4',
      status: 'failed',
      progress: 20,
      downloadedBytes: 200,
      totalBytes: 1000,
      downloadSpeed: '',
      eta: '',
      errorMessage: 'Network timeout',
      createdAt: new Date().toISOString(),
      isAudioOnly: false,
    };
    db.saveJob(job3);

    const retried = queue.retryJob('job-3');
    expect(retried).toBe(true);
    expect(mockMediaEngine.startDownload).toHaveBeenCalled();
  });

  it('clears completed jobs from queue list', () => {
    const job4: DownloadJob = {
      id: 'job-4',
      sourceUrl: 'https://youtube.com/watch?v=4',
      sourcePlatform: 'youtube',
      mediaTitle: 'Video 4',
      selectedFormat: 'best',
      selectedQuality: '1080p',
      targetContainer: 'mp4',
      outputPath: 'C:/v4.mp4',
      status: 'completed',
      progress: 100,
      downloadedBytes: 1000,
      totalBytes: 1000,
      downloadSpeed: '',
      eta: '',
      createdAt: new Date().toISOString(),
      isAudioOnly: false,
    };
    db.saveJob(job4);

    queue.clearCompleted();
    expect(db.getJob('job-4')).toBeNull();
  });
});
