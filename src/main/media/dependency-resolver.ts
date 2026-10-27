import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { DependencyStatus } from '../../types';

export class DependencyResolver {
  private customYtDlpPath?: string;
  private customFfmpegPath?: string;
  private cachedStatus?: DependencyStatus;

  constructor(customYtDlpPath?: string, customFfmpegPath?: string) {
    this.customYtDlpPath = customYtDlpPath;
    this.customFfmpegPath = customFfmpegPath;
  }

  public updateCustomPaths(ytDlpPath?: string, ffmpegPath?: string): void {
    this.customYtDlpPath = ytDlpPath;
    this.customFfmpegPath = ffmpegPath;
    this.cachedStatus = undefined;
  }

  public async getStatus(forceRefresh = false): Promise<DependencyStatus> {
    if (this.cachedStatus && !forceRefresh) {
      return this.cachedStatus;
    }

    const [ytDlp, ffmpeg] = await Promise.all([
      this.checkYtDlp(),
      this.checkFfmpeg(),
    ]);

    this.cachedStatus = { ytDlp, ffmpeg };
    return this.cachedStatus;
  }

  public async getYtDlpPath(): Promise<string | null> {
    const status = await this.getStatus();
    return status.ytDlp.available && status.ytDlp.path ? status.ytDlp.path : null;
  }

  public async getFfmpegPath(): Promise<string | null> {
    const status = await this.getStatus();
    return status.ffmpeg.available && status.ffmpeg.path ? status.ffmpeg.path : null;
  }

  private async checkYtDlp() {
    const potentialPaths: string[] = [];

    if (this.customYtDlpPath) {
      potentialPaths.push(this.customYtDlpPath);
    }

    // Check project bin directory or resources/bin
    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

    potentialPaths.push(
      path.resolve('bin', binaryName),
      path.join(process.resourcesPath || '', 'bin', binaryName),
      binaryName // fallback to system PATH
    );

    for (const testPath of potentialPaths) {
      if (testPath !== binaryName && !fs.existsSync(testPath)) {
        continue;
      }

      try {
        const version = await this.executeVersionCommand(testPath, ['--version']);
        if (version) {
          return {
            available: true,
            version: version.trim(),
            path: testPath === binaryName ? binaryName : path.resolve(testPath),
          };
        }
      } catch (err: any) {
        // Continue to next path candidate
      }
    }

    return {
      available: false,
      error: 'yt-dlp executable was not found. Please install yt-dlp or configure its path in Settings.',
    };
  }

  private async checkFfmpeg() {
    const potentialPaths: string[] = [];

    if (this.customFfmpegPath) {
      potentialPaths.push(this.customFfmpegPath);
    }

    const isWindows = process.platform === 'win32';
    const binaryName = isWindows ? 'ffmpeg.exe' : 'ffmpeg';

    // Check local bin
    potentialPaths.push(
      path.resolve('bin', binaryName),
      path.join(process.resourcesPath || '', 'bin', binaryName),
    );

    // Check @ffmpeg-installer if present
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
        potentialPaths.push(ffmpegInstaller.path);
      }
    } catch {
      // ignore
    }

    // System PATH fallback
    potentialPaths.push(binaryName);

    for (const testPath of potentialPaths) {
      if (testPath !== binaryName && !fs.existsSync(testPath)) {
        continue;
      }

      try {
        const versionOut = await this.executeVersionCommand(testPath, ['-version']);
        if (versionOut) {
          const firstLine = versionOut.split('\n')[0].replace('ffmpeg version', '').trim();
          return {
            available: true,
            version: firstLine,
            path: testPath === binaryName ? binaryName : path.resolve(testPath),
          };
        }
      } catch (err: any) {
        // Continue to next candidate
      }
    }

    return {
      available: false,
      error: 'FFmpeg executable was not found. Some format conversions or audio merges may fail.',
    };
  }

  private executeVersionCommand(executable: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(executable, args, {
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
        } else if (code === 0 && stderr.trim()) {
          resolve(stderr.trim());
        } else {
          reject(new Error(`Exit code ${code}: ${stderr || stdout}`));
        }
      });

      // 5 second timeout
      setTimeout(() => {
        try {
          child.kill();
        } catch {}
        reject(new Error('Timeout checking version'));
      }, 5000);
    });
  }
}
