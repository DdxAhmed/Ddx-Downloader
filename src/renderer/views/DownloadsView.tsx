import React, { useState } from 'react';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Play,
  RotateCcw,
  Folder,
  FileVideo,
  Trash2,
  Clock,
  ArrowUpRight,
  Pause,
  Info,
  Copy,
  ExternalLink,
  RotateCw,
} from 'lucide-react';
import { DownloadJob } from '../../types';
import { SupportedLanguage, getTranslation } from '../i18n';
import { TaskDetailsModal } from '../components/TaskDetailsModal';

interface DownloadsViewProps {
  queue: DownloadJob[];
  onCancelJob: (id: string) => Promise<boolean>;
  onPauseJob?: (id: string) => Promise<boolean>;
  onResumeJob?: (id: string) => Promise<boolean>;
  onRetryJob: (id: string) => Promise<boolean>;
  onRetryAllFailed?: () => Promise<void>;
  onClearCompleted: () => Promise<void>;
  onOpenFile: (filePath: string) => Promise<void>;
  onOpenFolder: (filePath: string) => Promise<void>;
  onNavigateHome: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  queue,
  onCancelJob,
  onPauseJob,
  onResumeJob,
  onRetryJob,
  onRetryAllFailed,
  onClearCompleted,
  onOpenFile,
  onOpenFolder,
  onNavigateHome,
  onShowToast,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [filter, setFilter] = useState<'all' | 'active' | 'queued' | 'completed' | 'failed' | 'paused'>('all');
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<DownloadJob | null>(null);

  const activeJobs = queue.filter(
    (j) => j.status === 'downloading' || j.status === 'processing' || j.status === 'merging' || j.status === 'preparing'
  );
  const queuedJobs = queue.filter((j) => j.status === 'queued' || j.status === 'retrying');
  const pausedJobs = queue.filter((j) => j.status === 'paused');
  const completedJobs = queue.filter((j) => j.status === 'completed');
  const failedJobs = queue.filter((j) => j.status === 'failed' || j.status === 'cancelled');

