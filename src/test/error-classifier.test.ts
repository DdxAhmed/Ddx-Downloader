import { describe, it, expect } from 'vitest';
import { ErrorClassifier } from '../main/media/error-classifier';

describe('ErrorClassifier & Sanitizer', () => {
  it('sanitizes query parameters containing sensitive tokens and passwords', () => {
    const raw = 'Downloading https://example.com/stream?token=abc123secret&key=xyz456 with cookie: user_session_secret';
    const sanitized = ErrorClassifier.sanitizeDetails(raw);
    expect(sanitized).not.toContain('abc123secret');
    expect(sanitized).not.toContain('xyz456');
    expect(sanitized).not.toContain('user_session_secret');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('classifies user cancellation properly', () => {
    const err = ErrorClassifier.classify('Cancelled by user');
    expect(err.category).toBe('cancelled');
    expect(err.isTransient).toBe(false);
    expect(err.titleEn).toContain('Cancelled');
    expect(err.titleAr).toContain('إلغاء');
  });

  it('classifies missing FFmpeg with clear user explanation', () => {
    const err = ErrorClassifier.classify('WARNING: ffmpeg not found! Some formats cannot be merged.');
    expect(err.category).toBe('missing_ffmpeg');
    expect(err.isTransient).toBe(false);
    expect(err.titleEn).toContain('FFmpeg Required');
    expect(err.titleAr).toContain('FFmpeg');
  });

  it('identifies transient network reset and timeout for automatic bounded retries', () => {
    const resetErr = ErrorClassifier.classify('urllib3.exceptions.ProtocolError: Connection reset by peer (WinError 10054)');
    expect(resetErr.category).toBe('connection_interrupted');
    expect(resetErr.isTransient).toBe(true);

    const timeoutErr = ErrorClassifier.classify('HTTPSConnectionPool: Read timed out.');
    expect(timeoutErr.category).toBe('network_timeout');
    expect(timeoutErr.isTransient).toBe(true);
  });

  it('identifies rate limits (HTTP 429) as transient with exponential backoff suggestions', () => {
    const rateErr = ErrorClassifier.classify('HTTP Error 429: Too Many Requests');
    expect(rateErr.category).toBe('rate_limited');
    expect(rateErr.isTransient).toBe(true);
  });

  it('identifies private or deleted media as permanent errors', () => {
    const privateErr = ErrorClassifier.classify('ERROR: [youtube] Private video. Sign in if you\'ve been granted access to this video');
    expect(privateErr.category).toBe('private_media');
    expect(privateErr.isTransient).toBe(false);
  });

  it('identifies unsupported formats and suggests alternatives', () => {
    const formatErr = ErrorClassifier.classify('ERROR: Requested format is not available');
    expect(formatErr.category).toBe('unsupported_format');
    expect(formatErr.isTransient).toBe(false);
  });

  it('does not mistake a yt-dlp JavaScript warning for a missing executable', () => {
    const err = ErrorClassifier.classify(
      'WARNING: [youtube] No supported JavaScript runtime could be found. Some formats may be missing.\n' +
      'opus in MP4 support is experimental. Could not write header for output file #0.\nERROR: ffmpeg exited with code 1'
    );
    expect(err.category).toBe('unsupported_format');
    expect(err.category).not.toBe('missing_ytdlp');
    expect(err.explanationAr).toContain('دمج');
  });

  it('redacts complete signed media URL query strings including lsig values', () => {
    const clean = ErrorClassifier.sanitizeDetails(
      'Input https://googlevideo.com/videoplayback?expire=1&sig=secret&lsig=also-secret&ip=127.0.0.1'
    );
    expect(clean).toBe('Input https://googlevideo.com/videoplayback?[REDACTED]');
    expect(clean).not.toContain('also-secret');
  });

  it('always provides both English and Arabic translations', () => {
    const err = ErrorClassifier.classify('unknown obscure failure code 999');
    expect(err.titleEn).toBeDefined();
    expect(err.titleAr).toBeDefined();
    expect(err.explanationEn).toBeDefined();
    expect(err.explanationAr).toBeDefined();
    expect(err.suggestedActionEn).toBeDefined();
    expect(err.suggestedActionAr).toBeDefined();
  });
});
