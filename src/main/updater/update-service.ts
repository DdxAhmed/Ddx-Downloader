import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { UpdateState, UpdateInfo } from '../../types';
import { createUpdaterLogger, redactUpdaterMessage } from './updater-logger';

export class UpdateService {
  private state: UpdateState;
  private isChecking = false;
  private isDownloading = false;
  private isInstalling = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private initialCheck: NodeJS.Timeout | null = null;
  private onStateChange?: (state: UpdateState) => void;
  private prepareShutdown: () => Promise<boolean> = async () => true;
  private abortShutdown: () => void = () => {};
  private logger = createUpdaterLogger(path.join(app.getPath('userData'), 'logs'));

  constructor(private isDev = !app.isPackaged) {
    this.state = { status: 'idle', currentVersion: app.getVersion(), updateInfo: null,
      progress: null, error: null, lastChecked: null, isManualCheck: false, installOnExit: true };
    autoUpdater.logger = this.logger;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableDifferentialDownload = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.allowDowngrade = false;
    if (isDev && process.env.DDX_TEST_UPDATES === 'true') autoUpdater.forceDevUpdateConfig = true;
    this.logger.info(`Updater initialized; installed=${this.state.currentVersion}; NSIS differential enabled`);

    autoUpdater.on('checking-for-update', () => {
      this.logger.info(`Retrieving update metadata; installed=${this.state.currentVersion}`);
      this.updateState({ status: 'checking', error: null });
    });
    autoUpdater.on('update-available', (info) => {
      const updateInfo: UpdateInfo = { version: info.version, releaseName: info.releaseName || `v${info.version}`,
        releaseNotes: this.normalizeReleaseNotes(info.releaseNotes), releaseDate: info.releaseDate };
      this.logger.info(`Metadata retrieved; installed=${this.state.currentVersion}; target=${info.version}; files=${JSON.stringify(info.files)}`);
      this.updateState({ status: 'available', updateInfo, progress: null,
        lastChecked: new Date().toISOString(), error: null });
    });
    autoUpdater.on('update-not-available', () => {
      this.updateState({ status: 'not-available', updateInfo: null, lastChecked: new Date().toISOString(), error: null });
    });
    autoUpdater.on('download-progress', (progress) => {
      // SDK download bytes, not installer size or total network traffic.
      this.updateState({ status: 'downloading', progress: {
        bytesPerSecond: progress.bytesPerSecond, percent: Math.min(progress.percent, 99.9),
        total: progress.total, transferred: progress.transferred,
      }, error: null });
    });
    autoUpdater.on('update-downloaded', (info) => {
      this.logger.info(`Downloaded and verified; installed=${this.state.currentVersion}; target=${info.version}; SDK progress=${JSON.stringify(this.state.progress)}. Not installed yet.`);
      this.updateState({ status: 'downloaded', updateInfo: { ...this.state.updateInfo, version: info.version },
        progress: this.state.progress ? { ...this.state.progress, percent: 100, bytesPerSecond: 0 } : null, error: null });
    });
    autoUpdater.on('error', (error) => this.reportError(error));
  }

  public setOnStateChange(callback: (state: UpdateState) => void): void { this.onStateChange = callback; }
  public setPrepareShutdown(callback: () => Promise<boolean>): void { this.prepareShutdown = callback; }
  public setAbortShutdown(callback: () => void): void { this.abortShutdown = callback; }
  public setInstallOnExitAllowed(allowed: boolean, error?: string): void {
    autoUpdater.autoInstallOnAppQuit = allowed;
    if (this.state.installOnExit === allowed && (!error || error === this.state.error)) return;
    if (!allowed) this.logger.warn(error || 'Install on exit deferred to preserve user data.');
    this.updateState({ installOnExit: allowed, error: error || null });
  }
  public getState(): UpdateState { return { ...this.state }; }

  public startPeriodicChecks(): void {
    if ((this.isDev && process.env.DDX_TEST_UPDATES !== 'true') || this.checkInterval) return;
    this.initialCheck = setTimeout(() => { this.initialCheck = null; void this.checkForUpdates(); }, 10000);
    this.checkInterval = setInterval(() => { void this.checkForUpdates(); }, 6 * 60 * 60 * 1000);
  }
  public stopPeriodicChecks(): void {
    if (this.initialCheck) clearTimeout(this.initialCheck);
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.initialCheck = this.checkInterval = null;
  }

