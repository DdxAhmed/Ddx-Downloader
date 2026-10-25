import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Folder,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Save,
  Download,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { AppSettings, DependencyStatus, UpdateState } from '../../types';

interface SettingsViewProps {
  settings: AppSettings;
  dependencies: DependencyStatus | null;
  updateState: UpdateState;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onSelectDirectory: () => Promise<void>;
  onRefreshDeps: () => Promise<void>;
  onCheckUpdates: () => Promise<void>;
  onDownloadUpdate: () => Promise<void>;
  onInstallUpdate: () => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  dependencies,
  updateState,
  onUpdateSettings,
  onSelectDirectory,
  onRefreshDeps,
  onCheckUpdates,
  onDownloadUpdate,
  onInstallUpdate,
  onShowToast,
}) => {
  const [preferredQuality, setPreferredQuality] = useState(settings.preferredQuality);
  const [preferredContainer, setPreferredContainer] = useState(settings.preferredContainer);
  const [defaultAudioFormat, setDefaultAudioFormat] = useState(settings.defaultAudioFormat);
  const [maxConcurrent, setMaxConcurrent] = useState(settings.maxConcurrentDownloads);
  const [embedSubtitles, setEmbedSubtitles] = useState(settings.embedSubtitles);
  const [downloadSubtitles, setDownloadSubtitles] = useState(settings.downloadSubtitles);
  const [customYtDlpPath, setCustomYtDlpPath] = useState(settings.customYtDlpPath || '');
  const [customFfmpegPath, setCustomFfmpegPath] = useState(settings.customFfmpegPath || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSettings({
        preferredQuality,
        preferredContainer,
        defaultAudioFormat,
        maxConcurrentDownloads: Number(maxConcurrent),
        embedSubtitles,
        downloadSubtitles,
        customYtDlpPath: customYtDlpPath.trim() || undefined,
        customFfmpegPath: customFfmpegPath.trim() || undefined,
      });
      onShowToast('Settings saved successfully!', 'success');
    } catch {
      onShowToast('Failed to save settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Page Title */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-indigo-400" />
            <span>Preferences & Configuration</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Customize download destinations, media engines, and application behaviors.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save Preferences'}</span>
        </button>
      </div>

      {/* 1. Storage & Downloads Directory */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Folder className="w-4 h-4 text-indigo-400" />
          <span>Storage & Download Destination</span>
        </h3>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Default Download Directory
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={settings.downloadDirectory}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-none"
            />
            <button
              onClick={onSelectDirectory}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <Folder className="w-3.5 h-3.5 text-indigo-400" />
              <span>Browse...</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            All videos and courses will be saved here unless otherwise specified.
          </p>
        </div>
      </div>

      {/* 2. Download Preferences */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>Download & Quality Defaults</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Preferred Video Quality</label>
            <select
              value={preferredQuality}
              onChange={(e) => setPreferredQuality(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="best">Best Available (Recommended)</option>
              <option value="2160p">4K UHD (2160p)</option>
              <option value="1440p">2K QHD (1440p)</option>
              <option value="1080p">Full HD (1080p)</option>
              <option value="720p">HD (720p)</option>
              <option value="480p">SD (480p)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Preferred Video Container</label>
            <select
              value={preferredContainer}
              onChange={(e) => setPreferredContainer(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="mp4">MP4 (Widely Compatible)</option>
              <option value="mkv">MKV (Matroska - Supports Advanced Subtitles)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Default Audio Format</label>
            <select
              value={defaultAudioFormat}
              onChange={(e) => setDefaultAudioFormat(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="mp3">MP3 (High Quality 320k)</option>
              <option value="m4a">M4A (Original AAC Audio)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Maximum Concurrent Downloads: <span className="text-indigo-400 font-bold">{maxConcurrent}</span>
            </label>
            <input
              type="range"
              min="1"
              max="6"
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 mt-2"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 (Sequential)</span>
              <span>3 (Balanced)</span>
              <span>6 (Fast Internet)</span>
            </div>
          </div>
        </div>

        {/* Subtitles */}
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="embedSubsPref"
              checked={embedSubtitles}
              onChange={(e) => setEmbedSubtitles(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="embedSubsPref" className="text-xs text-slate-300 cursor-pointer">
              Embed selected subtitle tracks into video files automatically
            </label>
          </div>
        </div>
      </div>

      {/* 3. Media Processing Engine & Dependencies */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-400" />
            <span>Media Engine Diagnostics</span>
          </h3>

          <button
            onClick={onRefreshDeps}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-verify Binaries</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* yt-dlp card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">yt-dlp Engine</span>
              {dependencies?.ytDlp.available ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Missing</span>
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div>Version: <span className="font-mono text-slate-300">{dependencies?.ytDlp.version || 'Unknown'}</span></div>
              <div className="truncate" title={dependencies?.ytDlp.path}>
                Path: <span className="font-mono text-slate-300">{dependencies?.ytDlp.path || 'Not detected'}</span>
              </div>
            </div>

            <div className="pt-2">
              <input
                type="text"
                value={customYtDlpPath}
                onChange={(e) => setCustomYtDlpPath(e.target.value)}
                placeholder="Custom yt-dlp path (optional)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* FFmpeg card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">FFmpeg Stream Merger</span>
              {dependencies?.ffmpeg.available ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ready</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Missing</span>
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-400 space-y-1">
              <div>Version: <span className="font-mono text-slate-300">{dependencies?.ffmpeg.version || 'Unknown'}</span></div>
              <div className="truncate" title={dependencies?.ffmpeg.path}>
                Path: <span className="font-mono text-slate-300">{dependencies?.ffmpeg.path || 'Not detected'}</span>
              </div>
            </div>

            <div className="pt-2">
              <input
                type="text"
                value={customFfmpegPath}
                onChange={(e) => setCustomFfmpegPath(e.target.value)}
                placeholder="Custom FFmpeg path (optional)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Software Updates */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Automatic Updates</span>
          </h3>

          <button
            onClick={onCheckUpdates}
            disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow transition-all"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${updateState.status === 'checking' ? 'animate-spin' : ''}`}
            />
            <span>
              {updateState.status === 'checking' ? 'Checking...' : 'Check for Updates'}
            </span>
          </button>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Installed Version: </span>
              <span className="font-mono font-bold text-white">v{updateState.currentVersion}</span>
            </div>

            {updateState.lastChecked && (
              <span className="text-[11px] text-slate-500">
                Last checked: {new Date(updateState.lastChecked).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Status Message */}
          <div className="text-xs">
            {updateState.status === 'checking' && (
              <span className="text-indigo-400 flex items-center gap-1.5 font-medium">
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Checking GitHub Releases for new updates...</span>
              </span>
            )}

            {updateState.status === 'not-available' && (
              <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>You are on the latest version of DDX Downloader.</span>
              </span>
            )}

            {updateState.status === 'available' && updateState.updateInfo && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 font-semibold">
                    New version available: v{updateState.updateInfo.version}
                  </span>
                  <button
                    onClick={onDownloadUpdate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Update</span>
                  </button>
                </div>
                {updateState.updateInfo.releaseNotes && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {updateState.updateInfo.releaseNotes}
                  </div>
                )}
              </div>
            )}

            {updateState.status === 'downloading' && (
              <div className="space-y-2 pt-1">
                <span className="text-cyan-400 font-medium">
                  Downloading update: {updateState.progress?.percent.toFixed(1)}%
                </span>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                    style={{ width: `${updateState.progress?.percent || 5}%` }}
                  />
                </div>
              </div>
            )}

            {updateState.status === 'downloaded' && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Update downloaded! Ready to install.</span>
                </span>
                <button
                  onClick={onInstallUpdate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Restart & Install</span>
                </button>
              </div>
            )}

            {updateState.status === 'error' && updateState.error && (
              <span className="text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{updateState.error}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. About & Privacy */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase">
            <ShieldCheck className="w-4 h-4" />
            <span>Open Source & Local Privacy</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">v1.0.0</span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          DDX Downloader is an open-source, local-first media extraction suite. It requires no backend server, no accounts, and transmits zero telemetry. All database operations and media downloads run strictly on your machine.
        </p>

        <div className="pt-2">
          <a
            href="https://github.com/DdxAhmed/Ddx-Downloader"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            <span>GitHub Repository & Documentation</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
