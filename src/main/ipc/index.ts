import { ipcMain, dialog, shell, BrowserWindow, app, Notification } from 'electron';
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
  MediaConversionRequest,
} from '../../types';

let miniWindow: BrowserWindow | null = null;

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

  // Connect queue events to renderer and OS desktop notifications
  queue.setCallbacks(
    (job) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download:progress', job);
      }
      if (miniWindow && !miniWindow.isDestroyed()) {
        miniWindow.webContents.send('download:progress', job);
      }
    },
    (jobs) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('queue:updated', jobs);
      }
      if (miniWindow && !miniWindow.isDestroyed()) {
        miniWindow.webContents.send('queue:updated', jobs);
      }
    },
    // On completed notification
    (completedJob) => {
      try {
        const settings = db.getSettings(defaultDownloadsDir);
        if (settings.notificationsEnabled !== false && Notification.isSupported()) {
          new Notification({
            title: 'Ddx Downloader — Download Completed',
            body: `Finished: "${completedJob.mediaTitle}"`,
            silent: false,
          }).show();
        }
      } catch (err) {
        console.error('[Notification] Failed to show completed notification:', err);
      }
    },
    // On failed notification
    (failedJob) => {
      try {
        const settings = db.getSettings(defaultDownloadsDir);
        if (settings.notificationsEnabled !== false && Notification.isSupported()) {
          new Notification({
            title: 'Ddx Downloader — Download Failed',
            body: `Failed: "${failedJob.mediaTitle}" (${failedJob.errorMessage || 'Error'})`,
            silent: false,
          }).show();
        }
      } catch (err) {
        console.error('[Notification] Failed to show failed notification:', err);
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
      const ext = req.isAudioOnly
        ? (req.container || 'mp3')
        : (req.container || settings.preferredContainer || 'mp4');

      const outputPath = buildOutputPath(settings.downloadDirectory, req.title, ext, {
        isPlaylist: !!req.playlistTitle,
        playlistTitle: req.playlistTitle,
        playlistIndex: req.playlistIndex,
        subfolder: req.customSubfolder,
      });

      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const speedLimit = req.speedLimit || settings.downloadSpeedLimit;

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
        speedLimit: speedLimit !== 'unlimited' ? speedLimit : undefined,
        retryCount: 0,
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
      const ext = req.isAudioOnly
        ? (req.container || 'mp3')
        : (req.container || settings.preferredContainer || 'mp4');
      const jobs: DownloadJob[] = [];
      const jobIds: string[] = [];
      const speedLimit = req.speedLimit || settings.downloadSpeedLimit;

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
          speedLimit: speedLimit !== 'unlimited' ? speedLimit : undefined,
          retryCount: 0,
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

  // 4. Cancel, Pause, Resume, and Retry
  ipcMain.handle('media:cancel', async (_event, jobId: string) => {
    const success = queue.cancelJob(jobId);
    return { success };
  });

  ipcMain.handle('media:pause', async (_event, jobId: string) => {
    const success = queue.pauseJob(jobId);
    return { success };
  });

  ipcMain.handle('media:resume', async (_event, jobId: string) => {
    const success = queue.resumeJob(jobId);
    return { success };
  });

  ipcMain.handle('media:retry', async (_event, jobId: string) => {
    const success = queue.retryJob(jobId);
    return { success };
  });

  ipcMain.handle('media:retryAllFailed', async () => {
    const count = queue.retryAllFailed();
    return { success: true, count };
  });

  // 5. Duplicate Detection
  ipcMain.handle('media:checkDuplicate', async (_event, url: string) => {
    if (!url || typeof url !== 'string') {
      return { isDuplicate: false };
    }

    const clean = url.trim().toLowerCase();
    const existingHist = db.findHistoryByUrl(clean);
    const existingJob = db.findJobByUrl(clean);

    return {
      isDuplicate: !!(existingHist || existingJob),
      existingEntry: existingHist || undefined,
      existingJob: existingJob || undefined,
      existingFilePath: existingHist?.filePath || existingJob?.outputPath,
    };
  });

  // 6. Standalone Subtitles Download
  ipcMain.handle(
    'media:downloadSubtitles',
    async (
      _event,
      url: string,
      lang: string,
      format: 'srt' | 'vtt',
      outDir?: string,
      title?: string
    ) => {
      const settings = db.getSettings(defaultDownloadsDir);
      const targetDir = outDir || settings.downloadDirectory;
      const targetTitle = title || 'subtitles';
      return mediaEngine.downloadStandaloneSubtitle(url, lang, format, targetDir, targetTitle);
    }
  );

  // 7. Media Converter Handlers (FFmpeg)
  ipcMain.handle('media:convert', async (_event, req: MediaConversionRequest) => {
    try {
      if (!req || !req.inputPath || !req.outputPath) {
        return { success: false, error: 'Invalid conversion request.' };
      }

      await mediaEngine.convertMedia(
        req,
        (prog) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('conversion:progress', prog);
          }
        },
        (_out) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('conversion:progress', {
              status: 'completed',
              percent: 100,
            });
          }
        },
        (err) => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('conversion:progress', {
              status: 'failed',
              percent: 0,
              errorMessage: err.message,
            });
          }
        }
      );
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('media:cancelConversion', async () => {
    const success = mediaEngine.cancelConversion();
    return { success };
  });

  ipcMain.handle('dialog:selectFileForConversion', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Media File to Convert',
      filters: [
        {
          name: 'Media Files',
          extensions: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'mp3', 'm4a', 'flac', 'wav', 'aac'],
        },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false };
    }

    return { success: true, filePath: result.filePaths[0] };
  });

  // 8. Disk Space and Storage Operations
  ipcMain.handle('storage:checkFreeSpace', async (_event, dirPath?: string) => {
    try {
      const target = dirPath || db.getSettings(defaultDownloadsDir).downloadDirectory;
      if (fs.existsSync(target) && (fs as any).statfsSync) {
        const stat = (fs as any).statfsSync(target);
        return {
          freeBytes: stat.bavail * stat.bsize,
          totalBytes: stat.blocks * stat.bsize,
        };
      }
    } catch (err) {
      console.warn('[Storage] Could not check free space via statfsSync:', err);
    }
    return { freeBytes: 100 * 1024 * 1024 * 1024, totalBytes: 500 * 1024 * 1024 * 1024 };
  });

  ipcMain.handle('storage:cleanTemp', async () => {
    try {
      const settings = db.getSettings(defaultDownloadsDir);
      const downloadDir = settings.downloadDirectory;
      let cleanedCount = 0;
      let freedBytes = 0;

      if (fs.existsSync(downloadDir)) {
        const files = fs.readdirSync(downloadDir);
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;

        for (const file of files) {
          if (file.endsWith('.part') || file.endsWith('.ytdl') || file.endsWith('.temp')) {
            const filePath = path.join(downloadDir, file);
            try {
              const stat = fs.statSync(filePath);
              // Only delete stale temporary files older than 15 mins
              if (stat.mtimeMs < fifteenMinutesAgo) {
                freedBytes += stat.size;
                fs.unlinkSync(filePath);
                cleanedCount++;
              }
            } catch {}
          }
        }
      }
      return { success: true, cleanedCount, freedBytes };
    } catch (err: any) {
      return { success: false, cleanedCount: 0, freedBytes: 0, error: err.message };
    }
  });

  // 9. Queue Management
  ipcMain.handle('queue:get', async () => {
    return queue.getQueue();
  });

  ipcMain.handle('queue:clearCompleted', async () => {
    queue.clearCompleted();
    return { success: true };
  });

  // 10. History Management
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

  // 11. Settings Management
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

  // 12. Dependencies Check
  ipcMain.handle('dependencies:check', async () => {
    return resolver.getStatus(true);
  });

  // 13. Safe Shell Operations
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

  // 14. App Info
  ipcMain.handle('app:getInfo', async () => {
    return {
      version: app.getVersion() || '1.0.0',
      platform: process.platform,
      userDataPath: app.getPath('userData'),
      downloadsPath: defaultDownloadsDir,
    };
  });

  // 15. Mini Mode Toggle
  ipcMain.handle('app:toggleMiniMode', async (_event, enable: boolean) => {
    try {
      if (enable) {
        if (!miniWindow || miniWindow.isDestroyed()) {
          miniWindow = new BrowserWindow({
            title: 'Ddx Downloader — Mini Mode',
            width: 440,
            height: 290,
            minWidth: 400,
            minHeight: 260,
            backgroundColor: '#0b0f19',
            autoHideMenuBar: true,
            alwaysOnTop: true,
            frame: true,
            webPreferences: {
              preload: path.join(__dirname, 'preload.cjs'),
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: false,
            },
          });

          const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
          const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173#mini';
          if (isDev) {
            try {
              await miniWindow.loadURL(devServerUrl);
            } catch {
              await miniWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'mini' });
            }
          } else {
            await miniWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'mini' });
          }

          miniWindow.on('closed', () => {
            miniWindow = null;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show();
            }
          });
        }

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.hide();
        }
        miniWindow.show();
      } else {
        if (miniWindow && !miniWindow.isDestroyed()) {
          miniWindow.close();
          miniWindow = null;
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 16. Auto Updater Handlers
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
