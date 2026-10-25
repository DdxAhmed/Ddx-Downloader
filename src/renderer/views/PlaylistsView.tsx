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
} from 'lucide-react';
import { MediaInfo, PlaylistBatchDownloadRequest, DownloadJob } from '../../types';

interface PlaylistsViewProps {
  onStartPlaylistDownload: (req: PlaylistBatchDownloadRequest) => Promise<boolean>;
  queue: DownloadJob[];
  onOpenFolder: (path: string) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PlaylistsView: React.FC<PlaylistsViewProps> = ({
  onStartPlaylistDownload,
  queue,
  onOpenFolder,
  onShowToast,
}) => {
  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [playlistMedia, setPlaylistMedia] = useState<MediaInfo | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [qualityLabel, setQualityLabel] = useState('Full HD (1080p)');
  const [formatId, setFormatId] = useState('bestvideo[height<=1080]+bestaudio/best[height<=1080]');
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [container, setContainer] = useState('mp4');

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
          onShowToast('The provided URL is a single video, not a playlist. Switched to single video analysis.', 'info');
        }
        setPlaylistMedia(res.data);
        if (res.data.playlistItems) {
          setSelectedIndices(new Set(res.data.playlistItems.map((i) => i.index)));
        }
      } else {
        onShowToast(res.error || 'Failed to analyze playlist.', 'error');
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
      onShowToast('Please select at least one video to download.', 'error');
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
    };

    const success = await onStartPlaylistDownload(req);
    if (success) {
      onShowToast(`Started course download (${selectedItems.length} videos)!`, 'success');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
          <FolderTree className="w-4 h-4" />
          <span>Curriculum & Course Downloader</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Download Entire Educational Courses</h2>
        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
          Preserve lesson order automatically, customize video resolutions, and download structured playlists organized directly into dedicated course folders.
        </p>
      </div>

      {/* URL Input */}
      <div className="glass-panel p-3 rounded-2xl shadow-xl border border-slate-700/60 focus-within:border-indigo-500">
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
            placeholder="Paste YouTube Playlist / Course URL (e.g. https://www.youtube.com/playlist?list=...)"
            className="flex-1 bg-transparent border-0 text-white placeholder-slate-500 text-sm focus:outline-none px-2 py-3"
          />
          <button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all"
          >
            {isAnalyzing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Inspect Course</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Playlist Analysis Card */}
      {playlistMedia && (
        <div className="glass-card rounded-2xl p-6 border border-slate-700 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[11px] font-bold text-indigo-400 uppercase">
                {playlistMedia.playlistItemCount || 0} Lessons Found
              </span>
              <h3 className="text-xl font-bold text-white mt-0.5">{playlistMedia.title}</h3>
              {playlistMedia.uploader && (
                <p className="text-xs text-slate-400 mt-1">Instructor / Channel: {playlistMedia.uploader}</p>
              )}
            </div>

            {/* Quality & Audio toggles */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-medium">Type:</span>
                <select
                  value={isAudioOnly ? 'audio' : 'video'}
                  onChange={(e) => setIsAudioOnly(e.target.value === 'audio')}
                  className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="video">Video & Audio</option>
                  <option value="audio">Audio Lectures Only (MP3)</option>
                </select>
              </div>

              {!isAudioOnly && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Resolution:</span>
                  <select
                    value={qualityLabel}
                    onChange={(e) => {
                      setQualityLabel(e.target.value);
                      if (e.target.value.includes('1080')) {
                        setFormatId('bestvideo[height<=1080]+bestaudio/best[height<=1080]');
                      } else if (e.target.value.includes('720')) {
                        setFormatId('bestvideo[height<=720]+bestaudio/best[height<=720]');
                      } else if (e.target.value.includes('480')) {
                        setFormatId('bestvideo[height<=480]+bestaudio/best[height<=480]');
                      } else {
                        setFormatId('bestvideo+bestaudio/best');
                      }
                    }}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="Best Available Quality">Best Available</option>
                    <option value="Full HD (1080p)">Full HD (1080p)</option>
                    <option value="HD (720p)">HD (720p)</option>
                    <option value="SD (480p)">SD (480p)</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Curriculum Checklist */}
          {playlistMedia.playlistItems && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Select Lessons to Download ({selectedIndices.size} of {playlistMedia.playlistItems.length}):
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedIndices(
                        new Set(playlistMedia.playlistItems!.map((i) => i.index))
                      )
                    }
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedIndices(new Set())}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                {playlistMedia.playlistItems.map((item) => {
                  const isChecked = selectedIndices.has(item.index);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        const next = new Set(selectedIndices);
                        if (next.has(item.index)) next.delete(item.index);
                        else next.add(item.index);
                        setSelectedIndices(next);
                      }}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-slate-900 border-indigo-500/50 text-white'
                          : 'bg-slate-950/40 border-slate-800 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="font-mono text-slate-400 font-bold w-6">
                          {String(item.index).padStart(2, '0')}.
                        </span>
                        <span className="font-medium truncate">{item.title}</span>
                      </div>
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-400">
              Folder template: <span className="text-indigo-400 font-mono">Downloads/{playlistMedia.title.substring(0, 20)}/01 - Lesson.mp4</span>
            </div>

            <button
              onClick={handleStartDownload}
              disabled={selectedIndices.size === 0}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Course ({selectedIndices.size} Lessons)</span>
            </button>
          </div>
        </div>
      )}

      {/* Previously Downloaded Playlists */}
      {uniquePlaylists.length > 0 && (
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
            Downloaded Course Collections ({uniquePlaylists.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {uniquePlaylists.map((pl) => (
              <div
                key={pl.title}
                className="glass-card p-4 rounded-xl border border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <ListVideo className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white truncate max-w-xs">{pl.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {pl.completed} of {pl.total} videos completed
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <span className="text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Locally Saved</span>
                  </span>

                  <button
                    onClick={() => onOpenFolder(pl.samplePath)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white font-medium"
                  >
                    <Folder className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Open Folder</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
