import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast, ToastMessage } from './components/Toast';
import { UpdateModal } from './components/UpdateModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { HomeView } from './views/HomeView';
import { DownloadsView } from './views/DownloadsView';
import { PlaylistsView } from './views/PlaylistsView';
import { ConverterView } from './views/ConverterView';
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import { MiniModeView } from './views/MiniModeView';
import {
  DownloadJob,
  DownloadHistoryEntry,
  AppSettings,
  DependencyStatus,
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  UpdateState,
} from '../types';
import { SupportedLanguage, getTranslation } from './i18n';

const defaultSettings: AppSettings = {
  downloadDirectory: '',
  preferredQuality: 'best',
  preferredContainer: 'mp4',
  defaultAudioFormat: 'mp3',
  maxConcurrentDownloads: 3,
  theme: 'dark',
  language: 'en',
  embedSubtitles: true,
  downloadSubtitles: true,
  autoRetryTransient: true,
  notificationsEnabled: true,
  downloadSpeedLimit: 'unlimited',
  duplicateConflictPolicy: 'prompt',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [queue, setQueue] = useState<DownloadJob[]>([]);
  const [history, setHistory] = useState<DownloadHistoryEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [dependencies, setDependencies] = useState<DependencyStatus | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '1.0.0',
    updateInfo: null,
    progress: null,
    error: null,
    lastChecked: null,
  });
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isMiniMode, setIsMiniMode] = useState(window.location.hash === '#mini');

  const lang: SupportedLanguage = (settings.language === 'ar' ? 'ar' : 'en');
  const theme: 'dark' | 'light' = (settings.theme === 'light' ? 'light' : 'dark');

  // Synchronize document direction (RTL/LTR) and theme class
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [lang, theme]);

  // Monitor hash changes for mini mode
  useEffect(() => {
    const handleHash = () => {
      setIsMiniMode(window.location.hash === '#mini');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        if (!window.electronAPI) return;

        const [initialQueue, initialHistory, initialSettings, initialDeps, initialUpdate] =
          await Promise.all([
            window.electronAPI.getQueue(),
            window.electronAPI.getHistory(),
            window.electronAPI.getSettings(),
            window.electronAPI.checkDependencies(),
            window.electronAPI.getUpdateState(),
          ]);

        setQueue(initialQueue || []);
        setHistory(initialHistory || []);
        if (initialSettings) setSettings(initialSettings);
        if (initialDeps) setDependencies(initialDeps);
        if (initialUpdate) {
          setUpdateState(initialUpdate);
          if (initialUpdate.status === 'available') {
            setShowUpdateModal(true);
          }
        }
      } catch (err) {
        console.error('Failed to load initial data from Electron API:', err);
      }
    };

    init();

    if (window.electronAPI) {
      const unsubProgress = window.electronAPI.onDownloadProgress((updatedJob) => {
        setQueue((prev) => {
          const index = prev.findIndex((j) => j.id === updatedJob.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedJob;
            return next;
          }
          return [updatedJob, ...prev];
        });

        // If completed, refresh history
        if (updatedJob.status === 'completed') {
          window.electronAPI.getHistory().then((h) => setHistory(h || []));
          addToast(
            lang === 'ar'
              ? `اكتمل التنزيل بنجاح: "${updatedJob.mediaTitle}"`
              : `Download completed: "${updatedJob.mediaTitle}"`,
            'success'
          );
        } else if (updatedJob.status === 'failed' && updatedJob.errorMessage) {
          addToast(
            lang === 'ar'
              ? `تعذر التنزيل: "${updatedJob.mediaTitle}"`
              : `Download failed: "${updatedJob.mediaTitle}"`,
            'error'
          );
        }
      });

      const unsubQueue = window.electronAPI.onQueueUpdated((updatedQueue) => {
        setQueue(updatedQueue);
      });

      const unsubDeps = window.electronAPI.onDependencyStatusChanged((status) => {
        setDependencies(status);
      });

      const unsubUpdater = window.electronAPI.onUpdateStateChanged((state) => {
        setUpdateState(state);
        if (state.status === 'available') {
          setShowUpdateModal(true);
        } else if (state.status === 'not-available' && state.isManualCheck) {
          addToast(
            lang === 'ar'
              ? 'أنت تستخدم أحدث إصدار من Ddx Downloader.'
              : 'You are running the latest version of Ddx Downloader.',
            'info'
          );
        } else if (state.status === 'downloaded') {
          setShowUpdateModal(true);
          addToast(
            lang === 'ar'
              ? 'تم تنزيل التحديث! جاهز لإعادة التشغيل والتثبيت.'
              : 'Update downloaded! Ready to restart and install.',
            'success'
          );
        } else if (state.status === 'error' && state.isManualCheck) {
          addToast(state.error || 'Failed to check for updates.', 'error');
        }
      });

      return () => {
        unsubProgress();
        unsubQueue();
        unsubDeps();
        unsubUpdater();
      };
    }
  }, [lang]);

  const handleStartDownload = async (req: CreateDownloadRequest): Promise<boolean> => {
    if (!window.electronAPI) return false;
    try {
      const res = await window.electronAPI.startDownload(req);
      if (res.success) {
        const updatedQueue = await window.electronAPI.getQueue();
        setQueue(updatedQueue);
        return true;
      } else {
        addToast(res.error || 'Failed to queue download', 'error');
        return false;
      }
    } catch (err: any) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const handleStartPlaylistDownload = async (
    req: PlaylistBatchDownloadRequest
  ): Promise<boolean> => {
    if (!window.electronAPI) return false;
    try {
      const res = await window.electronAPI.startPlaylistDownload(req);
      if (res.success) {
        const updatedQueue = await window.electronAPI.getQueue();
        setQueue(updatedQueue);
        setActiveTab('downloads');
        return true;
      } else {
        addToast(res.error || 'Failed to queue playlist batch', 'error');
        return false;
      }
    } catch (err: any) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const handlePauseJob = async (id: string): Promise<boolean> => {
    if (!window.electronAPI?.pauseDownload) return false;
    const res = await window.electronAPI.pauseDownload(id);
    if (res.success) {
      addToast(lang === 'ar' ? 'تم إيقاف التنزيل مؤقتاً.' : 'Download paused.', 'info');
      const updatedQueue = await window.electronAPI.getQueue();
      setQueue(updatedQueue);
      return true;
    }
    return false;
  };

  const handleResumeJob = async (id: string): Promise<boolean> => {
    if (!window.electronAPI?.resumeDownload) return false;
    const res = await window.electronAPI.resumeDownload(id);
    if (res.success) {
      addToast(lang === 'ar' ? 'تم استئناف التنزيل.' : 'Download resumed.', 'info');
      const updatedQueue = await window.electronAPI.getQueue();
      setQueue(updatedQueue);
      return true;
    }
    return false;
  };

  const handleCancelJob = async (id: string): Promise<boolean> => {
    if (!window.electronAPI) return false;
    const res = await window.electronAPI.cancelDownload(id);
    if (res.success) {
      addToast(lang === 'ar' ? 'تم إلغاء التنزيل.' : 'Download cancelled.', 'info');
      return true;
    }
    return false;
  };

  const handleRetryJob = async (id: string): Promise<boolean> => {
    if (!window.electronAPI) return false;
    const res = await window.electronAPI.retryDownload(id);
    if (res.success) {
      addToast(lang === 'ar' ? 'أُعيد وضع التنزيل في قائمة الانتظار.' : 'Re-queued download.', 'info');
      return true;
    }
    return false;
  };

  const handleRetryAllFailed = async () => {
    if (!window.electronAPI?.retryAllFailed) return;
    const res = await window.electronAPI.retryAllFailed();
    if (res.success) {
      addToast(
        lang === 'ar'
          ? `أعيد وضع ${res.requeuedCount} تنزيل فاشل في الانتظار.`
          : `Re-queued ${res.requeuedCount} failed downloads.`,
        'info'
      );
    }
  };

  const handleClearCompleted = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.clearCompletedQueue();
    const updated = await window.electronAPI.getQueue();
    setQueue(updated);
    addToast(
      lang === 'ar'
        ? 'تم مسح العناصر المكتملة من القائمة.'
        : 'Cleared completed items from queue.',
      'info'
    );
  };

  const handleOpenFile = async (filePath: string) => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.openFile(filePath);
    if (!res.success && res.error) {
      addToast(res.error, 'error');
    }
  };

  const handleOpenFolder = async (filePath?: string) => {
    if (!window.electronAPI) return;
    const target = filePath || settings.downloadDirectory;
    const res = await window.electronAPI.openFolder(target);
    if (!res.success && res.error) {
      addToast(res.error, 'error');
    }
  };

  const handleDeleteHistoryEntry = async (id: string, deleteFile: boolean) => {
    if (!window.electronAPI) return;
    await window.electronAPI.deleteHistoryEntry(id, deleteFile);
    const updated = await window.electronAPI.getHistory();
    setHistory(updated);
  };

  const handleClearHistory = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.clearHistory();
    setHistory([]);
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    if (!window.electronAPI) return;
    const res = await window.electronAPI.updateSettings(newSettings);
    if (res.success && res.settings) {
      setSettings(res.settings);
    }
  };

  const handleToggleLanguage = async () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    await handleUpdateSettings({ language: nextLang });
    addToast(nextLang === 'ar' ? 'تم تحويل الواجهة إلى العربية' : 'Switched interface to English', 'info');
  };

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    await handleUpdateSettings({ theme: nextTheme });
    addToast(
      lang === 'ar'
        ? (nextTheme === 'light' ? 'تم التبديل إلى المظهر الفاتح (Light Mode)' : 'تم التبديل إلى المظهر الداكن (Dark Mode)')
        : (nextTheme === 'light' ? 'Switched to Light Mode' : 'Switched to Dark Mode'),
      'info'
    );
  };

  const handleToggleMiniMode = async (enable?: boolean) => {
    const targetState = typeof enable === 'boolean' ? enable : !isMiniMode;
    setIsMiniMode(targetState);
    if (window.electronAPI?.toggleMiniMode) {
      await window.electronAPI.toggleMiniMode(targetState);
    } else {
      window.location.hash = targetState ? '#mini' : '';
    }
  };

  const handleSelectDirectory = async () => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.selectDirectory();
    if (res.success && res.path) {
      await handleUpdateSettings({ downloadDirectory: res.path });
      addToast(
        lang === 'ar' ? `تم تحديث مجلد الحفظ: ${res.path}` : `Updated download folder: ${res.path}`,
        'success'
      );
    }
  };

  const handleRefreshDeps = async () => {
    if (!window.electronAPI) return;
    addToast(
      lang === 'ar' ? 'جاري التحقق من محركات الوسائط...' : 'Verifying media dependencies...',
      'info'
    );
    const status = await window.electronAPI.checkDependencies();
    setDependencies(status);
    if (status.ytDlp.available && status.ffmpeg.available) {
      addToast(
        lang === 'ar'
          ? 'المحرك جاهز! yt-dlp و FFmpeg يعملان بكفاءة.'
          : 'Engine verified! yt-dlp and FFmpeg are operational.',
        'success'
      );
    } else {
      addToast(
        lang === 'ar'
          ? 'أحد محركات الوسائط مفقود أو غير مثبت.'
          : 'One or more media engine dependencies are missing.',
        'error'
      );
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.electronAPI) return;
    addToast(
      lang === 'ar' ? 'جاري التحقق من وجود تحديثات...' : 'Checking for updates...',
      'info'
    );
    await window.electronAPI.checkForUpdates(true);
  };

  const handleDownloadUpdate = async () => {
    if (!window.electronAPI) return;
    addToast(
      lang === 'ar' ? 'جاري تنزيل التحديث في الخلفية...' : 'Downloading update...',
      'info'
    );
    await window.electronAPI.downloadUpdate();
  };

  const handleInstallUpdate = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.installUpdate();
  };

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

      // Shortcuts Guide toggle (?)
      if (!isInput && e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      // Close modals on Escape
      if (e.key === 'Escape') {
        setShowShortcutsModal(false);
        setShowUpdateModal(false);
        return;
      }

      // Ctrl + 1..7 for Tabs
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('home');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('downloads');
        } else if (e.key === '3') {
          e.preventDefault();
          setActiveTab('playlists');
        } else if (e.key === '4') {
          e.preventDefault();
          setActiveTab('converter');
        } else if (e.key === '5') {
          e.preventDefault();
          setActiveTab('library');
        } else if (e.key === '6') {
          e.preventDefault();
          setActiveTab('history');
        } else if (e.key === '7' || e.key === ',') {
          e.preventDefault();
          setActiveTab('settings');
        } else if (e.key.toLowerCase() === 'p') {
          // Toggle Pause / Resume on active downloading job
          e.preventDefault();
          const activeJob = queue.find((j) => j.status === 'downloading' || j.status === 'processing');
          const pausedJob = queue.find((j) => j.status === 'paused');
          if (activeJob) {
            handlePauseJob(activeJob.id);
          } else if (pausedJob) {
            handleResumeJob(pausedJob.id);
          } else {
            setActiveTab('downloads');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queue, handlePauseJob, handleResumeJob]);

  const activeDownloadsCount = queue.filter(
    (j) => j.status === 'downloading' || j.status === 'processing' || j.status === 'merging'
  ).length;

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'home':
        return {
          title: getTranslation('homeTitle', lang),
          subtitle: getTranslation('homeSubtitle', lang),
        };
      case 'downloads':
        return {
          title: getTranslation('downloadsTitle', lang),
          subtitle: getTranslation('downloadsSubtitle', lang),
        };
      case 'playlists':
        return {
          title: getTranslation('playlistsTitle', lang),
          subtitle: getTranslation('playlistsSubtitle', lang),
        };
      case 'converter':
        return {
          title: getTranslation('converterTitle', lang),
          subtitle: getTranslation('converterSubtitle', lang),
        };
      case 'library':
        return {
          title: getTranslation('libraryTitle', lang),
          subtitle: getTranslation('librarySubtitle', lang),
        };
      case 'history':
        return {
          title: getTranslation('historyTitle', lang),
          subtitle: getTranslation('historySubtitle', lang),
        };
      case 'settings':
        return {
          title: getTranslation('settingsTitle', lang),
          subtitle: getTranslation('settingsSubtitle', lang),
        };
    }
  };

  // Mini mode compact display view
  if (isMiniMode) {
    return (
      <MiniModeView
        queue={queue}
        onPause={handlePauseJob}
        onResume={handleResumeJob}
        onCancel={handleCancelJob}
        onRestore={() => handleToggleMiniMode(false)}
        lang={lang}
      />
    );
  }

  const headerInfo = getHeaderInfo();

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${theme === 'light' ? 'light app-light' : 'dark app-dark'} bg-[#0b0f19] text-slate-100`}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDownloadsCount={activeDownloadsCount}
        lang={lang}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          dependencies={dependencies}
          onRefreshDeps={handleRefreshDeps}
          onOpenFolder={() => handleOpenFolder()}
          lang={lang}
          onToggleLanguage={handleToggleLanguage}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onToggleMiniMode={() => handleToggleMiniMode(true)}
          onOpenShortcuts={() => setShowShortcutsModal(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'home' && (
            <HomeView
              onStartDownload={handleStartDownload}
              onStartPlaylistDownload={handleStartPlaylistDownload}
              activeJobs={queue.filter(
                (j) => j.status === 'downloading' || j.status === 'processing' || j.status === 'merging'
              )}
              onNavigateToDownloads={() => setActiveTab('downloads')}
              onShowToast={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'downloads' && (
            <DownloadsView
              queue={queue}
              onCancelJob={handleCancelJob}
              onPauseJob={handlePauseJob}
              onResumeJob={handleResumeJob}
              onRetryJob={handleRetryJob}
              onRetryAllFailed={handleRetryAllFailed}
              onClearCompleted={handleClearCompleted}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onNavigateHome={() => setActiveTab('home')}
              onShowToast={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'playlists' && (
            <PlaylistsView
              onStartPlaylistDownload={handleStartPlaylistDownload}
              queue={queue}
              onOpenFolder={handleOpenFolder}
              onShowToast={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'converter' && (
            <ConverterView
              onShowToast={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              history={history}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onDeleteEntry={handleDeleteHistoryEntry}
              onShowToast={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onDeleteEntry={handleDeleteHistoryEntry}
              onClearHistory={handleClearHistory}
              onShowToast={addToast}
              lang={lang}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              dependencies={dependencies}
              updateState={updateState}
              onUpdateSettings={handleUpdateSettings}
              onSelectDirectory={handleSelectDirectory}
              onRefreshDeps={handleRefreshDeps}
              onCheckUpdates={handleCheckUpdates}
              onDownloadUpdate={handleDownloadUpdate}
              onInstallUpdate={handleInstallUpdate}
              onShowToast={addToast}
              lang={lang}
            />
          )}
        </main>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <UpdateModal
          updateState={updateState}
          onDownload={handleDownloadUpdate}
          onInstall={handleInstallUpdate}
          onDismiss={() => setShowUpdateModal(false)}
        />
      )}

      {/* Keyboard Shortcuts Guide Modal */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        lang={lang}
      />

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
