import React from 'react';
import {
  Download,
  Pause,
  Play,
  X,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { DownloadJob } from '../../types';
import { SupportedLanguage } from '../i18n';

interface MiniModeViewProps {
  queue: DownloadJob[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRestore: () => void;
  lang: SupportedLanguage;
}

export const MiniModeView: React.FC<MiniModeViewProps> = ({
  queue,
  onPause,
  onResume,
  onCancel,
  onRestore,
  lang,
}) => {
  const isAr = lang === 'ar';
  const activeJob =
    queue.find(
      (j) =>
        j.status === 'downloading' ||
        j.status === 'processing' ||
        j.status === 'merging' ||
        j.status === 'preparing' ||
        j.status === 'paused'
    ) || queue[0];

  const activeCount = queue.filter(
    (j) => j.status === 'downloading' || j.status === 'processing'
  ).length;

  return (
    <div className="h-screen w-screen bg-[#060813] text-slate-100 p-4 flex flex-col justify-between select-none border border-white/[0.1] rounded-2xl overflow-hidden shadow-2xl relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-transparent to-cyan-900/20 pointer-events-none" />

      {/* Top Bar with Title and Restore */}
      <div className="relative z-10 flex items-center justify-between pb-2.5 border-b border-white/[0.08] text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse" />
          <span className="font-extrabold text-white tracking-wide bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            Ddx Downloader
          </span>
          {activeCount > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-[10px] text-cyan-300 font-mono font-bold">
              +{activeCount - 1} more
            </span>
          )}
        </div>

        <button
          onClick={onRestore}
          title={isAr ? 'توسيع إلى النافذة الكاملة' : 'Restore Full Window'}
          className="p-1.5 rounded-xl text-slate-400 hover:text-white glass-acrylic hover:bg-white/[0.08] transition-all cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Media Active Card */}
      {activeJob ? (
        <div className="relative z-10 space-y-3.5 my-auto">
          <div className="flex items-center gap-3">
            {activeJob.thumbnailUrl ? (
              <img
                src={activeJob.thumbnailUrl}
                alt=""
                className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-white/[0.1] shrink-0 shadow-md"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-md">
                <Download className="w-5 h-5 text-indigo-300" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-white truncate">
                {activeJob.mediaTitle}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                <span className="capitalize font-medium text-slate-300">{activeJob.status}</span>
                {activeJob.downloadSpeed && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-cyan-400 font-mono font-bold">{activeJob.downloadSpeed}</span>
                  </>
                )}
                {activeJob.eta && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-slate-400">ETA {activeJob.eta}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-medium text-indigo-300">{activeJob.selectedQuality}</span>
              <span className="font-extrabold text-white font-mono">{activeJob.progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-white/[0.06] p-0.5">
              <div
                className="bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                style={{ width: `${Math.max(activeJob.progress, 2)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 text-center py-4 text-xs text-slate-400 font-medium">
          {isAr ? 'لا توجد تنزيلات نشطة حالياً' : 'No active downloads in queue'}
        </div>
      )}

      {/* Controls Footer */}
      <div className="relative z-10 flex items-center justify-between pt-2.5 border-t border-white/[0.08] text-xs">
        <span className="text-[11px] text-slate-400 font-medium">
          {isAr ? 'الوضع المصغر' : 'Mini Player Mode'}
        </span>

        {activeJob && (
          <div className="flex items-center gap-2">
            {activeJob.status === 'paused' ? (
              <button
                onClick={() => onResume(activeJob.id)}
                className="btn-glow-primary p-2 rounded-xl text-white transition-all shadow-md cursor-pointer"
                title={isAr ? 'استئناف' : 'Resume'}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={() => onPause(activeJob.id)}
                className="p-2 rounded-xl glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all cursor-pointer"
                title={isAr ? 'إيقاف مؤقت' : 'Pause'}
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => onCancel(activeJob.id)}
              className="p-2 rounded-xl glass-acrylic hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
              title={isAr ? 'إلغاء' : 'Cancel'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
