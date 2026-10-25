import React, { useState, useEffect } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast, ToastMessage } from './components/Toast';
import { UpdateModal } from './components/UpdateModal';
import { HomeView } from './views/HomeView';
import { DownloadsView } from './views/DownloadsView';
import { PlaylistsView } from './views/PlaylistsView';
import { LibraryView } from './views/LibraryView';
import { HistoryView } from './views/HistoryView';
import { SettingsView } from './views/SettingsView';
import {
  DownloadJob,
  DownloadHistoryEntry,
  AppSettings,
  DependencyStatus,
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  UpdateState,
} from '../types';

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
          addToast(`Download completed: "${updatedJob.mediaTitle}"`, 'success');
        } else if (updatedJob.status === 'failed' && updatedJob.errorMessage) {
          addToast(`Download failed: "${updatedJob.mediaTitle}"`, 'error');
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
          addToast('You are running the latest version of DDX Downloader.', 'info');
        } else if (state.status === 'downloaded') {
          setShowUpdateModal(true);
          addToast('Update downloaded! Ready to restart and install.', 'success');
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
  }, []);

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

  const handleCancelJob = async (id: string): Promise<boolean> => {
    if (!window.electronAPI) return false;
    const res = await window.electronAPI.cancelDownload(id);
    if (res.success) {
      addToast('Download cancelled.', 'info');
      return true;
    }
    return false;
  };

  const handleRetryJob = async (id: string): Promise<boolean> => {
    if (!window.electronAPI) return false;
    const res = await window.electronAPI.retryDownload(id);
    if (res.success) {
      addToast('Re-queued download.', 'info');
      return true;
    }
    return false;
  };

  const handleClearCompleted = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.clearCompletedQueue();
    const updated = await window.electronAPI.getQueue();
    setQueue(updated);
    addToast('Cleared completed items from queue.', 'info');
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
    if (!window.electronAPI) return;
    const res = await window.electronAPI.updateSettings(newSettings);
    if (res.success && res.settings) {
      setSettings(res.settings);
    }
  };

  const handleSelectDirectory = async () => {
    if (!window.electronAPI) return;
    const res = await window.electronAPI.selectDirectory();
    if (res.success && res.path) {
      await handleUpdateSettings({ downloadDirectory: res.path });
      addToast(`Updated download folder: ${res.path}`, 'success');
    }
  };

  const handleRefreshDeps = async () => {
    if (!window.electronAPI) return;
    addToast('Verifying media dependencies...', 'info');
    const status = await window.electronAPI.checkDependencies();
    setDependencies(status);
    if (status.ytDlp.available && status.ffmpeg.available) {
      addToast('Engine verified! yt-dlp and FFmpeg are operational.', 'success');
    } else {
      addToast('One or more media engine dependencies are missing.', 'error');
    }
  };

  const handleCheckUpdates = async () => {
    if (!window.electronAPI) return;
    addToast('Checking for updates...', 'info');
    await window.electronAPI.checkForUpdates(true);
  };

  const handleDownloadUpdate = async () => {
    if (!window.electronAPI) return;
    addToast('Downloading update...', 'info');
    await window.electronAPI.downloadUpdate();
  };

  const handleInstallUpdate = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.installUpdate();
  };

  const activeDownloadsCount = queue.filter(
    (j) => j.status === 'downloading' || j.status === 'processing'
  ).length;

  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'home':
        return {
          title: 'Home Dashboard',
          subtitle: 'Analyze and download online videos, playlists & educational courses',
        };
      case 'downloads':
        return {
          title: 'Download Manager',
          subtitle: 'Monitor active, queued, and completed media downloads',
        };
      case 'playlists':
        return {
          title: 'Courses & Playlists',
          subtitle: 'Batch download educational courses organized into structured local folders',
        };
      case 'library':
        return {
          title: 'Local Media Library',
          subtitle: 'Browse, play, and reveal your saved local media',
        };
      case 'history':
        return {
          title: 'Download History',
          subtitle: 'Audit log of completed media jobs saved in local SQLite database',
        };
      case 'settings':
        return {
          title: 'Application Settings',
          subtitle: 'Configure directories, default resolutions, and media engines',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f19] text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeDownloadsCount={activeDownloadsCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          title={headerInfo.title}
          subtitle={headerInfo.subtitle}
          dependencies={dependencies}
          onRefreshDeps={handleRefreshDeps}
          onOpenFolder={() => handleOpenFolder()}
        />

        <main className="flex-1 overflow-y-auto">
          {activeTab === 'home' && (
            <HomeView
              onStartDownload={handleStartDownload}
              onStartPlaylistDownload={handleStartPlaylistDownload}
              activeJobs={queue.filter(
                (j) => j.status === 'downloading' || j.status === 'processing'
              )}
              onNavigateToDownloads={() => setActiveTab('downloads')}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'downloads' && (
            <DownloadsView
              queue={queue}
              onCancelJob={handleCancelJob}
              onRetryJob={handleRetryJob}
              onClearCompleted={handleClearCompleted}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onNavigateHome={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'playlists' && (
            <PlaylistsView
              onStartPlaylistDownload={handleStartPlaylistDownload}
              queue={queue}
              onOpenFolder={handleOpenFolder}
              onShowToast={addToast}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              history={history}
              onOpenFile={handleOpenFile}
              onOpenFolder={handleOpenFolder}
              onDeleteEntry={handleDeleteHistoryEntry}
              onShowToast={addToast}
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

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export default App;
