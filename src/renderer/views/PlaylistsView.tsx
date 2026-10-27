import React, { useState } from 'react';
import {
  ListVideo,
  FolderTree,
  Search,
  Sparkles,
  Download,
  Check,
  Clock,
  Layers,
  CheckCircle2,
  Folder,
  Gauge,
  Sliders,
} from 'lucide-react';
import { MediaInfo, PlaylistBatchDownloadRequest, DownloadJob } from '../../types';
import { SupportedLanguage } from '../i18n';

interface PlaylistsViewProps {
  onStartPlaylistDownload: (req: PlaylistBatchDownloadRequest) => Promise<boolean>;
  queue: DownloadJob[];
  onOpenFolder: (path: string) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  onStartPlaylistDownload,
  queue,
  onOpenFolder,
  onShowToast,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [playlistMedia, setPlaylistMedia] = useState<MediaInfo | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [qualityLabel, setQualityLabel] = useState('Full HD (1080p)');
  const [formatId, setFormatId] = useState('bestvideo[height<=1080]+bestaudio/best[height<=1080]');
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [container, setContainer] = useState('mp4');
  const [speedLimit, setSpeedLimit] = useState('unlimited');

  // Discover previously downloaded playlists from queue
  const playlistJobs = queue.filter((j) => j.isPlaylist && j.playlistTitle);
  const uniquePlaylists = Array.from(
    new Set(playlistJobs.map((j) => j.playlistTitle as string))
  ).map((title) => {
    const jobs = playlistJobs.filter((j) => j.playlistTitle === title);
    const completed = jobs.filter((j) => j.status === 'completed').length;
    const sampleJob = jobs[0];
    return {
      title,
      total: jobs.length,
      completed,
      samplePath: sampleJob.outputPath,
    };
  });

