import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Folder,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Save,
  Download,
  RotateCw,
  Sparkles,
  Gauge,
  Trash2,
  HardDrive,
  Bell,
  CopyCheck,
  Globe,
  Sun,
  Moon,
} from 'lucide-react';
import { AppSettings, DependencyStatus, UpdateState, DiskSpaceInfo } from '../../types';
import { UpdateContent } from '../components/UpdateContent';
import { SupportedLanguage } from '../i18n';

interface SettingsViewProps {
  settings: AppSettings;
  dependencies: DependencyStatus | null;
  updateState: UpdateState;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onSelectDirectory: () => Promise<void>;
  onRefreshDeps: () => Promise<void>;
  onCheckUpdates: () => Promise<void>;
  onDownloadUpdate: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  dependencies,
  updateState,
  onUpdateSettings,
  onSelectDirectory,
  onRefreshDeps,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onShowToast,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [preferredQuality, setPreferredQuality] = useState(settings.preferredQuality);
  const [preferredContainer, setPreferredContainer] = useState(settings.preferredContainer);
  const [defaultAudioFormat, setDefaultAudioFormat] = useState(settings.defaultAudioFormat);
  const [maxConcurrent, setMaxConcurrent] = useState(settings.maxConcurrentDownloads);
  const [embedSubtitles, setEmbedSubtitles] = useState(settings.embedSubtitles);
  const [downloadSubtitles, setDownloadSubtitles] = useState(settings.downloadSubtitles);
  const [customYtDlpPath, setCustomYtDlpPath] = useState(settings.customYtDlpPath || '');
  const [customFfmpegPath, setCustomFfmpegPath] = useState(settings.customFfmpegPath || '');
  const [downloadSpeedLimit, setDownloadSpeedLimit] = useState(settings.downloadSpeedLimit || 'unlimited');
  const [autoRetryTransient, setAutoRetryTransient] = useState(settings.autoRetryTransient !== false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled !== false);
  const [duplicateConflictPolicy, setDuplicateConflictPolicy] = useState(settings.duplicateConflictPolicy || 'prompt');
  const [language, setLanguage] = useState(settings.language || 'en');
  const [theme, setTheme] = useState(settings.theme || 'dark');

  const [isSaving, setIsSaving] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [diskSpace, setDiskSpace] = useState<DiskSpaceInfo | null>(null);

  useEffect(() => {
    if (settings.theme) setTheme(settings.theme);
    if (settings.language) setLanguage(settings.language);
  }, [settings.theme, settings.language]);

