import React, { useState } from 'react';
import {
  Search,
  Clipboard,
  Sparkles,
  Download,
  Music,
  Video,
  Subtitles,
  Check,
  CheckCircle,
  Clock,
  User,
  ListVideo,
  Layers,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  Folder,
  Play,
  Gauge,
  Sliders,
} from 'lucide-react';
import {
  MediaInfo,
  MediaFormat,
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  DownloadJob,
  DuplicateCheckResult,
} from '../../types';
import { SupportedLanguage } from '../i18n';

interface HomeViewProps {
  onStartDownload: (req: CreateDownloadRequest) => Promise<boolean>;
  onStartPlaylistDownload: (req: PlaylistBatchDownloadRequest) => Promise<boolean>;
  activeJobs: DownloadJob[];
  onNavigateToDownloads: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onStartDownload,
  onStartPlaylistDownload,
  activeJobs,
  onNavigateToDownloads,
  onShowToast,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedMedia, setAnalyzedMedia] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);

  // Tab inside media card: 'video' | 'audio' | 'subtitles'
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'audio' | 'subtitles'>('video');

  // Selected format state
  const [selectedFormatId, setSelectedFormatId] = useState<string>('bestvideo+bestaudio/best');
  const [selectedQualityLabel, setSelectedQualityLabel] = useState<string>('Best Available Quality');
  const [selectedContainer, setSelectedContainer] = useState<string>('mp4');
  const [selectedAudioFormat, setSelectedAudioFormat] = useState<string>('mp3');
  const [selectedSubtitles, setSelectedSubtitles] = useState<string[]>([]);
  const [embedSubtitles, setEmbedSubtitles] = useState(true);
  const [speedLimit, setSpeedLimit] = useState<string>('unlimited');

  // Quality Preset Profile
  const [activeProfile, setActiveProfile] = useState<'best' | '1080p' | '720p' | 'small' | 'audio' | 'custom'>('best');

  // Playlist selection
  const [selectedPlaylistIndices, setSelectedPlaylistIndices] = useState<Set<number>>(new Set());
  const [organizeCourseInFolder, setOrganizeCourseInFolder] = useState(true);

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrl(text.trim());
        handleAnalyze(text.trim());
      }
    } catch {
      onShowToast(
        isAr ? 'تعذر الوصول إلى الحافظة. يرجى اللصق باستخدام Ctrl+V.' : 'Could not access clipboard. Please paste using Ctrl+V.',
        'error'
      );
    }
  };

  const handleAnalyze = async (targetUrl = url) => {
    if (!targetUrl.trim()) {
      setError(isAr ? 'يرجى إدخال رابط وسائط صالح.' : 'Please enter a media URL.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalyzedMedia(null);
    setDuplicateInfo(null);

    try {
      // 1. Check duplicate status
      if (window.electronAPI?.checkDuplicate) {
        const dup = await window.electronAPI.checkDuplicate(targetUrl.trim());
        if (dup.isDuplicate) {
          setDuplicateInfo(dup);
        }
      }

      // 2. Analyze URL metadata
      const res = await window.electronAPI.analyzeUrl(targetUrl.trim());
      if (res.success && res.data) {
        setAnalyzedMedia(res.data);

        // Default to best format
        if (res.data.formats.length > 0) {
          const first = res.data.formats[0];
          setSelectedFormatId(first.formatId);
          setSelectedQualityLabel(first.qualityLabel);
        }

        // If playlist, select all items by default
        if (res.data.isPlaylist && res.data.playlistItems) {
          const allIndices = new Set(res.data.playlistItems.map((item) => item.index));
          setSelectedPlaylistIndices(allIndices);
        }

        onShowToast(isAr ? 'تم تحليل الوسائط بنجاح!' : 'Media analyzed successfully!', 'success');
      } else {
        setError(res.error || (isAr ? 'تعذر استخراج بيانات الوسائط.' : 'Failed to extract media information.'));
        onShowToast(res.error || 'Failed to extract media information.', 'error');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyProfile = (profile: 'best' | '1080p' | '720p' | 'small' | 'audio' | 'custom') => {
    setActiveProfile(profile);
    if (!analyzedMedia) return;

    if (profile === 'best') {
      const best = analyzedMedia.formats[0];
      if (best) {
        setSelectedFormatId(best.formatId);
        setSelectedQualityLabel(best.qualityLabel);
        setActiveMediaTab('video');
      }
    } else if (profile === '1080p') {
      const target = analyzedMedia.formats.find((f) => f.height === 1080) || analyzedMedia.formats[0];
      if (target) {
        setSelectedFormatId(target.formatId);
        setSelectedQualityLabel(target.qualityLabel);
        setActiveMediaTab('video');
      }
    } else if (profile === '720p') {
      const target = analyzedMedia.formats.find((f) => f.height === 720) || analyzedMedia.formats[0];
      if (target) {
        setSelectedFormatId(target.formatId);
        setSelectedQualityLabel(target.qualityLabel);
        setActiveMediaTab('video');
      }
    } else if (profile === 'small') {
      const target = analyzedMedia.formats.find((f) => f.height && f.height <= 480) || analyzedMedia.formats[analyzedMedia.formats.length - 1];
      if (target) {
        setSelectedFormatId(target.formatId);
        setSelectedQualityLabel(target.qualityLabel);
        setActiveMediaTab('video');
      }
    } else if (profile === 'audio') {
      setActiveMediaTab('audio');
    }
  };

  const handleDownloadSingle = async (isAudio: boolean) => {
    if (!analyzedMedia) return;

    const req: CreateDownloadRequest = {
      url: analyzedMedia.url,
      title: analyzedMedia.title,
      thumbnail: analyzedMedia.thumbnail,
      duration: analyzedMedia.duration,
      platform: analyzedMedia.platform,
      formatId: isAudio ? 'bestaudio/best' : selectedFormatId,
      qualityLabel: isAudio ? `Audio (${selectedAudioFormat.toUpperCase()})` : selectedQualityLabel,
      isAudioOnly: isAudio,
      container: isAudio ? selectedAudioFormat : selectedContainer,
      selectedSubtitles: selectedSubtitles.length > 0 ? selectedSubtitles : undefined,
      embedSubtitles: embedSubtitles && selectedSubtitles.length > 0,
      speedLimit: speedLimit !== 'unlimited' ? speedLimit : undefined,
    };

    const success = await onStartDownload(req);
    if (success) {
      onShowToast(
        isAr ? `تمت إضافة "${analyzedMedia.title.substring(0, 30)}..." إلى قائمة التنزيل!` : `Queued "${analyzedMedia.title.substring(0, 30)}..." for download!`,
        'success'
      );
    }
  };

  const handleDownloadPlaylist = async () => {
    if (!analyzedMedia || !analyzedMedia.playlistItems) return;

    const selectedItems = analyzedMedia.playlistItems.filter((i) =>
      selectedPlaylistIndices.has(i.index)
    );

    if (selectedItems.length === 0) {
      onShowToast(isAr ? 'يرجى تحديد مقطع فيديو واحد على الأقل للتنزيل.' : 'Please select at least one video to download.', 'error');
      return;
    }

    const isAudio = activeMediaTab === 'audio';

    const req: PlaylistBatchDownloadRequest = {
      playlistTitle: analyzedMedia.playlistTitle || analyzedMedia.title,
      items: selectedItems.map((item) => ({
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        index: item.index,
      })),
      qualityLabel: isAudio ? `Audio (${selectedAudioFormat.toUpperCase()})` : selectedQualityLabel,
      formatId: isAudio ? 'bestaudio/best' : selectedFormatId,
      isAudioOnly: isAudio,
      container: isAudio ? selectedAudioFormat : selectedContainer,
      organizeInFolder: organizeCourseInFolder,
      speedLimit: speedLimit !== 'unlimited' ? speedLimit : undefined,
    };

    const success = await onStartPlaylistDownload(req);
    if (success) {
      onShowToast(
        isAr ? `تم بدء تنزيل الدورة (${selectedItems.length} مقطع فيديو)!` : `Started course batch download (${selectedItems.length} videos)!`,
        'success'
      );
    }
  };

  const handleDownloadStandaloneSubtitles = async () => {
    if (!analyzedMedia || selectedSubtitles.length === 0) {
      onShowToast(isAr ? 'يرجى تحديد لغة ترجمة واحدة على الأقل.' : 'Please select at least one subtitle language.', 'error');
      return;
    }

    if (!window.electronAPI?.downloadStandaloneSubtitle) return;

    const langCode = selectedSubtitles[0];
    onShowToast(isAr ? 'جاري تنزيل ملف الترجمة...' : 'Downloading standalone subtitle...', 'info');

    const res = await window.electronAPI.downloadStandaloneSubtitle(
      analyzedMedia.url,
      langCode,
      'srt',
      undefined,
      analyzedMedia.title
    );

    if (res.success) {
      onShowToast(isAr ? 'تم تنزيل ملف الترجمة SRT بنجاح!' : 'Subtitle downloaded successfully as SRT!', 'success');
    } else {
      onShowToast(res.error || 'Failed to download subtitle', 'error');
    }
  };

  const togglePlaylistSelection = (index: number) => {
    const next = new Set(selectedPlaylistIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedPlaylistIndices(next);
  };

  const selectAllPlaylist = () => {
    if (!analyzedMedia?.playlistItems) return;
    setSelectedPlaylistIndices(new Set(analyzedMedia.playlistItems.map((i) => i.index)));
  };

  const deselectAllPlaylist = () => {
    setSelectedPlaylistIndices(new Set());
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Hero Welcome Section */}
      <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-br from-indigo-950/60 via-[#0d1322] to-slate-900 border border-slate-800 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isAr ? 'محرك تنزيل محلي فائق السرعة' : 'High-Speed Local Media Downloader'}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
            {isAr ? 'تنزيل الدورات التعليمية ومقاطع الفيديو وقوائم التشغيل' : 'Download Educational Courses, Videos & Playlists'}
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            {isAr
              ? 'سريع وآمن وخاص ومحلي 100%. نزّل دورات يوتيوب الكاملة، المحاضرات، المقاطع بجودات تصل إلى 4K، والصوتيات مباشرة إلى جهازك.'
              : 'Fast, private, and offline-first. Download YouTube courses, lectures, high-resolution videos, and audio directly to your computer.'}
          </p>
        </div>

        {/* Supported Providers Pills */}
        <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-slate-800/60 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">{isAr ? 'المنصات المدعومة:' : 'Supported:'}</span>
          <span className="px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 font-medium">YouTube</span>
          <span className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 font-medium">{isAr ? 'قوائم التشغيل والدورات' : 'Playlists & Courses'}</span>
          <span className="px-2.5 py-1 rounded-md bg-pink-500/10 border border-pink-500/20 text-pink-400 font-medium">Instagram Reels</span>
          <span className="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">Vimeo</span>
          <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">+ 1000s of Web Media</span>
        </div>
      </div>

      {/* URL Input Box */}
      <div className="glass-panel p-3 rounded-2xl shadow-2xl border border-slate-700/60 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex items-center gap-2"
        >
          <div className="pl-3 text-slate-400">
            <Search className="w-5 h-5 text-indigo-400" />
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={
              isAr
                ? 'الصق رابط الفيديو أو الدورة أو قائمة التشغيل هنا...'
                : 'Paste video, course or playlist URL here (e.g. https://www.youtube.com/watch?v=...)'
            }
            className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-0 px-2 py-3"
          />

          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span>{isAr ? 'لصق' : 'Paste'}</span>
          </button>

          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>{isAr ? 'جاري الفحص...' : 'Analyzing...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? 'فحص الرابط' : 'Analyze'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Duplicate Warning Alert Banner */}
      {duplicateInfo && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold block">
                {isAr ? 'تنبيه: تم العثور على هذا المحتوى مسبقاً' : 'Notice: This media was already downloaded'}
              </span>
              <span className="text-amber-200/80">
                {duplicateInfo.existingEntry
                  ? `${isAr ? 'تم تنزيله في' : 'Completed on'} ${new Date(duplicateInfo.existingEntry.completedAt).toLocaleDateString()}`
                  : isAr
                  ? 'يوجد حالياً في قائمة الانتظار'
                  : 'Currently in download queue'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {duplicateInfo.existingFilePath && (
              <button
                onClick={() => window.electronAPI?.openFile(duplicateInfo.existingFilePath!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 font-semibold"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isAr ? 'تشغيل الملف الحالي' : 'Play Existing'}</span>
              </button>
            )}
            <button
              onClick={() => setDuplicateInfo(null)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
            >
              {isAr ? 'تجاهل' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      {/* Error Message Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 text-xs font-semibold underline ml-4"
          >
            {isAr ? 'إغلاق' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Active Jobs Quick Status Bar */}
      {activeJobs.length > 0 && (
        <div
          onClick={onNavigateToDownloads}
          className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 hover:border-indigo-500/60 cursor-pointer flex items-center justify-between transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <div>
              <p className="text-sm font-semibold text-white">
                {activeJobs.length} {activeJobs.length === 1 ? 'download' : 'downloads'} {isAr ? 'قيد التنزيل حالياً' : 'in progress'}
              </p>
              <p className="text-xs text-slate-400">
                {isAr ? 'انقر لفتح شاشة التنزيلات ومتابعة السرعة اللحظية والتحكم' : 'Click to open Download Manager and view live speeds and status'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 group-hover:text-indigo-300">
            <span>{isAr ? 'عرض المدير' : 'View Manager'}</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      )}

      {/* Media Analysis Result */}
      {analyzedMedia && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-700 shadow-2xl space-y-6 p-6">
          {/* Header Row: Thumbnail, Info, Channel */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="relative w-full md:w-72 h-44 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 group">
              {analyzedMedia.thumbnail ? (
                <img
                  src={analyzedMedia.thumbnail}
                  alt={analyzedMedia.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Video className="w-12 h-12" />
                </div>
              )}

              {analyzedMedia.duration && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[11px] font-mono text-white flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDuration(analyzedMedia.duration)}</span>
                </div>
              )}

              {analyzedMedia.isPlaylist && (
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-indigo-600/90 text-xs font-bold text-white flex items-center gap-1 shadow-md">
                  <ListVideo className="w-3.5 h-3.5" />
                  <span>{isAr ? 'دورة / قائمة' : 'Course / Playlist'} ({analyzedMedia.playlistItemCount || 0} {isAr ? 'درس' : 'items'})</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold uppercase tracking-wider">
                  {analyzedMedia.platform}
                </span>
                {analyzedMedia.isPlaylist && (
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[11px] font-semibold">
                    {isAr ? 'قائمة تشغيل منظمة' : 'Structured Playlist'}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white leading-snug">
                {analyzedMedia.title}
              </h2>

              {analyzedMedia.uploader && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium text-slate-300">{analyzedMedia.uploader}</span>
                  {analyzedMedia.uploaderUrl && (
                    <a
                      href={analyzedMedia.uploaderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {analyzedMedia.description && (
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1">
                  {analyzedMedia.description}
                </p>
              )}
            </div>
          </div>

          {/* Quality Profiles Bar */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isAr ? 'التشكيل الافتراضي:' : 'Quality Profile:'}</span>
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'best' as const, label: isAr ? 'أفضل جودة' : 'Best Quality' },
                { id: '1080p' as const, label: '1080p Full HD' },
                { id: '720p' as const, label: '720p HD' },
                { id: 'small' as const, label: isAr ? 'حجم أصغر (480p)' : 'Smaller File (480p)' },
                { id: 'audio' as const, label: isAr ? 'صوت فقط (MP3)' : 'Audio Only' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyProfile(p.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeProfile === p.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Media Option Tabs */}
          <div className="border-t border-slate-800 pt-4">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveMediaTab('video')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeMediaTab === 'video'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>{isAr ? 'تنزيل الفيديو' : 'Video Download'}</span>
                </button>

                <button
                  onClick={() => setActiveMediaTab('audio')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeMediaTab === 'audio'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span>{isAr ? 'صوت فقط' : 'Audio Only'}</span>
                </button>

                {analyzedMedia.subtitles && analyzedMedia.subtitles.length > 0 && (
                  <button
                    onClick={() => setActiveMediaTab('subtitles')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeMediaTab === 'subtitles'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Subtitles className="w-4 h-4" />
                    <span>{isAr ? 'ملفات الترجمة' : 'Subtitles'} ({analyzedMedia.subtitles.length})</span>
                  </button>
                )}
              </div>

              {/* Speed Limit & Container Controls */}
              <div className="flex items-center gap-3 text-xs">
                {activeMediaTab === 'video' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">{isAr ? 'الحاوية:' : 'Container:'}</span>
                    <select
                      value={selectedContainer}
                      onChange={(e) => setSelectedContainer(e.target.value)}
                      className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="mp4">MP4 (Recommended)</option>
                      <option value="mkv">MKV (Matroska)</option>
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={speedLimit}
                    onChange={(e) => setSpeedLimit(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    title={isAr ? 'تحديد السرعة لهذا التنزيل' : 'Speed limit for this download'}
                  >
                    <option value="unlimited">{isAr ? 'سرعة غير محدودة' : 'Unlimited Speed'}</option>
                    <option value="10M">10 MB/s</option>
                    <option value="5M">5 MB/s</option>
                    <option value="2M">2 MB/s</option>
                    <option value="1M">1 MB/s</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Video Qualities Tab */}
            {activeMediaTab === 'video' && (
              <div className="py-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300">
                  {isAr ? 'اختر الجودة المطلوبة من المصدر:' : 'Select Desired Quality from Source:'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {analyzedMedia.formats
                    .filter((f) => !f.isAudioOnly)
                    .map((fmt) => {
                      const isSelected = selectedFormatId === fmt.formatId;
                      return (
                        <div
                          key={fmt.formatId}
                          onClick={() => {
                            setSelectedFormatId(fmt.formatId);
                            setSelectedQualityLabel(fmt.qualityLabel);
                            setActiveProfile('custom');
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm">{fmt.qualityLabel}</span>
                            {isSelected && <Check className="w-4 h-4 text-indigo-400" />}
                          </div>
                          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>{fmt.resolution || fmt.ext.toUpperCase()}</span>
                            {fmt.filesize && (
                              <span>{(fmt.filesize / (1024 * 1024)).toFixed(1)} MB</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Audio Tab */}
            {activeMediaTab === 'audio' && (
              <div className="py-4 space-y-3">
                <p className="text-xs font-semibold text-slate-300">
                  {isAr ? 'اختر صيغة استخراج الصوت:' : 'Select Audio Format:'}
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <div
                    onClick={() => setSelectedAudioFormat('mp3')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedAudioFormat === 'mp3'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">MP3 Audio</span>
                      {selectedAudioFormat === 'mp3' && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAr ? 'أعلى توافق مع جميع الأجهزة والمشغلات' : 'Universal compatibility, converted via FFmpeg'}
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedAudioFormat('m4a')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      selectedAudioFormat === 'm4a'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">M4A / AAC</span>
                      {selectedAudioFormat === 'm4a' && <Check className="w-4 h-4 text-indigo-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAr ? 'جودة التدفق الأصلية بأسرع وقت' : 'Original stream quality, fastest download'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Subtitles Tab */}
            {activeMediaTab === 'subtitles' && (
              <div className="py-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="embedSubs"
                      checked={embedSubtitles}
                      onChange={(e) => setEmbedSubtitles(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="embedSubs" className="text-xs font-medium text-slate-300 cursor-pointer">
                      {isAr ? 'دمج الترجمة المحددة داخل حاوية الفيديو (MKV/MP4)' : 'Embed selected subtitles into video container (Soft Subtitles)'}
                    </label>
                  </div>

                  <button
                    onClick={handleDownloadStandaloneSubtitles}
                    disabled={selectedSubtitles.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 disabled:opacity-50 transition-all self-start sm:self-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تنزيل ملف الترجمة منفصلاً (.SRT)' : 'Download Standalone Subtitle (.SRT)'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                  {analyzedMedia.subtitles.map((sub) => {
                    const isChecked = selectedSubtitles.includes(sub.language);
                    return (
                      <div
                        key={sub.language}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedSubtitles(selectedSubtitles.filter((l) => l !== sub.language));
                          } else {
                            setSelectedSubtitles([...selectedSubtitles, sub.language]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-colors ${
                          isChecked
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate">{sub.name}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Playlist / Course Items Checklist */}
            {analyzedMedia.isPlaylist && analyzedMedia.playlistItems && (
              <div className="mt-6 pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {isAr ? 'محتوى الدورة التعليمية' : 'Course Curriculum'} ({selectedPlaylistIndices.size} of {analyzedMedia.playlistItems.length} {isAr ? 'محدد' : 'selected'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={selectAllPlaylist}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {isAr ? 'تحديد الكل' : 'Select All'}
                    </button>
                    <button
                      onClick={deselectAllPlaylist}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {isAr ? 'إلغاء التحديد' : 'Deselect All'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    id="organizeCourse"
                    checked={organizeCourseInFolder}
                    onChange={(e) => setOrganizeCourseInFolder(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600"
                  />
                  <label htmlFor="organizeCourse" className="cursor-pointer">
                    {isAr ? 'تنظيم في مجلد فرعي مرقم: ' : 'Organize into numbered folder: '}
                    <span className="text-indigo-300 font-mono">Downloads/{analyzedMedia.title.substring(0, 30)}/01 - Title.mp4</span>
                  </label>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {analyzedMedia.playlistItems.map((item) => {
                    const isChecked = selectedPlaylistIndices.has(item.index);
                    return (
                      <div
                        key={item.id}
                        onClick={() => togglePlaylistSelection(item.index)}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-slate-900/90 border-indigo-500/50 text-slate-100'
                            : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="font-mono text-xs w-6 text-slate-400 font-semibold">
                            {String(item.index).padStart(2, '0')}.
                          </span>
                          <span className="font-medium truncate">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {item.duration && (
                            <span className="text-[11px] text-slate-400 font-mono">
                              {formatDuration(item.duration)}
                            </span>
                          )}
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              isChecked
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-slate-700'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                <span>{isAr ? 'المجلد الوجهة: ' : 'Destination: '}</span>
                <span className="font-semibold text-slate-300">{isAr ? 'مجلد التنزيلات الافتراضي' : 'Default Downloads Folder'}</span>
              </div>

              {analyzedMedia.isPlaylist ? (
                <button
                  onClick={handleDownloadPlaylist}
                  disabled={selectedPlaylistIndices.size === 0}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{isAr ? `تنزيل الدورة (${selectedPlaylistIndices.size} فيديو)` : `Download Course (${selectedPlaylistIndices.size} Videos)`}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleDownloadSingle(activeMediaTab === 'audio')}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {activeMediaTab === 'audio'
                      ? `${isAr ? 'تنزيل الصوت' : 'Download Audio'} (${selectedAudioFormat.toUpperCase()})`
                      : `${isAr ? 'تنزيل الفيديو' : 'Download Video'} (${selectedQualityLabel})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
