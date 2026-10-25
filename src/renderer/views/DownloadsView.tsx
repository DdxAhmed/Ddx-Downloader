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
} from 'lucide-react';
import { DownloadJob } from '../../types';

interface DownloadsViewProps {
  queue: DownloadJob[];
  onCancelJob: (id: string) => Promise<boolean>;
  onRetryJob: (id: string) => Promise<boolean>;
  onClearCompleted: () => Promise<void>;
  onOpenFile: (filePath: string) => Promise<void>;
  onOpenFolder: (filePath: string) => Promise<void>;
  onNavigateHome: () => void;
}

export const DownloadsView: React.FC<DownloadsViewProps> = ({
  queue,
  onCancelJob,
  onRetryJob,
  onClearCompleted,
  onOpenFile,
  onOpenFolder,
  onNavigateHome,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'queued' | 'completed' | 'failed'>('all');

  const activeJobs = queue.filter(
    (j) => j.status === 'downloading' || j.status === 'processing'
  );
  const queuedJobs = queue.filter((j) => j.status === 'queued');
  const completedJobs = queue.filter((j) => j.status === 'completed');
  const failedJobs = queue.filter(
    (j) => j.status === 'failed' || j.status === 'cancelled'
  );

  const filteredJobs = queue.filter((job) => {
    if (filter === 'active') return job.status === 'downloading' || job.status === 'processing';
    if (filter === 'queued') return job.status === 'queued';
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

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Filter and Stats Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({queue.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'active'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active ({activeJobs.length})
          </button>
          <button
            onClick={() => setFilter('queued')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'queued'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Queued ({queuedJobs.length})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'completed'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Completed ({completedJobs.length})
          </button>
          <button
            onClick={() => setFilter('failed')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'failed'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Failed ({failedJobs.length})
          </button>
        </div>

        {completedJobs.length > 0 && (
          <button
            onClick={onClearCompleted}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 transition-all self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Completed</span>
          </button>
        )}
      </div>

      {/* Queue Items List */}
      {filteredJobs.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-4 border border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <Download className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white">No downloads found</h3>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            {filter === 'all'
              ? 'Your download queue is currently empty. Paste a URL on the Home screen to start downloading!'
              : `There are currently no downloads in the "${filter}" state.`}
          </p>
          {filter === 'all' && (
            <button
              onClick={onNavigateHome}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all inline-flex items-center gap-2"
            >
              <span>Add Media to Download</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isDownloading = job.status === 'downloading';
            const isProcessing = job.status === 'processing';
            const isCompleted = job.status === 'completed';
            const isFailed = job.status === 'failed' || job.status === 'cancelled';
            const isQueued = job.status === 'queued';

            return (
              <div
                key={job.id}
                className="glass-card rounded-2xl p-4 border border-slate-800 hover:border-slate-700/80 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Media Thumbnail & Title */}
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-20 h-14 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden relative">
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
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase">
                          {job.sourcePlatform}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                          {job.selectedQuality}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                          {job.targetContainer.toUpperCase()}
                        </span>
                        {job.playlistTitle && (
                          <span className="text-[11px] text-slate-400 truncate max-w-xs">
                            in {job.playlistTitle}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white truncate mt-1" title={job.mediaTitle}>
                        {job.mediaTitle}
                      </h4>

                      {/* Error text if failed */}
                      {job.errorMessage && (
                        <p className="text-xs text-red-400 truncate mt-0.5" title={job.errorMessage}>
                          Error: {job.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(isDownloading || isQueued) && (
                      <button
                        onClick={() => onCancelJob(job.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {isFailed && (
                      <button
                        onClick={() => onRetryJob(job.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry</span>
                      </button>
                    )}

                    {isCompleted && (
                      <>
                        <button
                          onClick={() => onOpenFile(job.outputPath)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Play</span>
                        </button>

                        <button
                          onClick={() => onOpenFolder(job.outputPath)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
                          title="Show in Folder"
                        >
                          <Folder className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Real-time Metrics */}
                <div className="space-y-1.5">
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isDownloading
                          ? 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                          : isProcessing
                          ? 'bg-amber-400 animate-pulse'
                          : isCompleted
                          ? 'bg-emerald-500'
                          : isFailed
                          ? 'bg-red-500'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: `${Math.max(job.progress, isQueued ? 5 : 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <div className="flex items-center gap-3">
                      {isDownloading && (
                        <>
                          <span className="text-white font-bold">{job.progress.toFixed(1)}%</span>
                          {job.downloadSpeed && (
                            <span className="text-cyan-400 font-mono">{job.downloadSpeed}</span>
                          )}
                          {job.totalBytes > 0 && (
                            <span>
                              {formatBytes(job.downloadedBytes)} / {formatBytes(job.totalBytes)}
                            </span>
                          )}
                        </>
                      )}

                      {isProcessing && (
                        <span className="text-amber-400 flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span>Merging audio and video streams (FFmpeg)...</span>
                        </span>
                      )}

                      {isQueued && (
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>Waiting in queue...</span>
                        </span>
                      )}

                      {isCompleted && (
                        <span className="text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed • {formatBytes(job.totalBytes)}</span>
                        </span>
                      )}

                      {isFailed && (
                        <span className="text-red-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{job.status === 'cancelled' ? 'Cancelled' : 'Download Failed'}</span>
                        </span>
                      )}
                    </div>

                    {isDownloading && job.eta && (
                      <div className="flex items-center gap-1 font-mono text-slate-300">
                        <span>ETA:</span>
                        <span>{job.eta}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
