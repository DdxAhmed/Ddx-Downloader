import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { MediaEngine } from './media-engine';
import { DownloadJob } from '../../types';

vi.mock('child_process', () => ({ spawn: vi.fn() }));
vi.mock('fs', () => ({ default: { existsSync: () => true } }));

function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((done) => { resolve = done; });
  return { promise, resolve };
}
const job = (): DownloadJob => ({
  id: 'download', sourceUrl: 'https://example.com/video', sourcePlatform: 'generic',
  mediaTitle: 'Video', selectedFormat: 'bestvideo+bestaudio/best', selectedQuality: 'best',
  targetContainer: 'mp4', outputPath: 'video.mp4', status: 'queued', progress: 0,
  downloadedBytes: 0, totalBytes: 0, downloadSpeed: '', eta: '', createdAt: new Date().toISOString(), isAudioOnly: false,
});
const makeChild = () => Object.assign(new EventEmitter(), {
  stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(), exitCode: null, signalCode: null,
});

describe('Media engine cancellation lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pairs MP4 video with AAC-compatible audio instead of Opus', async () => {
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child as any);
    const engine = new MediaEngine({ getYtDlpPath: async () => 'yt-dlp', getFfmpegPath: async () => 'ffmpeg' } as any);
    const selected = { ...job(), selectedFormat: '398', targetContainer: 'mp4' };
    await engine.startDownload(selected, vi.fn(), vi.fn(), vi.fn());
    const args = vi.mocked(spawn).mock.calls[0][1] as string[];
    const selector = args[args.indexOf('-f') + 1];
    expect(selector).toContain('398+bestaudio[ext=m4a]');
    expect(selector).not.toContain('398+bestaudio/best');
    engine.cancelDownload(selected.id);
  });

  it('waits for media processes to close and prevents new work during shutdown', async () => {
    const child = makeChild();
    child.kill.mockReturnValue(true);
    vi.mocked(spawn).mockReturnValue(child as any);
    const engine = new MediaEngine({ getYtDlpPath: async () => 'yt-dlp', getFfmpegPath: async () => 'ffmpeg' } as any);
    await engine.startDownload(job(), vi.fn(), vi.fn(), vi.fn());
    expect(engine.hasActiveWork()).toBe(true);
    let stopped = false;
    const shutdown = engine.shutdown().then(() => { stopped = true; });
    await Promise.resolve();
    expect(stopped).toBe(false);
    await expect(engine.startDownload(job(), vi.fn(), vi.fn(), vi.fn())).rejects.toThrow('preparing to exit');
    child.emit('close', 1);
    await shutdown;
    expect(engine.hasActiveWork()).toBe(false);
  });

  it('prevents pending conversion from launching after shutdown', async () => {
    const pending = deferred();
    const engine = new MediaEngine({ getFfmpegPath: () => pending.promise } as any);
    const conversion = engine.convertMedia({ inputPath: 'input.mp4', outputPath: 'output.mp4', targetFormat: 'mp4' }, vi.fn(), vi.fn(), vi.fn());
    expect(engine.hasActiveWork()).toBe(true);
    await engine.shutdown();
    pending.resolve('ffmpeg');
    await conversion;
    expect(spawn).not.toHaveBeenCalled();
  });

  it.each(['yt-dlp', 'ffmpeg'])('does not spawn after cancellation while resolving %s', async (stage) => {
    const pending = deferred();
    const resolver = {
      getYtDlpPath: () => stage === 'yt-dlp' ? pending.promise : Promise.resolve('yt-dlp'),
      getFfmpegPath: () => pending.promise,
    };
    const engine = new MediaEngine(resolver as any);
    const progress = vi.fn();
    const run = engine.startDownload(job(), progress, vi.fn(), vi.fn());
    await Promise.resolve();
    expect(engine.cancelDownload('download')).toBe(true);
    pending.resolve('tool');
    await run;
    expect(spawn).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
  });

  it('allows restarting while the cancelled startup is still resolving', async () => {
    const pending = deferred();
    const resolver = {
      getYtDlpPath: vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue('yt-dlp'),
      getFfmpegPath: vi.fn().mockResolvedValue('ffmpeg'),
    };
    const child = makeChild();
    vi.mocked(spawn).mockReturnValue(child as any);
    const engine = new MediaEngine(resolver as any);
    const first = engine.startDownload(job(), vi.fn(), vi.fn(), vi.fn());
    engine.cancelDownload('download');
    await engine.startDownload(job(), vi.fn(), vi.fn(), vi.fn());
    pending.resolve('yt-dlp');
    await first;
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(engine.cancelDownload('download')).toBe(true);
    expect(child.kill).toHaveBeenCalled();
  });

  it('keeps the replacement cancellable when the old process closes', async () => {
    const oldChild = makeChild();
    const newChild = makeChild();
    vi.mocked(spawn).mockReturnValueOnce(oldChild as any).mockReturnValueOnce(newChild as any);
    const engine = new MediaEngine({ getYtDlpPath: async () => 'yt-dlp', getFfmpegPath: async () => 'ffmpeg' } as any);
    const failed = vi.fn();
    await engine.startDownload(job(), vi.fn(), vi.fn(), failed);
    engine.cancelDownload('download');
    await engine.startDownload(job(), vi.fn(), vi.fn(), failed);
    oldChild.emit('close', 1);
    expect(failed).not.toHaveBeenCalled();
    expect(engine.cancelDownload('download')).toBe(true);
    expect(newChild.kill).toHaveBeenCalled();
  });
});
