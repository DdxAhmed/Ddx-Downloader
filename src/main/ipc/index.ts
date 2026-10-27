import { ipcMain, dialog, shell, BrowserWindow, app, Notification } from 'electron';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../database';
import { MediaEngine } from '../media/media-engine';
import { DependencyResolver } from '../media/dependency-resolver';
import { DownloadQueue } from '../queue/download-queue';
import { UpdateService } from '../updater/update-service';
import { CourseService } from '../courses/course-service';
import { SubtitleService } from '../subtitles/subtitle-service';
import { DiskSpaceChecker } from '../storage/disk-space-checker';
import { SizeEstimator } from '../media/size-estimator';
import {
  buildOutputPath,
  sanitizeFilename,
  validateTimeRange,
} from '../media/filename-sanitizer';
import {
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  DownloadJob,
  AppSettings,
  MediaConversionRequest,
  SubtitleSearchQuery,
  MediaFormat,
  TimeRange,
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
  const courseService = new CourseService(db, mediaEngine, queue);
  const subtitleService = new SubtitleService(db);
  const userApprovedDownloadDirectories = new Set<string>();

  // Automatically index any subtitles downloaded alongside completed video jobs
  if (mediaEngine && typeof (mediaEngine as any).setOnSubtitlesDownloaded === 'function') {
    mediaEngine.setOnSubtitlesDownloaded((subPath, job) => {
      subtitleService.indexSubtitleFile(subPath, {
        mediaTitle: job.mediaTitle,
        mediaId: job.id,
        associatedMediaFile: job.outputPath,
      });
    });
  }

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

  // 2. Start Single Download (with optional Section / Time Range clipping & pre-check)
  ipcMain.handle('media:download', async (_event, req: CreateDownloadRequest) => {
    try {
      if (!req || typeof req.url !== 'string' || !req.url.trim() || typeof req.title !== 'string') {
        return { success: false, error: 'Invalid download parameters.' };
      }

      // Runtime validation of time range if provided
      if (req.timeRange) {
        if (typeof req.timeRange.start !== 'number' || typeof req.timeRange.end !== 'number') {
          return { success: false, error: 'Time range start and end must be valid numbers.' };
        }
        const validation = validateTimeRange(req.timeRange.start, req.timeRange.end, req.duration);
        if (!validation.valid) {
          return { success: false, error: validation.error || 'Invalid time range.' };
        }
        if (req.cutMode !== undefined && req.cutMode !== 'fast' && req.cutMode !== 'accurate') {
          return { success: false, error: 'Invalid clip cutting mode.' };
        }
      }

      const settings = db.getSettings(defaultDownloadsDir);
      const destinationDirectory = req.destinationDirectory
        ? path.resolve(req.destinationDirectory)
        : path.resolve(settings.downloadDirectory);
      if (
        req.destinationDirectory &&
        destinationDirectory !== path.resolve(settings.downloadDirectory) &&
        !userApprovedDownloadDirectories.has(destinationDirectory)
      ) {
        return { success: false, error: 'The destination folder was not selected through the application.' };
      }
      const ext = req.isAudioOnly
        ? (req.container || 'mp3')
        : (req.container || settings.preferredContainer || 'mp4');

      const outputPath = buildOutputPath(destinationDirectory, req.title, ext, {
        isPlaylist: !!req.playlistTitle,
        playlistTitle: req.playlistTitle,
        playlistIndex: req.playlistIndex,
        subfolder: req.customSubfolder,
        timeRange: req.timeRange,
        checkCollision: true,
      });

      // Pre-check available disk space against estimated peak requirements
      if (req.estimatedSizeBytes && req.estimatedSizeBytes > 0) {
        const spaceCheck = DiskSpaceChecker.evaluateSpaceWithEstimates(
          outputPath,
          req.estimatedSizeBytes,
          !req.isAudioOnly,
          queue.getQueue()
        );
        if (spaceCheck.isInsufficient) {
          return {
            success: false,
            error: `Insufficient disk space: Peak space of ${SizeEstimator.formatBytes(spaceCheck.estimatedPeakBytes)} required, but only ${SizeEstimator.formatBytes(spaceCheck.diskSpace.freeBytes || 0)} available on ${spaceCheck.diskSpace.path}.`,
          };
        }
      }

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
        timeRange: req.timeRange,
        cutMode: req.timeRange ? (req.cutMode || 'fast') : undefined,
        estimatedSizeBytes: req.estimatedSizeBytes,
        sizeEstimationType: req.sizeEstimationType,
        courseId: req.courseId,
        courseItemId: req.courseItemId,
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
          checkCollision: true,
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
    if (typeof jobId !== 'string') return { success: false };
    const success = queue.cancelJob(jobId);
    return { success };
  });

  ipcMain.handle('media:pause', async (_event, jobId: string) => {
    if (typeof jobId !== 'string') return { success: false };
    const success = queue.pauseJob(jobId);
    return { success };
  });

  ipcMain.handle('media:resume', async (_event, jobId: string) => {
    if (typeof jobId !== 'string') return { success: false };
    const success = queue.resumeJob(jobId);
    return { success };
  });

  ipcMain.handle('media:retry', async (_event, jobId: string) => {
    if (typeof jobId !== 'string') return { success: false };
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
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'URL is required' };
      }
      const settings = db.getSettings(defaultDownloadsDir);
      const targetDir = outDir || settings.downloadDirectory;
      const targetTitle = title || 'subtitles';
      const res = await mediaEngine.downloadStandaloneSubtitle(url, lang, format, targetDir, targetTitle);
      if (res.success && res.filePath) {
        // Automatically index newly downloaded standalone subtitle
        await subtitleService.indexSubtitleFile(res.filePath, { mediaTitle: targetTitle, language: lang });
      }
      return res;
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
    const target = dirPath || db.getSettings(defaultDownloadsDir).downloadDirectory;
    return DiskSpaceChecker.getFreeDiskSpace(target);
  });

  ipcMain.handle(
    'storage:checkDiskSpaceWithEstimates',
    async (
      _event,
      dirPath: string | undefined,
      estimatedBytes: number,
      isSeparateStreams?: boolean
    ) => {
      const target = dirPath || db.getSettings(defaultDownloadsDir).downloadDirectory;
      return DiskSpaceChecker.evaluateSpaceWithEstimates(
        target,
        Number(estimatedBytes) || 0,
        Boolean(isSeparateStreams),
        queue.getQueue()
      );
    }
  );

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
      if (typeof id !== 'string') return { success: false, error: 'ID is required' };
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
    if (!newSettings || typeof newSettings !== 'object') {
      return { success: false, error: 'Invalid settings object' };
    }
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
    const selectedPath = path.resolve(result.filePaths[0]);
    userApprovedDownloadDirectories.add(selectedPath);
    return { success: true, path: selectedPath };
  });

  // 12. Dependencies Check
  ipcMain.handle('dependencies:check', async () => {
    return resolver.getStatus(true);
  });

  // 13. Safe Shell Operations
  ipcMain.handle('shell:openFile', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string' || !fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist on disk.' };
    }
    await shell.openPath(filePath);
    return { success: true };
  });

  ipcMain.handle('shell:openFolder', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
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
      if (!targetUrl || typeof targetUrl !== 'string') return { success: false };
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
      version: app.getVersion() || '2.0.0',
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
        currentVersion: app.getVersion() || '2.0.0',
        updateInfo: null,
        progress: null,
        error: 'Update service unavailable',
        lastChecked: null,
      };
    }
    return updateService.getState();
  });

  // -------------------------------------------------------------------------
  // 17. Course & Playlist Library Handlers (Feature 2)
  // -------------------------------------------------------------------------

  ipcMain.handle('courses:save', async (_event, courseData) => {
    if (!courseData || typeof courseData.title !== 'string' || typeof courseData.sourceUrl !== 'string') {
      return { success: false, error: 'Invalid course data.' };
    }
    return courseService.saveCourse(courseData);
  });

  ipcMain.handle('courses:getAll', async () => {
    return courseService.getCoursesWithItems();
  });

  ipcMain.handle('courses:get', async (_event, courseId: string) => {
    if (typeof courseId !== 'string') return null;
    return courseService.getCourseWithItems(courseId);
  });

  ipcMain.handle('courses:sync', async (_event, courseId: string) => {
    if (typeof courseId !== 'string') return { success: false, error: 'Course ID is required.' };
    return courseService.syncCourse(courseId);
  });

  ipcMain.handle('courses:downloadItems', async (_event, courseId: string, itemIds: string[], options) => {
    if (typeof courseId !== 'string' || !Array.isArray(itemIds)) {
      return { success: false, error: 'Invalid course download parameters.' };
    }
    return courseService.downloadCourseItems(courseId, itemIds, options);
  });

  ipcMain.handle('courses:delete', async (_event, courseId: string, deleteFiles = false) => {
    if (typeof courseId !== 'string') return { success: false, error: 'Course ID is required.' };
    return courseService.deleteCourse(courseId, Boolean(deleteFiles));
  });

  // -------------------------------------------------------------------------
  // 18. Subtitle Search & Playback Handlers (Feature 3)
  // -------------------------------------------------------------------------

  ipcMain.handle('subtitles:search', async (_event, query: SubtitleSearchQuery) => {
    if (!query || typeof query.query !== 'string') {
      return { results: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }
    return subtitleService.searchSubtitles(query);
  });

  ipcMain.handle('subtitles:importFiles', async (_event, filePaths?: string[]) => {
    let targets = filePaths;
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Subtitle Files (SRT or VTT)',
        filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }],
        properties: ['openFile', 'multiSelections'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, indexedCount: 0 };
      }
      targets = result.filePaths;
    }

    const indexedCount = await subtitleService.importSubtitleFiles(targets);
    return { success: true, indexedCount };
  });

  ipcMain.handle('subtitles:importFolder', async (_event, folderPath?: string) => {
    let targetDir = folderPath;
    if (!targetDir || typeof targetDir !== 'string') {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Folder Containing Subtitles',
        properties: ['openDirectory'],
      });
      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, indexedCount: 0 };
      }
      targetDir = result.filePaths[0];
    }

    const indexedCount = await subtitleService.importSubtitleFolder(targetDir);
    return { success: true, indexedCount };
  });

  ipcMain.handle('subtitles:playAtTimestamp', async (_event, mediaPath: string, timestampSeconds: number) => {
    if (typeof mediaPath !== 'string' || typeof timestampSeconds !== 'number') {
      return { success: false, error: 'Invalid media path or timestamp' };
    }
    const settings = db.getSettings(defaultDownloadsDir);
    return subtitleService.playMediaAtTimestamp(mediaPath, timestampSeconds, settings.customMediaPlayerPath);
  });

  ipcMain.handle('subtitles:getPlayers', async () => {
    return subtitleService.getDetectedMediaPlayers();
  });

  // -------------------------------------------------------------------------
  // 19. Sizing & Metadata Estimates (Feature 4)
  // -------------------------------------------------------------------------

  ipcMain.handle(
    'media:estimateFormatSize',
    async (_event, format?: MediaFormat, duration?: number, isAudioOnly = false,
      audioFormat?: MediaFormat, targetContainer?: string, timeRange?: TimeRange) => {
      return SizeEstimator.estimateFormatSize(format, duration, Boolean(isAudioOnly),
        audioFormat, targetContainer, timeRange);
    }
  );

  ipcMain.handle(
    'media:estimatePlaylistSize',
    async (
      _event,
      items: Array<{ id: string; url: string; duration?: number; filesize?: number }>,
      qualityLabel?: string,
      formatId?: string,
      isAudioOnly = false
    ) => {
      if (!Array.isArray(items)) {
        return { totalBytes: 0, knownCount: 0, unknownCount: 0, totalCount: 0, isComplete: true };
      }
      return SizeEstimator.estimatePlaylistSize(items, qualityLabel, formatId, Boolean(isAudioOnly));
    }
  );

  ipcMain.handle('media:fetchPlaylistItemSizes', async (_event, _playlistUrl: string, itemUrls: string[]) => {
    if (!Array.isArray(itemUrls)) return {};
    return mediaEngine.fetchPlaylistItemSizes(itemUrls);
  });
}
