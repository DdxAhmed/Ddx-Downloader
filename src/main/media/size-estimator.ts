import { MediaFormat, TimeRange, SizeEstimate, PlaylistSizeEstimate } from '../../types';

export class SizeEstimator {
  /**
   * Estimates download size for an individual video or audio selection.
   * Accounts for separate video + audio streams, transcoding, and clip duration.
   */
  public static estimateFormatSize(
    format?: MediaFormat,
    duration?: number,
    isAudioOnly = false,
    audioFormat?: MediaFormat,
    targetContainer = 'mp4',
    timeRange?: TimeRange
  ): SizeEstimate {
    if (!format && !isAudioOnly) {
      return { bytes: 0, type: 'unknown', details: 'No format information' };
    }

    const effectiveDuration = timeRange && timeRange.end > timeRange.start
      ? timeRange.end - timeRange.start
      : duration;

    // 1. Audio-only path
    if (isAudioOnly || format?.isAudioOnly) {
      if (targetContainer === 'mp3') {
        // Transcoding to MP3 CBR 320 kbps
        if (effectiveDuration && effectiveDuration > 0) {
          const bytes = Math.round((320 * 1000 / 8) * effectiveDuration);
          return {
            bytes,
            type: 'estimated',
            details: 'Bitrate estimate: MP3 320 kbps',
          };
        }
      }

      // Source-reported audio stream
      if (format?.filesize && format.filesize > 0) {
        let bytes = format.filesize;
        if (timeRange && duration && duration > 0) {
          bytes = Math.round((effectiveDuration! / duration) * bytes);
          return { bytes, type: 'estimated', details: 'Proportional clip estimate from reported size' };
        }
        return { bytes, type: 'reported', details: 'Reported by media source' };
      }

      if (format?.filesize_approx && format.filesize_approx > 0) {
        let bytes = format.filesize_approx;
        if (timeRange && duration && duration > 0) {
          bytes = Math.round((effectiveDuration! / duration) * bytes);
        }
        return { bytes, type: 'estimated', details: 'Approximate size from media source' };
      }

      if (format?.tbr && effectiveDuration && effectiveDuration > 0) {
        const bytes = Math.round((format.tbr * 1000 / 8) * effectiveDuration);
        return { bytes, type: 'estimated', details: `Estimated from audio bitrate (${Math.round(format.tbr)} kbps)` };
      }

      if (effectiveDuration && effectiveDuration > 0) {
        // Fallback default audio bitrate ~160 kbps
        const bytes = Math.round((160 * 1000 / 8) * effectiveDuration);
        return { bytes, type: 'estimated', details: 'Estimated standard audio bitrate (~160 kbps)' };
      }

      return { bytes: 0, type: 'unknown', details: 'Audio size cannot be determined from metadata' };
    }

    // 2. Video path
    let videoBytes = 0;
    let videoIsReported = false;

    if (format?.filesize && format.filesize > 0) {
      videoBytes = format.filesize;
      videoIsReported = true;
    } else if (format?.filesize_approx && format.filesize_approx > 0) {
      videoBytes = format.filesize_approx;
    } else if (format?.tbr && duration && duration > 0) {
      videoBytes = Math.round((format.tbr * 1000 / 8) * duration);
    }

    // Check if separate audio stream is required (video-only stream)
    let audioBytes = 0;
    let audioIsReported = false;

    if (format?.isVideoOnly) {
      if (audioFormat?.filesize && audioFormat.filesize > 0) {
        audioBytes = audioFormat.filesize;
        audioIsReported = true;
      } else if (audioFormat?.filesize_approx && audioFormat.filesize_approx > 0) {
        audioBytes = audioFormat.filesize_approx;
      } else if (audioFormat?.tbr && duration && duration > 0) {
        audioBytes = Math.round((audioFormat.tbr * 1000 / 8) * duration);
      } else if (duration && duration > 0) {
        // Standard AAC audio stream: ~128 kbps
        audioBytes = Math.round((128 * 1000 / 8) * duration);
      }
    }

    if (videoBytes === 0) {
      // Try resolution-based estimation heuristic if duration is known
      if (duration && duration > 0 && format?.height) {
        let estimatedBitrateKbps = 2500;
        if (format.height >= 2160) estimatedBitrateKbps = 15000;
        else if (format.height >= 1440) estimatedBitrateKbps = 8000;
        else if (format.height >= 1080) estimatedBitrateKbps = 4000;
        else if (format.height >= 720) estimatedBitrateKbps = 2000;
        else estimatedBitrateKbps = 1000;

        const totalEstBytes = Math.round(((estimatedBitrateKbps + 128) * 1000 / 8) * (effectiveDuration || duration));
        return {
          bytes: totalEstBytes,
          type: 'estimated',
          details: `Resolution-based bitrate estimate (${estimatedBitrateKbps} kbps)`,
        };
      }

      return { bytes: 0, type: 'unknown', details: 'Insufficient source metadata to estimate size' };
    }

    let combinedBytes = videoBytes + audioBytes;

    if (timeRange && duration && duration > 0 && effectiveDuration) {
      combinedBytes = Math.round((effectiveDuration / duration) * combinedBytes);
      return {
        bytes: combinedBytes,
        type: 'estimated',
        details: `Clip estimate (${Math.round(effectiveDuration)}s of ${Math.round(duration)}s)`,
      };
    }

    const type = (videoIsReported && (!format?.isVideoOnly || audioIsReported))
      ? 'reported'
      : 'estimated';

    const details = format?.isVideoOnly
      ? 'Combined video stream and paired audio stream'
      : 'Reported by media provider';

    return { bytes: combinedBytes, type, details };
  }

