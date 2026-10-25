import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { DependencyResolver } from './dependency-resolver';
import { ProviderRegistry } from './providers/provider-registry';
import { sanitizeFilename, buildOutputPath } from './filename-sanitizer';
import {
  MediaInfo,
  MediaFormat,
  SubtitleTrack,
  PlaylistItem,
  DownloadJob,
  CreateDownloadRequest,
} from '../../types';

export class MediaEngine {
  private resolver: DependencyResolver;
  private providerRegistry: ProviderRegistry;
  private activeProcesses: Map<string, ChildProcess> = new Map();

  constructor(resolver: DependencyResolver) {
    this.resolver = resolver;
    this.providerRegistry = new ProviderRegistry();
  }

  public getProviderRegistry(): ProviderRegistry {
    return this.providerRegistry;
  }

  /**
   * Analyzes a URL and extracts media metadata, formats, and playlist items
   */
  public async analyzeUrl(rawUrl: string): Promise<MediaInfo> {
    const validation = this.providerRegistry.validateUrl(rawUrl);
    if (!validation.valid || !validation.cleanUrl) {
      throw new Error(validation.error || 'Invalid URL provided');
    }

    const cleanUrl = validation.cleanUrl;
    const provider = this.providerRegistry.getProvider(cleanUrl);
    const ytDlpPath = await this.resolver.getYtDlpPath();

    if (!ytDlpPath) {
      throw new Error('yt-dlp executable is not available. Please install it or verify its path in Settings.');
    }

    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-call-home',
      '--skip-download',
      '--flat-playlist',
      cleanUrl,
    ];

    const stdout = await this.executeProcess(ytDlpPath, args);
    let data: any;

    try {
      data = JSON.parse(stdout);
    } catch (err: any) {
      throw new Error(`Failed to parse media metadata: ${err.message}`);
    }

    // Determine if it's a playlist
    const isPlaylist = data._type === 'playlist' || Array.isArray(data.entries);

    if (isPlaylist) {
      const entries: any[] = data.entries || [];
      const playlistItems: PlaylistItem[] = entries.map((entry, idx) => ({
        id: entry.id || `item-${idx}`,
        index: idx + 1,
        title: entry.title || `Video ${idx + 1}`,
        url: entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : cleanUrl),
        duration: typeof entry.duration === 'number' ? entry.duration : undefined,
        thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail,
        uploader: entry.uploader || entry.channel || data.uploader,
      }));

      // For playlists, provide standard quality options
      const standardFormats: MediaFormat[] = [
        {
          formatId: 'bestvideo+bestaudio/best',
          ext: 'mp4',
          qualityLabel: 'Best Available Quality',
          isVideoOnly: false,
          isAudioOnly: false,
          isMuxed: true,
        },
        {
          formatId: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
          ext: 'mp4',
          resolution: '3840x2160',
          height: 2160,
          qualityLabel: '4K (2160p)',
          isVideoOnly: false,
          isAudioOnly: false,
          isMuxed: true,
        },
        {
          formatId: 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
          ext: 'mp4',
          resolution: '2560x1440',
          height: 1440,
          qualityLabel: '2K (1440p)',
          isVideoOnly: false,
          isAudioOnly: false,
          isMuxed: true,
        },
        {
          formatId: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
          ext: 'mp4',
          resolution: '1920x1080',
          height: 1080,
          qualityLabel: 'Full HD (1080p)',
          isVideoOnly: false,
          isAudioOnly: false,
          isMuxed: true,
        },
        {
          formatId: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
          ext: 'mp4',
          resolution: '1280x720',
          height: 720,
          qualityLabel: 'HD (720p)',
          isVideoOnly: false,
          isAudioOnly: false,
          isMuxed: true,
        },
        {
          formatId: 'bestvideo[height<=480]+bestaudio/best[height<=480]',
          ext: 'mp4',
          resolution: '854x480',
          height: 480,
          qualityLabel: 'SD (480p)',
          isVideoOnly: false,
          isAudioOnly: false,
          isMuxed: true,
        },
        {
          formatId: 'bestaudio/best',
          ext: 'mp3',
          qualityLabel: 'Audio Only (MP3)',
          isVideoOnly: false,
          isAudioOnly: true,
          isMuxed: false,
        },
      ];

