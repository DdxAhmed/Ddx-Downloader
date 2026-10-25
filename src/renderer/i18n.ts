export type SupportedLanguage = 'en' | 'ar';

export interface Translations {
  [key: string]: {
    en: string;
    ar: string;
  };
}

export const translations: Translations = {
  // Navigation
  navHome: { en: 'Home', ar: 'الرئيسية' },
  navDownloads: { en: 'Downloads', ar: 'التنزيلات' },
  navPlaylists: { en: 'Courses & Playlists', ar: 'الدورات وقوائم التشغيل' },
  navConverter: { en: 'Media Converter', ar: 'محول الوسائط' },
  navLibrary: { en: 'Media Library', ar: 'مكتبة الوسائط' },
  navHistory: { en: 'History', ar: 'السجل' },
  navSettings: { en: 'Settings', ar: 'الإعدادات' },

  // Headers
  homeTitle: { en: 'Home Dashboard', ar: 'لوحة التحكم الرئيسية' },
  homeSubtitle: {
    en: 'Analyze and download online videos, playlists & educational courses',
    ar: 'تحليل وتنزيل مقاطع الفيديو وقوائم التشغيل والدورات التعليمية',
  },
  downloadsTitle: { en: 'Download Manager', ar: 'إدارة التنزيلات' },
  downloadsSubtitle: {
    en: 'Monitor active, queued, and completed media downloads with real-time controls',
    ar: 'متابعة التنزيلات النشطة وقيد الانتظار والمكتملة مع تحكم فوري',
  },
  playlistsTitle: { en: 'Courses & Playlists', ar: 'الدورات وقوائم التشغيل' },
  playlistsSubtitle: {
    en: 'Batch download educational courses organized into structured local folders',
    ar: 'تنزيل دورات تعليمية كاملة منظمة في مجلدات محلية مرتبة ومرقمة',
  },
  converterTitle: { en: 'Media Converter', ar: 'محول الوسائط' },
  converterSubtitle: {
    en: 'Convert videos and extract audio into MP4, MKV, MP3, AAC or FLAC using FFmpeg',
    ar: 'تحويل الفيديو واستخراج الصوتيات إلى MP4 أو MKV أو MP3 أو FLAC عبر FFmpeg',
  },
  libraryTitle: { en: 'Local Media Library', ar: 'مكتبة الوسائط المحلية' },
  librarySubtitle: {
    en: 'Browse, search, and manage your downloaded media files',
    ar: 'تصفح والبحث في ملفات الوسائط المحفوظة وإدارتها محلياً',
  },
  historyTitle: { en: 'Download History', ar: 'سجل التنزيلات' },
  historySubtitle: {
    en: 'Audit log of completed media jobs saved in local SQLite database',
    ar: 'سجل تدقيق لجميع التنزيلات السابقة المحفوظة في قاعدة بيانات SQLite المحلية',
  },
  settingsTitle: { en: 'Application Settings', ar: 'إعدادات البرنامج' },
  settingsSubtitle: {
    en: 'Configure directories, speed limits, default resolutions, and media engines',
    ar: 'ضبط مجلدات الحفظ وحدود السرعة والدقة الافتراضية ومحركات الوسائط',
  },

  // Common Actions
  pasteUrl: { en: 'Paste URL', ar: 'لصق الرابط' },
  analyzeMedia: { en: 'Inspect Media', ar: 'فحص الوسائط' },
  analyzing: { en: 'Scanning...', ar: 'جاري الفحص...' },
  downloadNow: { en: 'Start Download', ar: 'بدء التنزيل' },
  downloadAudio: { en: 'Download Audio Only', ar: 'تنزيل الصوت فقط' },
  downloadSubtitlesOnly: { en: 'Download Subtitles Only', ar: 'تنزيل الترجمة فقط' },
  pause: { en: 'Pause', ar: 'إيقاف مؤقت' },
  resume: { en: 'Resume', ar: 'استئناف' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  retry: { en: 'Retry', ar: 'إعادة المحاولة' },
  retryAll: { en: 'Retry All Failed', ar: 'إعادة محاولة كل التنزيلات الفاشلة' },
  clearCompleted: { en: 'Clear Completed', ar: 'مسح المكتملة' },
  openFile: { en: 'Open File', ar: 'فتح الملف' },
  openFolder: { en: 'Open Folder', ar: 'فتح المجلد' },
  copyUrl: { en: 'Copy URL', ar: 'نسخ الرابط' },
  copyPath: { en: 'Copy Path', ar: 'نسخ المسار' },
  details: { en: 'Details', ar: 'التفاصيل' },
  save: { en: 'Save Preferences', ar: 'حفظ التفضيلات' },
  saving: { en: 'Saving...', ar: 'جاري الحفظ...' },

  // Task Statuses
  statusQueued: { en: 'Queued', ar: 'قيد الانتظار' },
  statusPreparing: { en: 'Preparing', ar: 'جاري التجهيز' },
  statusDownloading: { en: 'Downloading', ar: 'جاري التنزيل' },
  statusMerging: { en: 'Merging', ar: 'جاري دمج المقاطع' },
  statusProcessing: { en: 'Processing', ar: 'جاري المعالجة' },
  statusCompleted: { en: 'Completed', ar: 'اكتمل' },
  statusFailed: { en: 'Failed', ar: 'فشل' },
  statusCancelled: { en: 'Cancelled', ar: 'تم الإلغاء' },
  statusPaused: { en: 'Paused', ar: 'متوقف مؤقتاً' },
  statusRetrying: { en: 'Retrying', ar: 'إعادة المحاولة' },

  // Duplicate Warning
  duplicateDetectedTitle: { en: 'Duplicate Media Detected', ar: 'تم العثور على تنزيل مسبق' },
  duplicateDetectedMsg: {
    en: 'This media item has already been downloaded or is currently in the queue.',
    ar: 'تم تنزيل هذا المحتوى مسبقاً أو يوجد حالياً في قائمة الانتظار.',
  },
  openExisting: { en: 'Open Existing', ar: 'فتح الملف الموجود' },
  downloadAgain: { en: 'Download Again', ar: 'تنزيل نسخة أخرى' },

  // Storage and Cleanup
  storageSpace: { en: 'Free Disk Space', ar: 'المساحة الحرة على القرص' },
  cleanTemp: { en: 'Clean Stale Temp Files', ar: 'تنظيف الملفات المؤقتة القديمة' },
  cleaningTemp: { en: 'Cleaning...', ar: 'جاري التنظيف...' },
  cleanupSuccess: { en: 'Temporary files cleaned successfully', ar: 'تم تنظيف الملفات المؤقتة بنجاح' },

  // Mini mode
  miniMode: { en: 'Mini Mode', ar: 'الوضع المصغر' },
  restoreWindow: { en: 'Expand Application', ar: 'توسيع البرنامج' },

  // Keyboard Shortcuts
  shortcuts: { en: 'Keyboard Shortcuts', ar: 'اختصارات لوحة المفاتيح' },
  shortcutHelp: { en: 'Press ? anytime to open shortcuts guide', ar: 'اضغط ? في أي وقت لفتح دليل الاختصارات' },

  // History
  searchHistory: { en: 'Search history by title or URL...', ar: 'ابحث في السجل بالعنوان أو الرابط...' },
  clearHistory: { en: 'Clear History', ar: 'مسح السجل' },
  clearHistoryConfirmTitle: { en: 'Clear All History?', ar: 'مسح كل السجل؟' },
  clearHistoryConfirmDesc: {
    en: 'This will remove all entries from the local download history database. The actual downloaded video files on your computer will NOT be deleted.',
    ar: 'سيؤدي هذا إلى إزالة جميع الإدخالات من قاعدة بيانات السجل المحلية. لن يتم حذف ملفات الفيديو الفعلية التي تم تنزيلها على جهازك.',
  },
  mediaTitle: { en: 'Media Title', ar: 'عنوان الوسائط' },
  platform: { en: 'Platform', ar: 'المنصة' },
  format: { en: 'Format', ar: 'الصيغة' },
  size: { en: 'Size', ar: 'الحجم' },
  date: { en: 'Date', ar: 'التاريخ' },
  actions: { en: 'Actions', ar: 'الإجراءات' },
  noHistory: { en: 'No history records', ar: 'لا توجد سجلات تنزيل' },
  noHistoryDesc: {
    en: 'Completed downloads will be automatically logged here for easy reference.',
    ar: 'سيتم تسجيل التنزيلات المكتملة هنا تلقائياً لسهولة الرجوع إليها.',
  },
  noHistoryMatch: { en: 'No history matches your search query.', ar: 'لا توجد نتائج تطابق بحثك.' },
};

export function getTranslation(key: string, lang: SupportedLanguage): string {
  const item = translations[key];
  if (!item) return key;
  return item[lang] || item.en || key;
}
