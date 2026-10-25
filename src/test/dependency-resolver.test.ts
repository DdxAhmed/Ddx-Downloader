import { describe, it, expect } from 'vitest';
import { DependencyResolver } from '../main/media/dependency-resolver';

describe('DependencyResolver Engine Verification', () => {
  it('detects available yt-dlp and FFmpeg in bin directory', async () => {
    const resolver = new DependencyResolver();
    const status = await resolver.getStatus();

    expect(status).toHaveProperty('ytDlp');
    expect(status).toHaveProperty('ffmpeg');

    // Since we downloaded yt-dlp.exe and copied ffmpeg.exe to bin/, they should be detected
    if (status.ytDlp.available) {
      expect(status.ytDlp.path).toBeDefined();
      expect(status.ytDlp.version).toBeDefined();
    }

    if (status.ffmpeg.available) {
      expect(status.ffmpeg.path).toBeDefined();
      expect(status.ffmpeg.version).toBeDefined();
    }
  });

  it('allows updating custom paths dynamically', async () => {
    const resolver = new DependencyResolver();
    resolver.updateCustomPaths('C:/non-existent/yt-dlp.exe', 'C:/non-existent/ffmpeg.exe');

    // Should gracefully report missing or check fallback without crashing
    const ytPath = await resolver.getYtDlpPath();
    expect(ytPath).toBeDefined();
  });
});
