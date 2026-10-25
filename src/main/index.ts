import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { DatabaseService } from './database';
import { DependencyResolver } from './media/dependency-resolver';
import { MediaEngine } from './media/media-engine';
import { DownloadQueue } from './queue/download-queue';
import { UpdateService } from './updater/update-service';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: DatabaseService | null = null;
let queue: DownloadQueue | null = null;
let mediaEngine: MediaEngine | null = null;
let updateService: UpdateService | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

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
    queue = new DownloadQueue(db, mediaEngine, settings.maxConcurrentDownloads);

    // 5. Initialize Update Service
    updateService = new UpdateService(isDev);

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
