import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { DatabaseService } from './database';
import { DependencyResolver } from './media/dependency-resolver';
import { MediaEngine } from './media/media-engine';
import { DownloadQueue } from './queue/download-queue';
import { UpdateService } from './updater/update-service';
import { registerIpcHandlers } from './ipc';
import { ShutdownCoordinator } from './updater/shutdown-coordinator';
import { assertDataOutsideInstallDirectory } from './updater/update-data-guard';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService | null = null;
let queue: DownloadQueue | null = null;
let mediaEngine: MediaEngine | null = null;
let updateService: UpdateService | null = null;
let shutdown: ShutdownCoordinator | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function protectUpdateData(): void {
  if (!app.isPackaged || !db || !updateService) return;
  let ar = false;
  try {
    const settings = db.getSettings(app.getPath('downloads'));
    ar = settings.language === 'ar';
    const courses = db.getAllCourses();
    const locations = [app.getPath('userData'), settings.downloadDirectory,
      ...db.getHistory().map((entry) => entry.filePath),
      ...db.getAllJobs().map((job) => path.dirname(job.outputPath)),
      ...courses.flatMap((course) => [course.destinationFolder,
        ...db!.getCourseItems(course.id).map((item) => item.localFilePath || '')]),
    ].filter((location) => location && fs.existsSync(location)).map((location) => fs.realpathSync(location));
    assertDataOutsideInstallDirectory(fs.realpathSync(path.dirname(app.getPath('exe'))), locations);
    updateService.setInstallOnExitAllowed(true);
  } catch (error) {
    const message = ar
      ? 'تم تأجيل التحديث: توجد بيانات أو ملفات وسائط داخل مجلد تثبيت البرنامج. انقلها خارج هذا المجلد قبل تطبيق التحديث.'
      : (error as Error).message;
    updateService.setInstallOnExitAllowed(false, message);
    throw new Error(message);
  }
}

async function createWindow(
  db: DatabaseService,
  resolver: DependencyResolver,
  mediaEngine: MediaEngine,
  queue: DownloadQueue,
  defaultDownloadsDir: string,
  updateService: UpdateService
) {
  mainWindow = new BrowserWindow({
    title: 'Ddx Downloader',
    width: 1200,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    show: true,
    center: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, // Allows loading local Vite assets over file://
    },
  });

  mainWindow.on('close', (event) => {
    if (process.platform !== 'darwin' && shutdown && !shutdown.ready) {
      event.preventDefault();
      app.quit();
    }
  });

  // Register IPC Handlers BEFORE loading any URL/HTML
  registerIpcHandlers(
    mainWindow,
    db,
    mediaEngine,
    resolver,
    queue,
    defaultDownloadsDir,
    updateService
  );

  mainWindow.webContents.on('console-message', (event: any) => {
    console.log('[Renderer Console]', event?.message || event);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[MainWindow] Failed to load URL:', validatedURL, errorCode, errorDescription);
  });

  // Handle external link clicks securely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow navigating within app or localhost in dev
    if (url.startsWith('http://localhost:5173')) {
      return;
    }
    if (url.startsWith('file://')) {
      return;
    }
    event.preventDefault();
    shell.openExternal(url);
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  let loaded = false;

  if (isDev) {
    try {
      const response = await fetch(devServerUrl).catch(() => null);
      if (response && response.ok) {
        console.log('[Main] Connected to dev server:', devServerUrl);
        await mainWindow.loadURL(devServerUrl);
        loaded = true;
      }
    } catch {}
  }

  if (!loaded) {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('[Main] Loading local production bundle:', indexPath);
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.show();
  mainWindow.focus();
}

app.whenReady().then(async () => {
  try {
    const userDataPath = app.getPath('userData');
    const defaultDownloadsDir = app.getPath('downloads');

    // 1. Initialize SQLite Database
    db = new DatabaseService(userDataPath);
    await db.initialize();

    const settings = db.getSettings(defaultDownloadsDir);

    // 2. Initialize Dependency Resolver
    const resolver = new DependencyResolver(
      settings.customYtDlpPath,
      settings.customFfmpegPath
    );

    // 3. Initialize Media Engine
    mediaEngine = new MediaEngine(resolver);

    // 4. Initialize Download Queue
    queue = new DownloadQueue(db, mediaEngine, settings.maxConcurrentDownloads,
      () => db!.getSettings(defaultDownloadsDir).autoRetryTransient !== false);

    // 5. Initialize Update Service
    updateService = new UpdateService(isDev);
    shutdown = new ShutdownCoordinator({
      hasActiveWork: () => mediaEngine!.hasActiveWork(),
      confirmInterruption: async () => {
        const ar = db!.getSettings(defaultDownloadsDir).language === 'ar';
        const result = await dialog.showMessageBox({
          type: 'warning',
          title: ar ? 'يوجد عمل قيد التنفيذ' : 'Work is still running',
          message: ar ? 'الخروج أو إعادة التشغيل سيوقف التنزيلات والدمج والتحويلات الحالية.' : 'Exiting or restarting will interrupt active downloads, merging, and conversions.',
          detail: ar ? 'سيتم حفظ قائمة التنزيلات لإمكانية استئنافها. قد تحتاج إلى إعادة التحويل. يمكنك التأجيل.' : 'The download queue will be saved for resuming. Conversions may need to be restarted. You can postpone.',
          buttons: ar ? ['لاحقًا', 'إيقاف العمل والمتابعة'] : ['Later', 'Stop work and continue'],
          defaultId: 0, cancelId: 0, noLink: true,
        });
        return result.response === 1;
      },
      pauseQueue: () => queue!.prepareForShutdown(),
      stopProcesses: () => mediaEngine!.shutdown(),
      flushDatabase: () => db!.flushForShutdown(),
      recover: () => {
        if (!mediaEngine!.hasActiveWork()) {
          queue!.recoverFromShutdown();
          mediaEngine!.recoverFromShutdown();
        }
      },
    });
    updateService.setPrepareShutdown(() => { protectUpdateData(); return shutdown!.prepare(); });
    updateService.setAbortShutdown(() => shutdown!.reset());

    // 6. Create Window and Register IPC Handlers
    await createWindow(db, resolver, mediaEngine, queue, defaultDownloadsDir, updateService);

    // 7. Start Periodic Update Checks (every ~6 hours, non-blocking)
    updateService.startPeriodicChecks();
  } catch (err) {
    console.error('[Main] Failed to initialize application:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && db && mediaEngine && queue && updateService) {
      createWindow(db, new DependencyResolver(), mediaEngine, queue, app.getPath('downloads'), updateService);
    }
  });
});

app.on('window-all-closed', () => {
  if (updateService) {
    updateService.stopPeriodicChecks();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (updateService?.getState().status === 'downloaded') {
    try { protectUpdateData(); } catch { /* Safe exit is allowed; update installation is disabled. */ }
  }
  if (!shutdown || shutdown.ready) return;
  event.preventDefault();
  void shutdown.prepare().then((ready) => {
    if (ready) app.quit();
  }).catch((error) => {
    const ar = db?.getSettings(app.getPath('downloads')).language === 'ar';
    void dialog.showMessageBox({ type: 'error',
      title: ar ? 'تعذر الخروج بأمان' : 'Could not exit safely',
      message: ar ? 'تم تأجيل الخروج والتحديث. لم يتم حذف أي بيانات. حاول مرة أخرى.' : 'Exit and update postponed. No data was deleted. Please try again.',
    });
    console.error('[Shutdown] Preparation failed:', error);
  });
});
