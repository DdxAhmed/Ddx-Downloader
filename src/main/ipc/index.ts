import { ipcMain, dialog, shell, BrowserWindow, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../database';
import { MediaEngine } from '../media/media-engine';
import { DependencyResolver } from '../media/dependency-resolver';
import { DownloadQueue } from '../queue/download-queue';
import { UpdateService } from '../updater/update-service';
import { buildOutputPath, sanitizeFilename } from '../media/filename-sanitizer';
import {
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  DownloadJob,
  AppSettings,
} from '../../types';

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  db: DatabaseService,
  mediaEngine: MediaEngine,
  resolver: DependencyResolver,
  queue: DownloadQueue,
  defaultDownloadsDir: string,
  updateService?: UpdateService
): void {
  // Connect updater events to renderer
  if (updateService) {
    updateService.setOnStateChange((state) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater:state-changed', state);
      }
    });
  }

  // Connect queue events to renderer
  queue.setCallbacks(
    (job) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:progress', job);
      }
    },
    (jobs) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('queue:updated', jobs);
      }
    }
  );

  // 1. Analyze URL
  ipcMain.handle('media:analyze', async (_event, rawUrl: string) => {
    try {
      if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return { success: false, error: 'URL must be a non-empty string.' };
      }
      const data = await mediaEngine.analyzeUrl(rawUrl);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to analyze URL' };
    }
  });

  // 2. Start Single Download
  ipcMain.handle('media:download', async (_event, req: CreateDownloadRequest) => {
    try {
      if (!req || !req.url || !req.title) {
        return { success: false, error: 'Invalid download parameters.' };
      }

      const settings = db.getSettings(defaultDownloadsDir);
      const ext = req.isAudioOnly ? (req.container || 'mp3') : (req.container || settings.preferredContainer || 'mp4');

      const outputPath = buildOutputPath(settings.downloadDirectory, req.title, ext, {
        isPlaylist: !!req.playlistTitle,
        playlistTitle: req.playlistTitle,
        playlistIndex: req.playlistIndex,
        subfolder: req.customSubfolder,
      });

      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const job: DownloadJob = {
        id: jobId,
        sourceUrl: req.url,
        sourcePlatform: req.platform || 'generic',
        mediaTitle: req.title,
        thumbnailUrl: req.thumbnail,
        mediaDuration: req.duration,
        selectedFormat: req.formatId || 'bestvideo+bestaudio/best',
        selectedQuality: req.qualityLabel || 'Best',
        isAudioOnly: !!req.isAudioOnly,
        targetContainer: ext,
        outputPath,
        status: 'queued',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        downloadSpeed: '',
        eta: '',
        createdAt: new Date().toISOString(),
        isPlaylist: !!req.playlistTitle,
        playlistTitle: req.playlistTitle,
        playlistIndex: req.playlistIndex,
        selectedSubtitles: req.selectedSubtitles,
        embedSubtitles: req.embedSubtitles,
      };

      queue.addJob(job);
      return { success: true, jobId };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to queue download' };
    }
  });

  // 3. Start Playlist / Course Batch Download
  ipcMain.handle('media:downloadBatch', async (_event, req: PlaylistBatchDownloadRequest) => {
    try {
      if (!req || !Array.isArray(req.items) || req.items.length === 0) {
        return { success: false, error: 'No items provided for playlist download.' };
      }

      const settings = db.getSettings(defaultDownloadsDir);
      const ext = req.isAudioOnly ? (req.container || 'mp3') : (req.container || settings.preferredContainer || 'mp4');
      const jobs: DownloadJob[] = [];
      const jobIds: string[] = [];

      for (const item of req.items) {
        const outputPath = buildOutputPath(settings.downloadDirectory, item.title, ext, {
          isPlaylist: true,
          playlistTitle: req.organizeInFolder ? req.playlistTitle : undefined,
          playlistIndex: item.index,
        });

        const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        jobIds.push(jobId);

        jobs.push({
          id: jobId,
          sourceUrl: item.url,
          sourcePlatform: 'youtube',
          mediaTitle: item.title,
          thumbnailUrl: item.thumbnail,
          mediaDuration: item.duration,
          selectedFormat: req.formatId || 'bestvideo+bestaudio/best',
          selectedQuality: req.qualityLabel || 'Best',
          isAudioOnly: req.isAudioOnly,
          targetContainer: ext,
          outputPath,
          status: 'queued',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          downloadSpeed: '',
          eta: '',
          createdAt: new Date().toISOString(),
          isPlaylist: true,
          playlistTitle: req.playlistTitle,
          playlistIndex: item.index,
        });
      }

      queue.addBatch(jobs);
      return { success: true, jobIds };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to queue playlist batch' };
    }
  });

  // 4. Cancel & Retry
  ipcMain.handle('media:cancel', async (_event, jobId: string) => {
    const success = queue.cancelJob(jobId);
    return { success };
  });

  ipcMain.handle('media:retry', async (_event, jobId: string) => {
    const success = queue.retryJob(jobId);
    return { success };
  });

  // 5. Queue management
  ipcMain.handle('queue:get', async () => {
    return queue.getQueue();
  });

  ipcMain.handle('queue:clearCompleted', async () => {
    queue.clearCompleted();
    return { success: true };
  });

  // 6. History management
  ipcMain.handle('history:get', async () => {
    return db.getHistory();
  });

  ipcMain.handle('history:delete', async (_event, id: string, deleteFile?: boolean) => {
    try {
      if (deleteFile) {
        const entries = db.getHistory();
        const target = entries.find((e) => e.id === id);
        if (target && target.filePath && fs.existsSync(target.filePath)) {
          fs.unlinkSync(target.filePath);
        }
      }
      db.deleteHistory(id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('history:clear', async () => {
    db.clearHistory();
    return { success: true };
  });

  // 7. Settings management
  ipcMain.handle('settings:get', async () => {
    return db.getSettings(defaultDownloadsDir);
  });

  ipcMain.handle('settings:update', async (_event, newSettings: Partial<AppSettings>) => {
    const updated = db.updateSettings(newSettings, defaultDownloadsDir);
    if (newSettings.maxConcurrentDownloads) {
      queue.setMaxConcurrent(newSettings.maxConcurrentDownloads);
    }
    if (newSettings.customYtDlpPath !== undefined || newSettings.customFfmpegPath !== undefined) {
      resolver.updateCustomPaths(updated.customYtDlpPath, updated.customFfmpegPath);
      const status = await resolver.getStatus(true);
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dependencies:status', status);
      }
    }
    return { success: true, settings: updated };
  });

  ipcMain.handle('settings:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Default Download Directory',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // 8. Dependencies check
  ipcMain.handle('dependencies:check', async () => {
    return resolver.getStatus(true);
  });

  // 9. Safe Shell operations
  ipcMain.handle('shell:openFile', async (_event, filePath: string) => {
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist on disk.' };
    }
    await shell.openPath(filePath);
    return { success: true };
  });

  ipcMain.handle('shell:openFolder', async (_event, filePath: string) => {
    if (!filePath) {
      return { success: false, error: 'Path is required.' };
    }
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return { success: true };
    } else {
      // If file doesn't exist, try opening containing folder
      const dir = path.dirname(filePath);
      if (fs.existsSync(dir)) {
        await shell.openPath(dir);
        return { success: true };
      }
      return { success: false, error: 'Folder does not exist.' };
    }
  });

  ipcMain.handle('shell:openExternal', async (_event, targetUrl: string) => {
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        await shell.openExternal(targetUrl);
        return { success: true };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  });

  // 10. App Info
  ipcMain.handle('app:getInfo', async () => {
    return {
      version: app.getVersion() || '1.0.0',
      platform: process.platform,
      userDataPath: app.getPath('userData'),
      downloadsPath: defaultDownloadsDir,
    };
  });

  // 11. Auto Updater handlers
  ipcMain.handle('updater:check', async (_event, isManual: boolean) => {
    if (!updateService) {
      return { success: false, error: 'Update service not initialized.' };
    }
    return updateService.checkForUpdates(Boolean(isManual));
  });

  ipcMain.handle('updater:download', async () => {
    if (!updateService) {
      return { success: false, error: 'Update service not initialized.' };
    }
    return updateService.downloadUpdate();
  });

  ipcMain.handle('updater:install', async () => {
    if (!updateService) {
      return { success: false, error: 'Update service not initialized.' };
    }
    return updateService.installUpdate();
  });

  ipcMain.handle('updater:getState', async () => {
    if (!updateService) {
      return {
        status: 'idle',
        currentVersion: app.getVersion() || '1.0.0',
        updateInfo: null,
        progress: null,
        error: 'Update service unavailable',
        lastChecked: null,
      };
    }
    return updateService.getState();
  });
}
