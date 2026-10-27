import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { DependencyResolver } from './dependency-resolver';
import { ProviderRegistry } from './providers/provider-registry';
import { sanitizeFilename, buildOutputPath } from './filename-sanitizer';
import { ErrorClassifier } from './error-classifier';
import {
  MediaInfo,
  MediaFormat,
  SubtitleTrack,
  MediaChapter,
  PlaylistItem,
  DownloadJob,
  CreateDownloadRequest,
  MediaConversionRequest,
  ConversionProgress,
} from '../../types';

export class MediaEngine {
  private resolver: DependencyResolver;
  private providerRegistry: ProviderRegistry;
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private pendingDownloads = new Map<string, object>();
  private activeConversionProcess?: ChildProcess;
  private children = new Set<ChildProcess>();
  private shuttingDown = false;
  private pendingConversion = false;

  private trackChild(child: ChildProcess): void {
    this.children.add(child);
    child.once('close', () => this.children.delete(child));
    child.once('error', () => { if (!child.pid) this.children.delete(child); });
  }

  public hasActiveWork(): boolean {
    return this.children.size > 0 || this.pendingDownloads.size > 0 || this.pendingConversion;
  }

  public recoverFromShutdown(): void { this.shuttingDown = false; }

  public async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.pendingDownloads.clear();
    this.activeProcesses.clear();
    const results = await Promise.allSettled([...this.children].map((child) => new Promise<void>((resolve, reject) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
      const timer = setTimeout(() => finish(new Error('A media process did not stop; update postponed.')), 10000);
      let childClosed = false;
      let treeStopped = process.platform !== 'win32' || !child.pid;
      const onClose = () => { childClosed = true; if (treeStopped) finish(); };
      const finish = (error?: Error) => {
        clearTimeout(timer);
        child.removeListener('close', onClose);
        error ? reject(error) : resolve();
      };
      child.once('close', onClose);
      try {
        if (process.platform === 'win32' && child.pid) {
          const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
            ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
          killer.once('error', finish);
          killer.once('close', (code) => {
            if (code !== 0) { finish(new Error('Could not confirm that the media process tree stopped; update postponed.')); return; }
            treeStopped = true;
            if (childClosed) finish();
          });
        } else if (!child.kill('SIGTERM')) finish(new Error('Could not stop a media process; update postponed.'));
      } catch (error) { finish(error as Error); }
    })));
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }
  private playlistItemSizeCache = new Map<string, { filesize?: number; filesizeApprox?: number; tbr?: number }>();
  private onSubtitlesDownloadedCallback?: (subtitlePath: string, job: DownloadJob) => void;

  constructor(resolver: DependencyResolver) {
    this.resolver = resolver;
    this.providerRegistry = new ProviderRegistry();
  }

  public setOnSubtitlesDownloaded(cb: (subtitlePath: string, job: DownloadJob) => void): void {
    this.onSubtitlesDownloadedCallback = cb;
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

    // Parse chapters if available
    const chapters: MediaChapter[] = Array.isArray(data.chapters)
      ? data.chapters.map((c: any) => ({
          title: c.title || 'Chapter',
          startTime: typeof c.start_time === 'number' ? c.start_time : 0,
          endTime: typeof c.end_time === 'number' ? c.end_time : 0,
        }))
      : undefined;

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
      chapters,
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
    if (this.shuttingDown) throw new Error('Application is preparing to exit.');
    const attempt = {};
    this.pendingDownloads.set(job.id, attempt);
    let ytDlpPath: string | null;
    let ffmpegPath: string | null;
    try {
      ytDlpPath = await this.resolver.getYtDlpPath();
      if (this.pendingDownloads.get(job.id) !== attempt) return;
      ffmpegPath = await this.resolver.getFfmpegPath();
      if (this.pendingDownloads.get(job.id) !== attempt) return;
    } finally {
      if (this.pendingDownloads.get(job.id) === attempt) {
        this.pendingDownloads.delete(job.id);
      }
    }

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
      args.push('--postprocessor-args', 'ffmpeg:-strict -2');
    }

    // Apply speed limit if configured (e.g. '5M', '1M')
    if (job.speedLimit && job.speedLimit !== 'unlimited') {
      args.push('--limit-rate', job.speedLimit);
    }

    if (job.isAudioOnly) {
      args.push('-x');
      const audioFormat = job.targetContainer === 'm4a' ? 'm4a' : 'mp3';
      args.push('--audio-format', audioFormat);
      args.push('-f', 'bestaudio/best');
    } else {
      const container = job.targetContainer || 'mp4';
      if (job.selectedFormat && job.selectedFormat !== 'bestvideo+bestaudio/best') {
        if (job.selectedFormat.includes('+') || job.selectedFormat.includes('/')) {
          args.push('-f', job.selectedFormat);
        } else {
          // MP4 cannot reliably contain Opus with older/system FFmpeg builds.
          // Prefer AAC/M4A and then a combined MP4 instead of selecting Opus
          // and failing during the final merge.
          const audioSelector = container === 'mp4'
            ? `${job.selectedFormat}+bestaudio[ext=m4a]/${job.selectedFormat}+bestaudio[acodec^=mp4a]/best[ext=mp4]`
            : `${job.selectedFormat}+bestaudio/best`;
          args.push('-f', audioSelector);
        }
      } else {
        args.push('-f', container === 'mp4'
          ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo[ext=mp4]+bestaudio[acodec^=mp4a]/best[ext=mp4]'
          : 'bestvideo+bestaudio/best');
      }
      args.push('--merge-output-format', container);
    }

    // Subtitles
    if (job.selectedSubtitles && job.selectedSubtitles.length > 0) {
      args.push('--write-subs', '--sub-langs', job.selectedSubtitles.join(','));
      if (job.embedSubtitles) {
        args.push('--embed-subs');
      }
    }

    // Time range / chapter clipping
    if (job.timeRange) {
      if (!ffmpegPath) {
        const err = new Error(
          'FFmpeg is required to download a selected time range or chapter. Please configure FFmpeg in Settings.'
        );
        job.status = 'failed';
        job.errorMessage = err.message;
        job.errorDetails = ErrorClassifier.classify(err.message);
        onError(job, err);
        return;
      }

      args.push('--download-sections', `*${job.timeRange.start}-${job.timeRange.end}`);
      if (job.cutMode === 'accurate') {
        args.push('--force-keyframes-at-cuts');
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
    this.trackChild(child);

    let stderrBuffer = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      const lines = text.split(/[\r\n]+/);

      for (const line of lines) {
        if (!line.trim()) continue;

        // Check if merging / post-processing
        if (line.includes('[Merger]')) {
          job.status = 'merging';
          job.progress = 99;
          job.downloadSpeed = 'Merging video & audio streams...';
          onProgress(job);
          continue;
        } else if (line.includes('[ExtractAudio]') || line.includes('[Fixup')) {
          job.status = 'processing';
          job.progress = 99;
          job.downloadSpeed = 'Processing audio format...';
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
      if (this.activeProcesses.get(job.id) !== child) return;
      this.activeProcesses.delete(job.id);

      if (code === 0) {
        if (job.timeRange) {
          try {
            if (!fs.existsSync(job.outputPath) || fs.statSync(job.outputPath).size <= 0) {
              throw new Error('The clip process finished without producing a valid output file.');
            }
          } catch (verificationError: any) {
            const classified = ErrorClassifier.classify(verificationError.message);
            job.status = 'failed';
            job.errorMessage = classified.explanationEn;
            job.errorDetails = classified;
            onError(job, verificationError);
            return;
          }
        }
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

        // Notify if subtitles were downloaded alongside
        if (this.onSubtitlesDownloadedCallback && job.selectedSubtitles && job.selectedSubtitles.length > 0) {
          try {
            const outDir = path.dirname(job.outputPath);
            const baseWithoutExt = path.basename(job.outputPath, path.extname(job.outputPath));
            if (fs.existsSync(outDir)) {
              const files = fs.readdirSync(outDir);
              for (const f of files) {
                if (f.startsWith(baseWithoutExt) && (f.endsWith('.vtt') || f.endsWith('.srt'))) {
                  this.onSubtitlesDownloadedCallback(path.join(outDir, f), job);
                }
              }
            }
          } catch {}
        }

        onComplete(job);
      } else if (job.status === 'cancelled') {
        // Was deliberately cancelled by user
        onProgress(job);
      } else {
        const classified = ErrorClassifier.classify(stderrBuffer, code || undefined);
        job.status = 'failed';
        job.errorMessage = classified.explanationEn;
        job.errorDetails = classified;
        onError(job, new Error(job.errorMessage));
      }
    });

    child.on('error', (err) => {
      if (this.activeProcesses.get(job.id) !== child) return;
      this.activeProcesses.delete(job.id);
      const classified = ErrorClassifier.classify(err.message);
      job.status = 'failed';
      job.errorMessage = classified.explanationEn;
      job.errorDetails = classified;
      onError(job, err);
    });
  }

  /**
   * Cancels an active download process
   */
  public cancelDownload(jobId: string): boolean {
    const cancelledPending = this.pendingDownloads.delete(jobId);
    const child = this.activeProcesses.get(jobId);
    if (!child) return cancelledPending;

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
      if (this.shuttingDown) { reject(new Error('Application is preparing to exit.')); return; }
      const child = spawn(executable, args, {
        windowsHide: true,
      });
      this.trackChild(child);

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

  /**
   * Standalone subtitle downloader: downloads and converts subtitles to SRT or VTT without video.
   */
  public async downloadStandaloneSubtitle(
    url: string,
    lang: string,
    format: 'srt' | 'vtt',
    outDir: string,
    filename: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    const ytDlpPath = await this.resolver.getYtDlpPath();
    const ffmpegPath = await this.resolver.getFfmpegPath();

    if (!ytDlpPath) {
      return { success: false, error: 'yt-dlp is required to download subtitles.' };
    }

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const safeBase = sanitizeFilename(filename || 'subtitles');
    const outTemplate = path.join(outDir, `${safeBase}.%(ext)s`);

    const args: string[] = [
      '--skip-download',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', lang,
      '--convert-subs', format,
      '-o', outTemplate,
      url,
    ];

    if (ffmpegPath) {
      args.push('--ffmpeg-location', path.dirname(ffmpegPath));
    }

    try {
      await this.executeProcess(ytDlpPath, args);
      const expectedFile = path.join(outDir, `${safeBase}.${format}`);
      const expectedWithLang = path.join(outDir, `${safeBase}.${lang}.${format}`);
      const finalPath = fs.existsSync(expectedFile)
        ? expectedFile
        : fs.existsSync(expectedWithLang)
        ? expectedWithLang
        : outTemplate;
      return { success: true, filePath: finalPath };
    } catch (err: any) {
      const classified = ErrorClassifier.classify(err.message);
      return { success: false, error: classified.explanationEn };
    }
  }

  /**
   * Media Converter Engine using FFmpeg: converts video and audio formats safely without overwriting originals.
   */
  public async convertMedia(
    req: MediaConversionRequest,
    onProgress: (prog: ConversionProgress) => void,
    onComplete: (outputPath: string) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    if (this.shuttingDown || this.pendingConversion || this.activeConversionProcess) {
      throw new Error('Conversion is unavailable while another conversion or shutdown is in progress.');
    }
    this.pendingConversion = true;
    let ffmpegPath: string | null;
    try { ffmpegPath = await this.resolver.getFfmpegPath(); }
    finally { this.pendingConversion = false; }
    if (this.shuttingDown) return;
    if (!ffmpegPath) {
      onError(new Error('FFmpeg is required for media conversion. Please configure its path in Settings.'));
      return;
    }

    if (!fs.existsSync(req.inputPath)) {
      onError(new Error('Input file does not exist on disk.'));
      return;
    }

    // Ensure target output directory exists
    const outDir = path.dirname(req.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const args: string[] = ['-y', '-i', req.inputPath];

    // Determine codec settings based on target format
    switch (req.targetFormat) {
      case 'mp3':
        args.push('-vn', '-c:a', 'libmp3lame', '-b:a', '320k');
        break;
      case 'm4a':
      case 'aac':
        args.push('-vn', '-c:a', 'aac', '-b:a', '256k');
        break;
      case 'flac':
        args.push('-vn', '-c:a', 'flac');
        break;
      case 'mp4':
        args.push('-c:v', 'libx264', '-preset', req.qualityPreset === 'fast' ? 'ultrafast' : 'medium', '-crf', req.qualityPreset === 'high_quality' ? '18' : '23', '-c:a', 'aac');
        break;
      case 'mkv':
        args.push('-c:v', 'copy', '-c:a', 'copy');
        break;
      case 'webm':
        args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-c:a', 'libopus');
        break;
      default:
        args.push('-c:v', 'copy', '-c:a', 'copy');
    }

    args.push(req.outputPath);

    onProgress({ status: 'converting', percent: 1 });

    const child = spawn(ffmpegPath, args, { windowsHide: true });
    this.activeConversionProcess = child;
    this.trackChild(child);

    let stderrBuffer = '';

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrBuffer += text;

      // Parse speed and time progress from FFmpeg stderr:
      // frame= 1234 fps= 45 q=28.0 size= 12450kB time=00:01:23.45 bitrate=1224.5kbits/s speed= 1.5x
      const speedMatch = text.match(/speed=\s*([0-9.]+x)/);
      const timeMatch = text.match(/time=(\d+:\d+:\d+\.\d+)/);

      if (timeMatch || speedMatch) {
        onProgress({
          status: 'converting',
          percent: 50, // indeterminate progress estimation
          speed: speedMatch ? speedMatch[1] : undefined,
          eta: timeMatch ? timeMatch[1] : undefined,
        });
      }
    });

    child.on('close', (code) => {
      this.activeConversionProcess = undefined;
      if (code === 0) {
        onProgress({ status: 'completed', percent: 100 });
        onComplete(req.outputPath);
      } else {
        const classified = ErrorClassifier.classify(stderrBuffer, code || undefined);
        onError(new Error(classified.explanationEn));
      }
    });

    child.on('error', (err) => {
      this.activeConversionProcess = undefined;
      onError(err);
    });
  }

  public cancelConversion(): boolean {
    if (!this.activeConversionProcess) return false;
    try {
      if (process.platform === 'win32' && this.activeConversionProcess.pid) {
        spawn('taskkill', ['/pid', this.activeConversionProcess.pid.toString(), '/f', '/t']);
      } else {
        this.activeConversionProcess.kill('SIGTERM');
      }
      this.activeConversionProcess = undefined;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetches metadata (filesize, filesize_approx, tbr) for playlist items using bounded concurrency.
   * Results are cached by item URL to prevent repeated network requests.
   */
  public async fetchPlaylistItemSizes(
    itemUrls: string[],
    concurrency = 3
  ): Promise<{ [url: string]: { filesize?: number; filesizeApprox?: number; tbr?: number } }> {
    const ytDlpPath = await this.resolver.getYtDlpPath();
    const result: { [url: string]: { filesize?: number; filesizeApprox?: number; tbr?: number } } = {};
    if (!ytDlpPath || !itemUrls || itemUrls.length === 0) return result;

    const queue = [...itemUrls];
    const runWorker = async () => {
      while (queue.length > 0) {
        const itemUrl = queue.shift();
        if (!itemUrl) break;

        if (this.playlistItemSizeCache.has(itemUrl)) {
          result[itemUrl] = this.playlistItemSizeCache.get(itemUrl)!;
          continue;
        }

        try {
          const stdout = await this.executeProcess(ytDlpPath, [
            '--dump-single-json',
            '--no-warnings',
            '--no-call-home',
            '--skip-download',
            itemUrl,
          ]);
          const data = JSON.parse(stdout);
          const info = {
            filesize: typeof data.filesize === 'number' ? data.filesize : undefined,
            filesizeApprox: typeof data.filesize_approx === 'number' ? data.filesize_approx : undefined,
            tbr: typeof data.tbr === 'number' ? data.tbr : undefined,
          };
          this.playlistItemSizeCache.set(itemUrl, info);
          result[itemUrl] = info;
        } catch {
          // If individual query fails, continue without stalling the batch
        }
      }
    };

    const workerCount = Math.min(concurrency, itemUrls.length);
    const workers = Array.from({ length: workerCount }, () => runWorker());
    await Promise.all(workers);

    return result;
  }
}
