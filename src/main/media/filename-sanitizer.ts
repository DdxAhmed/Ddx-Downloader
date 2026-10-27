import path from 'path';
import fs from 'fs';
import { TimeRange } from '../../types';

export function sanitizeFilename(name: string): string {
  if (!name) return 'media';

  // Remove control characters and illegal Windows/Unix filesystem characters: < > : " / \ | ? *
  let clean = name.replace(/[\x00-\x1f\\/:*?"<>|]/g, '_');

  // Collapse multiple spaces or underscores
  clean = clean.replace(/\s+/g, ' ').replace(/_+/g, '_').trim();

  // Remove trailing dots or spaces which are invalid in Windows
  clean = clean.replace(/[. ]+$/, '');

  // Truncate to reasonable length (prevent MAX_PATH issues on Windows)
  if (clean.length > 180) {
    clean = clean.substring(0, 180).trim();
  }

  // Handle Windows reserved DOS device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const reservedRegex = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reservedRegex.test(clean)) {
    clean = `${clean}_file`;
  }

  return clean || 'media';
}

/**
 * Formats seconds into a compact filename-friendly tag (e.g. 90 -> "01m30s", 3665 -> "01h01m05s")
 */
export function formatTimeTag(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
  }
  return `${String(m).padStart(2, '0')}m${String(s).padStart(2, '0')}s`;
}

/**
 * Parses user input timestamp string (HH:MM:SS, MM:SS, HH:MM, or pure seconds)
 * Returns total seconds as a float, or null if invalid.
 */
export function parseTimestamp(input: string): number | null {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  if (!str) return null;

  // Check pure number of seconds (e.g. "95" or "95.5")
  if (/^\d+(\.\d+)?$/.test(str)) {
    const val = parseFloat(str);
    return isNaN(val) || val < 0 ? null : val;
  }

  // Check colon-separated: HH:MM:SS or MM:SS or HH:MM
  const parts = str.split(':');
  if (parts.length === 2) {
    // MM:SS
    const [minStr, secStr] = parts;
    const min = parseFloat(minStr);
    const sec = parseFloat(secStr);
    if (isNaN(min) || isNaN(sec) || min < 0 || sec < 0 || sec >= 60) return null;
    return min * 60 + sec;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const [hStr, mStr, sStr] = parts;
    const h = parseFloat(hStr);
    const m = parseFloat(mStr);
    const s = parseFloat(sStr);
    if (isNaN(h) || isNaN(m) || isNaN(s) || h < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) {
      return null;
    }
    return h * 3600 + m * 60 + s;
  }

  return null;
}

/**
 * Formats seconds into human-readable HH:MM:SS or MM:SS
 */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Validates start and end timestamps against constraints and known media duration
 */
export function validateTimeRange(
  start: number,
  end: number,
  mediaDuration?: number
): { valid: boolean; error?: string } {
  if (isNaN(start) || start < 0) {
    return { valid: false, error: 'Start timestamp must be 0 or greater.' };
  }
  if (isNaN(end) || end <= start) {
    return { valid: false, error: 'End timestamp must be strictly greater than start timestamp.' };
  }
  if (typeof mediaDuration === 'number' && mediaDuration > 0 && end > mediaDuration + 0.5) {
    return {
      valid: false,
      error: `End timestamp (${formatTimestamp(end)}) exceeds total media duration (${formatTimestamp(mediaDuration)}).`,
    };
  }
  return { valid: true };
}

export function buildOutputPath(
  baseDir: string,
  title: string,
  ext: string,
  options?: {
    isPlaylist?: boolean;
    playlistTitle?: string;
    playlistIndex?: number;
    subfolder?: string;
    timeRange?: TimeRange;
    checkCollision?: boolean;
  }
): string {
  let targetFolder = baseDir;

  if (options?.playlistTitle && options.isPlaylist) {
    const safePlaylistDir = sanitizeFilename(options.playlistTitle);
    targetFolder = path.join(targetFolder, safePlaylistDir);
  } else if (options?.subfolder) {
    const safeSub = sanitizeFilename(options.subfolder);
    targetFolder = path.join(targetFolder, safeSub);
  }

  let finalFileName = sanitizeFilename(title);

  if (options?.playlistIndex !== undefined && options.playlistIndex >= 0) {
    const indexStr = String(options.playlistIndex).padStart(2, '0');
    finalFileName = `${indexStr} - ${finalFileName}`;
  }

  // Include range suffix to clearly distinguish clips from complete videos
  if (options?.timeRange) {
    const startTag = formatTimeTag(options.timeRange.start);
    const endTag = formatTimeTag(options.timeRange.end);
    finalFileName = `${finalFileName} [${startTag}-${endTag}]`;
  }

  const cleanExt = ext.replace(/^\./, '');
  const candidate = path.join(targetFolder, `${finalFileName}.${cleanExt}`);

  if (options?.checkCollision) {
    return ensureUniqueOutputPath(candidate);
  }

  return candidate;
}

/**
 * Handles filename collisions safely by appending (1), (2), etc. before the extension if file exists
 */
export function ensureUniqueOutputPath(desiredPath: string): string {
  if (!fs.existsSync(desiredPath)) {
    return desiredPath;
  }

  const dir = path.dirname(desiredPath);
  const ext = path.extname(desiredPath);
  const baseName = path.basename(desiredPath, ext);

  let counter = 1;
  let candidate = path.join(dir, `${baseName} (${counter})${ext}`);

  while (fs.existsSync(candidate)) {
    counter++;
    candidate = path.join(dir, `${baseName} (${counter})${ext}`);
  }

  return candidate;
}
