import { it, expect, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseService } from './index';
import { DownloadQueue } from '../queue/download-queue';
import { ShutdownCoordinator } from '../updater/shutdown-coordinator';

it('preserves settings, courses, history, media and paused jobs across safe shutdown and database reopen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddx-preservation-'));
  const db = new DatabaseService(dir);
  await db.initialize();
  try {
    const media = path.join(dir, 'lesson.mp4');
    const content = Buffer.from('existing downloaded media');
    fs.writeFileSync(media, content);
    db.updateSettings({ language: 'ar', downloadDirectory: dir }, dir);
    const now = new Date().toISOString();
    db.saveCourse({ id: 'course', sourceUrl: 'https://example.com/course', platform: 'generic', title: 'Saved course', destinationFolder: dir,
      preferredQuality: 'best', preferredContainer: 'mp4', isAudioOnly: false, itemCount: 1, createdAt: now, updatedAt: now },
    [{ id: 'lesson', courseId: 'course', sourceMediaId: 'video', title: 'Lesson', url: 'https://example.com/video', index: 1, status: 'downloaded', localFilePath: media, updatedAt: now }]);
    db.addHistory({ id: 'history', jobId: 'old-job', mediaTitle: 'Lesson', sourceUrl: 'https://example.com/video', sourcePlatform: 'generic',
      filePath: media, fileSize: content.length, format: 'mp4', duration: 10, completedAt: now });
    db.saveJob({ id: 'active', sourceUrl: 'https://example.com/new', sourcePlatform: 'generic', mediaTitle: 'Active', selectedFormat: 'best',
      selectedQuality: 'best', targetContainer: 'mp4', outputPath: path.join(dir, 'active.mp4'), status: 'downloading',
      progress: 42, downloadedBytes: 420, totalBytes: 1000, downloadSpeed: '100', eta: '', createdAt: now, isAudioOnly: false });
    const queue = new DownloadQueue(db, {} as any);
    const coordinator = new ShutdownCoordinator({ hasActiveWork: () => true, confirmInterruption: async () => true,
      pauseQueue: () => queue.prepareForShutdown(), stopProcesses: async () => {}, flushDatabase: () => db.flushForShutdown(), recover: vi.fn() });
    expect(await coordinator.prepare()).toBe(true);
    const reopened = new DatabaseService(dir);
    await reopened.initialize();
    expect(reopened.getSettings(dir).language).toBe('ar');
    expect(reopened.getAllCourses()[0].title).toBe('Saved course');
    expect(reopened.getCourseItems('course')[0].localFilePath).toBe(media);
    expect(reopened.getHistory()[0].filePath).toBe(media);
    expect(reopened.getJob('active')).toMatchObject({ status: 'paused', progress: 42, downloadedBytes: 420 });
    expect(fs.readFileSync(media)).toEqual(content);
  } finally {
    db.flushPendingPersist();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
