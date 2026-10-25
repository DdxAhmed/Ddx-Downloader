import { contextBridge, ipcRenderer } from 'electron';
import {
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  AppSettings,
  DownloadJob,
  DependencyStatus,
  MediaConversionRequest,
} from '../types';

const electronAPI = {
  analyzeUrl: (url: string) => ipcRenderer.invoke('media:analyze', url),
  startDownload: (req: CreateDownloadRequest) => ipcRenderer.invoke('media:download', req),
  startPlaylistDownload: (req: PlaylistBatchDownloadRequest) =>
    ipcRenderer.invoke('media:downloadBatch', req),
  cancelDownload: (jobId: string) => ipcRenderer.invoke('media:cancel', jobId),
  pauseDownload: (jobId: string) => ipcRenderer.invoke('media:pause', jobId),
  resumeDownload: (jobId: string) => ipcRenderer.invoke('media:resume', jobId),
  retryDownload: (jobId: string) => ipcRenderer.invoke('media:retry', jobId),
  retryAllFailed: () => ipcRenderer.invoke('media:retryAllFailed'),
  checkDuplicate: (url: string) => ipcRenderer.invoke('media:checkDuplicate', url),
  downloadStandaloneSubtitle: (
    url: string,
    lang: string,
    format: 'srt' | 'vtt',
    outDir?: string,
    filename?: string
  ) => ipcRenderer.invoke('media:downloadSubtitles', url, lang, format, outDir, filename),
  convertMedia: (req: MediaConversionRequest) => ipcRenderer.invoke('media:convert', req),
  cancelConversion: () => ipcRenderer.invoke('media:cancelConversion'),
  selectFileForConversion: () => ipcRenderer.invoke('dialog:selectFileForConversion'),
  checkFreeDiskSpace: (dirPath?: string) => ipcRenderer.invoke('storage:checkFreeSpace', dirPath),
  cleanTempFiles: () => ipcRenderer.invoke('storage:cleanTemp'),
  toggleMiniMode: (enable: boolean) => ipcRenderer.invoke('app:toggleMiniMode', enable),
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

  onConversionProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress);
    ipcRenderer.on('conversion:progress', handler);
    return () => ipcRenderer.removeListener('conversion:progress', handler);
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
