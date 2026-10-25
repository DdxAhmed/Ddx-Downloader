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
    <div className="h-screen w-screen bg-[#0b0f19] text-slate-100 p-4 flex flex-col justify-between select-none border border-slate-800 rounded-lg overflow-hidden">
      {/* Top Bar with Title and Restore */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-bold text-white tracking-wide">Ddx Downloader</span>
          {activeCount > 1 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
              +{activeCount - 1} more
            </span>
          )}
        </div>

        <button
          onClick={onRestore}
          title={isAr ? 'توسيع إلى النافذة الكاملة' : 'Restore Full Window'}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Media Active Card */}
      {activeJob ? (
        <div className="space-y-3 my-auto">
          <div className="flex items-center gap-3">
            {activeJob.thumbnailUrl ? (
              <img
                src={activeJob.thumbnailUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-800 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <Download className="w-5 h-5" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-white truncate">
                {activeJob.mediaTitle}
              </h4>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="capitalize">{activeJob.status}</span>
                {activeJob.downloadSpeed && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-300 font-mono">{activeJob.downloadSpeed}</span>
                  </>
                )}
                {activeJob.eta && (
                  <>
                    <span>•</span>
                    <span>ETA {activeJob.eta}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{activeJob.selectedQuality}</span>
              <span className="font-semibold text-white">{activeJob.progress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-200"
                style={{ width: `${Math.max(activeJob.progress, 2)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-slate-400">
          {isAr ? 'لا توجد تنزيلات نشطة حالياً' : 'No active downloads in queue'}
        </div>
      )}

      {/* Controls Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
        <span className="text-[11px] text-slate-500">
          {isAr ? 'الوضع المصغر' : 'Mini Player Mode'}
        </span>

        {activeJob && (
          <div className="flex items-center gap-1.5">
            {activeJob.status === 'paused' ? (
              <button
                onClick={() => onResume(activeJob.id)}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                title={isAr ? 'استئناف' : 'Resume'}
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onPause(activeJob.id)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title={isAr ? 'إيقاف مؤقت' : 'Pause'}
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => onCancel(activeJob.id)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors"
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
