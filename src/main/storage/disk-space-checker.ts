import fs from 'fs';
import path from 'path';
import { DiskSpaceInfo, DiskSpaceCheckResult, DownloadJob } from '../../types';

export class DiskSpaceChecker {
  /**
   * Finds the closest existing ancestor directory for a target path.
   * Handles paths where the destination directory or subfolders have not been created yet.
   */
  public static getExistingAncestor(targetPath: string): string {
    let current = path.resolve(targetPath);

    // If it's a file path with an extension, start from its directory
    if (path.extname(current)) {
      current = path.dirname(current);
    }

    while (!fs.existsSync(current)) {
      const parent = path.dirname(current);
      if (parent === current) {
        // Reached filesystem root
        break;
      }
      current = parent;
    }

    return fs.existsSync(current) ? current : process.cwd();
  }

  /**
   * Retrieves real available disk space on the target filesystem.
   * Replaces any fake fallback with real statfsSync or an explicit unavailable state.
   */
  public static getFreeDiskSpace(targetPath: string): DiskSpaceInfo {
    try {
      const ancestor = this.getExistingAncestor(targetPath);

      if (typeof (fs as any).statfsSync === 'function') {
        const stat = (fs as any).statfsSync(ancestor);
        const bsize = stat.bsize || stat.frsize || 4096;
        const bavail = stat.bavail !== undefined ? stat.bavail : stat.bfree;
        const blocks = stat.blocks || 0;

        return {
          available: true,
          freeBytes: bavail * bsize,
          totalBytes: blocks * bsize,
          path: ancestor,
        };
      }
    } catch (err: any) {
      console.warn(`[DiskSpaceChecker] statfsSync failed for path ${targetPath}:`, err);
      return {
        available: false,
        error: err.message || 'Disk space check unavailable on this filesystem',
        path: targetPath,
      };
    }

    return {
      available: false,
      error: 'statfsSync is not supported by the current Node environment',
      path: targetPath,
    };
  }

  /**
   * Checks disk space accounting for:
   * 1. Real destination filesystem free space.
   * 2. Peak temporary disk usage (temporary audio/video streams + FFmpeg merge overhead).
   * 3. Pending/active queued downloads on the same filesystem without double counting.
   */
  public static evaluateSpaceWithEstimates(
    dirPath: string,
    estimatedFinalBytes: number,
    isSeparateStreams = false,
    activeJobs: DownloadJob[] = []
  ): DiskSpaceCheckResult {
    const diskSpace = this.getFreeDiskSpace(dirPath);

    // Peak multiplier: Separate video+audio streams require downloading both streams
    // plus the merged output file during the post-processing step (~2.1x final size)
    const peakMultiplier = isSeparateStreams ? 2.1 : 1.15;
    const estimatedPeakBytes = Math.round(estimatedFinalBytes * peakMultiplier);

    // Calculate pending bytes in queue targeting the same root drive/filesystem
    const targetAncestor = this.getExistingAncestor(dirPath);
    const targetRoot = path.parse(targetAncestor).root.toLowerCase();

    let pendingQueueBytes = 0;
    for (const job of activeJobs) {
      if (
        job.status === 'queued' ||
        job.status === 'downloading' ||
        job.status === 'processing' ||
        job.status === 'merging'
      ) {
        const jobRoot = path.parse(this.getExistingAncestor(job.outputPath)).root.toLowerCase();
        if (jobRoot === targetRoot) {
          const remaining = job.totalBytes > 0
            ? Math.max(0, job.totalBytes - (job.downloadedBytes || 0))
            : (job.estimatedSizeBytes || 0);
          pendingQueueBytes += remaining;
        }
      }
    }

    if (!diskSpace.available || diskSpace.freeBytes === undefined) {
      return {
        diskSpace,
        estimatedRequiredBytes: estimatedFinalBytes,
        estimatedPeakBytes,
        pendingQueueBytes,
        projectedRemainingBytes: 0,
        isLowSpace: false,
        isInsufficient: false,
      };
    }

    const projectedRemainingBytes = diskSpace.freeBytes - pendingQueueBytes - estimatedPeakBytes;
    const isInsufficient = diskSpace.freeBytes < estimatedPeakBytes;
    const isLowSpace = projectedRemainingBytes < 1024 * 1024 * 1024; // Less than 1 GiB projected remaining

    return {
      diskSpace,
      estimatedRequiredBytes: estimatedFinalBytes,
      estimatedPeakBytes,
      pendingQueueBytes,
      projectedRemainingBytes,
      isLowSpace,
      isInsufficient,
    };
  }
}
