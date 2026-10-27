import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { UpdateState } from '../types';

// Mock electron-updater autoUpdater and electron ipcMain
const { mockAutoUpdater, registeredIpcHandlers } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');
  const emitter = new EventEmitter() as any;
  emitter.autoDownload = true;
  emitter.autoInstallOnAppQuit = true;
  emitter.checkForUpdates = vi.fn();
  emitter.downloadUpdate = vi.fn();
  emitter.quitAndInstall = vi.fn();

  const handlers = new Map<string, Function>();
  return { mockAutoUpdater: emitter, registeredIpcHandlers: handlers };
});

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn(() => '1.0.0'),
    getPath: vi.fn(() => 'C:\\Users\\Mock\\AppData'),
    isPackaged: true,
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => {
      registeredIpcHandlers.set(channel, handler);
    }),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
    openExternal: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));
vi.mock('../main/updater/updater-logger', async (importOriginal) => ({
  ...await importOriginal<typeof import('../main/updater/updater-logger')>(),
  createUpdaterLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Import UpdateService and IPC register after mocking
import { UpdateService } from '../main/updater/update-service';
import { registerIpcHandlers } from '../main/ipc';


describe('UpdateService & Automatic Update Workflow', () => {
  let updater: UpdateService;
  let stateChanges: UpdateState[] = [];
  afterEach(() => { updater.stopPeriodicChecks(); vi.useRealTimers(); });

  beforeEach(() => {
    vi.resetAllMocks();
    mockAutoUpdater.removeAllListeners();
    stateChanges = [];

    // Initialize with isDev = false (production simulation)
    updater = new UpdateService(false);
    updater.setOnStateChange((s) => stateChanges.push(s));
  });

  it('initializes with idle state and current application version', () => {
    const state = updater.getState();
    expect(state.status).toBe('idle');
    expect(state.currentVersion).toBe('1.0.0');
    expect(state.updateInfo).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.error).toBeNull();
  });

  it('prevents simultaneous or duplicate update checks', async () => {
    mockAutoUpdater.checkForUpdates.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 50))
    );

    // Trigger first check
    const check1 = updater.checkForUpdates(true);
    // Trigger duplicate check while first is running
    const check2 = await updater.checkForUpdates(true);

    expect(check2.success).toBe(false);
    expect(check2.error).toContain('already in progress');

    await check1;
  });

  it('handles update-available events and parses release notes', async () => {
    mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
      mockAutoUpdater.emit('update-available', {
        version: '1.1.0',
        releaseName: 'v1.1.0 Feature Release',
        releaseNotes: [
          { version: '1.1.0', note: 'Added automatic update support' },
          { version: '1.1.0', note: 'Performance improvements' },
        ],
        releaseDate: '2026-10-25T12:00:00Z',
      });
    });

    await updater.checkForUpdates(true);
    const state = updater.getState();

    expect(state.status).toBe('available');
    expect(state.updateInfo?.version).toBe('1.1.0');
    expect(state.updateInfo?.releaseNotes).toContain('Added automatic update support');
    expect(state.updateInfo?.releaseNotes).toContain('Performance improvements');
    expect(state.lastChecked).toBeDefined();
  });

  it('downloads automatically after a scheduled check but not after a manual check', async () => {
    mockAutoUpdater.downloadUpdate.mockResolvedValue([]);
    mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
      mockAutoUpdater.emit('update-available', { version: '1.1.0', releaseNotes: 'Safe update' });
    });

    await updater.checkForUpdates(false);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);

    mockAutoUpdater.downloadUpdate.mockClear();
    mockAutoUpdater.emit('update-not-available', { version: '1.0.0' });
    await updater.checkForUpdates(true);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it('handles update-not-available events for latest version', async () => {
    mockAutoUpdater.checkForUpdates.mockImplementation(async () => {
      mockAutoUpdater.emit('update-not-available', { version: '1.0.0' });
    });

    const res = await updater.checkForUpdates(true);
    expect(res.success).toBe(true);

    const state = updater.getState();
    expect(state.status).toBe('not-available');
    expect(state.updateInfo).toBeNull();
    expect(state.lastChecked).toBeDefined();
  });

  it('tracks download progress accurately', async () => {
    // Set state to available first
    mockAutoUpdater.emit('update-available', { version: '1.1.0' });

    mockAutoUpdater.downloadUpdate.mockImplementation(async () => {
      mockAutoUpdater.emit('download-progress', {
        percent: 45.6,
        bytesPerSecond: 2097152, // 2 MB/s
        transferred: 22817013,
        total: 50000000,
      });
    });

    await updater.downloadUpdate();
    const state = updater.getState();

    expect(state.status).toBe('downloading');
    expect(state.progress?.percent).toBe(45.6);
    expect(state.progress?.bytesPerSecond).toBe(2097152);
    expect(state.progress?.total).toBe(50000000);
  });

  it('handles update-downloaded completion state', () => {
    mockAutoUpdater.emit('update-available', { version: '1.1.0' });
    mockAutoUpdater.emit('download-progress', {
      percent: 50,
      bytesPerSecond: 1000,
      transferred: 5000,
      total: 10000,
    });

    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });
    const state = updater.getState();

    expect(state.status).toBe('downloaded');
    expect(state.progress?.percent).toBe(100);
    expect(state.error).toBeNull();
  });

  it('safely rejects restart-and-install if update is not downloaded', async () => {
    // Current status is idle
    const res = await updater.installUpdate();
    expect(res.success).toBe(false);
    expect(res.error).toContain('fully downloaded');
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('calls quitAndInstall only when update is fully downloaded upon explicit request', async () => {
    // Transition to downloaded state
    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });

    const res = await updater.installUpdate();
    expect(res.success).toBe(true);
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it('sanitizes and handles update check errors without crashing', async () => {
    mockAutoUpdater.checkForUpdates.mockRejectedValue(
      new Error('net::ERR_INTERNET_DISCONNECTED https://github.com/DdxAhmed/Ddx-Downloader?token=secret123')
    );

    const res = await updater.checkForUpdates(true);
    expect(res.success).toBe(false);

    const state = updater.getState();
    expect(state.status).toBe('error');
    expect(state.error).toContain('Network connection unavailable');
    expect(state.error).not.toContain('secret123'); // Token redacted
  });

  it('skips production update checks in development mode unless DDX_TEST_UPDATES=true', async () => {
    const devUpdater = new UpdateService(true);

    // Automatic check in dev mode returns false
    const autoCheck = await devUpdater.checkForUpdates(false);
    expect(autoCheck.success).toBe(false);

    // Manual check in dev mode gracefully reports not-available
    const manualCheck = await devUpdater.checkForUpdates(true);
    expect(manualCheck.success).toBe(true);
    expect(devUpdater.getState().status).toBe('not-available');
  });

  it('starts and stops periodic checks interval cleanly', () => {
    updater.startPeriodicChecks();
    expect((updater as any).checkInterval).toBeDefined();

    updater.stopPeriodicChecks();
    expect((updater as any).checkInterval).toBeNull();
  });

  it('enables differential updates and silent install on exit', () => {
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(mockAutoUpdater.disableDifferentialDownload).toBe(false);
    expect(mockAutoUpdater.autoDownload).toBe(false);
  });
  it('can defer exit installation to protect data while keeping the downloaded update', () => {
    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });
    updater.setInstallOnExitAllowed(false, 'Data is inside the installation folder');
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(false);
    expect(updater.getState()).toMatchObject({ status: 'downloaded', installOnExit: false });
    updater.setInstallOnExitAllowed(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(updater.getState().error).toBeNull();
  });

  it('keeps a downloaded update across manual checks', async () => {
    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });
    await updater.checkForUpdates(true);
    expect(updater.getState().status).toBe('downloaded');
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect((await updater.downloadUpdate()).success).toBe(false);
    expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.getState().currentVersion).toBe('1.0.0');
  });

  it('locks downloads even if an SDK error precedes promise settlement', async () => {
    let finish!: () => void;
    mockAutoUpdater.downloadUpdate.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    mockAutoUpdater.emit('update-available', { version: '1.1.0' });
    const first = updater.downloadUpdate();
    mockAutoUpdater.emit('error', new Error('Temporary failure'));
    expect((await updater.downloadUpdate()).success).toBe(false);
    expect((await updater.checkForUpdates()).success).toBe(false);
    finish(); await first;
    expect(mockAutoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
  });

  it('waits for shutdown preparation and supports postponing', async () => {
    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });
    updater.setPrepareShutdown(async () => false);
    expect((await updater.installUpdate()).postponed).toBe(true);
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(updater.getState().status).toBe('downloaded');
    let finish!: (ready: boolean) => void;
    updater.setPrepareShutdown(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const first = updater.installUpdate();
    expect((await updater.installUpdate()).success).toBe(false);
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
    finish(true); await first;
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
  });

  it('does not install after persistence failure', async () => {
    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });
    updater.setPrepareShutdown(async () => { throw new Error('Could not flush database'); });
    expect((await updater.installUpdate()).success).toBe(false);
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
    expect(updater.getState().status).toBe('downloaded');
  });

  it('does not fabricate transferred bytes at completion', () => {
    mockAutoUpdater.emit('download-progress', { percent: 99, total: 10000, transferred: 9000, bytesPerSecond: 100 });
    mockAutoUpdater.emit('update-downloaded', { version: '1.1.0' });
    expect(updater.getState().progress?.transferred).toBe(9000);
  });

  it('clears initial and periodic checks and does not schedule twice', () => {
    vi.useFakeTimers();
    updater.startPeriodicChecks(); updater.startPeriodicChecks();
    expect(vi.getTimerCount()).toBe(2);
    updater.stopPeriodicChecks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('validates IPC handlers for updater channels safely', async () => {
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send: vi.fn() },
    } as any;
    const mockDb = { getSettings: vi.fn() } as any;
    const mockMediaEngine = {} as any;
    const mockResolver = {} as any;
    const mockQueue = { setCallbacks: vi.fn() } as any;

    registerIpcHandlers(mockWindow, mockDb, mockMediaEngine, mockResolver, mockQueue, 'C:\\Downloads', updater);

    expect(registeredIpcHandlers.has('updater:check')).toBe(true);
    expect(registeredIpcHandlers.has('updater:download')).toBe(true);
    expect(registeredIpcHandlers.has('updater:install')).toBe(true);
    expect(registeredIpcHandlers.has('updater:getState')).toBe(true);

    // Call updater:check via IPC handler with valid input
    const checkHandler = registeredIpcHandlers.get('updater:check')!;
    const checkResult = await checkHandler({}, true);
    expect(checkResult).toBeDefined();

    // Call updater:getState via IPC handler
    const getStateHandler = registeredIpcHandlers.get('updater:getState')!;
    const stateResult = await getStateHandler({});
    expect(stateResult.currentVersion).toBe('1.0.0');

    // Test with missing updateService
    registeredIpcHandlers.clear();
    registerIpcHandlers(mockWindow, mockDb, mockMediaEngine, mockResolver, mockQueue, 'C:\\Downloads', undefined);
    const uninitializedCheck = await registeredIpcHandlers.get('updater:check')!({}, true);
    expect(uninitializedCheck.success).toBe(false);
    expect(uninitializedCheck.error).toContain('not initialized');

    const uninitializedState = await registeredIpcHandlers.get('updater:getState')!({});
    expect(uninitializedState.error).toContain('unavailable');
  });
});

