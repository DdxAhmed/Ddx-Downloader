import React from 'react';
import { Folder, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { DependencyStatus } from '../../types';

interface HeaderProps {
  title: string;
  subtitle: string;
  dependencies: DependencyStatus | null;
  onRefreshDeps: () => void;
  onOpenFolder: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  dependencies,
  onRefreshDeps,
  onOpenFolder,
}) => {
  const isReady =
    dependencies?.ytDlp?.available && dependencies?.ffmpeg?.available;

  return (
    <header className="h-16 px-8 flex items-center justify-between border-b border-slate-800/80 bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-20">
      <div>
        <h2 className="text-lg font-semibold text-white tracking-tight">{title}</h2>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Dependency Status Badge */}
        <div
          onClick={onRefreshDeps}
          title={
            isReady
              ? `yt-dlp: ${dependencies?.ytDlp.version || 'Ready'} | FFmpeg: ${
                  dependencies?.ffmpeg.version || 'Ready'
                }`
              : 'Dependency check required. Click to verify.'
          }
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
        >
          {isReady ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">Engine Ready</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-400">Verifying Engine</span>
            </>
          )}
          <RefreshCw className="w-3 h-3 text-slate-400 hover:text-slate-200 transition-transform active:rotate-180" />
        </div>

        {/* Open Downloads Folder */}
        <button
          onClick={onOpenFolder}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all"
        >
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span>Downloads Folder</span>
        </button>
      </div>
    </header>
  );
};