  /**
   * Estimates playlist total size and unknown count.
   * Never fabricates numbers for unknown items.
   */
  public static estimatePlaylistSize(
    items: Array<{ id: string; url: string; duration?: number; filesize?: number }>,
    qualityLabel?: string,
    formatId?: string,
    isAudioOnly = false
  ): PlaylistSizeEstimate {
    if (!items || items.length === 0) {
      return { totalBytes: 0, knownCount: 0, unknownCount: 0, totalCount: 0, isComplete: true };
    }

    let totalBytes = 0;
    let knownCount = 0;
    let unknownCount = 0;

    // Bitrate multiplier per second depending on quality
    let bitrateKbps = 3500; // default 1080p
    if (isAudioOnly) {
      bitrateKbps = 192;
    } else if (qualityLabel) {
      if (qualityLabel.includes('4K')) bitrateKbps = 15000;
      else if (qualityLabel.includes('1440p') || qualityLabel.includes('2K')) bitrateKbps = 8000;
      else if (qualityLabel.includes('1080p')) bitrateKbps = 4000;
      else if (qualityLabel.includes('720p')) bitrateKbps = 2000;
      else if (qualityLabel.includes('480p')) bitrateKbps = 1000;
    }

    for (const item of items) {
      if (item.filesize && item.filesize > 0) {
        totalBytes += item.filesize;
        knownCount++;
      } else if (typeof item.duration === 'number' && item.duration > 0) {
        const itemBytes = Math.round((bitrateKbps * 1000 / 8) * item.duration);
        totalBytes += itemBytes;
        knownCount++;
      } else {
        unknownCount++;
      }
    }

    return {
      totalBytes,
      knownCount,
      unknownCount,
      totalCount: items.length,
      isComplete: unknownCount === 0,
    };
  }

  /**
   * Formats byte values with clear unit distinction:
   * GiB/MiB/KiB (binary 1024) or GB/MB/KB (decimal 1000).
   */
  public static formatBytes(bytes: number, binary = true): string {
    if (isNaN(bytes) || bytes <= 0) return '0 B';

    const k = binary ? 1024 : 1000;
    const units = binary
      ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      : ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const idx = Math.min(i, units.length - 1);
    const val = bytes / Math.pow(k, idx);

    return `${val < 10 ? val.toFixed(2) : val.toFixed(1)} ${units[idx]}`;
  }
}
