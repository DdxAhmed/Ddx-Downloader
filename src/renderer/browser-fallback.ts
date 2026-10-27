import { ElectronAPI, DownloadJob, DownloadHistoryEntry, AppSettings, DependencyStatus, UpdateState } from '../types';

/**
 * Browser preview mock adapter.
 * Only activated when Ddx Downloader is opened directly in a standard web browser
 * (e.g. during `npm run dev:web` or browsing http://localhost:5173).
 *
 * This provides a realistic preview of the React UI and CSS without faking real downloads
 * or exposing arbitrary system capabilities to browser JavaScript.
 */
export function setupBrowserPreviewFallback(): boolean {
  if (typeof window === 'undefined' || window.electronAPI) {
    return false; // Real Electron environment with preload bridge
  }

  const sampleSettings: AppSettings = {
    downloadDirectory: 'C:\\Users\\User\\Downloads\\DDX-Media',
    preferredQuality: 'best',
    preferredContainer: 'mp4',
    defaultAudioFormat: 'mp3',
    maxConcurrentDownloads: 3,
    theme: 'dark',
    language: 'en',
    embedSubtitles: true,
    downloadSubtitles: true,
  };

  const sampleQueue: DownloadJob[] = [
    {
      id: 'preview-job-1',
      sourceUrl: 'https://www.youtube.com/watch?v=sample1',
      sourcePlatform: 'youtube',
      mediaTitle: 'Sample: Python for Beginners - Full Educational Course',
      thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80',
      mediaDuration: 3600,
      selectedFormat: '1080p',
      selectedQuality: 'Full HD (1080p)',
      isAudioOnly: false,
      targetContainer: 'mp4',
      outputPath: 'C:\\Users\\User\\Downloads\\Python_Course.mp4',
      status: 'downloading',
      progress: 68.4,
      downloadedBytes: 358612992,
      totalBytes: 524288000,
      downloadSpeed: '6.4 MiB/s',
      eta: '00:26',
      createdAt: new Date(Date.now() - 120000).toISOString(),
      startedAt: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'preview-job-2',
      sourceUrl: 'https://www.youtube.com/watch?v=sample2',
      sourcePlatform: 'youtube',
      mediaTitle: 'Sample: Complete Web Development Bootcamp - Lecture 01',
      thumbnailUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&q=80',
      mediaDuration: 1800,
      selectedFormat: '720p',
      selectedQuality: 'HD (720p)',
      isAudioOnly: false,
      targetContainer: 'mp4',
      outputPath: 'C:\\Users\\User\\Downloads\\WebDev_01.mp4',
      status: 'queued',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 250000000,
      downloadSpeed: '',
      eta: '',
      createdAt: new Date(Date.now() - 30000).toISOString(),
    },
  ];

  const sampleHistory: DownloadHistoryEntry[] = [
    {
      id: 'preview-hist-1',
      jobId: 'prev-1',
      mediaTitle: 'Machine Learning Fundamentals - Module 1',
      sourceUrl: 'https://www.youtube.com/watch?v=sample-ml',
      sourcePlatform: 'youtube',
      filePath: 'C:\\Users\\User\\Downloads\\ML_Fundamentals.mp4',
      fileSize: 420000000,
      format: '1080p',
      duration: 2400,
      thumbnailUrl: 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=400&q=80',
      completedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const sampleDependencies: DependencyStatus = {
    ytDlp: {
      available: true,
      version: '2026.02.01 (Browser Mock)',
      path: 'bin/yt-dlp.exe',
    },
    ffmpeg: {
      available: true,
      version: '7.1 (Browser Mock)',
      path: 'bin/ffmpeg.exe',
    },
  };

  const sampleUpdateState: UpdateState = {
    status: 'idle',
    currentVersion: '1.0.0 (Web Preview)',
    updateInfo: null,
    progress: null,
    error: null,
    lastChecked: new Date().toISOString(),
  };

  let currentSettings = { ...sampleSettings };
  let currentQueue = [...sampleQueue];
  let currentHistory = [...sampleHistory];

  const mockAPI: ElectronAPI = {
    analyzeUrl: async (url: string) => {
      // In browser preview mode, provide a mock analyzed media object to inspect the UI
      return {
        success: true,
        data: {
          id: 'preview-vid-123',
          url,
          title: 'Preview Video: Introduction to Advanced TypeScript & System Architecture',
          description: 'This is a browser-preview metadata payload demonstrating format picker UI and subtitle controls.',
          thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80',
          uploader: 'DDX Tech Academy',
          uploaderUrl: 'https://example.com/channel',
          duration: 1250,
          platform: 'youtube',
          isPlaylist: false,
          formats: [
            {
              formatId: 'bestvideo+bestaudio/best',
              ext: 'mp4',
              qualityLabel: 'Best Available Quality',
              isVideoOnly: false,
              isAudioOnly: false,
              isMuxed: true,
            },
            {
              formatId: '137+140',
              ext: 'mp4',
              resolution: '1920x1080',
              height: 1080,
              width: 1920,
              fps: 60,
              qualityLabel: 'Full HD (1080p) 60fps',
              isVideoOnly: false,
              isAudioOnly: false,
              isMuxed: true,
              filesize: 185000000,
            },
            {
              formatId: '22',
              ext: 'mp4',
              resolution: '1280x720',
              height: 720,
              width: 1280,
              fps: 30,
              qualityLabel: 'HD (720p)',
              isVideoOnly: false,
              isAudioOnly: false,
              isMuxed: true,
              filesize: 85000000,
            },
            {
              formatId: 'bestaudio/best',
              ext: 'mp3',
              qualityLabel: 'Audio Only (MP3)',
              isVideoOnly: false,
              isAudioOnly: true,
              isMuxed: false,
            },
          ],
          subtitles: [
            { language: 'en', name: 'English', ext: 'vtt', isAutoGenerated: false },
            { language: 'ar', name: 'Arabic', ext: 'vtt', isAutoGenerated: false },
            { language: 'en-orig', name: 'English (Auto-generated)', ext: 'vtt', isAutoGenerated: true },
          ],
        },
      };
    },

    startDownload: async (req) => {
      return {
        success: false,
        error: 'Web Browser Preview Mode: Starting real downloads requires the Ddx Downloader Electron desktop application.',
      };
    },

    startPlaylistDownload: async (_req) => {
      return {
        success: false,
        error: 'Web Browser Preview Mode: Batch downloading playlists requires the desktop application.',
      };
    },

    cancelDownload: async (jobId: string) => {
      currentQueue = currentQueue.filter((j) => j.id !== jobId);
      return { success: true };
    },

    retryDownload: async (_jobId: string) => {
      return { success: true };
    },

    getQueue: async () => currentQueue,

    clearCompletedQueue: async () => {
      currentQueue = currentQueue.filter((j) => j.status !== 'completed');
      return { success: true };
    },

    getHistory: async () => currentHistory,

    deleteHistoryEntry: async (id: string) => {
      currentHistory = currentHistory.filter((h) => h.id !== id);
      return { success: true };
    },

    clearHistory: async () => {
      currentHistory = [];
      return { success: true };
    },

    getSettings: async () => currentSettings,

    updateSettings: async (settings) => {
      currentSettings = { ...currentSettings, ...settings };
      return { success: true, settings: currentSettings };
    },

    selectDirectory: async () => {
      return {
        success: false,
        path: undefined,
      };
    },

    checkDependencies: async () => sampleDependencies,

    openFile: async () => {
      return {
        success: false,
        error: 'Web Browser Preview Mode: Opening local files requires the desktop application.',
      };
    },

    openFolder: async () => {
      return {
        success: false,
        error: 'Web Browser Preview Mode: Opening local folders requires the desktop application.',
      };
    },

    openExternal: async (url: string) => {
      window.open(url, '_blank');
      return { success: true };
    },

    getAppInfo: async () => ({
      version: '1.0.0 (Browser Preview)',
      platform: 'web',
      userDataPath: 'N/A (Web Browser Preview)',
      downloadsPath: currentSettings.downloadDirectory,
    }),

    checkDuplicate: async (_url: string) => ({
      isDuplicate: false,
    }),

    pauseDownload: async (_jobId: string) => ({ success: true }),
    resumeDownload: async (_jobId: string) => ({ success: true }),
    retryAllFailed: async () => ({ success: true, requeuedCount: 0 }),

    checkFreeDiskSpace: async () => ({
      available: true,
      freeBytes: 150000000000,
      totalBytes: 512000000000,
      path: 'C:\\Users\\User\\Downloads',
    }),

    checkDiskSpaceWithEstimates: async (_dir, estimatedBytes) => ({
      diskSpace: {
        available: true,
        freeBytes: 150000000000,
        totalBytes: 512000000000,
        path: 'C:\\Users\\User\\Downloads',
      },
      estimatedRequiredBytes: estimatedBytes,
      estimatedPeakBytes: Math.round(estimatedBytes * 2),
      pendingQueueBytes: 0,
      projectedRemainingBytes: 150000000000 - Math.round(estimatedBytes * 2),
      isLowSpace: false,
      isInsufficient: false,
    }),

    // Courses & Playlists Mock
    saveCourse: async () => ({ success: true, courseId: 'mock-course-1' }),
    getCourses: async () => [],
    getCourse: async () => null,
    syncCourse: async () => ({ success: true }),
    downloadCourseItems: async () => ({ success: true, jobIds: [] }),
    deleteCourse: async () => ({ success: true }),

    // Subtitle Search Mock
    searchSubtitles: async () => ({ results: [], total: 0, page: 1, pageSize: 20, totalPages: 0 }),
    importSubtitleFiles: async () => ({ success: true, indexedCount: 0 }),
    importSubtitleFolder: async () => ({ success: true, indexedCount: 0 }),
    playMediaAtTimestamp: async () => ({ success: true, copiedTimestamp: '00:00' }),
    getDetectedMediaPlayers: async () => [],

    // Sizing & Estimates Mock
    estimateFormatSize: async (fmt, duration) => ({
      bytes: fmt?.filesize || (duration ? Math.round(duration * 250000) : 0),
      type: fmt?.filesize ? 'reported' : 'estimated',
      details: 'Browser preview calculation',
    }),
    estimatePlaylistSize: async (items) => ({
      totalBytes: items.length * 150000000,
      knownCount: items.length,
      unknownCount: 0,
      totalCount: items.length,
      isComplete: true,
    }),
    fetchPlaylistItemSizes: async () => ({}),

    cleanTempFiles: async () => ({
      success: true,
      cleanedCount: 0,
      freedBytes: 0,
    }),

    convertMedia: async () => ({
      success: false,
      error: 'Web Browser Preview Mode: Media conversion requires FFmpeg running via desktop Electron.',
    }),

    cancelConversion: async () => ({ success: true }),
    selectFileForConversion: async () => ({ success: false }),
    toggleMiniMode: async () => ({ success: true }),
    downloadStandaloneSubtitle: async () => ({
      success: false,
      error: 'Web Browser Preview Mode: Subtitle downloading requires desktop Electron.',
    }),

    onDownloadProgress: () => () => {},
    onQueueUpdated: () => () => {},
    onDependencyStatusChanged: () => () => {},
    onConversionProgress: () => () => {},

    checkForUpdates: async () => ({ success: true }),
    downloadUpdate: async () => ({ success: true }),
    installUpdate: async () => ({ success: true }),
    getUpdateState: async () => sampleUpdateState,
    onUpdateStateChanged: () => () => {},
  };

  window.electronAPI = mockAPI;
  (window as any).__IS_BROWSER_PREVIEW__ = true;

  console.info(
    '%c[Ddx Downloader]%c Running in Web Browser Preview Mode. HMR active. Desktop operations require Electron.',
    'background: #4f46e5; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    'color: #94a3b8;'
  );

  return true;
}
