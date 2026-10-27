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

  // Feature 1: Time Range & Chapters
  downloadSection: { en: 'Download a Section', ar: 'تنزيل مقطع محدد' },
  downloadSectionDesc: {
    en: 'Cut and download a specific time range or chapter instead of the full video.',
    ar: 'قص وتنزيل نطاق زمني أو فصل محدد بدلاً من الفيديو الكامل.',
  },
  enableSection: { en: 'Enable Section Clip', ar: 'تفعيل قص المقطع' },
  fullVideoDefault: { en: 'Full Video (Default)', ar: 'الفيديو بالكامل (الافتراضي)' },
  selectChapter: { en: 'Select Chapter', ar: 'اختر فصلاً' },
  customRange: { en: 'Custom Time Range', ar: 'نطاق زمني مخصص' },
  startTime: { en: 'Start Time', ar: 'وقت البدء' },
  endTime: { en: 'End Time', ar: 'وقت الانتهاء' },
  clipDuration: { en: 'Clip Duration', ar: 'مدة المقطع' },
  timeRangePlaceholder: { en: 'HH:MM:SS or MM:SS', ar: 'HH:MM:SS أو MM:SS' },
  invalidRangeError: {
    en: 'Invalid time range: start must be >= 0 and end must be greater than start.',
    ar: 'نطاق زمني غير صالح: وقت البدء يجب أن يكون >= 0 ووقت الانتهاء أكبر من البدء.',
  },
  endExceedsDuration: { en: 'End time cannot exceed media duration.', ar: 'وقت الانتهاء لا يمكن أن يتجاوز مدة الفيديو.' },
  ffmpegRequiredForClips: { en: 'FFmpeg is required to cut and download media sections.', ar: 'يتطلب FFmpeg لقص وتنزيل مقاطع الوسائط.' },
  keyframeDisclaimer: {
    en: 'Note: Stream cuts rely on video keyframes. Cuts will begin and end on the nearest available keyframe for fast downloads without re-encoding quality loss.',
    ar: 'تنبيه: يعتمد القص المباشر على الإطارات المفتاحية (Keyframes). سيبدأ المقطع وينتهي عند أقرب إطار متاح للحفاظ على السرعة وجودة الفيديو الأصلية بدون إعادة تشفير.',
  },
  clipRangeLabel: { en: 'Clip Range', ar: 'نطاق المقطع' },

  // Feature 2: Courses & Playlists
  savedCourses: { en: 'Saved Courses', ar: 'الدورات المحفوظة' },
  inspectCourse: { en: 'Inspect & Add Course', ar: 'فحص وإضافة دورة' },
  saveCourseToLibrary: { en: 'Save Course to Library', ar: 'حفظ الدورة في المكتبة' },
  courseSavedSuccess: { en: 'Course saved to library successfully', ar: 'تم حفظ الدورة في المكتبة بنجاح' },
  syncCourse: { en: 'Check for Updates', ar: 'التحقق من التحديثات' },
  syncingCourse: { en: 'Checking updates...', ar: 'جاري فحص التحديثات...' },
  courseSynced: { en: 'Course synchronized', ar: 'تمت مزامنة الدورة' },
  courseDetails: { en: 'Course Details', ar: 'تفاصيل الدورة' },
  lessonsCount: { en: 'Lessons', ar: 'الدروس' },
  downloadedCount: { en: 'Downloaded', ar: 'مكتمل' },
  downloadingCount: { en: 'Downloading', ar: 'قيد التنزيل' },
  missingLocallyCount: { en: 'Missing Locally', ar: 'مفقود محلياً' },
  failedCount: { en: 'Failed', ar: 'فشل' },
  newCount: { en: 'New', ar: 'جديد' },
  removedFromSourceCount: { en: 'Removed from Source', ar: 'محذوف من المصدر' },
  syncReviewTitle: { en: 'Course Update Review', ar: 'مراجعة تحديثات الدورة' },
  syncReviewDesc: {
    en: 'Review new and missing lessons before adding them to download queue.',
    ar: 'راجع الدروس الجديدة والمفقودة قبل إضافتها إلى قائمة التنزيل.',
  },
  downloadSelectedLessons: { en: 'Download Selected Lessons', ar: 'تنزيل الدروس المحددة' },
  retryFailedLessons: { en: 'Retry Failed Lessons', ar: 'إعادة محاولة الدروس الفاشلة' },
  redownloadMissing: { en: 'Re-download Missing', ar: 'إعادة تنزيل المفقودة' },
  noCoursesSaved: { en: 'No saved courses yet', ar: 'لا توجد دورات محفوظة بعد' },
  noCoursesSavedDesc: {
    en: 'Analyze a playlist or course above and click "Save Course to Library" to track updates.',
    ar: 'قم بفحص قائمة تشغيل أو دورة بالأعلى واضغط "حفظ الدورة في المكتبة" لمتابعة تحديثاتها.',
  },
  lastSynced: { en: 'Last Synced', ar: 'آخر مزامنة' },
  neverSynced: { en: 'Never', ar: 'أبداً' },
  courseProgress: { en: 'Overall Progress', ar: 'التقدم الإجمالي' },
  deleteCourse: { en: 'Delete Course', ar: 'حذف الدورة' },
  deleteCourseConfirm: {
    en: 'Remove this course from the library? Local video files will not be deleted.',
    ar: 'هل تريد إزالة هذه الدورة من المكتبة؟ لن يتم حذف ملفات الفيديو المحلية.',
  },
  removedFromSourceNote: {
    en: 'This lesson was removed from the source playlist. Your local file is preserved.',
    ar: 'تمت إزالة هذا الدرس من قائمة المصدر. ملفك المحلي محفوظ ولم يُحذف.',
  },

  // Feature 3: Subtitles Search
  tabFiles: { en: 'Downloaded Files', ar: 'الملفات المحملة' },
  tabSubtitles: { en: 'Search Subtitles', ar: 'البحث في الترجمات' },
  searchSubtitlesPlaceholder: {
    en: 'Search words or phrases across local subtitles (Arabic & English)...',
    ar: 'ابحث عن كلمات أو عبارات داخل الترجمات المحلية (عربي وإنجليزي)...',
  },
  subtitlesDisclaimer: {
    en: 'Notice: Searches text inside downloaded or imported subtitle files (.srt, .vtt). Does not transcribe audio from media without subtitles.',
    ar: 'تنبيه: يبحث في نصوص ملفات الترجمة المحملة أو المستوردة (.srt, .vtt). لا يقوم بتفريغ الصوت آلياً للمقاطع غير المترجمة.',
  },
  importSubtitles: { en: 'Import Subtitle Files', ar: 'استيراد ملفات ترجمة' },
  importSubtitleFolder: { en: 'Scan Subtitle Folder', ar: 'فحص مجلد ترجمات' },
  allLanguages: { en: 'All Languages', ar: 'جميع اللغات' },
  noSubtitlesFound: { en: 'No subtitle matches found', ar: 'لم يتم العثور على نتائج في الترجمات' },
  noSubtitlesFoundDesc: {
    en: 'Try different search keywords, or import local subtitle files to index them.',
    ar: 'جرب كلمات بحث أخرى، أو استورد ملفات ترجمة محلية لفهرستها.',
  },
  playFromHere: { en: 'Play from here', ar: 'تشغيل من هنا' },
  openMedia: { en: 'Open Media', ar: 'فتح الوسائط' },
  revealSubtitle: { en: 'Reveal Subtitle File', ar: 'عرض ملف الترجمة' },
  copyTimestamp: { en: 'Copy Timestamp', ar: 'نسخ التوقيت' },
  timestampCopied: { en: 'Timestamp copied to clipboard', ar: 'تم نسخ التوقيت إلى الحافظة' },
  indexingSubtitles: { en: 'Indexing subtitles...', ar: 'جاري فهرسة الترجمات...' },
  totalCuesIndexed: { en: 'Subtitles Indexed', ar: 'جمل مترجمة مفهرسة' },

  // Feature 4: Download Sizes & Disk Space
  sizeReported: { en: 'Reported', ar: 'مؤكد من المصدر' },
  sizeEstimated: { en: 'Estimated', ar: 'تقديري' },
  sizeUnknown: { en: 'Size Unknown', ar: 'الحجم غير معروف' },
  sizeStreamsCombined: { en: 'Combined video & audio streams', ar: 'مجموع مساري الفيديو والصوت معاً' },
  calculatePlaylistSize: { en: 'Calculate Total Size', ar: 'حساب الحجم الإجمالي' },
  calculatingSizes: { en: 'Calculating sizes ({current}/{total})...', ar: 'جاري حساب الأحجام ({current}/{total})...' },
  playlistSizeKnown: { en: '{size} for {knownCount} lessons', ar: '{size} لعدد {knownCount} درس' },
  playlistSizeUnknownNote: { en: '({unknownCount} lessons have unknown size)', ar: '({unknownCount} درس بحجم غير محدد بعد)' },
  diskSpaceRequired: { en: 'Estimated Required', ar: 'المساحة المطلوبة' },
  diskSpaceAvailable: { en: 'Available on Disk', ar: 'المتوفر على القرص' },
  diskSpaceRemaining: { en: 'Remaining after download', ar: 'المتبقي بعد التنزيل' },
  peakSpaceWarning: {
    en: 'Warning: Download requires temporary merge space ({peakSize}). Available disk space ({freeSize}) may be insufficient!',
    ar: 'تحذير: التنزيل يحتاج مساحة مؤقتة لدمج المقاطع ({peakSize}). المساحة المتوفرة ({freeSize}) قد لا تكفي!',
  },
  diskSpaceUnavailable: { en: 'Disk space check unavailable for this location', ar: 'فحص مساحة القرص غير متوفر لهذا المسار' },
  diskSpaceNote: {
    en: 'Includes temporary video/audio streams and container merge overhead (~2.1x final size).',
    ar: 'يشمل مسارات الفيديو والصوت المؤقتة وتكاليف الدمج (~2.1x من الحجم النهائي).',
  },
  insufficientDiskSpace: { en: 'Insufficient disk space on destination drive.', ar: 'لا توجد مساحة كافية على قرص التخزين المحدد.' },
};

export function getTranslation(key: string, lang: SupportedLanguage): string {
  const item = translations[key];
  if (!item) return key;
  return item[lang] || item.en || key;
}
