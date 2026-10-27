import React, { useState, useEffect } from 'react';
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
  Scissors,
  HardDrive,
  Info,
  BookmarkPlus,
} from 'lucide-react';
import {
  MediaInfo,
  MediaFormat,
  CreateDownloadRequest,
  PlaylistBatchDownloadRequest,
  DownloadJob,
  DuplicateCheckResult,
  TimeRange,
  SizeEstimate,
  DiskSpaceCheckResult,
  MediaChapter,
} from '../../types';
import { SupportedLanguage, getTranslation } from '../i18n';

function parseTimestamp(input: string | number): number | null {
  if (typeof input === 'number') {
    return isNaN(input) || input < 0 ? null : input;
  }
  const clean = input.trim();
  if (!clean) return null;
  if (/^\d+(\.\d+)?$/.test(clean)) {
    const val = parseFloat(clean);
    return isNaN(val) || val < 0 ? null : val;
  }
  const parts = clean.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => isNaN(p) || p < 0)) return null;
  if (parts.length === 2) {
    if (parts[1] >= 60) return null;
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    if (parts[1] >= 60 || parts[2] >= 60) return null;
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

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
  const t = (key: string) => getTranslation(key, lang);
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedMedia, setAnalyzedMedia] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateCheckResult | null>(null);

  // Tab inside media card: 'video' | 'audio' | 'subtitles'
  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'audio' | 'subtitles'>('video');

  // Feature 1: Section Clip / Time Range state
  const [enableSectionClip, setEnableSectionClip] = useState(false);
  const [clipStartStr, setClipStartStr] = useState('');
  const [clipEndStr, setClipEndStr] = useState('');
  const [clipLabel, setClipLabel] = useState('');
  const [selectedChapterIdx, setSelectedChapterIdx] = useState<number>(-1);
  const [clipValidationErr, setClipValidationErr] = useState<string | null>(null);
  const [clipDurationSec, setClipDurationSec] = useState<number | null>(null);
  const [cutMode, setCutMode] = useState<'fast' | 'accurate'>('fast');
  const [clipDestination, setClipDestination] = useState<string | undefined>();
  const [ffmpegAvailable, setFfmpegAvailable] = useState(true);

  // Feature 4: Size Estimation & Disk Space state
  const [sizeEstimate, setSizeEstimate] = useState<SizeEstimate | null>(null);
  const [diskSpaceResult, setDiskSpaceResult] = useState<DiskSpaceCheckResult | null>(null);

  // Feature 2: Save Course state
  const [isSavingCourse, setIsSavingCourse] = useState(false);

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
    setEnableSectionClip(false);
    setClipStartStr('');
    setClipEndStr('');
    setClipLabel('');
    setSelectedChapterIdx(-1);
    setClipValidationErr(null);
    setClipDurationSec(null);
    setClipDestination(undefined);

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

  useEffect(() => {
    let mounted = true;
    const unsubscribe = window.electronAPI?.onDependencyStatusChanged((status) => {
      if (mounted) setFfmpegAvailable(status.ffmpeg.available);
    });
    if (window.electronAPI?.checkDependencies) {
      window.electronAPI
        .checkDependencies()
        .then((res) => {
          if (mounted && res?.ffmpeg) {
            setFfmpegAvailable(res.ffmpeg.available);
          }
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!enableSectionClip) {
      setClipValidationErr(null);
      setClipDurationSec(null);
      return;
    }
    const s = parseTimestamp(clipStartStr);
    const e = parseTimestamp(clipEndStr);
    if (s === null || e === null) {
      setClipValidationErr(
        isAr
          ? 'يرجى إدخال وقتي البدء والانتهاء بصيغة صالحة (مثال 01:30 أو 00:01:30)'
          : 'Please enter valid start and end times (e.g. 01:30 or 00:01:30)'
      );
      setClipDurationSec(null);
      return;
    }
    if (s < 0 || e <= s) {
      setClipValidationErr(t('invalidRangeError'));
      setClipDurationSec(null);
      return;
    }
    if (analyzedMedia?.duration && e > analyzedMedia.duration) {
      setClipValidationErr(t('endExceedsDuration'));
      setClipDurationSec(null);
      return;
    }
    setClipValidationErr(null);
    setClipDurationSec(e - s);
  }, [enableSectionClip, clipStartStr, clipEndStr, analyzedMedia?.duration, isAr]);

  useEffect(() => {
    if (!analyzedMedia || analyzedMedia.isPlaylist) {
      setSizeEstimate(null);
      setDiskSpaceResult(null);
      return;
    }

    let isMounted = true;
    const runEstimate = async () => {
      try {
        const isAudio = activeMediaTab === 'audio';
        const audioFormat = analyzedMedia.formats.filter((f) => f.isAudioOnly)
          .sort((a, b) => (b.tbr || 0) - (a.tbr || 0))[0];
        const fmt = isAudio ? audioFormat :
          analyzedMedia.formats.find((f) => f.formatId === selectedFormatId) ||
          analyzedMedia.formats.filter((f) => !f.isAudioOnly)
            .sort((a, b) => (b.height || 0) - (a.height || 0) || (b.tbr || 0) - (a.tbr || 0))[0];
        const cont = isAudio ? selectedAudioFormat : selectedContainer;

        let range: TimeRange | undefined = undefined;
        if (enableSectionClip && !clipValidationErr) {
          const s = parseTimestamp(clipStartStr);
          const e = parseTimestamp(clipEndStr);
          if (s !== null && e !== null && e > s) {
            range = { start: s, end: e, label: clipLabel || undefined };
          }
        }

        if (window.electronAPI?.estimateFormatSize) {
          const est = await window.electronAPI.estimateFormatSize(
            fmt,
            analyzedMedia.duration,
            isAudio,
            audioFormat,
            cont,
            range
          );
          if (!isMounted) return;
          setSizeEstimate(est);

          if (window.electronAPI?.checkDiskSpaceWithEstimates) {
            const ds = await window.electronAPI.checkDiskSpaceWithEstimates(
              undefined,
              est.bytes,
              !isAudio && !!fmt?.isVideoOnly
            );
            if (!isMounted) return;
            if (!isMounted) return;
            setDiskSpaceResult(ds);
          }
        }
      } catch (err) {
        console.error('Error calculating size estimate:', err);
      }
    };

    runEstimate();
    return () => {
      isMounted = false;
    };
  }, [
    analyzedMedia,
    selectedFormatId,
    activeMediaTab,
    selectedAudioFormat,
    selectedContainer,
    enableSectionClip,
    clipStartStr,
    clipEndStr,
    clipValidationErr,
    clipLabel,
  ]);

  const handleSelectChapter = (idx: number) => {
    setSelectedChapterIdx(idx);
    if (!analyzedMedia?.chapters || idx < 0 || idx >= analyzedMedia.chapters.length) return;
    const ch = analyzedMedia.chapters[idx];
    setClipStartStr(formatDuration(ch.startTime));
    setClipEndStr(formatDuration(ch.endTime));
    setClipLabel(ch.title);
  };

  const handleSaveCourse = async () => {
    if (!analyzedMedia || !analyzedMedia.isPlaylist) return;
    if (!window.electronAPI?.saveCourse) return;
    setIsSavingCourse(true);
    try {
      const settings = await window.electronAPI.getSettings();
      const res = await window.electronAPI.saveCourse({
        sourceUrl: analyzedMedia.url,
        platform: analyzedMedia.platform,
        providerPlaylistId: analyzedMedia.id,
        destinationFolder: settings.downloadDirectory,
        title: analyzedMedia.playlistTitle || analyzedMedia.title,
        thumbnailUrl: analyzedMedia.thumbnail,
        preferredQuality: selectedQualityLabel,
        preferredContainer: activeMediaTab === 'audio' ? selectedAudioFormat : selectedContainer,
        isAudioOnly: activeMediaTab === 'audio',
        selectedSubtitles,
        items: (analyzedMedia.playlistItems || []).map((item) => ({
          sourceMediaId: item.id,
          title: item.title,
          url: item.url,
          index: item.index,
          duration: item.duration,
          thumbnailUrl: item.thumbnail,
        })),
      });
      if (res.success) {
        onShowToast(t('courseSavedSuccess'), 'success');
      } else {
        onShowToast(res.error || 'Failed to save course', 'error');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsSavingCourse(false);
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

    let timeRange: TimeRange | undefined = undefined;
    if (enableSectionClip) {
      if (!ffmpegAvailable) {
        onShowToast(t('ffmpegRequiredForClips'), 'error');
        return;
      }
      if (clipValidationErr) {
        onShowToast(clipValidationErr, 'error');
        return;
      }
      const s = parseTimestamp(clipStartStr);
      const e = parseTimestamp(clipEndStr);
      if (s === null || e === null || e <= s) {
        onShowToast(t('invalidRangeError'), 'error');
        return;
      }
      timeRange = {
        start: s,
        end: e,
        label: clipLabel ? clipLabel.trim() : undefined,
      };
    }

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
      timeRange,
      cutMode: timeRange ? cutMode : undefined,
      destinationDirectory: timeRange ? clipDestination : undefined,
      estimatedSizeBytes: sizeEstimate?.bytes,
      sizeEstimationType: sizeEstimate?.type,
    };

    const success = await onStartDownload(req);
    if (success) {
      onShowToast(
        isAr
          ? `تمت إضافة "${analyzedMedia.title.substring(0, 30)}..." إلى قائمة التنزيل!`
          : `Queued "${analyzedMedia.title.substring(0, 30)}..." for download!`,
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
    <div className="px-5 py-6 lg:px-8 lg:py-7 max-w-[1440px] mx-auto space-y-6 animate-fadeIn">
      {/* Hero Welcome Section */}
      {!analyzedMedia && (
        <div className="glass-acrylic relative overflow-hidden rounded-[26px] p-7 lg:p-8 border border-white/[0.08] shadow-2xl">
          <div className="absolute -top-28 -right-28 w-96 h-96 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-28 -left-28 w-96 h-96 bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-cyan-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>{isAr ? 'محرك التنزيل السريع 100% محلي وبدون قيود' : 'High-Speed Local Media Engine • 100% Private'}</span>
            </div>
            <h1 className="text-2xl lg:text-[32px] font-black tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
              {isAr ? 'تنزيل مقاطع الفيديو، الدورات، والصوتيات' : 'Download Videos, Playlists & Complete Courses'}
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed max-w-xl">
              {isAr
                ? 'نزّل أي فيديو أو قائمة تشغيل أو دورة تعليمية كاملة بدقة تصل إلى 4K والصوت الأصلي مباشرة إلى جهازك وبدون أي إعلانات أو قيود سحابية.'
                : 'Fast, offline-first media downloader. Extract 4K videos, full course curricula, chapters, subtitles, and high-fidelity audio straight to your storage.'}
            </p>
          </div>

          {/* Supported Providers Pills */}
          <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-white/[0.06] text-xs">
            <span className="font-semibold text-slate-300 text-[11px] uppercase tracking-wider">{isAr ? 'المنصات المدعومة:' : 'Supported:'}</span>
            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
              YouTube & Shorts
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-300 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              {isAr ? 'الدورات وقوائم التشغيل' : 'Courses & Playlists'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
              Instagram Reels
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              TikTok
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              Facebook & Vimeo
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-300 font-medium">
              + 1000s of Web Media
            </span>
          </div>
        </div>
      )}

      {/* URL Input Box */}
      <div className="glass-acrylic p-2 rounded-2xl border border-white/[0.08] transition-all duration-300 focus-within:border-indigo-500/80 focus-within:shadow-[0_0_35px_rgba(99,102,241,0.22)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAnalyze();
          }}
          className="flex items-center gap-2"
        >
          <div className="pl-3.5 text-slate-400">
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
            className="flex-1 bg-transparent border-0 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-0 px-2 py-3.5"
          />

          {url.trim() && (
            <button
              type="button"
              onClick={() => {
                setUrl('');
                setAnalyzedMedia(null);
                setError(null);
              }}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
              title={isAr ? 'مسح' : 'Clear'}
            >
              ✕
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-slate-200 hover:text-white border border-white/[0.08] transition-all shadow-sm"
            title="Paste from clipboard (Ctrl+V)"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isAr ? 'لصق' : 'Paste'}</span>
            <span className="hidden sm:inline text-[10px] font-mono px-1 py-0.2 rounded bg-white/[0.06] text-slate-400">Ctrl+V</span>
          </button>

          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="btn-glow-primary flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
        <div className="glass-acrylic-card rounded-[28px] overflow-hidden space-y-6 p-6 lg:p-7 border border-white/[0.08] shadow-2xl">
          {/* Header Row: Thumbnail, Info, Channel */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="relative w-full md:w-[380px] h-[220px] rounded-2xl overflow-hidden bg-slate-900/90 border border-white/[0.08] shrink-0 group shadow-xl">
              {analyzedMedia.thumbnail ? (
                <>
                  <div
                    className="absolute inset-0 bg-cover bg-center blur-2xl opacity-40 scale-110 pointer-events-none"
                    style={{ backgroundImage: `url(${analyzedMedia.thumbnail})` }}
                  />
                  <img
                    src={analyzedMedia.thumbnail}
                    alt={analyzedMedia.title}
                    className="relative z-10 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <Video className="w-12 h-12" />
                </div>
              )}

              {analyzedMedia.duration && (
                <div className="absolute bottom-2.5 right-2.5 z-20 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md text-[11px] font-mono font-bold text-white flex items-center gap-1.5 shadow-md border border-white/10">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{formatDuration(analyzedMedia.duration)}</span>
                </div>
              )}

              {analyzedMedia.isPlaylist && (
                <div className="absolute top-2.5 left-2.5 z-20 px-3 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-xs font-extrabold text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/40 border border-white/20">
                  <ListVideo className="w-3.5 h-3.5" />
                  <span>{isAr ? 'دورة / قائمة تشغيل' : 'Course / Playlist'} ({analyzedMedia.playlistItemCount || 0} {isAr ? 'درس' : 'items'})</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
                  {analyzedMedia.platform}
                </span>
                {analyzedMedia.isPlaylist && (
                  <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold">
                    {isAr ? 'دورة تعليمية منظمة' : 'Structured Course'}
                  </span>
                )}
              </div>

              <h2 className="text-xl lg:text-2xl font-black text-white leading-snug tracking-tight">
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
          <div className="p-3.5 rounded-2xl glass-acrylic border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-300 font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>{isAr ? 'التشكيل السريع للجودة:' : 'Quality Preset:'}</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'best' as const, label: isAr ? 'أفضل جودة (تلقائي)' : 'Best Quality (Auto)' },
                { id: '1080p' as const, label: '1080p Full HD' },
                { id: '720p' as const, label: '720p HD' },
                { id: 'small' as const, label: isAr ? 'حجم أصغر (480p)' : 'Data Saver (480p)' },
                { id: 'audio' as const, label: isAr ? 'صوت فقط (MP3)' : 'Audio Only' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyProfile(p.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    activeProfile === p.id
                      ? 'btn-glow-primary shadow-md'
                      : 'glass-acrylic text-slate-300 hover:text-white hover:border-white/20'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Media Option Tabs */}
          <div className="border-t border-white/[0.08] pt-5">
            <div className="flex flex-wrap items-center justify-between border-b border-white/[0.06] pb-4 gap-3">
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/20 border border-white/[0.06]">
                <button
                  onClick={() => setActiveMediaTab('video')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeMediaTab === 'video'
                      ? 'btn-glow-primary shadow-lg shadow-indigo-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Video className="w-4 h-4" />
                  <span>{isAr ? 'تنزيل الفيديو' : 'Video Download'}</span>
                </button>

                <button
                  onClick={() => setActiveMediaTab('audio')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeMediaTab === 'audio'
                      ? 'btn-glow-primary shadow-lg shadow-indigo-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span>{isAr ? 'صوت فقط' : 'Audio Only'}</span>
                </button>

                {analyzedMedia.subtitles && analyzedMedia.subtitles.length > 0 && (
                  <button
                    onClick={() => setActiveMediaTab('subtitles')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeMediaTab === 'subtitles'
                        ? 'btn-glow-primary shadow-lg shadow-indigo-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
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
                      className="glass-input rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
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
                    className="glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
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
              <div className="py-5 space-y-3.5">
                <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  {isAr ? 'اختر الجودة المطلوبة من المصدر:' : 'Select Desired Quality from Source:'}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                          className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-transparent border-indigo-500 text-white shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500'
                              : 'glass-acrylic text-slate-300 hover:border-white/20 hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm tracking-tight">{fmt.qualityLabel}</span>
                            {isSelected ? (
                              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/50">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-600" />
                            )}
                          </div>
                          <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.05]">{fmt.resolution || fmt.ext.toUpperCase()}</span>
                            {fmt.filesize && (
                              <span className="font-semibold text-slate-300">{(fmt.filesize / (1024 * 1024)).toFixed(1)} MB</span>
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

            {!analyzedMedia.isPlaylist && (
              <section className="mt-7 rounded-[20px] border border-cyan-400/25 bg-[#091524]/80 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.22)]" aria-labelledby="clip-heading">
                <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 bg-gradient-to-r from-cyan-500/[0.08] to-indigo-500/[0.06]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center"><Scissors className="w-4 h-4 text-cyan-300" /></span>
                      <div>
                    <h3 id="clip-heading" className="text-base font-bold text-white">
                      {t('downloadSection')}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">{t('downloadSectionDesc')}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableSectionClip}
                    onClick={() => {
                      const next = !enableSectionClip;
                      setEnableSectionClip(next);
                    }}
                    className={`focus-ring min-w-36 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                      enableSectionClip
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500'
                    }`}
                  >
                    {enableSectionClip ? t('enableSection') : t('fullVideoDefault')}
                  </button>
                </div>

                {enableSectionClip && (
                  <div className="p-5 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[isAr ? '١. حدد الوقت' : '1. Select range', isAr ? '٢. اختر الدقة' : '2. Choose quality', isAr ? '٣. اختر المجلد' : '3. Destination', isAr ? '٤. ابدأ التنزيل' : '4. Download'].map((step, index) => (
                        <div key={step} className={`px-3 py-2 rounded-lg text-[11px] font-semibold border ${index === 0 ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-slate-800 bg-slate-900/50 text-slate-400'}`}>{step}</div>
                      ))}
                    </div>
                    {analyzedMedia.duration && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="text-xs text-slate-300">
                          <span className="block mb-1.5">{t('startTime')}</span>
                          <input
                            aria-label={t('startTime')}
                            type="range"
                            min={0}
                            max={analyzedMedia.duration}
                            step="0.1"
                            value={parseTimestamp(clipStartStr) ?? 0}
                            onChange={(event) => setClipStartStr(formatDuration(Number(event.target.value)))}
                            className="w-full accent-indigo-500"
                          />
                        </label>
                        <label className="text-xs text-slate-300">
                          <span className="block mb-1.5">{t('endTime')}</span>
                          <input
                            aria-label={t('endTime')}
                            type="range"
                            min={0}
                            max={analyzedMedia.duration}
                            step="0.1"
                            value={parseTimestamp(clipEndStr) ?? analyzedMedia.duration}
                            onChange={(event) => setClipEndStr(formatDuration(Number(event.target.value)))}
                            className="w-full accent-cyan-500"
                          />
                        </label>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-900/35 p-4">
                      <label className="text-xs text-slate-300">
                        <span className="block mb-1.5">{t('startTime')}</span>
                        <input value={clipStartStr} onChange={(e) => setClipStartStr(e.target.value)} placeholder={t('timeRangePlaceholder')} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
                      </label>
                      <label className="text-xs text-slate-300">
                        <span className="block mb-1.5">{t('endTime')}</span>
                        <input value={clipEndStr} onChange={(e) => setClipEndStr(e.target.value)} placeholder={t('timeRangePlaceholder')} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
                      </label>
                      <label className="text-xs text-slate-300">
                        <span className="block mb-1.5">{isAr ? 'اسم المقطع (اختياري)' : 'Clip label (optional)'}</span>
                        <input value={clipLabel} onChange={(e) => setClipLabel(e.target.value)} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
                      </label>
                    </div>

                    {analyzedMedia.chapters && analyzedMedia.chapters.length > 0 && (
                      <label className="block text-xs text-slate-300">
                        <span className="block mb-1.5">{t('selectChapter')}</span>
                        <select value={selectedChapterIdx} onChange={(e) => handleSelectChapter(Number(e.target.value))} className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white">
                          <option value={-1}>{t('customRange')}</option>
                          {analyzedMedia.chapters.map((chapter, index) => (
                            <option key={`${chapter.startTime}-${index}`} value={index}>{chapter.title} ({formatDuration(chapter.startTime)}–{formatDuration(chapter.endTime)})</option>
                          ))}
                        </select>
                      </label>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={isAr ? 'دقة القص' : 'Cut accuracy'}>
                      {(['fast', 'accurate'] as const).map((mode) => (
                        <button key={mode} type="button" role="radio" aria-checked={cutMode === mode} onClick={() => setCutMode(mode)} className={`focus-ring p-4 rounded-xl border text-start transition-all ${cutMode === mode ? 'border-cyan-400/50 bg-cyan-400/10 text-white shadow-[inset_0_0_0_1px_rgba(34,211,238,.12)]' : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'}`}>
                          <span className="block text-xs font-bold">{mode === 'fast' ? (isAr ? 'قص سريع' : 'Fast Cut') : (isAr ? 'قص دقيق' : 'Accurate Cut')}</span>
                          <span className="block mt-1 text-[11px] text-slate-400">{mode === 'fast' ? t('keyframeDisclaimer') : (isAr ? 'حدود أدق بإعادة الترميز عند الحاجة؛ أبطأ ويستهلك المعالج.' : 'More precise boundaries using re-encoding when needed; slower and CPU intensive.')}</span>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await window.electronAPI.selectDirectory();
                          if (result.success && result.path) setClipDestination(result.path);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:border-indigo-500"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        {isAr ? 'اختيار مجلد الحفظ' : 'Choose destination'}
                      </button>
                      <span className="truncate text-[11px] text-slate-400">{clipDestination || (isAr ? 'مجلد التنزيلات الافتراضي' : 'Default Downloads folder')}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5"><span className="block text-[10px] text-slate-500">{isAr ? 'مدة المقطع' : 'Duration'}</span><strong className="text-sm text-white">{clipDurationSec !== null ? formatDuration(clipDurationSec) : '—'}</strong></div>
                      <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5"><span className="block text-[10px] text-slate-500">{isAr ? 'الصيغة' : 'Format'}</span><strong className="text-sm text-white">{activeMediaTab === 'audio' ? selectedAudioFormat.toUpperCase() : selectedContainer.toUpperCase()}</strong></div>
                      <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5"><span className="block text-[10px] text-slate-500">{isAr ? 'الحجم المتوقع' : 'Estimated size'}</span><strong className="text-sm text-white">{sizeEstimate?.bytes ? `${(sizeEstimate.bytes / 1048576).toFixed(1)} MB` : '—'}</strong></div>
                      <div className="rounded-xl bg-slate-900/60 border border-slate-800 px-3 py-2.5"><span className="block text-[10px] text-slate-500">{isAr ? 'مساحة القرص' : 'Disk check'}</span><strong className={`text-sm ${diskSpaceResult?.isInsufficient ? 'text-rose-400' : 'text-emerald-400'}`}>{diskSpaceResult?.isInsufficient ? (isAr ? 'غير كافية' : 'Insufficient') : (isAr ? 'جاهز' : 'Ready')}</strong></div>
                    </div>

                    <div aria-live="polite" className={`text-xs ${clipValidationErr ? 'text-red-400' : 'text-emerald-400'}`}>
                      {clipValidationErr || (clipDurationSec !== null ? `${t('clipDuration')}: ${formatDuration(clipDurationSec)}` : '')}
                    </div>
                    {!ffmpegAvailable && <p className="text-xs text-amber-300">{t('ffmpegRequiredForClips')}</p>}
                    <p className="text-[11px] text-slate-400">{isAr ? 'سيطلب التطبيق من المصدر تنزيل النطاق المحدد فقط. قد ترسل بعض الخوادم بيانات إضافية حول الإطارات المطلوبة، ولن يتم تنزيل الفيديو الكامل بصمت.' : 'The app requests only the selected section. Some servers may transfer extra data around required keyframes; the full video will never be downloaded silently as a fallback.'}</p>
                  </div>
                )}
              </section>
            )}

            {/* Bottom Actions */}
            <div className="mt-8 pt-6 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Folder className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-slate-400">{isAr ? 'المجلد الوجهة: ' : 'Destination: '}</span>
                <span className="font-semibold text-slate-200 truncate max-w-xs">{enableSectionClip && clipDestination ? clipDestination : (isAr ? 'مجلد التنزيلات الافتراضي' : 'Default Downloads Folder')}</span>
              </div>

              {analyzedMedia.isPlaylist ? (
                <button
                  onClick={handleDownloadPlaylist}
                  disabled={selectedPlaylistIndices.size === 0}
                  className="btn-glow-primary flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-extrabold text-white shadow-xl shadow-indigo-500/30 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4 animate-bounce" />
                  <span>{isAr ? `تنزيل الدورة كاملة (${selectedPlaylistIndices.size} فيديو)` : `Download Course (${selectedPlaylistIndices.size} Videos)`}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleDownloadSingle(activeMediaTab === 'audio')}
                  disabled={enableSectionClip && (!!clipValidationErr || !ffmpegAvailable || diskSpaceResult?.isInsufficient)}
                  className="btn-glow-primary flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl text-sm font-extrabold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xl shadow-indigo-500/30 cursor-pointer"
                >
                  <Download className="w-4 h-4 animate-pulse" />
                  <span>
                    {activeMediaTab === 'audio'
                      ? `${enableSectionClip ? (isAr ? 'تنزيل المقطع الصوتي' : 'Download Audio Clip') : (isAr ? 'تنزيل الصوت' : 'Download Audio')} (${selectedAudioFormat.toUpperCase()})`
                      : `${enableSectionClip ? (isAr ? 'تنزيل المقطع' : 'Download Clip') : (isAr ? 'تنزيل الفيديو' : 'Download Video')} (${selectedQualityLabel})`}
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