  useEffect(() => {
    if (window.electronAPI?.checkFreeDiskSpace) {
      window.electronAPI.checkFreeDiskSpace().then((res) => {
        if (res) setDiskSpace(res);
      });
    }
  }, [settings.downloadDirectory]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings({
        preferredQuality,
        preferredContainer,
        defaultAudioFormat,
        maxConcurrentDownloads: Number(maxConcurrent),
        embedSubtitles,
        downloadSubtitles,
        customYtDlpPath: customYtDlpPath.trim() || undefined,
        customFfmpegPath: customFfmpegPath.trim() || undefined,
        downloadSpeedLimit,
        autoRetryTransient,
        notificationsEnabled,
        duplicateConflictPolicy: duplicateConflictPolicy as any,
        language,
        theme,
      });
      onShowToast(isAr ? 'تم حفظ التفضيلات بنجاح!' : 'Settings saved successfully!', 'success');
    } catch {
      onShowToast(isAr ? 'فشل حفظ الإعدادات.' : 'Failed to save settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCleanTemp = async () => {
    if (!window.electronAPI?.cleanTempFiles) return;
    setIsCleaning(true);
    try {
      const res = await window.electronAPI.cleanTempFiles();
      if (res.success) {
        onShowToast(
          isAr
            ? `تم تنظيف ${res.cleanedCount} ملف مؤقت بنجاح (تحرير ${formatBytes(res.freedBytes)})!`
            : `Cleaned ${res.cleanedCount} temporary files (freed ${formatBytes(res.freedBytes)})!`,
          'success'
        );
      } else {
        onShowToast(res.error || 'Cleanup failed', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7 max-w-[1200px] mx-auto space-y-6 animate-fadeIn">
      {/* Page Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-indigo-400" />
            <span>{isAr ? 'التفضيلات والإعدادات المتقدمة' : 'Preferences & Configuration'}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'تخصيص مجلدات الحفظ، محركات الوسائط، قواعد الجدولة، وسياسات التكرار'
              : 'Customize download destinations, media engines, scheduling rules, and duplicate detection.'}
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-glow-primary flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-xl shadow-indigo-500/30 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ التفضيلات' : 'Save Preferences'}</span>
        </button>
      </div>

      {/* 1. Storage & Downloads Directory */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-400" />
            <span>{isAr ? '1. مجلد التنزيل والمساحة التخزينية' : '1. Storage & Download Destination'}</span>
          </h3>

          {diskSpace && diskSpace.available && typeof diskSpace.freeBytes === 'number' && (
            <span className="text-xs font-mono text-slate-300">
              {isAr ? 'المساحة المتاحة:' : 'Free:'}{' '}
              <strong className="text-indigo-400 font-bold">{formatBytes(diskSpace.freeBytes)}</strong> / {formatBytes(diskSpace.totalBytes || 0)}
            </span>
          )}
          {diskSpace && !diskSpace.available && (
            <span className="text-xs font-mono text-amber-400">
              {isAr ? 'المساحة غير متاحة' : 'Disk space unavailable'}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            {isAr ? 'المجلد الافتراضي لحفظ التنزيلات' : 'Default Download Directory'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={settings.downloadDirectory}
              className="flex-1 glass-input rounded-xl px-4 py-2.5 text-xs text-slate-200 font-mono focus:outline-none"
            />
            <button
              onClick={onSelectDirectory}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isAr ? 'استعراض...' : 'Browse...'}</span>
            </button>
          </div>
        </div>

        {/* Temporary Files Cleanup Button */}
        <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
          <div>
            <p className="text-xs font-semibold text-slate-300">
              {isAr ? 'تنظيف الملفات المؤقتة (.part / .ytdl)' : 'Clean Stale Temporary Files (.part / .ytdl)'}
            </p>
            <p className="text-[11px] text-slate-500">
              {isAr
                ? 'يحذف فقط الملفات المؤقتة غير المكتملة القديمة بأمان لتحرير مساحة القرص.'
                : 'Safely removes stale uncompleted download segments older than 15 minutes.'}
            </p>
          </div>

          <button
            onClick={handleCleanTemp}
            disabled={isCleaning}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{isCleaning ? (isAr ? 'جاري التنظيف...' : 'Cleaning...') : isAr ? 'تنظيف الآن' : 'Clean Temp Files'}</span>
          </button>
        </div>
      </div>

      {/* 2. Download Rules & Concurrency */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-4 shadow-lg">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Gauge className="w-4 h-4 text-indigo-400" />
          <span>{isAr ? '2. قواعد التنزيل والسرعة' : '2. Download Rules, Speed & Concurrency'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'الحد الأقصى للسرعة' : 'Global Speed Limit'}
            </label>
            <select
              value={downloadSpeedLimit}
              onChange={(e) => setDownloadSpeedLimit(e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="unlimited">{isAr ? 'غير محدودة (الأسرع)' : 'Unlimited (Full Bandwidth)'}</option>
              <option value="20M">20 MB/s</option>
              <option value="10M">10 MB/s</option>
              <option value="5M">5 MB/s</option>
              <option value="2M">2 MB/s</option>
              <option value="1M">1 MB/s</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'التنزيلات المتزامنة' : 'Max Concurrent Downloads'}
            </label>
            <select
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="1">1 (Sequential - Saves CPU)</option>
              <option value="2">2 concurrent</option>
              <option value="3">3 (Recommended default)</option>
              <option value="5">5 concurrent</option>
              <option value="8">8 concurrent (High Speed)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'سياسة الملفات المكررة' : 'Duplicate Media Policy'}
            </label>
            <select
              value={duplicateConflictPolicy}
              onChange={(e) => setDuplicateConflictPolicy(e.target.value as any)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="prompt">{isAr ? 'تنبيه وسؤال المستخدم' : 'Prompt / Ask User'}</option>
              <option value="skip">{isAr ? 'تخطي التكرار تلقائياً' : 'Skip Existing Items'}</option>
              <option value="rename">{isAr ? 'تنزيل باسم مرقم فريد' : 'Download with Unique Suffix'}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRetryTransient}
              onChange={(e) => setAutoRetryTransient(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              {isAr ? 'إعادة المحاولة التلقائية للأخطاء المؤقتة (مثل انقطاع الشبكة)' : 'Auto-retry transient failures (Network timeouts, rate limits)'}
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>
              {isAr ? 'إشعارات ويندوز لسطح المكتب عند اكتمال التنزيل' : 'Enable Windows desktop notifications on task completion'}
            </span>
          </label>
        </div>
      </div>

      {/* 3. Appearance & Language */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-4 shadow-lg">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-indigo-400" />
          <span>{isAr ? '3. المظهر واللغة' : '3. Language & Appearance'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'لغة الواجهة' : 'Interface Language'}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="en">English (LTR)</option>
              <option value="ar">العربية (RTL - Arabic)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'السمة والمظهر' : 'Color Theme'}
            </label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="dark">{isAr ? 'المظهر الداكن (Dark Glassmorphism)' : 'Dark Glassmorphism (Default)'}</option>
              <option value="light">{isAr ? 'المظهر الفاتح (Light Mode)' : 'Light Studio Mode'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. External Media Engines (yt-dlp and FFmpeg) */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>{isAr ? '4. محركات الوسائط الخارجية (yt-dlp & FFmpeg)' : '4. Media Engines & External Binaries'}</span>
          </h3>

          <button
            onClick={onRefreshDeps}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isAr ? 'فحص المحركات' : 'Verify Engines'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-black/25 border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">yt-dlp Core Downloader</span>
              {dependencies?.ytDlp?.available ? (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{dependencies.ytDlp.version || 'Operational'}</span>
                </span>
              ) : (
                <span className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Missing</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={customYtDlpPath}
              onChange={(e) => setCustomYtDlpPath(e.target.value)}
              placeholder="Default: bundled bin/yt-dlp.exe"
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
            />
          </div>

          <div className="p-4 rounded-xl bg-black/25 border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">FFmpeg Processor & Converter</span>
              {dependencies?.ffmpeg?.available ? (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{dependencies.ffmpeg.version || 'Operational'}</span>
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Missing</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={customFfmpegPath}
              onChange={(e) => setCustomFfmpegPath(e.target.value)}
              placeholder="Default: bundled bin/ffmpeg.exe"
              className="w-full glass-input rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* 5. Application Updates */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">
              {isAr ? 'تحديثات البرنامج الآلية' : 'Application Updates (GitHub Releases)'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAr ? 'النسخة الحالية:' : 'Current Version:'}{' '}
              <strong className="text-white font-mono">{updateState.currentVersion}</strong>
            </p>
          </div>

          <button
            onClick={onCheckUpdates}
            disabled={['checking', 'downloading', 'downloaded', 'installing'].includes(updateState.status)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all cursor-pointer shadow-sm"
          >
            <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isAr ? 'التحقق من التحديثات' : 'Check for Updates'}</span>
          </button>
        </div>
        <UpdateContent updateState={updateState} lang={lang} onDownload={onDownloadUpdate} onInstall={onInstallUpdate} />
      </div>
    </div>
  );
};