  const filteredJobs = queue.filter((job) => {
    if (filter === 'active') {
      return job.status === 'downloading' || job.status === 'processing' || job.status === 'merging' || job.status === 'preparing';
    }
    if (filter === 'queued') return job.status === 'queued' || job.status === 'retrying';
    if (filter === 'paused') return job.status === 'paused';
    if (filter === 'completed') return job.status === 'completed';
    if (filter === 'failed') return job.status === 'failed' || job.status === 'cancelled';
    return true;
  });

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusBadge = (job: DownloadJob) => {
    switch (job.status) {
      case 'downloading':
        return (
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 font-semibold text-[10px] flex items-center gap-1 border border-indigo-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span>{isAr ? 'جاري التنزيل' : 'Downloading'}</span>
          </span>
        );
      case 'preparing':
        return (
          <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold text-[10px] flex items-center gap-1 border border-blue-500/20">
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            <span>{isAr ? 'جاري التجهيز' : 'Preparing'}</span>
          </span>
        );
      case 'merging':
        return (
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-semibold text-[10px] flex items-center gap-1 border border-cyan-500/20">
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            <span>{isAr ? 'جاري الدمج' : 'Merging'}</span>
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold text-[10px] flex items-center gap-1 border border-purple-500/20">
            <RotateCw className="w-2.5 h-2.5 animate-spin" />
            <span>{isAr ? 'جاري المعالجة' : 'Processing'}</span>
          </span>
        );
      case 'paused':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 font-semibold text-[10px] flex items-center gap-1 border border-slate-700">
            <Pause className="w-2.5 h-2.5" />
            <span>{isAr ? 'متوقف مؤقتاً' : 'Paused'}</span>
          </span>
        );
      case 'queued':
        return (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-semibold text-[10px] flex items-center gap-1 border border-amber-500/20">
            <Clock className="w-2.5 h-2.5" />
            <span>{isAr ? 'في الانتظار' : 'Queued'}</span>
          </span>
        );
      case 'retrying':
        return (
          <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 font-semibold text-[10px] flex items-center gap-1 border border-orange-500/30 animate-pulse">
            <RotateCcw className="w-2.5 h-2.5 animate-spin" />
            <span>{isAr ? 'إعادة المحاولة...' : 'Retrying...'}</span>
          </span>
        );
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold text-[10px] flex items-center gap-1 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>{isAr ? 'اكتمل' : 'Completed'}</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold text-[10px] flex items-center gap-1 border border-slate-700">
            <XCircle className="w-2.5 h-2.5" />
            <span>{isAr ? 'ملغى' : 'Cancelled'}</span>
          </span>
        );
      case 'failed':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 font-semibold text-[10px] flex items-center gap-1 border border-rose-500/20">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>{isAr ? 'فشل' : 'Failed'}</span>
          </span>
        );
    }
  };

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7 max-w-[1440px] mx-auto space-y-6 animate-fadeIn">
      {/* Top Filter and Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-acrylic p-3.5 rounded-2xl border border-white/[0.08] shadow-md">
        <div className="flex flex-wrap items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/[0.05] text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === 'all'
                ? 'btn-glow-primary shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            {isAr ? 'الكل' : 'All'} ({queue.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === 'active'
                ? 'btn-glow-primary shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            {isAr ? 'نشط' : 'Active'} ({activeJobs.length})
          </button>
          <button
            onClick={() => setFilter('queued')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === 'queued'
                ? 'btn-glow-primary shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            {isAr ? 'بالانتظار' : 'Queued'} ({queuedJobs.length})
          </button>
          {pausedJobs.length > 0 && (
            <button
              onClick={() => setFilter('paused')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                filter === 'paused'
                  ? 'btn-glow-primary shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              {isAr ? 'متوقف' : 'Paused'} ({pausedJobs.length})
            </button>
          )}
          <button
            onClick={() => setFilter('completed')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === 'completed'
                ? 'btn-glow-primary shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            {isAr ? 'المكتملة' : 'Completed'} ({completedJobs.length})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              filter === 'failed'
                ? 'btn-glow-primary shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            {isAr ? 'الفاشلة' : 'Failed'} ({failedJobs.length})
          </button>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {failedJobs.length > 0 && onRetryAllFailed && (
            <button
              onClick={onRetryAllFailed}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:text-white glass-acrylic hover:border-indigo-500/50 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'إعادة محاولة الفاشلة' : 'Retry All Failed'}</span>
            </button>
          )}

          {completedJobs.length > 0 && (
            <button
              onClick={onClearCompleted}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white glass-acrylic hover:bg-white/[0.08] border border-white/[0.08] transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'مسح المكتملة' : 'Clear Completed'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Queue Items List */}
      {filteredJobs.length === 0 ? (
        <div className="glass-acrylic-card rounded-3xl p-12 text-center space-y-4 border border-white/[0.08] shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 via-purple-500/20 to-cyan-500/20 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/30 shadow-lg shadow-indigo-500/20">
            <Download className="w-8 h-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-bold text-white">
            {isAr ? 'لا توجد تنزيلات في هذه القائمة' : 'No downloads found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isAr
              ? 'الصق رابط فيديو أو دورة في الصفحة الرئيسية لبدء تنزيل الملفات بسرعة فائقة.'
              : 'Paste a video or course URL on the Home tab to start downloading files.'}
          </p>
          {filter === 'all' && (
            <button
              onClick={onNavigateHome}
              className="btn-glow-primary px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <span>{isAr ? 'إضافة وسائط للتنزيل' : 'Add Media to Download'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isDownloading = job.status === 'downloading' || job.status === 'processing' || job.status === 'merging' || job.status === 'preparing';
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed' || job.status === 'cancelled';
            const isPaused = job.status === 'paused';
            const isQueued = job.status === 'queued' || job.status === 'retrying';

            return (
              <div
                key={job.id}
                className="glass-acrylic-card rounded-2xl p-4 sm:p-5 border border-white/[0.08] hover:border-indigo-500/30 transition-all space-y-3.5 shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Media Thumbnail & Title */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-20 h-14 rounded-xl bg-slate-900 border border-white/[0.08] shrink-0 overflow-hidden relative shadow-md">
                      {job.thumbnailUrl ? (
                        <img
                          src={job.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <FileVideo className="w-6 h-6" />
                        </div>
                      )}

                      {job.isPlaylist && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono text-cyan-300">
                          #{job.playlistIndex}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(job)}
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase border border-indigo-500/20">
                          {job.sourcePlatform}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 text-[10px] font-medium border border-white/[0.06]">
                          {job.selectedQuality}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-300 text-[10px] font-mono border border-white/[0.06]">
                          {job.targetContainer.toUpperCase()}
                        </span>
                        {job.playlistTitle && (
                          <span className="text-[11px] text-slate-400 truncate max-w-xs">
                            in {job.playlistTitle}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white truncate mt-1.5" title={job.mediaTitle}>
                        {job.mediaTitle}
                      </h4>

                      {/* User friendly error or status summary */}
                      {isFailed && (
                        <p className="text-xs text-rose-400 truncate mt-0.5 font-medium" title={job.errorMessage}>
                          {job.errorDetails
                            ? isAr
                              ? job.errorDetails.titleAr
                              : job.errorDetails.titleEn
                            : job.errorMessage || 'Error'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Pause / Resume */}
                    {isDownloading && onPauseJob && (
                      <button
                        onClick={() => onPauseJob(job.id)}
                        title={isAr ? 'إيقاف مؤقت' : 'Pause Download'}
                        className="p-2 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all shadow-sm"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isPaused && onResumeJob && (
                      <button
                        onClick={() => onResumeJob(job.id)}
                        title={isAr ? 'استئناف التنزيل' : 'Resume Download'}
                        className="p-2 rounded-xl text-xs font-semibold btn-glow-primary text-white transition-all shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Cancel */}
                    {(isDownloading || isQueued || isPaused) && (
                      <button
                        onClick={() => onCancelJob(job.id)}
                        title={isAr ? 'إلغاء التنزيل' : 'Cancel Download'}
                        className="p-2 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all shadow-sm"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Retry */}
                    {isFailed && (
                      <button
                        onClick={() => onRetryJob(job.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-300 hover:text-white glass-acrylic hover:bg-indigo-500/20 border border-indigo-500/30 transition-all shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إعادة' : 'Retry'}</span>
                      </button>
                    )}

                    {/* Completed actions */}
                    {isCompleted && (
                      <>
                        <button
                          onClick={() => onOpenFile(job.outputPath)}
                          className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold btn-glow-primary text-white shadow-md shadow-indigo-600/20 transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isAr ? 'تشغيل' : 'Play'}</span>
                        </button>

                        <button
                          onClick={() => onOpenFolder(job.outputPath)}
                          title={isAr ? 'عرض في المجلد' : 'Reveal in Folder'}
                          className="p-2 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all"
                        >
                          <Folder className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    {/* Details modal launcher */}
                    <button
                      onClick={() => setSelectedJobForDetails(job)}
                      title={isAr ? 'عرض التفاصيل والتشخيص' : 'View Details & Diagnostics'}
                      className="p-2 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 transition-all"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar and metrics */}
                {(isDownloading || isQueued || isPaused) && (
                  <div className="space-y-2 pt-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className="text-slate-300 font-semibold">{formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)}</span>
                        {job.downloadSpeed && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-bold text-[10px]">
                            {job.downloadSpeed}
                          </span>
                        )}
                        {job.speedLimit && (
                          <span className="text-slate-500 text-[10px]">
                            (Limit: {job.speedLimit})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {job.eta && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/25 text-purple-300 font-semibold text-[10px]">
                            ETA: {job.eta}
                          </span>
                        )}
                        <span className="font-extrabold text-white font-mono">{job.progress.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden p-0.5 border border-white/[0.05]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isPaused
                            ? 'bg-slate-500'
                            : 'bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
                        }`}
                        style={{ width: `${Math.max(job.progress, 1)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Task Details & Diagnostics Modal */}
      {selectedJobForDetails && (
        <TaskDetailsModal
          job={selectedJobForDetails}
          isOpen={!!selectedJobForDetails}
          onClose={() => setSelectedJobForDetails(null)}
          onRetry={onRetryJob}
          onOpenFile={onOpenFile}
          onOpenFolder={onOpenFolder}
          onShowToast={onShowToast}
          lang={lang}
        />
      )}
    </div>
  );
};
