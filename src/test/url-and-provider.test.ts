import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../main/media/providers/provider-registry';
import { YouTubeProvider } from '../main/media/providers/youtube-provider';
import { InstagramProvider, VimeoProvider, TikTokProvider } from '../main/media/providers/other-providers';

describe('URL Validation & Provider Detection', () => {
  const registry = new ProviderRegistry();

  it('accepts valid https and http URLs', () => {
    const result1 = registry.validateUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result1.valid).toBe(true);
    expect(result1.cleanUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    const result2 = registry.validateUrl('http://example.com/video.mp4');
    expect(result2.valid).toBe(true);
  });

  it('rejects empty or non-string inputs', () => {
    expect(registry.validateUrl('').valid).toBe(false);
    expect(registry.validateUrl('   ').valid).toBe(false);
    expect(registry.validateUrl(null as any).valid).toBe(false);
  });

  it('rejects dangerous protocols (file://, javascript:, data:)', () => {
    expect(registry.validateUrl('file:///C:/Windows/System32').valid).toBe(false);
    expect(registry.validateUrl('javascript:alert(1)').valid).toBe(false);
    expect(registry.validateUrl('data:text/html,<h1>Hello</h1>').valid).toBe(false);
  });

  it('rejects local/private network addresses (SSRF prevention)', () => {
    expect(registry.validateUrl('http://localhost:8080/video').valid).toBe(false);
    expect(registry.validateUrl('http://127.0.0.1:3000').valid).toBe(false);
    expect(registry.validateUrl('http://192.168.1.1/stream').valid).toBe(false);
    expect(registry.validateUrl('http://10.0.0.1/video').valid).toBe(false);
  });

  it('identifies YouTube video and playlist URLs correctly', () => {
    const yt = new YouTubeProvider();
    expect(yt.canHandle('https://www.youtube.com/watch?v=test12345')).toBe(true);
    expect(yt.canHandle('https://youtu.be/test12345')).toBe(true);
    expect(yt.canHandle('https://vimeo.com/12345')).toBe(false);

    // Playlist detection
    expect(yt.isPlaylist('https://www.youtube.com/playlist?list=PL12345678')).toBe(true);
    expect(yt.isPlaylist('https://www.youtube.com/watch?v=abc12345')).toBe(false);

    // Strips tracking params while retaining video ID
    const cleaned = yt.cleanUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share&si=123');
    expect(cleaned).toContain('v=dQw4w9WgXcQ');
    expect(cleaned).not.toContain('feature=share');
  });

  it('identifies Instagram, Vimeo, and TikTok URLs', () => {
    const insta = new InstagramProvider();
    expect(insta.canHandle('https://www.instagram.com/reel/C1234567/')).toBe(true);
    expect(insta.canHandle('https://youtube.com')).toBe(false);

    const vimeo = new VimeoProvider();
    expect(vimeo.canHandle('https://vimeo.com/76979871')).toBe(true);

    const tiktok = new TikTokProvider();
    expect(tiktok.canHandle('https://www.tiktok.com/@user/video/12345')).toBe(true);
  });

  it('falls back to generic web provider for other valid sites', () => {
    const provider = registry.getProvider('https://example.com/lecture.mp4');
    expect(provider.id).toBe('generic');
    expect(provider.name).toBe('Web Media');
  });
});
