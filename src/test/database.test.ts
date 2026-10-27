import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { DatabaseService } from '../main/database';
import { DownloadJob, DownloadHistoryEntry } from '../types';

describe('DatabaseService SQLite & Schema Migrations', () => {
  let tempDir: string;
  let db: DatabaseService;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddx-test-'));
    db = new DatabaseService(tempDir);
    await db.initialize();
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('initializes tables and creates database file on disk', () => {
    const dbFile = path.join(tempDir, 'DdxDownloader', 'database.sqlite');
    expect(fs.existsSync(dbFile)).toBe(true);
  });

  it('saves and retrieves download jobs', () => {
    const job: DownloadJob = {
      id: 'test-job-1',
      sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      sourcePlatform: 'youtube',
      mediaTitle: 'Never Gonna Give You Up',
      selectedFormat: 'bestvideo+bestaudio/best',
      selectedQuality: '1080p',
      targetContainer: 'mp4',
      outputPath: 'C:/Downloads/video.mp4',
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 50000000,
      downloadSpeed: '',
      eta: '',
      createdAt: new Date().toISOString(),
      isAudioOnly: false,
      timeRange: { start: 135, end: 220, label: 'Key section' },
      cutMode: 'accurate',
    };

    db.saveJob(job);
    const retrieved = db.getJob('test-job-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.mediaTitle).toBe('Never Gonna Give You Up');
    expect(retrieved?.status).toBe('queued');
    expect(retrieved?.timeRange).toEqual({ start: 135, end: 220, label: 'Key section' });
    expect(retrieved?.cutMode).toBe('accurate');

    // Update job status
    job.status = 'downloading';
    job.progress = 55.4;
    db.saveJob(job);

    const updated = db.getJob('test-job-1');
    expect(updated?.status).toBe('downloading');
    expect(updated?.progress).toBe(55.4);
  });

  it('reconciles interrupted jobs on application startup', () => {
    // Simulate a job left in downloading state during crash/shutdown
    const activeJob: DownloadJob = {
      id: 'interrupted-job-2',
      sourceUrl: 'https://www.youtube.com/watch?v=abc',
      sourcePlatform: 'youtube',
      mediaTitle: 'Crash Test Video',
      selectedFormat: 'best',
      selectedQuality: '720p',
      targetContainer: 'mp4',
      outputPath: 'C:/Downloads/crash.mp4',
      status: 'downloading',
      progress: 40,
      downloadedBytes: 4000,
      totalBytes: 10000,
      downloadSpeed: '2 MB/s',
      eta: '00:03',
      createdAt: new Date().toISOString(),
      isAudioOnly: false,
    };
    db.saveJob(activeJob);

    // Run reconciliation
    db.reconcileStartupJobs();

    const reconciled = db.getJob('interrupted-job-2');
    expect(reconciled?.status).toBe('failed');
    expect(reconciled?.errorMessage).toContain('Interrupted by application shutdown');
  });

  it('records, queries, and clears download history', () => {
    const entry: DownloadHistoryEntry = {
      id: 'hist-1',
      jobId: 'test-job-1',
      mediaTitle: 'History Video',
      sourceUrl: 'https://youtube.com/watch?v=123',
      sourcePlatform: 'youtube',
      filePath: 'C:/Downloads/history.mp4',
      fileSize: 1048576,
      format: '1080p',
      duration: 120,
      completedAt: new Date().toISOString(),
    };

    db.addHistory(entry);

    const allHistory = db.getHistory();
    expect(allHistory.length).toBeGreaterThanOrEqual(1);
    expect(allHistory.some((h) => h.id === 'hist-1')).toBe(true);

    db.deleteHistory('hist-1');
    const afterDelete = db.getHistory();
    expect(afterDelete.some((h) => h.id === 'hist-1')).toBe(false);
  });

  it('persists and updates application settings', () => {
    const defaultDownloads = 'C:/DefaultDownloads';
    const initial = db.getSettings(defaultDownloads);
    expect(initial.downloadDirectory).toBe(defaultDownloads);
    expect(initial.maxConcurrentDownloads).toBe(3);

    db.updateSettings({
      downloadDirectory: 'D:/CustomMedia',
      maxConcurrentDownloads: 5,
      preferredQuality: '1080p',
    }, defaultDownloads);

    const updated = db.getSettings(defaultDownloads);
    expect(updated.downloadDirectory).toBe('D:/CustomMedia');
    expect(updated.maxConcurrentDownloads).toBe(5);
    expect(updated.preferredQuality).toBe('1080p');
  });
});
