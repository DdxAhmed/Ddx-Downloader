import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { shell } from 'electron';
import { DatabaseService, SubtitleFileRow } from '../database';
import {
  SubtitleCue,
  SubtitleSearchQuery,
  SubtitleSearchResponse,
  SubtitleSearchResult,
  SupportedPlayerInfo,
} from '../../types';
import { formatTimestamp } from '../media/filename-sanitizer';

export class SubtitleService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Arabic & English text normalization for search matching.
   * Strips tashkeel (diacritics), tatweel, normalizes alefs, yeh, and teh marbuta.
   */
  public static normalizeText(text: string): string {
    if (!text) return '';

    let res = text.toLowerCase();

    // 1. Remove Arabic Harakat / Diacritics (tashkeel: fathah, dammah, kasrah, sukun, shaddah, tanween)
    res = res.replace(/[\u064B-\u065F\u0670]/g, '');

    // 2. Remove Tatweel / Kashida
    res = res.replace(/\u0640/g, '');

    // 3. Normalize Alefs: [إأآٱ] -> ا
    res = res.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');

    // 4. Normalize Teh Marbuta: ة -> ه
    res = res.replace(/\u0629/g, '\u0647');

    // 5. Normalize Alif Maqsurah: ى -> ي
    res = res.replace(/\u0649/g, '\u064A');

    // 6. Normalize English/general punctuation and collapse spaces
    res = res.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ');
    res = res.replace(/\s+/g, ' ').trim();

    return res;
  }

  /**
   * Strips XML/HTML markup tags like <c>, <b>, <i>, <v Speaker> and VTT positioning tokens
   */
  public static stripMarkup(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') // remove HTML/XML tags
      .replace(/\{[^}]*\}/g, '') // remove bracket styles if present
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Parses time string (00:01:23.456 or 00:01:23,456 or 01:23.456) into seconds
   */
  public static parseTime(timeStr: string): number {
    const clean = timeStr.trim().replace(',', '.');
    const parts = clean.split(':');
    if (parts.length === 3) {
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      const s = parseFloat(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    } else if (parts.length === 2) {
      const m = parseFloat(parts[0]) || 0;
      const s = parseFloat(parts[1]) || 0;
      return m * 60 + s;
    }
    return parseFloat(clean) || 0;
  }

  /**
   * Parses an SRT or WebVTT string into structured cue objects.
   * Gracefully handles empty lines, missing cue numbers, and malformed headers.
   */
  public static parseSubtitleContent(
    content: string,
    fileId: string
  ): Omit<SubtitleCue, 'id'>[] {
    const cues: Omit<SubtitleCue, 'id'>[] = [];
    if (!content || !content.trim()) return cues;

    // Normalize newlines
    const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');

    let i = 0;
    let cueIndex = 1;

    // Skip WebVTT header block if present
    if (lines[0] && lines[0].startsWith('WEBVTT')) {
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        i++;
      }
    }

    const timeArrowRegex = /(?:(\d+:\d+:\d+[\.,]\d+|\d+:\d+[\.,]\d+))\s*-->\s*(?:(\d+:\d+:\d+[\.,]\d+|\d+:\d+[\.,]\d+))/;

    while (i < lines.length) {
      const line = lines[i].trim();

      // Skip comments or empty lines
      if (!line || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
        // Skip until next empty line
        if (line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
          while (i < lines.length && lines[i].trim() !== '') {
            i++;
          }
        }
        i++;
        continue;
      }

      // Check if line is timestamp line, or if the next line is timestamp line
      let match = line.match(timeArrowRegex);
      if (!match && i + 1 < lines.length) {
        match = lines[i + 1].trim().match(timeArrowRegex);
        if (match) {
          i++; // current line was cue index number
        }
      }

      if (match) {
        const startTime = SubtitleService.parseTime(match[1]);
        const endTime = SubtitleService.parseTime(match[2]);

        i++;
        const textLines: string[] = [];
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i++;
        }

        const rawText = textLines.join(' ');
        const cleanText = SubtitleService.stripMarkup(rawText);

        if (cleanText) {
          cues.push({
            fileId,
            cueIndex: cueIndex++,
            startTime,
            endTime,
            text: cleanText,
            normalizedText: SubtitleService.normalizeText(cleanText),
          });
        }
      } else {
        i++;
      }
    }

    return cues;
  }

  /**
   * Safely reads subtitle file content with charset detection fallback.
   */
  private readFileSafely(filePath: string): string | null {
    try {
      const buffer = fs.readFileSync(filePath);
      // Remove UTF-8 BOM if present
      if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return buffer.subarray(3).toString('utf8');
      }

      // Try UTF-8 first
      const utf8Text = buffer.toString('utf8');
      // Simple check for replacement characters which indicate non-utf8
      if (!utf8Text.includes('\uFFFD')) {
        return utf8Text;
      }

      // Fallback to latin1 / windows-1256
      return buffer.toString('latin1');
    } catch (err) {
      console.warn(`[SubtitleService] Error reading file ${filePath}:`, err);
      return null;
    }
  }

  /**
   * Indexes a single subtitle file on disk.
   * If file hasn't changed since last indexing (matching mtime and size), skips cleanly.
   */
  public async indexSubtitleFile(
    filePath: string,
    metadata?: {
      mediaTitle?: string;
      mediaId?: string;
      language?: string;
      associatedMediaFile?: string;
    }
  ): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) return false;

      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.srt' && ext !== '.vtt') return false;

      const format: 'srt' | 'vtt' = ext === '.srt' ? 'srt' : 'vtt';
      const existing = this.db.getSubtitleFileByPath(filePath);

      // Check if unchanged
      if (existing && existing.mtimeMs === stat.mtimeMs && existing.fileSize === stat.size) {
        return true; // Already up to date
      }

      const content = this.readFileSafely(filePath);
      if (content === null) return false;

      const fileId = existing?.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

      // Infer language from filename (e.g. video.ar.srt or video.en.vtt)
      let language = metadata?.language;
      if (!language) {
        const langMatch = path.basename(filePath, ext).match(/\.([a-z]{2,3}(?:-[A-Za-z0-9]+)?)$/i);
        language = langMatch ? langMatch[1].toLowerCase() : 'unknown';
      }

      // Infer media title
      let mediaTitle = metadata?.mediaTitle;
      if (!mediaTitle) {
        let base = path.basename(filePath, ext);
        base = base.replace(/\.([a-z]{2,3}(?:-[A-Za-z0-9]+)?)$/i, '');
        mediaTitle = base;
      }

      // Look for associated media file in the same directory if not provided
      let associatedMediaFile = metadata?.associatedMediaFile;
      if (!associatedMediaFile) {
        const dir = path.dirname(filePath);
        const base = path.basename(filePath, ext).replace(/\.([a-z]{2,3}(?:-[A-Za-z0-9]+)?)$/i, '');
        const videoExtensions = ['.mp4', '.mkv', '.webm', '.mp3', '.m4a'];
        for (const vext of videoExtensions) {
          const candidate = path.join(dir, `${base}${vext}`);
          if (fs.existsSync(candidate)) {
            associatedMediaFile = candidate;
            break;
          }
        }
      }

      // Parse cues
      const rawCues = SubtitleService.parseSubtitleContent(content, fileId);
      const cues: SubtitleCue[] = rawCues.map((c, idx) => ({
        ...c,
        id: `cue-${fileId}-${idx + 1}`,
      }));

      // Delete old cues if re-indexing changed file
      if (existing) {
        this.db.deleteSubtitleCuesByFileId(fileId);
      }

      const fileRecord: SubtitleFileRow = {
        id: fileId,
        filePath,
        mediaTitle,
        mediaId: metadata?.mediaId,
        language,
        format,
        mtimeMs: stat.mtimeMs,
        fileSize: stat.size,
        cueCount: cues.length,
        associatedMediaFile,
        indexedAt: new Date().toISOString(),
      };

      this.db.saveSubtitleFile(fileRecord);
      this.db.insertSubtitleCues(cues);

      return true;
    } catch (err) {
      console.error(`[SubtitleService] Failed to index ${filePath}:`, err);
      return false;
    }
  }

  /**
   * Imports an array of user-selected subtitle files or scans a user-selected folder.
   * Yields to the event loop so the Electron main process is never blocked.
   */
  public async importSubtitleFiles(filePaths: string[]): Promise<number> {
    let count = 0;
    for (const file of filePaths) {
      const ok = await this.indexSubtitleFile(file);
      if (ok) count++;
      // Yield execution to prevent UI freezing
      await new Promise((res) => setImmediate(res));
    }
    return count;
  }

  public async importSubtitleFolder(folderPath: string): Promise<number> {
    if (!fs.existsSync(folderPath)) return 0;
    const entries = fs.readdirSync(folderPath);
    const subFiles: string[] = [];

    for (const name of entries) {
      const full = path.join(folderPath, name);
      try {
        const stat = fs.statSync(full);
        if (stat.isFile()) {
          const ext = path.extname(name).toLowerCase();
          if (ext === '.srt' || ext === '.vtt') {
            subFiles.push(full);
          }
        }
      } catch {}
    }

    return this.importSubtitleFiles(subFiles);
  }

  /**
   * Generates safe highlighted snippet of the matching text.
   */
  private generateSafeSnippet(text: string, query: string): string {
    if (!text || !query) return text;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);

    if (idx === -1) {
      // Check normalized match
      const normText = SubtitleService.normalizeText(text);
      const normQuery = SubtitleService.normalizeText(query);
      const normIdx = normText.indexOf(normQuery);
      if (normIdx === -1) {
        return text.length > 120 ? `${text.substring(0, 117)}...` : text;
      }
    }

    // Window around match
    const matchPos = idx !== -1 ? idx : 0;
    const start = Math.max(0, matchPos - 40);
    const end = Math.min(text.length, matchPos + query.length + 50);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';

    return `${prefix}${text.substring(start, end)}${suffix}`;
  }

  /**
   * Searches locally indexed subtitles with Arabic/English normalization and pagination.
   */
  public searchSubtitles(req: SubtitleSearchQuery): SubtitleSearchResponse {
    const query = req.query?.trim();
    if (!query) {
      return { results: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    const page = Math.max(1, req.page || 1);
    const pageSize = Math.min(100, Math.max(1, req.pageSize || 20));
    const offset = (page - 1) * pageSize;

    const normalizedQuery = SubtitleService.normalizeText(query);
    const searchRes = this.db.searchSubtitleCues(normalizedQuery, req.language, pageSize, offset);

    const detectedPlayers = this.getDetectedMediaPlayers();
    const defaultSeekPlayer = detectedPlayers.length > 0 ? detectedPlayers[0] : null;

    const results: SubtitleSearchResult[] = searchRes.cues.map((cue) => {
      const mediaExists = cue.associatedMediaFile ? fs.existsSync(cue.associatedMediaFile) : false;
      return {
        id: cue.id,
        fileId: cue.fileId,
        cueIndex: cue.cueIndex,
        startTime: cue.startTime,
        endTime: cue.endTime,
        timestampFormatted: formatTimestamp(cue.startTime),
        text: cue.text,
        matchedSnippet: this.generateSafeSnippet(cue.text, query),
        mediaTitle: cue.mediaTitle,
        subtitlePath: cue.filePath,
        language: cue.language,
        format: cue.format,
        associatedMediaPath: cue.associatedMediaFile,
        mediaExists,
        canDirectSeek: !!defaultSeekPlayer && mediaExists,
        supportedPlayerName: defaultSeekPlayer?.displayName,
      };
    });

    const totalPages = Math.ceil(searchRes.total / pageSize);
    return {
      results,
      total: searchRes.total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Detects known media players with seek CLI capability (VLC, MPV, MPC-HC)
   */
  public getDetectedMediaPlayers(): SupportedPlayerInfo[] {
    const list: SupportedPlayerInfo[] = [];
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      const vlcPaths = [
        'C:\\Program Files\\VideoLAN\\VLC\\vlc.exe',
        'C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe',
      ];
      for (const p of vlcPaths) {
        if (fs.existsSync(p)) {
          list.push({ name: 'vlc', displayName: 'VLC Media Player', executablePath: p });
          break;
        }
      }

      const mpcPaths = [
        'C:\\Program Files\\MPC-HC\\mpc-hc64.exe',
        'C:\\Program Files (x86)\\MPC-HC\\mpc-hc.exe',
      ];
      for (const p of mpcPaths) {
        if (fs.existsSync(p)) {
          list.push({ name: 'mpc-hc', displayName: 'MPC-HC', executablePath: p });
          break;
        }
      }
    } else {
      // Unix / macOS candidates
      const unixCandidates = [
        { path: '/usr/bin/vlc', name: 'vlc' as const, disp: 'VLC' },
        { path: '/usr/bin/mpv', name: 'mpv' as const, disp: 'MPV' },
        { path: '/Applications/VLC.app/Contents/MacOS/VLC', name: 'vlc' as const, disp: 'VLC' },
      ];
      for (const c of unixCandidates) {
        if (fs.existsSync(c.path)) {
          list.push({ name: c.name, displayName: c.disp, executablePath: c.path });
        }
      }
    }

    return list;
  }

  /**
   * Plays media file at given timestamp using an explicitly supported player (VLC, MPV, MPC-HC).
   * If no seek-capable player is installed, opens normally with system default player
   * and copies the formatted timestamp so user is informed without false pretenses.
   */
  public async playMediaAtTimestamp(
    mediaPath: string,
    timestampSeconds: number,
    customPlayerPath?: string
  ): Promise<{ success: boolean; launchedPlayer?: string; copiedTimestamp?: string; error?: string }> {
    if (!fs.existsSync(mediaPath)) {
      return { success: false, error: 'Associated media file does not exist on disk.' };
    }

    const formattedTime = formatTimestamp(timestampSeconds);
    let playerPath = customPlayerPath && fs.existsSync(customPlayerPath) ? customPlayerPath : undefined;
    let playerName = 'Custom Player';

    if (!playerPath) {
      const detected = this.getDetectedMediaPlayers();
      if (detected.length > 0) {
        playerPath = detected[0].executablePath;
        playerName = detected[0].displayName;
      }
    }

    if (playerPath) {
      try {
        const lower = playerPath.toLowerCase();
        const args: string[] = [];

        if (lower.includes('vlc')) {
          args.push(`--start-time=${Math.floor(timestampSeconds)}`, mediaPath);
        } else if (lower.includes('mpv')) {
          args.push(`--start=${Math.floor(timestampSeconds)}`, mediaPath);
        } else if (lower.includes('mpc-hc')) {
          args.push(mediaPath, `/startpos`, formattedTime);
        } else {
          args.push(mediaPath);
        }

        spawn(playerPath, args, { detached: true, stdio: 'ignore' }).unref();
        return { success: true, launchedPlayer: playerName, copiedTimestamp: formattedTime };
      } catch (err: any) {
        console.warn('[SubtitleService] Failed to spawn seek player:', err);
      }
    }

    // Fallback: Open with default system viewer and return copied timestamp
    try {
      await shell.openPath(mediaPath);
      return {
        success: true,
        copiedTimestamp: formattedTime,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
