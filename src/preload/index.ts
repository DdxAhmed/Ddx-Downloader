import { contextBridge, ipcRenderer } from 'electron';
import {
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  AppSettings,
  DownloadJob,
  DependencyStatus,
} from '../types';

const electronAPI = {
  analyzeUrl: (url: string) => ipcRenderer.invoke('media:analyze', url),
  startDownload: (req: CreateDownloadRequest) => ipcRenderer.invoke('media:download', req),
  startPlaylistDownload: (req: PlaylistBatchDownloadRequest) =>
    ipcRenderer.invoke('media:downloadBatch', req),
  cancelDownload: (jobId: string) => ipcRenderer.invoke('media:cancel', jobId),
  retryDownload: (jobId: string) => ipcRenderer.invoke('media:retry', jobId),
  getQueue: () => ipcRenderer.invoke('queue:get'),
  clearCompletedQueue: () => ipcRenderer.invoke('queue:clearCompleted'),
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistoryEntry: (id: string, deleteFile = false) =>
    ipcRenderer.invoke('history:delete', id, deleteFile),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke('settings:update', settings),
  selectDirectory: () => ipcRenderer.invoke('settings:selectDirectory'),
  checkDependencies: () => ipcRenderer.invoke('dependencies:check'),
  openFile: (filePath: string) => ipcRenderer.invoke('shell:openFile', filePath),
  openFolder: (filePath: string) => ipcRenderer.invoke('shell:openFolder', filePath),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),

  // Event listeners with unregister callbacks
  onDownloadProgress: (callback: (job: DownloadJob) => void) => {
    const handler = (_event: any, job: DownloadJob) => callback(job);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },

  onQueueUpdated: (callback: (queue: DownloadJob[]) => void) => {
    const handler = (_event: any, queue: DownloadJob[]) => callback(queue);
    ipcRenderer.on('queue:updated', handler);
    return () => ipcRenderer.removeListener('queue:updated', handler);
  },

  onDependencyStatusChanged: (callback: (status: DependencyStatus) => void) => {
    const handler = (_event: any, status: DependencyStatus) => callback(status);
    ipcRenderer.on('dependencies:status', handler);
    return () => ipcRenderer.removeListener('dependencies:status', handler);
  },

  // Auto Updater
  checkForUpdates: (isManual = false) => ipcRenderer.invoke('updater:check', isManual),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  getUpdateState: () => ipcRenderer.invoke('updater:getState'),
  onUpdateStateChanged: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on('updater:state-changed', handler);
    return () => ipcRenderer.removeListener('updater:state-changed', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
