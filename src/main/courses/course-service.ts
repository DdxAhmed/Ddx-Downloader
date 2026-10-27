import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../database';
import { MediaEngine } from '../media/media-engine';
import { DownloadQueue } from '../queue/download-queue';
import { buildOutputPath, sanitizeFilename } from '../media/filename-sanitizer';
import {
  SavedCourse,
  CourseItem,
  CourseWithItems,
  CourseSyncResult,
  DownloadJob,
  MediaInfo,
} from '../../types';

export class CourseService {
  private db: DatabaseService;
  private mediaEngine: MediaEngine;
  private queue: DownloadQueue;

  constructor(db: DatabaseService, mediaEngine: MediaEngine, queue: DownloadQueue) {
    this.db = db;
    this.mediaEngine = mediaEngine;
    this.queue = queue;
  }

  /**
   * Saves a newly analyzed course/playlist and its items into the persistent database
   */
  public async saveCourse(data: {
    sourceUrl: string;
    platform: string;
    providerPlaylistId?: string;
    title: string;
    thumbnailUrl?: string;
    destinationFolder: string;
    preferredQuality: string;
    preferredContainer: string;
    isAudioOnly: boolean;
    selectedSubtitles?: string[];
    items: Array<{
      sourceMediaId: string;
      title: string;
      url: string;
      index: number;
      duration?: number;
      thumbnailUrl?: string;
    }>;
  }): Promise<{ success: boolean; courseId?: string; error?: string }> {
    try {
      const courseId = `course-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();

      const course: SavedCourse = {
        id: courseId,
        sourceUrl: data.sourceUrl,
        platform: data.platform || 'youtube',
        providerPlaylistId: data.providerPlaylistId,
        title: data.title,
        thumbnailUrl: data.thumbnailUrl,
        destinationFolder: data.destinationFolder,
        preferredQuality: data.preferredQuality || 'best',
        preferredContainer: data.preferredContainer || 'mp4',
        isAudioOnly: !!data.isAudioOnly,
        selectedSubtitles: data.selectedSubtitles,
        itemCount: data.items.length,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      const courseItems: CourseItem[] = data.items.map((item, idx) => ({
        id: `citem-${courseId}-${item.sourceMediaId || idx + 1}`,
        courseId,
        sourceMediaId: item.sourceMediaId || `item-${idx + 1}`,
        title: item.title,
        url: item.url,
        index: item.index || idx + 1,
        duration: item.duration,
        thumbnailUrl: item.thumbnailUrl,
        status: 'new',
        updatedAt: now,
      }));

      this.db.saveCourse(course, courseItems);
      return { success: true, courseId };
    } catch (err: any) {
      console.error('[CourseService] Failed to save course:', err);
      return { success: false, error: err.message || 'Failed to save course' };
    }
  }

  /**
   * Retrieves all saved courses with live synchronization of local file states and download jobs
   */
  public getCoursesWithItems(): CourseWithItems[] {
    const courses = this.db.getAllCourses();
    const activeJobs = this.queue.getQueue();

    return courses.map((course) => {
      const items = this.db.getCourseItems(course.id);

      let downloaded = 0;
      let downloading = 0;
      let missingLocal = 0;
      let failed = 0;
      let newItems = 0;

      for (const item of items) {
        // Reconcile status dynamically with disk and queue
        const activeJob = activeJobs.find(
          (j) => j.id === item.jobId || (j.courseItemId === item.id)
        );

        if (activeJob) {
          if (
            activeJob.status === 'downloading' ||
            activeJob.status === 'processing' ||
            activeJob.status === 'merging' ||
            activeJob.status === 'queued'
          ) {
            item.status = activeJob.status === 'queued' ? 'queued' : 'downloading';
            item.jobId = activeJob.id;
          } else if (activeJob.status === 'failed') {
            item.status = 'failed';
          } else if (activeJob.status === 'completed') {
            if (activeJob.outputPath && fs.existsSync(activeJob.outputPath)) {
              item.status = 'downloaded';
              item.localFilePath = activeJob.outputPath;
            } else {
              item.status = 'missing_local';
            }
          }
        } else if (item.localFilePath) {
          if (fs.existsSync(item.localFilePath)) {
            item.status = 'downloaded';
          } else if (item.status === 'downloaded') {
            item.status = 'missing_local';
          }
        }

        switch (item.status) {
          case 'downloaded':
            downloaded++;
            break;
          case 'downloading':
          case 'queued':
            downloading++;
            break;
          case 'missing_local':
            missingLocal++;
            break;
          case 'failed':
            failed++;
            break;
          case 'new':
            newItems++;
            break;
        }
      }

      const total = items.length;
      const progressPercent = total > 0 ? Math.round((downloaded / total) * 100) : 0;

      return {
        ...course,
        items,
        stats: {
          total,
          downloaded,
          downloading,
          missingLocal,
          failed,
          newItems,
          progressPercent,
        },
      };
    });
  }

  public getCourseWithItems(courseId: string): CourseWithItems | null {
    const all = this.getCoursesWithItems();
    return all.find((c) => c.id === courseId) || null;
  }

  /**
   * Synchronizes course with remote source playlist.
   * Matches items primarily by provider + stable source media ID.
   * Detects newly added lessons, preserves removed lessons without deleting files,
   * and preserves existing local file associations when playlist order changes.
   */
  public async syncCourse(courseId: string): Promise<{ success: boolean; result?: CourseSyncResult; error?: string }> {
    const course = this.db.getCourse(courseId);
    if (!course) {
      return { success: false, error: 'Course not found in database' };
    }

    try {
      const analyzed = await this.mediaEngine.analyzeUrl(course.sourceUrl);
      const remoteItems = analyzed.playlistItems || [];
      const existingItems = this.db.getCourseItems(courseId);

      const existingBySourceId = new Map<string, CourseItem>();
      for (const item of existingItems) {
        existingBySourceId.set(item.sourceMediaId, item);
      }

      const now = new Date().toISOString();
      const updatedItems: CourseItem[] = [];

      let addedCount = 0;
      let missingLocalCount = 0;
      let unchangedCount = 0;

      const seenSourceIds = new Set<string>();

      // 1. Process remote items
      for (const remote of remoteItems) {
        seenSourceIds.add(remote.id);
        const existing = existingBySourceId.get(remote.id);

        if (existing) {
          // Lesson already exists: update order/title if changed, preserve local file association!
          let status = existing.status;
          if (existing.localFilePath) {
            if (!fs.existsSync(existing.localFilePath)) {
              status = 'missing_local';
              missingLocalCount++;
            } else {
              status = 'downloaded';
            }
          }

          const updated: CourseItem = {
            ...existing,
            title: remote.title || existing.title,
            index: remote.index, // order preserved from remote
            duration: remote.duration || existing.duration,
            thumbnailUrl: remote.thumbnail || existing.thumbnailUrl,
            status,
            updatedAt: now,
          };
          updatedItems.push(updated);
          unchangedCount++;
        } else {
          // Newly added lesson in source playlist!
          addedCount++;
          updatedItems.push({
            id: `citem-${courseId}-${remote.id}`,
            courseId,
            sourceMediaId: remote.id,
            title: remote.title,
            url: remote.url,
            index: remote.index,
            duration: remote.duration,
            thumbnailUrl: remote.thumbnail,
            status: 'new',
            updatedAt: now,
          });
        }
      }

      // 2. Identify lessons removed from source playlist
      // Preserve local files and mark as removed_from_source without deleting!
      let removedCount = 0;
      for (const existing of existingItems) {
        if (!seenSourceIds.has(existing.sourceMediaId)) {
          removedCount++;
          updatedItems.push({
            ...existing,
            status: 'removed_from_source',
            updatedAt: now,
          });
        }
      }

      // Save updated items and course metadata
      this.db.saveCourseItems(updatedItems);
      this.db.updateCourse(courseId, {
        itemCount: remoteItems.length,
        lastSyncedAt: now,
        title: analyzed.title || course.title,
        thumbnailUrl: analyzed.thumbnail || course.thumbnailUrl,
      });

      const syncResult: CourseSyncResult = {
        courseId,
        addedCount,
        missingLocalCount,
        removedCount,
        unchangedCount,
        totalCount: updatedItems.length,
        items: updatedItems,
      };

      return { success: true, result: syncResult };
    } catch (err: any) {
      console.error(`[CourseService] Error syncing course ${courseId}:`, err);
      return { success: false, error: err.message || 'Failed to synchronize course' };
    }
  }

  /**
   * Queues downloads for specific items in a course (e.g. new, missing, or retried lessons).
   * Prevents queuing duplicate jobs that are already active in the queue.
   */
  public async downloadCourseItems(
    courseId: string,
    itemIds: string[],
    options?: {
      qualityLabel?: string;
      formatId?: string;
      isAudioOnly?: boolean;
      container?: string;
      speedLimit?: string;
    }
  ): Promise<{ success: boolean; jobIds?: string[]; error?: string }> {
    const course = this.db.getCourse(courseId);
    if (!course) {
      return { success: false, error: 'Course not found' };
    }

    const items = this.db.getCourseItems(courseId).filter((i) => itemIds.includes(i.id));
    if (items.length === 0) {
      return { success: false, error: 'No valid course items selected' };
    }

    const activeJobs = this.queue.getQueue();
    const activeUrlSet = new Set(
      activeJobs
        .filter((j) => j.status === 'queued' || j.status === 'downloading' || j.status === 'processing')
        .map((j) => j.sourceUrl.trim().toLowerCase())
    );

    const isAudioOnly = options?.isAudioOnly ?? course.isAudioOnly;
    const ext = options?.container || (isAudioOnly ? 'mp3' : course.preferredContainer || 'mp4');
    const qualityLabel = options?.qualityLabel || course.preferredQuality || 'best';
    const formatId = options?.formatId || (isAudioOnly ? 'bestaudio/best' : 'bestvideo+bestaudio/best');
    const speedLimit = options?.speedLimit;

    const queuedJobs: DownloadJob[] = [];
    const jobIds: string[] = [];

    for (const item of items) {
      // Prevent duplicate if already active in queue
      if (activeUrlSet.has(item.url.trim().toLowerCase())) {
        continue;
      }

      const safeCourseDir = sanitizeFilename(course.title);
      const targetDir = path.join(course.destinationFolder, safeCourseDir);
      const outputPath = buildOutputPath(course.destinationFolder, item.title, ext, {
        isPlaylist: true,
        playlistTitle: course.title,
        playlistIndex: item.index,
      });

      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      jobIds.push(jobId);

      const job: DownloadJob = {
        id: jobId,
        sourceUrl: item.url,
        sourcePlatform: course.platform,
        mediaTitle: item.title,
        thumbnailUrl: item.thumbnailUrl,
        mediaDuration: item.duration,
        selectedFormat: formatId,
        selectedQuality: qualityLabel,
        isAudioOnly,
        targetContainer: ext,
        outputPath,
        status: 'queued',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        downloadSpeed: '',
        eta: '',
        speedLimit,
        retryCount: 0,
        createdAt: new Date().toISOString(),
        isPlaylist: true,
        playlistTitle: course.title,
        playlistIndex: item.index,
        courseId: course.id,
        courseItemId: item.id,
      };

      queuedJobs.push(job);

      // Link job ID with course item
      item.jobId = jobId;
      item.status = 'queued';
      item.updatedAt = new Date().toISOString();
      this.db.saveCourseItem(item);
    }

    if (queuedJobs.length > 0) {
      this.queue.addBatch(queuedJobs);
    }

    return { success: true, jobIds };
  }

  public deleteCourse(courseId: string, deleteFiles = false): { success: boolean; error?: string } {
    try {
      const course = this.db.getCourse(courseId);
      if (!course) return { success: false, error: 'Course not found' };

      if (deleteFiles) {
        const items = this.db.getCourseItems(courseId);
        for (const item of items) {
          if (item.localFilePath && fs.existsSync(item.localFilePath)) {
            try {
              fs.unlinkSync(item.localFilePath);
            } catch {}
          }
        }
      }

      this.db.deleteCourse(courseId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
