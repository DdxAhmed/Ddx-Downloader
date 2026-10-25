import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  RotateCw,
  CheckCircle2,
  X,
  ArrowRight,
  HardDrive,
  Info,
} from 'lucide-react';
import { UpdateState } from '../../types';

interface UpdateModalProps {
  updateState: UpdateState;
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onDismiss: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  updateState,
  onDownload,
  onInstall,
  onDismiss,
}) => {
  const { status, currentVersion, updateInfo, progress } = updateState;
  const [isMinimized, setIsMinimized] = useState(false);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const isAvailable = status === 'available';
  const isDownloading = status === 'downloading';
  const isDownloaded = status === 'downloaded';

  if (!isAvailable && !isDownloading && !isDownloaded) {
    return null;
  }

  // Minimized floating pill during background download or if dismissed
  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 left-6 z-50 glass-card px-4 py-2.5 rounded-full border border-indigo-500/50 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-indigo-400 transition-all animate-bounce"
      >
        {isDownloading ? (
          <>
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-xs font-semibold text-white">
              Downloading Update: {progress?.percent.toFixed(0)}%
            </span>
          </>
        ) : isDownloaded ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white">Update Ready to Install</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-white">
              Update v{updateInfo?.version} Available
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-[#111827] border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isDownloaded
                    ? 'Update Ready to Install'
                    : isDownloading
                    ? 'Downloading Update...'
                    : 'New Version Available'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDownloaded
                  ? 'The installer has been downloaded and verified.'
                  : 'A new version of DDX Downloader is ready.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isDownloading) setIsMinimized(true);
              else onDismiss();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version Compare Banner */}
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Current: </span>
            <span className="font-mono font-semibold text-slate-300">v{currentVersion}</span>
          </div>

          <ArrowRight className="w-4 h-4 text-indigo-400" />

          <div>
            <span className="text-slate-400">New Release: </span>
            <span className="font-mono font-bold text-emerald-400">
              v{updateInfo?.version || 'Latest'}
            </span>
          </div>
        </div>

        {/* Release Notes */}
        {updateInfo?.releaseNotes && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>What's New in this Release:</span>
            </span>
            <div className="max-h-40 overflow-y-auto p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
              {updateInfo.releaseNotes}
            </div>
          </div>
        )}

        {/* Downloading Progress Bar */}
        {isDownloading && (
          <div className="space-y-2 pt-1">
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress?.percent || 5}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>{progress?.percent.toFixed(1)}% Completed</span>
              {progress?.total && progress.total > 0 && (
                <span>
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                </span>
              )}
              {progress?.bytesPerSecond ? (
                <span className="text-cyan-400">
                  {formatBytes(progress.bytesPerSecond)}/s
                </span>
              ) : null}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <button
            onClick={() => {
              if (isDownloading) setIsMinimized(true);
              else onDismiss();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-all"
          >
            {isDownloading ? 'Run in Background' : 'Later'}
          </button>

          {isAvailable && (
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Update Now</span>
            </button>
          )}

          {isDownloading && (
            <button
              onClick={() => setIsMinimized(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 hover:bg-indigo-900/60 transition-all"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Continue in App</span>
            </button>
          )}

          {isDownloaded && (
            <button
              onClick={onInstall}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 transition-all"
            >
              <RotateCw className="w-4 h-4" />
              <span>Restart & Install</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