  public async checkForUpdates(isManual = false): Promise<{ success: boolean; error?: string }> {
    if (this.isChecking || this.isDownloading || this.isInstalling || this.state.status === 'installing') {
      return { success: false, error: 'An update check or download is already in progress.' };
    }
    if (this.state.status === 'downloaded') {
      if (isManual) this.updateState({ isManualCheck: true });
      return { success: true };
    }
    this.state.isManualCheck = isManual;
    if (this.isDev && process.env.DDX_TEST_UPDATES !== 'true') {
      if (!isManual) return { success: false, error: 'Update checks are skipped in development.' };
      this.updateState({ status: 'not-available', lastChecked: new Date().toISOString(), error: null });
      return { success: true };
    }
    this.isChecking = true;
    this.updateState({ status: 'checking', error: null });
    try { await autoUpdater.checkForUpdates(); return { success: true }; }
    catch (error) { return this.reportError(error); }
    finally {
      this.isChecking = false;
      // Scheduled checks are intentionally quiet and begin the verified SDK
      // download in the background. Manual checks leave download timing to the user.
      if (!isManual && this.state.status === 'available') {
        queueMicrotask(() => { void this.downloadUpdate(); });
      }
    }
  }

  public async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    if (this.isChecking || this.isDownloading || this.isInstalling ||
      !this.state.updateInfo || !['available', 'error'].includes(this.state.status)) {
      return { success: false, error: 'No update is available to download, or an operation is already in progress.' };
    }
    this.isDownloading = true;
    this.logger.info(`Download requested; installed=${this.state.currentVersion}; target=${this.state.updateInfo.version}. SDK attempts differential where possible; its logs record actual fallback reasons.`);
    this.updateState({ status: 'downloading', progress: { bytesPerSecond: 0, percent: 0, total: 0, transferred: 0 }, error: null });
    try { await autoUpdater.downloadUpdate(); return { success: true }; }
    catch (error) { return this.reportError(error); }
    finally { this.isDownloading = false; }
  }

  public async installUpdate(): Promise<{ success: boolean; error?: string; postponed?: boolean }> {
    if (this.state.status !== 'downloaded' || this.isInstalling) {
      return { success: false, error: 'Update must be fully downloaded before installing.' };
    }
    this.isInstalling = true;
    try {
      if (!await this.prepareShutdown()) return { success: false, postponed: true };
      this.stopPeriodicChecks();
      this.updateState({ status: 'installing', error: null });
      this.logger.info(`Applying target=${this.state.updateInfo?.version}; silent=true; restart=true`);
      autoUpdater.quitAndInstall(true, true);
      return { success: this.getState().status === 'installing', error: this.state.error || undefined };
    } catch (error) {
      this.abortShutdown();
      const clean = this.sanitizeErrorMessage(error);
      this.logger.error(error);
      this.updateState({ status: 'downloaded', error: clean });
      return { success: false, error: clean };
    } finally { this.isInstalling = false; }
  }

  private reportError(error: unknown): { success: false; error: string } {
    if (this.state.status === 'installing') this.abortShutdown();
    const clean = this.sanitizeErrorMessage(error);
    this.logger.error(error);
    this.updateState({ status: this.state.status === 'downloaded' || this.state.status === 'installing' ? 'downloaded' : 'error',
      error: clean, lastChecked: new Date().toISOString() });
    return { success: false, error: clean };
  }
  private updateState(partial: Partial<UpdateState>): void {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.getState());
  }
  private normalizeReleaseNotes(notes: unknown): string {
    if (typeof notes === 'string') return notes;
    if (Array.isArray(notes)) return notes.map((n) => typeof n === 'string' ? n : n.note || '').filter(Boolean).join('\n\n');
    return '';
  }
  private sanitizeErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/ERR_INTERNET_DISCONNECTED|ENOTFOUND/.test(message)) return 'Network connection unavailable. Please check your internet connection.';
    return redactUpdaterMessage(message);
  }
}
