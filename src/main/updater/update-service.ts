import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import { UpdateState, UpdateInfo, UpdateProgress } from '../../types';

export class UpdateService {
  private state: UpdateState;
  private isChecking = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private onStateChange?: (state: UpdateState) => void;
  private isDev: boolean;

  constructor(isDev = !app.isPackaged) {
    this.isDev = isDev;
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion() || '1.0.0',
      updateInfo: null,
      progress: null,
      error: null,
      lastChecked: null,
      isManualCheck: false,
    };

    this.configureUpdater();
  }

  public setOnStateChange(callback: (state: UpdateState) => void): void {
    this.onStateChange = callback;
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  private configureUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    // In dev mode, allow testing if DDX_TEST_UPDATES is set
    if (this.isDev && process.env.DDX_TEST_UPDATES === 'true') {
      autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.on('checking-for-update', () => {
      this.isChecking = true;
      this.updateState({
        status: 'checking',
        error: null,
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.isChecking = false;
      const releaseNotes = this.normalizeReleaseNotes(info.releaseNotes);

      const updateInfo: UpdateInfo = {
        version: info.version,
        releaseName: info.releaseName || `Release v${info.version}`,
        releaseNotes,
        releaseDate: info.releaseDate,
      };

      this.updateState({
        status: 'available',
        updateInfo,
        lastChecked: new Date().toISOString(),
        error: null,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.isChecking = false;
      this.updateState({
        status: 'not-available',
        updateInfo: null,
        lastChecked: new Date().toISOString(),
        error: null,
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const progress: UpdateProgress = {
        bytesPerSecond: progressObj.bytesPerSecond,
        percent: Math.min(progressObj.percent, 99.9),
        total: progressObj.total,
        transferred: progressObj.transferred,
      };

      this.updateState({
        status: 'downloading',
        progress,
        error: null,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.updateState({
        status: 'downloaded',
        progress: {
          bytesPerSecond: 0,
          percent: 100,
          total: this.state.progress?.total || 0,
          transferred: this.state.progress?.total || 0,
        },
        error: null,
      });
    });

    autoUpdater.on('error', (err) => {
      this.isChecking = false;
      const errorMsg = this.sanitizeErrorMessage(err?.message || 'Unknown update error');
      this.updateState({
        status: 'error',
        error: errorMsg,
        lastChecked: new Date().toISOString(),
      });
    });
  }

  /**
   * Initializes periodic update checks (every ~6 hours) and scheduled initial check
   */
  public startPeriodicChecks(): void {
    if (this.isDev && process.env.DDX_TEST_UPDATES !== 'true') {
      console.log('[UpdateService] Update checks disabled in development mode.');
      return;
    }

    // Initial non-blocking check after 10 seconds
    setTimeout(() => {
      this.checkForUpdates(false).catch((err) => {
        console.warn('[UpdateService] Initial update check failed:', err.message);
      });
    }, 10000);

    // Periodic check every 6 hours
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    this.checkInterval = setInterval(() => {
      this.checkForUpdates(false).catch((err) => {
        console.warn('[UpdateService] Periodic update check failed:', err.message);
      });
    }, SIX_HOURS);
  }

  public stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Checks for available updates. Prevents simultaneous or duplicate checks.
   */
  public async checkForUpdates(isManual = false): Promise<{ success: boolean; error?: string }> {
    if (this.isChecking || this.state.status === 'downloading') {
      return { success: false, error: 'An update check or download is already in progress.' };
    }

    this.state.isManualCheck = isManual;

    if (this.isDev && process.env.DDX_TEST_UPDATES !== 'true') {
      if (isManual) {
        this.updateState({
          status: 'not-available',
          lastChecked: new Date().toISOString(),
          error: null,
        });
        return { success: true };
      }
      return { success: false, error: 'Update checks are skipped in development.' };
    }

    try {
      this.isChecking = true;
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err: any) {
      this.isChecking = false;
      const cleanError = this.sanitizeErrorMessage(err.message);
      this.updateState({
        status: 'error',
        error: cleanError,
        lastChecked: new Date().toISOString(),
      });
      return { success: false, error: cleanError };
    }
  }

  /**
   * Downloads the available update
   */
  public async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    if (this.state.status !== 'available') {
      return { success: false, error: 'No update is available to download.' };
    }

    try {
      this.updateState({
        status: 'downloading',
        progress: { bytesPerSecond: 0, percent: 0, total: 0, transferred: 0 },
        error: null,
      });

      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err: any) {
      const cleanError = this.sanitizeErrorMessage(err.message);
      this.updateState({
        status: 'error',
        error: cleanError,
      });
      return { success: false, error: cleanError };
    }
  }

  /**
   * Installs the downloaded update upon explicit user action
   */
  public installUpdate(): { success: boolean; error?: string } {
    if (this.state.status !== 'downloaded') {
      return { success: false, error: 'Update must be fully downloaded before installing.' };
    }

    try {
      // Calls quitAndInstall(isSilent = false, isForceRunAfter = true)
      autoUpdater.quitAndInstall(false, true);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  private updateState(partial: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  private normalizeReleaseNotes(rawNotes: any): string {
    if (!rawNotes) return '';
    if (typeof rawNotes === 'string') return rawNotes;
    if (Array.isArray(rawNotes)) {
      return rawNotes
        .map((n) => (typeof n === 'string' ? n : n.note || ''))
        .filter(Boolean)
        .join('\n\n');
    }
    return '';
  }

  private sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'An error occurred during update check.';
    if (msg.includes('net::ERR_INTERNET_DISCONNECTED') || msg.includes('ENOTFOUND')) {
      return 'Network connection unavailable. Please check your internet connection.';
    }
    if (msg.includes('404')) {
      return 'No published releases found on GitHub yet.';
    }
    if (msg.includes('rate limit')) {
      return 'GitHub API rate limit reached. Please try again later.';
    }
    return msg.replace(/token=[^&]+/gi, 'token=***');
  }
}
