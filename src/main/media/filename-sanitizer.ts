import path from 'path';

export function sanitizeFilename(name: string): string {
  if (!name) return 'media';

  // Remove control characters and illegal Windows/Unix filesystem characters
  let clean = name.replace(/[\x00-\x1f\x80-\x9f\\/:*?"<>|]/g, '_');

  // Collapse multiple spaces or underscores
  clean = clean.replace(/\s+/g, ' ').replace(/_+/g, '_').trim();

  // Remove trailing dots or spaces which are invalid in Windows
  clean = clean.replace(/[. ]+$/, '');

  // Truncate to reasonable length (prevent MAX_PATH issues on Windows)
  if (clean.length > 180) {
    clean = clean.substring(0, 180).trim();
  }

  return clean || 'media';
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

  return path.join(targetFolder, `${finalFileName}.${ext}`);
}