  const handleAnalyze = async () => {
    if (!url.trim()) return;

    setIsAnalyzing(true);
    setPlaylistMedia(null);

    try {
      const res = await window.electronAPI.analyzeUrl(url.trim());
      if (res.success && res.data) {
        if (!res.data.isPlaylist) {
          onShowToast(
            isAr
              ? 'الرابط المدخل لمقطع فردي، تم التحويل لوضع الفحص المباشر.'
              : 'The provided URL is a single video, not a playlist. Switched to single video analysis.',
            'info'
          );
        }
        setPlaylistMedia(res.data);
        if (res.data.playlistItems) {
          setSelectedIndices(new Set(res.data.playlistItems.map((i) => i.index)));
        }
      } else {
        onShowToast(res.error || (isAr ? 'فشل فحص قائمة التشغيل' : 'Failed to analyze playlist.'), 'error');
      }
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartDownload = async () => {
    if (!playlistMedia || !playlistMedia.playlistItems) return;

    const selectedItems = playlistMedia.playlistItems.filter((i) =>
      selectedIndices.has(i.index)
    );

    if (selectedItems.length === 0) {
      onShowToast(
        isAr ? 'يرجى تحديد مقطع فيديو واحد على الأقل للتنزيل.' : 'Please select at least one video to download.',
        'error'
      );
      return;
    }

    const req: PlaylistBatchDownloadRequest = {
      playlistTitle: playlistMedia.playlistTitle || playlistMedia.title,
      items: selectedItems.map((item) => ({
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        duration: item.duration,
        index: item.index,
      })),
      qualityLabel: isAudioOnly ? 'Audio (MP3)' : qualityLabel,
      formatId: isAudioOnly ? 'bestaudio/best' : formatId,
      isAudioOnly,
      container: isAudioOnly ? 'mp3' : container,
      organizeInFolder: true,
      speedLimit: speedLimit !== 'unlimited' ? speedLimit : undefined,
    };

    const success = await onStartPlaylistDownload(req);
    if (success) {
      onShowToast(
        isAr
          ? `بدأ تنزيل الدورة التعليمية (${selectedItems.length} مقطع)!`
          : `Started course download (${selectedItems.length} videos)!`,
        'success'
      );
    }
  };

  const selectAll = () => {
    if (!playlistMedia?.playlistItems) return;
    setSelectedIndices(new Set(playlistMedia.playlistItems.map((i) => i.index)));
  };

  const deselectAll = () => {
    setSelectedIndices(new Set());
  };

  const invertSelection = () => {
    if (!playlistMedia?.playlistItems) return;
    const next = new Set<number>();
    for (const item of playlistMedia.playlistItems) {
      if (!selectedIndices.has(item.index)) {
        next.add(item.index);
      }
    }
    setSelectedIndices(next);
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
      {/* Header Banner */}
      <div className="glass-acrylic p-7 rounded-[26px] border border-white/[0.08] shadow-xl space-y-2.5 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
          <FolderTree className="w-4 h-4" />
          <span>{isAr ? 'منظم ومنزل الدورات التعليمية' : 'Curriculum & Course Downloader'}</span>
        </div>
        <h2 className="text-2xl lg:text-[28px] font-black text-white tracking-tight">
          {isAr ? 'تنزيل دورات وقوائم تشغيل تعليمية كاملة' : 'Download Entire Educational Courses'}
        </h2>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          {isAr
            ? 'احفظ ترتيب الدروس تلقائياً بترقيم منظم (01 - مقدمة.mp4)، وحدد الدقة المطلوبة لكل المقاطع بضغطة واحدة مع تنظيمها في مجلدات منفصلة.'
            : 'Preserve lesson order automatically, customize video resolutions, and download structured playlists organized directly into dedicated course folders.'}
        </p>
      </div>

      {/* URL Input */}
      <div className="glass-acrylic p-2 rounded-2xl border border-white/[0.08] shadow-xl transition-all duration-300 focus-within:border-indigo-500/80 focus-within:shadow-[0_0_30px_rgba(99,102,241,0.22)]">
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
                ? 'الصق رابط قائمة التشغيل أو الدورة (e.g. https://www.youtube.com/playlist?list=...)'
                : 'Paste YouTube Playlist / Course URL (e.g. https://www.youtube.com/playlist?list=...)'
            }
            className="flex-1 bg-transparent border-0 text-white placeholder-slate-400 text-sm focus:outline-none px-2 py-3.5"
          />
          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="btn-glow-primary flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-all cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{isAr ? 'جاري المسح...' : 'Scanning...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isAr ? 'فحص الدورة' : 'Inspect Course'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Course Media Details & Items Selector */}
      {playlistMedia && (
        <div className="glass-card rounded-2xl border border-slate-700 shadow-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold uppercase">
                  {playlistMedia.platform}
                </span>
                <span className="text-xs text-slate-400">
                  {playlistMedia.playlistItems?.length || 0} {isAr ? 'درس متاح' : 'lessons available'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mt-1">{playlistMedia.title}</h3>
            </div>

            {/* Quality and Speed Settings for Course */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">{isAr ? 'الجودة:' : 'Quality:'}</span>
                <select
                  value={qualityLabel}
                  onChange={(e) => {
                    const label = e.target.value;
                    setQualityLabel(label);
                    if (label.includes('4K')) setFormatId('bestvideo[height<=2160]+bestaudio/best[height<=2160]');
                    else if (label.includes('1440p')) setFormatId('bestvideo[height<=1440]+bestaudio/best[height<=1440]');
                    else if (label.includes('1080p')) setFormatId('bestvideo[height<=1080]+bestaudio/best[height<=1080]');
                    else if (label.includes('720p')) setFormatId('bestvideo[height<=720]+bestaudio/best[height<=720]');
                    else if (label.includes('480p')) setFormatId('bestvideo[height<=480]+bestaudio/best[height<=480]');
                    else setFormatId('bestvideo+bestaudio/best');
                  }}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="Best Available Quality">Best Available</option>
                  <option value="4K (2160p)">4K (2160p)</option>
                  <option value="2K (1440p)">2K (1440p)</option>
                  <option value="Full HD (1080p)">Full HD (1080p)</option>
                  <option value="HD (720p)">HD (720p)</option>
                  <option value="SD (480p)">SD (480p)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <Gauge className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  value={speedLimit}
                  onChange={(e) => setSpeedLimit(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                  title="Speed limit"
                >
                  <option value="unlimited">{isAr ? 'سرعة غير محدودة' : 'Unlimited'}</option>
                  <option value="10M">10 MB/s</option>
                  <option value="5M">5 MB/s</option>
                  <option value="2M">2 MB/s</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAudioOnly}
                    onChange={(e) => setIsAudioOnly(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600"
                  />
                  <span>{isAr ? 'صوت فقط (MP3)' : 'Audio Only (MP3)'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Selection control toolbar */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {isAr ? 'تحديد الكل' : 'Select All'}
              </button>
              <button
                onClick={deselectAll}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {isAr ? 'إلغاء التحديد' : 'Deselect All'}
              </button>
              <button
                onClick={invertSelection}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                {isAr ? 'عكس التحديد' : 'Invert'}
              </button>
            </div>

            <span className="text-slate-400 font-medium">
              {selectedIndices.size} / {playlistMedia.playlistItems?.length || 0} {isAr ? 'محدد' : 'selected'}
            </span>
          </div>

          {/* Lessons List */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {playlistMedia.playlistItems?.map((item) => {
              const isChecked = selectedIndices.has(item.index);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    const next = new Set(selectedIndices);
                    if (isChecked) next.delete(item.index);
                    else next.add(item.index);
                    setSelectedIndices(next);
                  }}
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-slate-900/90 border-indigo-500/50 text-slate-100'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="font-mono text-xs w-7 text-indigo-400 font-bold">
                      {String(item.index).padStart(2, '0')}.
                    </span>
                    <span className="font-semibold truncate">{item.title}</span>
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

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              <span>{isAr ? 'تنسيق الحفظ التلقائي: ' : 'Organized into: '}</span>
              <span className="font-mono text-indigo-300">
                Downloads/{playlistMedia.title.substring(0, 25)}/01 - Lesson.mp4
              </span>
            </div>

            <button
              onClick={handleStartDownload}
              disabled={selectedIndices.size === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>
                {isAr
                  ? `بدء تنزيل الدورة (${selectedIndices.size} فيديو)`
                  : `Download Course (${selectedIndices.size} Videos)`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Previously Tracked Playlists */}
      {uniquePlaylists.length > 0 && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Folder className="w-4 h-4 text-indigo-400" />
            <span>{isAr ? 'الدورات المنزلة سابقاً في قائمة الانتظار' : 'Previously Queued Courses'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {uniquePlaylists.map((pl) => (
              <div
                key={pl.title}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1">{pl.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {pl.completed} / {pl.total} {isAr ? 'مكتمل' : 'completed'}
                  </p>
                </div>

                <button
                  onClick={() => onOpenFolder(pl.samplePath)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title={isAr ? 'فتح مجلد الدورة' : 'Open Course Folder'}
                >
                  <Folder className="w-4 h-4 text-indigo-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