      return {
        id: data.id || 'playlist',
        url: cleanUrl,
        title: data.title || 'Course / Playlist',
        description: data.description,
        thumbnail: data.thumbnails?.[0]?.url || data.thumbnail,
        uploader: data.uploader || data.channel,
        uploaderUrl: data.uploader_url || data.channel_url,
        platform: provider.id,
        isPlaylist: true,
        playlistTitle: data.title || 'Playlist',
        playlistItemCount: playlistItems.length,
        playlistItems,
        formats: standardFormats,
        subtitles: [],
      };
    }

    // Single video extraction
    const rawFormats: any[] = Array.isArray(data.formats) ? data.formats : [];
    const formats: MediaFormat[] = [];
    const seenQualities = new Set<string>();

    // Always include a smart "Best Available" format
    formats.push({
      formatId: 'bestvideo+bestaudio/best',
      ext: 'mp4',
      qualityLabel: 'Best Available Quality',
      isVideoOnly: false,
      isAudioOnly: false,
      isMuxed: true,
    });

    // Parse available video formats and filter to distinct resolutions
    const videoFormats = rawFormats
      .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    for (const f of videoFormats) {
      const height = f.height;
      const key = `${height}p`;
      if (!seenQualities.has(key)) {
        seenQualities.add(key);

        let label = `${height}p`;
        if (height >= 2160) label = `4K (${height}p)`;
        else if (height >= 1440) label = `2K (${height}p)`;
        else if (height >= 1080) label = `Full HD (${height}p)`;
        else if (height >= 720) label = `HD (${height}p)`;
        else label = `SD (${height}p)`;

        if (f.fps && f.fps > 30) {
          label += ` ${f.fps}fps`;
        }

        formats.push({
          formatId: f.format_id,
          ext: f.ext || 'mp4',
          resolution: f.resolution || `${f.width}x${f.height}`,
          height: f.height,
          width: f.width,
          fps: f.fps,
          vcodec: f.vcodec,
          acodec: f.acodec,
          filesize: f.filesize || f.filesize_approx,
          tbr: f.tbr,
          qualityLabel: label,
          isVideoOnly: f.acodec === 'none',
          isAudioOnly: false,
          isMuxed: f.acodec !== 'none',
        });
      }
    }

    // Audio only formats
    formats.push({
      formatId: 'bestaudio/best',
      ext: 'mp3',
      qualityLabel: 'Audio Only (MP3)',
      isVideoOnly: false,
      isAudioOnly: true,
      isMuxed: false,
    });
    formats.push({
      formatId: 'bestaudio[ext=m4a]/bestaudio/best',
      ext: 'm4a',
      qualityLabel: 'Audio Only (M4A / AAC)',
      isVideoOnly: false,
      isAudioOnly: true,
      isMuxed: false,
    });

    // Parse subtitles
    const subtitles: SubtitleTrack[] = [];
    if (data.subtitles) {
      for (const [lang, list] of Object.entries<any>(data.subtitles)) {
        const first = Array.isArray(list) ? list[0] : null;
        subtitles.push({
          language: lang,
          name: first?.name || lang,
          ext: first?.ext || 'vtt',
          isAutoGenerated: false,
        });
      }
    }
    if (data.automatic_captions) {
      for (const [lang, list] of Object.entries<any>(data.automatic_captions)) {
        if (!subtitles.some((s) => s.language === lang)) {
          const first = Array.isArray(list) ? list[0] : null;
          subtitles.push({
            language: lang,
            name: `${first?.name || lang} (Auto)`,
            ext: first?.ext || 'vtt',
            isAutoGenerated: true,
          });
        }
      }
    }

    return {
      id: data.id || 'video',
      url: cleanUrl,
      title: data.title || 'Media Video',
      description: data.description,
      thumbnail: data.thumbnail || data.thumbnails?.[0]?.url,
      uploader: data.uploader || data.channel,
      uploaderUrl: data.uploader_url || data.channel_url,
      duration: typeof data.duration === 'number' ? data.duration : undefined,
      platform: provider.id,
      isPlaylist: false,
      formats,
      subtitles,
    };
  }

  /**
   * Spawns a download job and tracks its progress in real-time
   */
  public async startDownload(
    job: DownloadJob,
    onProgress: (updatedJob: DownloadJob) => void,
    onComplete: (completedJob: DownloadJob) => void,
    onError: (failedJob: DownloadJob, err: Error) => void
  ): Promise<void> {
    const ytDlpPath = await this.resolver.getYtDlpPath();
    const ffmpegPath = await this.resolver.getFfmpegPath();

    if (!ytDlpPath) {
      const err = new Error('yt-dlp is missing. Cannot start download.');
      job.status = 'failed';
      job.errorMessage = err.message;
      onError(job, err);
      return;
    }

    // Ensure output directory exists
    const outputDir = path.dirname(job.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const args: string[] = [
      '--newline',
      '--no-colors',
      '--no-playlist',
    ];

    if (ffmpegPath) {
      const ffmpegDir = path.dirname(ffmpegPath);
      args.push('--ffmpeg-location', ffmpegDir);
    }

    if (job.isAudioOnly) {
      args.push('-x');
      const audioFormat = job.targetContainer === 'm4a' ? 'm4a' : 'mp3';
      args.push('--audio-format', audioFormat);
      args.push('-f', 'bestaudio/best');
    } else {
      if (job.selectedFormat && job.selectedFormat !== 'bestvideo+bestaudio/best') {
        if (job.selectedFormat.includes('+') || job.selectedFormat.includes('/')) {
          args.push('-f', job.selectedFormat);
        } else {
          // If specific format ID, pair with best audio and merge
          args.push('-f', `${job.selectedFormat}+bestaudio/best`);
        }
      } else {
        args.push('-f', 'bestvideo+bestaudio/best');
      }

      const container = job.targetContainer || 'mp4';
      args.push('--merge-output-format', container);
    }

    // Subtitles
    if (job.selectedSubtitles && job.selectedSubtitles.length > 0) {
      args.push('--write-subs', '--sub-langs', job.selectedSubtitles.join(','));
      if (job.embedSubtitles) {
        args.push('--embed-subs');
      }
    }

    // Output template
    args.push('-o', job.outputPath);
    args.push(job.sourceUrl);

    job.status = 'downloading';
    job.startedAt = new Date().toISOString();
    onProgress(job);

    const child = spawn(ytDlpPath, args, {
      windowsHide: true,
    });

    this.activeProcesses.set(job.id, child);

    let stderrBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split(/[\r\n]+/);

      for (const line of lines) {
        if (!line.trim()) continue;

        // Check if merging / post-processing
        if (line.includes('[Merger]') || line.includes('[ExtractAudio]') || line.includes('[Fixup')) {
          job.status = 'processing';
          job.progress = 99;
          job.downloadSpeed = 'Finalizing file...';
          onProgress(job);
          continue;
        }

        // Parse standard yt-dlp download progress:
        // [download]  45.2% of ~  25.40MiB at  3.50MiB/s ETA 00:04
        if (line.startsWith('[download]')) {
          const percentMatch = line.match(/(\d+(?:\.\d+)?)%/);
          if (percentMatch) {
            job.progress = Math.min(parseFloat(percentMatch[1]), 99.9);
          }

          const speedMatch = line.match(/at\s+([~0-9.]+[KkMmGg]iB\/s)/);
          if (speedMatch) {
            job.downloadSpeed = speedMatch[1];
          }

          const etaMatch = line.match(/ETA\s+(\d+:\d+(?::\d+)?)/);
          if (etaMatch) {
            job.eta = etaMatch[1];
          }

          // Parse size
          const sizeMatch = line.match(/of\s+(?:~\s*)?([0-9.]+[KkMmGg]iB)/);
          if (sizeMatch) {
            job.totalBytes = this.parseBytes(sizeMatch[1]);
            job.downloadedBytes = Math.round((job.progress / 100) * job.totalBytes);
          }

          job.status = 'downloading';
          onProgress(job);
        }
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    child.on('close', (code) => {
      this.activeProcesses.delete(job.id);

      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
        job.eta = '00:00';
        job.downloadSpeed = '';
        job.completedAt = new Date().toISOString();

        // Calculate actual file size if output file exists
        try {
          if (fs.existsSync(job.outputPath)) {
            const stat = fs.statSync(job.outputPath);
            job.totalBytes = stat.size;
            job.downloadedBytes = stat.size;
          }
        } catch {}

        onComplete(job);
      } else if (job.status === 'cancelled') {
        // Was deliberately cancelled by user
        onProgress(job);
      } else {
        job.status = 'failed';
        job.errorMessage = stderrBuffer.trim() || `Process exited with code ${code}`;
        onError(job, new Error(job.errorMessage));
      }
    });

    child.on('error', (err) => {
      this.activeProcesses.delete(job.id);
      job.status = 'failed';
      job.errorMessage = err.message;
      onError(job, err);
    });
  }

  /**
   * Cancels an active download process
   */
  public cancelDownload(jobId: string): boolean {
    const child = this.activeProcesses.get(jobId);
    if (!child) return false;

    try {
      if (process.platform === 'win32' && child.pid) {
        // Use taskkill to kill the whole process tree (including any spawned ffmpeg child)
        spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
      } else {
        child.kill('SIGTERM');
      }
      this.activeProcesses.delete(jobId);
      return true;
    } catch (err) {
      console.error(`[MediaEngine] Failed to kill process for job ${jobId}:`, err);
      return false;
    }
  }

  private executeProcess(executable: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout || `Process exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  }

  private parseBytes(sizeStr: string): number {
    const match = sizeStr.match(/([0-9.]+)\s*([KkMmGgTt]iB|[KkMmGgTt]B|B)/);
    if (!match) return 0;

    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (unit.startsWith('K')) return Math.round(val * 1024);
    if (unit.startsWith('M')) return Math.round(val * 1024 * 1024);
    if (unit.startsWith('G')) return Math.round(val * 1024 * 1024 * 1024);
    if (unit.startsWith('T')) return Math.round(val * 1024 * 1024 * 1024 * 1024);
    return Math.round(val);
  }
}
