import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { drizzle, SQLJsDatabase } from 'drizzle-orm/sql-js';
import { eq, desc } from 'drizzle-orm';
import {
  jobsTable,
  historyTable,
  settingsTable,
  collectionsTable,
  coursesTable,
  courseItemsTable,
  subtitleFilesTable,
  subtitleCuesTable,
} from './schema';
import {
  DownloadJob,
  DownloadHistoryEntry,
  AppSettings,
  JobStatus,
  SavedCourse,
  CourseItem,
  SubtitleCue,
  TimeRange,
  SizeEstimationType,
} from '../../types';

export interface SubtitleFileRow {
  id: string;
  filePath: string;
  mediaTitle: string;
  mediaId?: string;
  language: string;
  format: 'srt' | 'vtt';
  mtimeMs: number;
  fileSize: number;
  cueCount: number;
  associatedMediaFile?: string;
  indexedAt: string;
}

export class DatabaseService {
  private dbPath: string;
  private sqlDb!: SqlJsDatabase;
  private db!: SQLJsDatabase;
  private isInitialized = false;
  private pendingPersistTimer: NodeJS.Timeout | null = null;
  private ftsAvailable = false;

  constructor(userDataPath: string) {
    const dir = path.join(userDataPath, 'DdxDownloader');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.dbPath = path.join(dir, 'database.sqlite');
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Resolve wasm file
    const locateFile = (file: string) => {
      const localWasm = path.join(__dirname, file);
      if (fs.existsSync(localWasm)) return localWasm;

      const nodeModulesWasm = path.resolve('node_modules/sql.js/dist', file);
      if (fs.existsSync(nodeModulesWasm)) return nodeModulesWasm;

      return file;
    };

    const SQL = await initSqlJs({ locateFile });

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.sqlDb = new SQL.Database(fileBuffer);
    } else {
      this.sqlDb = new SQL.Database();
    }

    this.db = drizzle(this.sqlDb);
    this.runMigrations();
    this.writeDatabaseToDisk();
    this.reconcileStartupJobs();

    this.isInitialized = true;
  }

  public getSqlDb(): SqlJsDatabase {
    return this.sqlDb;
  }

  public isFtsAvailable(): boolean {
    return this.ftsAvailable;
  }

  private runMigrations(): void {
    // 1. Version table tracking
    this.sqlDb.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedVersions = new Set<number>();
    try {
      const res = this.sqlDb.exec(`SELECT version FROM schema_version`);
      if (res.length > 0 && res[0].values) {
        for (const row of res[0].values) {
          appliedVersions.add(Number(row[0]));
        }
      }
    } catch {}

    const applyMigration = (version: number, name: string, fn: () => void) => {
      if (!appliedVersions.has(version)) {
        try {
          fn();
          this.sqlDb.run(
            `INSERT INTO schema_version (version, applied_at) VALUES (?, ?)`,
            [version, new Date().toISOString()]
          );
          appliedVersions.add(version);
        } catch (err) {
          console.error(`[DatabaseService] Migration v${version} (${name}) failed:`, err);
        }
      }
    };

    // Migration 1: Base tables
    applyMigration(1, 'base_schema', () => {
      this.sqlDb.run(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          source_url TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          media_title TEXT NOT NULL,
          thumbnail_url TEXT,
          media_duration INTEGER,
          selected_format TEXT NOT NULL,
          selected_quality TEXT NOT NULL,
          target_container TEXT NOT NULL DEFAULT 'mp4',
          output_path TEXT NOT NULL,
          status TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0,
          downloaded_bytes INTEGER NOT NULL DEFAULT 0,
          total_bytes INTEGER NOT NULL DEFAULT 0,
          download_speed TEXT,
          eta TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          started_at TEXT,
          completed_at TEXT,
          is_audio_only INTEGER NOT NULL DEFAULT 0,
          is_playlist INTEGER NOT NULL DEFAULT 0,
          playlist_title TEXT,
          playlist_index INTEGER,
          retry_count INTEGER NOT NULL DEFAULT 0,
          speed_limit TEXT,
          error_category TEXT,
          error_details_json TEXT
        );

        CREATE TABLE IF NOT EXISTS history (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          media_title TEXT NOT NULL,
          source_url TEXT NOT NULL,
          source_platform TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL DEFAULT 0,
          format TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 0,
          thumbnail_url TEXT,
          completed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          playlist_url TEXT NOT NULL,
          playlist_title TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    });

    // Migration 2: Existing retry and error columns
    applyMigration(2, 'jobs_error_retry', () => {
      const alters = [
        'ALTER TABLE jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;',
        'ALTER TABLE jobs ADD COLUMN speed_limit TEXT;',
        'ALTER TABLE jobs ADD COLUMN error_category TEXT;',
        'ALTER TABLE jobs ADD COLUMN error_details_json TEXT;',
      ];
      for (const sql of alters) {
        try {
          this.sqlDb.run(sql);
        } catch {}
      }
    });

    // Migration 3: Time range clipping, size estimates, and course links
    applyMigration(3, 'jobs_clipping_and_estimates', () => {
      const alters = [
        'ALTER TABLE jobs ADD COLUMN clip_start REAL;',
        'ALTER TABLE jobs ADD COLUMN clip_end REAL;',
        'ALTER TABLE jobs ADD COLUMN clip_label TEXT;',
        'ALTER TABLE jobs ADD COLUMN estimated_size_bytes INTEGER;',
        'ALTER TABLE jobs ADD COLUMN size_estimation_type TEXT;',
        'ALTER TABLE jobs ADD COLUMN course_id TEXT;',
        'ALTER TABLE jobs ADD COLUMN course_item_id TEXT;',
        'ALTER TABLE jobs ADD COLUMN selected_subtitles_json TEXT;',
        'ALTER TABLE jobs ADD COLUMN embed_subtitles INTEGER NOT NULL DEFAULT 0;',
        'ALTER TABLE history ADD COLUMN clip_start REAL;',
        'ALTER TABLE history ADD COLUMN clip_end REAL;',
        'ALTER TABLE history ADD COLUMN clip_label TEXT;',
      ];
      for (const sql of alters) {
        try {
          this.sqlDb.run(sql);
        } catch {}
      }
    });

    // Migration 4: Courses & Course Items
    applyMigration(4, 'courses_and_course_items', () => {
      this.sqlDb.run(`
        CREATE TABLE IF NOT EXISTS courses (
          id TEXT PRIMARY KEY,
          source_url TEXT NOT NULL,
          platform TEXT NOT NULL,
          provider_playlist_id TEXT,
          title TEXT NOT NULL,
          thumbnail_url TEXT,
          destination_folder TEXT NOT NULL,
          preferred_quality TEXT NOT NULL,
          preferred_container TEXT NOT NULL,
          is_audio_only INTEGER NOT NULL DEFAULT 0,
          subtitles_json TEXT,
          item_count INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS course_items (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          source_media_id TEXT NOT NULL,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          index_order INTEGER NOT NULL,
          duration INTEGER,
          thumbnail_url TEXT,
          job_id TEXT,
          local_file_path TEXT,
          status TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    });

    // Migration 5: Subtitle files, cues, and search
    applyMigration(5, 'subtitle_indexing', () => {
      this.sqlDb.run(`
        CREATE TABLE IF NOT EXISTS subtitle_files (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL UNIQUE,
          media_title TEXT NOT NULL,
          media_id TEXT,
          language TEXT NOT NULL,
          format TEXT NOT NULL,
          mtime_ms REAL NOT NULL,
          file_size INTEGER NOT NULL,
          cue_count INTEGER NOT NULL DEFAULT 0,
          associated_media_file TEXT,
          indexed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subtitle_cues (
          id TEXT PRIMARY KEY,
          file_id TEXT NOT NULL,
          cue_index INTEGER NOT NULL,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          text TEXT NOT NULL,
          normalized_text TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cues_file_id ON subtitle_cues(file_id);
        CREATE INDEX IF NOT EXISTS idx_cues_normalized ON subtitle_cues(normalized_text);
      `);

      // Try enabling FTS4 if supported by the SQLite wasm build
      try {
        this.sqlDb.run(`
          CREATE VIRTUAL TABLE IF NOT EXISTS cues_fts USING fts4(
            cue_id TEXT,
            text TEXT,
            normalized_text TEXT
          );
        `);
        this.ftsAvailable = true;
      } catch (err) {
        this.ftsAvailable = false;
      }
    });

    applyMigration(6, 'clip_cut_mode', () => {
      try {
        this.sqlDb.run('ALTER TABLE jobs ADD COLUMN cut_mode TEXT;');
      } catch {}
    });

    // Check if FTS was already enabled
    try {
      this.sqlDb.run(`SELECT count(*) FROM cues_fts LIMIT 1;`);
      this.ftsAvailable = true;
    } catch {
      this.ftsAvailable = false;
    }
  }

  /**
   * Persists database state to disk.
   * If forceImmediate is false, coalesces writes to at most once per 1200ms.
   */
  public persist(forceImmediate = true): void {
    if (forceImmediate) {
      if (this.pendingPersistTimer) {
        clearTimeout(this.pendingPersistTimer);
        this.pendingPersistTimer = null;
      }
      this.writeDatabaseToDisk();
    } else {
      if (!this.pendingPersistTimer) {
        this.pendingPersistTimer = setTimeout(() => {
          this.pendingPersistTimer = null;
          this.writeDatabaseToDisk();
        }, 1200);
      }
    }
  }

  public flushPendingPersist(): void {
    if (this.pendingPersistTimer) {
      clearTimeout(this.pendingPersistTimer);
      this.pendingPersistTimer = null;
      this.writeDatabaseToDisk();
    }
  }

  public flushForShutdown(): void {
    if (this.pendingPersistTimer) clearTimeout(this.pendingPersistTimer);
    this.pendingPersistTimer = null;
    this.writeDatabaseToDisk(true);
  }

  private writeDatabaseToDisk(throwOnError = false): void {
    try {
      const data = this.sqlDb.export();
      const buffer = Buffer.from(data);
      const temporaryPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(temporaryPath, buffer);
      try {
        fs.renameSync(temporaryPath, this.dbPath);
      } catch (renameError: any) {
        // Windows may reject replacing a destination with rename. The export
        // was already written completely, so use a bounded fallback.
        if (renameError?.code !== 'EPERM' && renameError?.code !== 'EEXIST') throw renameError;
        fs.copyFileSync(temporaryPath, this.dbPath);
        fs.unlinkSync(temporaryPath);
      }
    } catch (err) {
      console.error('[DatabaseService] Failed to persist database:', err);
      if (throwOnError) throw err;
    }
  }

  public reconcileStartupJobs(): void {
    try {
      const shutdownError = JSON.stringify({
        category: 'cancelled',
        titleEn: 'Interrupted by Application Shutdown',
        titleAr: 'تمت المقاطعة بسبب إغلاق البرنامج',
        explanationEn: 'The download was in progress when the application was closed. You can resume or retry it.',
        explanationAr: 'كان التنزيل قيد التقدم عند إغلاق التطبيق. يمكنك استئنافه أو إعادة المحاولة.',
        suggestedActionEn: 'Click Retry or Resume to continue downloading.',
        suggestedActionAr: 'انقر على إعادة المحاولة أو استئناف لمتابعة التنزيل.',
        isTransient: true,
      });

      this.sqlDb.run(`
        UPDATE jobs
        SET status = 'failed',
            error_message = 'Interrupted by application shutdown',
            error_category = 'cancelled',
            error_details_json = '${shutdownError.replace(/'/g, "''")}'
        WHERE status IN ('downloading', 'processing', 'merging', 'analyzing', 'preparing', 'retrying')
      `);
      this.writeDatabaseToDisk();
    } catch (err) {
      console.error('[DatabaseService] Error reconciling startup jobs:', err);
    }
  }

  // --- Jobs ---

  public saveJob(job: DownloadJob): void {
    const existing = this.getJob(job.id);
    const errorDetailsJson = job.errorDetails ? JSON.stringify(job.errorDetails) : null;
    const errorCategory = job.errorDetails?.category || null;
    const selectedSubtitlesJson = job.selectedSubtitles ? JSON.stringify(job.selectedSubtitles) : null;

    const clipStart = job.timeRange ? job.timeRange.start : null;
    const clipEnd = job.timeRange ? job.timeRange.end : null;
    const clipLabel = job.timeRange?.label || null;

    if (existing) {
      this.db.update(jobsTable).set({
        sourceUrl: job.sourceUrl,
        sourcePlatform: job.sourcePlatform,
        mediaTitle: job.mediaTitle,
        thumbnailUrl: job.thumbnailUrl || null,
        mediaDuration: job.mediaDuration || null,
        selectedFormat: job.selectedFormat,
        selectedQuality: job.selectedQuality,
        targetContainer: job.targetContainer || 'mp4',
        outputPath: job.outputPath,
        status: job.status,
        progress: job.progress,
        downloadedBytes: job.downloadedBytes,
        totalBytes: job.totalBytes,
        downloadSpeed: job.downloadSpeed || null,
        eta: job.eta || null,
        errorMessage: job.errorMessage || null,
        startedAt: job.startedAt || null,
        completedAt: job.completedAt || null,
        isAudioOnly: job.isAudioOnly ? 1 : 0,
        isPlaylist: job.isPlaylist ? 1 : 0,
        playlistTitle: job.playlistTitle || null,
        playlistIndex: job.playlistIndex || null,
        retryCount: job.retryCount || 0,
        speedLimit: job.speedLimit || null,
        errorCategory,
        errorDetailsJson,
        clipStart,
        clipEnd,
        clipLabel,
        cutMode: job.cutMode || null,
        estimatedSizeBytes: job.estimatedSizeBytes || null,
        sizeEstimationType: job.sizeEstimationType || null,
        courseId: job.courseId || null,
        courseItemId: job.courseItemId || null,
        selectedSubtitlesJson,
        embedSubtitles: job.embedSubtitles ? 1 : 0,
      }).where(eq(jobsTable.id, job.id)).run();
    } else {
      this.db.insert(jobsTable).values({
        id: job.id,
        sourceUrl: job.sourceUrl,
        sourcePlatform: job.sourcePlatform,
        mediaTitle: job.mediaTitle,
        thumbnailUrl: job.thumbnailUrl || null,
        mediaDuration: job.mediaDuration || null,
        selectedFormat: job.selectedFormat,
        selectedQuality: job.selectedQuality,
        targetContainer: job.targetContainer || 'mp4',
        outputPath: job.outputPath,
        status: job.status,
        progress: job.progress,
        downloadedBytes: job.downloadedBytes,
        totalBytes: job.totalBytes,
        downloadSpeed: job.downloadSpeed || null,
        eta: job.eta || null,
        errorMessage: job.errorMessage || null,
        createdAt: job.createdAt,
        startedAt: job.startedAt || null,
        completedAt: job.completedAt || null,
        isAudioOnly: job.isAudioOnly ? 1 : 0,
        isPlaylist: job.isPlaylist ? 1 : 0,
        playlistTitle: job.playlistTitle || null,
        playlistIndex: job.playlistIndex || null,
        retryCount: job.retryCount || 0,
        speedLimit: job.speedLimit || null,
        errorCategory,
        errorDetailsJson,
        clipStart,
        clipEnd,
        clipLabel,
        cutMode: job.cutMode || null,
        estimatedSizeBytes: job.estimatedSizeBytes || null,
        sizeEstimationType: job.sizeEstimationType || null,
        courseId: job.courseId || null,
        courseItemId: job.courseItemId || null,
        selectedSubtitlesJson,
        embedSubtitles: job.embedSubtitles ? 1 : 0,
      }).run();
    }

    // Coalesce persistence for frequent downloading progress updates
    const isProgressOnly = job.status === 'downloading' && existing?.status === 'downloading';
    this.persist(!isProgressOnly);
  }

  public getJob(id: string): DownloadJob | null {
    const rows = this.db.select().from(jobsTable).where(eq(jobsTable.id, id)).all();
    if (!rows || rows.length === 0) return null;
    return this.mapJobRow(rows[0]);
  }

  public getAllJobs(): DownloadJob[] {
    const rows = this.db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt)).all();
    return rows.map((r) => this.mapJobRow(r));
  }

  public findJobByUrl(url: string): DownloadJob | null {
    if (!url) return null;
    const clean = url.trim().toLowerCase();
    const all = this.getAllJobs();
    return all.find((j) => j.sourceUrl.trim().toLowerCase() === clean) || null;
  }

  public deleteJob(id: string): void {
    this.db.delete(jobsTable).where(eq(jobsTable.id, id)).run();
    this.persist(true);
  }

  public clearCompletedJobs(): void {
    this.sqlDb.run(`DELETE FROM jobs WHERE status = 'completed'`);
    this.persist(true);
  }

  private mapJobRow(row: any): DownloadJob {
    let errorDetails;
    if (row.errorDetailsJson || row.error_details_json) {
      try {
        errorDetails = JSON.parse(row.errorDetailsJson || row.error_details_json);
      } catch {}
    }

    let selectedSubtitles: string[] | undefined;
    const rawSubs = row.selectedSubtitlesJson || row.selected_subtitles_json;
    if (rawSubs) {
      try {
        selectedSubtitles = JSON.parse(rawSubs);
      } catch {}
    }

    let timeRange: TimeRange | undefined;
    const clipStart = row.clipStart ?? row.clip_start;
    const clipEnd = row.clipEnd ?? row.clip_end;
    if (typeof clipStart === 'number' && typeof clipEnd === 'number') {
      timeRange = {
        start: clipStart,
        end: clipEnd,
        label: row.clipLabel || row.clip_label || undefined,
      };
    }

    return {
      id: row.id,
      sourceUrl: row.sourceUrl || row.source_url,
      sourcePlatform: row.sourcePlatform || row.source_platform,
      mediaTitle: row.mediaTitle || row.media_title,
      thumbnailUrl: row.thumbnailUrl || row.thumbnail_url || undefined,
      mediaDuration: row.mediaDuration || row.media_duration || undefined,
      selectedFormat: row.selectedFormat || row.selected_format,
      selectedQuality: row.selectedQuality || row.selected_quality,
      targetContainer: row.targetContainer || row.target_container || 'mp4',
      outputPath: row.outputPath || row.output_path,
      status: row.status as JobStatus,
      progress: row.progress || 0,
      downloadedBytes: row.downloadedBytes || row.downloaded_bytes || 0,
      totalBytes: row.totalBytes || row.total_bytes || 0,
      downloadSpeed: row.downloadSpeed || row.download_speed || '',
      eta: row.eta || '',
      errorMessage: row.errorMessage || row.error_message || undefined,
      errorDetails,
      retryCount: row.retryCount || row.retry_count || 0,
      speedLimit: row.speedLimit || row.speed_limit || undefined,
      createdAt: row.createdAt || row.created_at,
      startedAt: row.startedAt || row.started_at || undefined,
      completedAt: row.completedAt || row.completed_at || undefined,
      isAudioOnly: (row.isAudioOnly ?? row.is_audio_only) === 1,
      isPlaylist: (row.isPlaylist ?? row.is_playlist) === 1,
      playlistTitle: row.playlistTitle || row.playlist_title || undefined,
      playlistIndex: row.playlistIndex || row.playlist_index || undefined,
      timeRange,
      cutMode: (row.cutMode || row.cut_mode || undefined) as DownloadJob['cutMode'],
      estimatedSizeBytes: row.estimatedSizeBytes ?? row.estimated_size_bytes ?? undefined,
      sizeEstimationType: (row.sizeEstimationType || row.size_estimation_type) as SizeEstimationType | undefined,
      courseId: row.courseId || row.course_id || undefined,
      courseItemId: row.courseItemId || row.course_item_id || undefined,
      selectedSubtitles,
      embedSubtitles: (row.embedSubtitles ?? row.embed_subtitles) === 1,
    };
  }

  // --- History ---

  public addHistory(entry: DownloadHistoryEntry): void {
    const clipStart = entry.timeRange ? entry.timeRange.start : null;
    const clipEnd = entry.timeRange ? entry.timeRange.end : null;
    const clipLabel = entry.timeRange?.label || null;

    this.db.insert(historyTable).values({
      id: entry.id,
      jobId: entry.jobId,
      mediaTitle: entry.mediaTitle,
      sourceUrl: entry.sourceUrl,
      sourcePlatform: entry.sourcePlatform,
      filePath: entry.filePath,
      fileSize: entry.fileSize,
      format: entry.format,
      duration: entry.duration,
      thumbnailUrl: entry.thumbnailUrl || null,
      completedAt: entry.completedAt,
      clipStart,
      clipEnd,
      clipLabel,
    }).run();
    this.persist(true);
  }

  public getHistory(): DownloadHistoryEntry[] {
    const rows = this.db.select().from(historyTable).orderBy(desc(historyTable.completedAt)).all();
    return rows.map((r) => {
      const exists = r.filePath ? fs.existsSync(r.filePath) : false;
      let timeRange: TimeRange | undefined;
      const clipStart = (r as any).clipStart ?? (r as any).clip_start;
      const clipEnd = (r as any).clipEnd ?? (r as any).clip_end;
      if (typeof clipStart === 'number' && typeof clipEnd === 'number') {
        timeRange = {
          start: clipStart,
          end: clipEnd,
          label: (r as any).clipLabel || (r as any).clip_label || undefined,
        };
      }

      return {
        id: r.id,
        jobId: r.jobId,
        mediaTitle: r.mediaTitle,
        sourceUrl: r.sourceUrl,
        sourcePlatform: r.sourcePlatform,
        filePath: r.filePath,
        fileSize: r.fileSize,
        format: r.format,
        duration: r.duration,
        thumbnailUrl: r.thumbnailUrl || undefined,
        completedAt: r.completedAt,
        fileExists: exists,
        timeRange,
      };
    });
  }

  public findHistoryByUrl(url: string): DownloadHistoryEntry | null {
    if (!url) return null;
    const clean = url.trim().toLowerCase();
    const rows = this.getHistory();
    return rows.find((h) => h.sourceUrl.trim().toLowerCase() === clean) || null;
  }

  public deleteHistory(id: string): void {
    this.db.delete(historyTable).where(eq(historyTable.id, id)).run();
    this.persist(true);
  }

  public clearHistory(): void {
    this.sqlDb.run(`DELETE FROM history`);
    this.persist(true);
  }

  // --- Settings ---

  public getSettings(defaultDownloadsDir: string): AppSettings {
    const rows = this.db.select().from(settingsTable).all();
    const map: Record<string, string> = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }

    return {
      downloadDirectory: map.downloadDirectory || defaultDownloadsDir,
      preferredQuality: map.preferredQuality || 'best',
      preferredContainer: map.preferredContainer || 'mp4',
      defaultAudioFormat: map.defaultAudioFormat || 'mp3',
      maxConcurrentDownloads: parseInt(map.maxConcurrentDownloads || '3', 10),
      theme: (map.theme as 'dark' | 'light') || 'dark',
      language: map.language || 'en',
      embedSubtitles: map.embedSubtitles === 'true',
      downloadSubtitles: map.downloadSubtitles === 'true',
      customYtDlpPath: map.customYtDlpPath || undefined,
      customFfmpegPath: map.customFfmpegPath || undefined,
      downloadSpeedLimit: map.downloadSpeedLimit || 'unlimited',
      autoRetryTransient: map.autoRetryTransient !== 'false',
      maxRetryAttempts: parseInt(map.maxRetryAttempts || '3', 10),
      notificationsEnabled: map.notificationsEnabled !== 'false',
      duplicateConflictPolicy: (map.duplicateConflictPolicy as any) || 'prompt',
      clipboardMonitoring: map.clipboardMonitoring === 'true',
      customMediaPlayerPath: map.customMediaPlayerPath || undefined,
    };
  }

  public updateSettings(settings: Partial<AppSettings>, defaultDownloadsDir: string): AppSettings {
    for (const [key, val] of Object.entries(settings)) {
      if (val !== undefined) {
        const valStr = String(val);
        const existing = this.db.select().from(settingsTable).where(eq(settingsTable.key, key)).all();
        if (existing.length > 0) {
          this.db.update(settingsTable).set({ value: valStr }).where(eq(settingsTable.key, key)).run();
        } else {
          this.db.insert(settingsTable).values({ key, value: valStr }).run();
        }
      }
    }
    this.persist(true);
    return this.getSettings(defaultDownloadsDir);
  }

  // --- Courses & Course Items ---

  public saveCourse(course: SavedCourse, items: CourseItem[]): void {
    const existing = this.getCourse(course.id);
    const subtitlesJson = course.selectedSubtitles ? JSON.stringify(course.selectedSubtitles) : null;

    if (existing) {
      this.sqlDb.run(
        `UPDATE courses
         SET source_url = ?, platform = ?, provider_playlist_id = ?, title = ?, thumbnail_url = ?,
             destination_folder = ?, preferred_quality = ?, preferred_container = ?, is_audio_only = ?,
             subtitles_json = ?, item_count = ?, last_synced_at = ?, updated_at = ?
         WHERE id = ?`,
        [
          course.sourceUrl,
          course.platform,
          course.providerPlaylistId || null,
          course.title,
          course.thumbnailUrl || null,
          course.destinationFolder,
          course.preferredQuality,
          course.preferredContainer,
          course.isAudioOnly ? 1 : 0,
          subtitlesJson,
          course.itemCount,
          course.lastSyncedAt || null,
          course.updatedAt,
          course.id,
        ]
      );
    } else {
      this.sqlDb.run(
        `INSERT INTO courses (
          id, source_url, platform, provider_playlist_id, title, thumbnail_url,
          destination_folder, preferred_quality, preferred_container, is_audio_only,
          subtitles_json, item_count, last_synced_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          course.id,
          course.sourceUrl,
          course.platform,
          course.providerPlaylistId || null,
          course.title,
          course.thumbnailUrl || null,
          course.destinationFolder,
          course.preferredQuality,
          course.preferredContainer,
          course.isAudioOnly ? 1 : 0,
          subtitlesJson,
          course.itemCount,
          course.lastSyncedAt || null,
          course.createdAt,
          course.updatedAt,
        ]
      );
    }

    if (items && items.length > 0) {
      this.saveCourseItems(items);
    }

    this.persist(true);
  }

  public getAllCourses(): SavedCourse[] {
    const res = this.sqlDb.exec(`SELECT * FROM courses ORDER BY created_at DESC`);
    if (res.length === 0 || !res[0].values) return [];

    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, idx) => {
        obj[c] = row[idx];
      });
      return this.mapCourseRow(obj);
    });
  }

  public getCourse(courseId: string): SavedCourse | null {
    const res = this.sqlDb.exec(`SELECT * FROM courses WHERE id = ?`, [courseId]);
    if (res.length === 0 || !res[0].values || res[0].values.length === 0) return null;
    const cols = res[0].columns;
    const obj: any = {};
    cols.forEach((c, idx) => {
      obj[c] = res[0].values[0][idx];
    });
    return this.mapCourseRow(obj);
  }

  public getCourseItems(courseId: string): CourseItem[] {
    const res = this.sqlDb.exec(
      `SELECT * FROM course_items WHERE course_id = ? ORDER BY index_order ASC`,
      [courseId]
    );
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, idx) => {
        obj[c] = row[idx];
      });
      return this.mapCourseItemRow(obj);
    });
  }

  public saveCourseItem(item: CourseItem): void {
    this.sqlDb.run(
      `INSERT INTO course_items (
        id, course_id, source_media_id, title, url, index_order,
        duration, thumbnail_url, job_id, local_file_path, status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_media_id = excluded.source_media_id,
        title = excluded.title,
        url = excluded.url,
        index_order = excluded.index_order,
        duration = excluded.duration,
        thumbnail_url = excluded.thumbnail_url,
        job_id = excluded.job_id,
        local_file_path = excluded.local_file_path,
        status = excluded.status,
        updated_at = excluded.updated_at`,
      [
        item.id,
        item.courseId,
        item.sourceMediaId,
        item.title,
        item.url,
        item.index,
        item.duration ?? null,
        item.thumbnailUrl ?? null,
        item.jobId ?? null,
        item.localFilePath ?? null,
        item.status,
        item.updatedAt,
      ]
    );
    this.persist(true);
  }

  public saveCourseItems(items: CourseItem[]): void {
    for (const item of items) {
      this.sqlDb.run(
        `INSERT INTO course_items (
          id, course_id, source_media_id, title, url, index_order,
          duration, thumbnail_url, job_id, local_file_path, status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          source_media_id = excluded.source_media_id,
          title = excluded.title,
          url = excluded.url,
          index_order = excluded.index_order,
          duration = excluded.duration,
          thumbnail_url = excluded.thumbnail_url,
          job_id = excluded.job_id,
          local_file_path = excluded.local_file_path,
          status = excluded.status,
          updated_at = excluded.updated_at`,
        [
          item.id,
          item.courseId,
          item.sourceMediaId,
          item.title,
          item.url,
          item.index,
          item.duration ?? null,
          item.thumbnailUrl ?? null,
          item.jobId ?? null,
          item.localFilePath ?? null,
          item.status,
          item.updatedAt,
        ]
      );
    }
    this.persist(true);
  }

  public updateCourse(courseId: string, updates: Partial<SavedCourse>): void {
    const course = this.getCourse(courseId);
    if (!course) return;

    const merged = { ...course, ...updates, updatedAt: new Date().toISOString() };
    const subtitlesJson = merged.selectedSubtitles ? JSON.stringify(merged.selectedSubtitles) : null;

    this.sqlDb.run(
      `UPDATE courses
       SET source_url = ?, platform = ?, provider_playlist_id = ?, title = ?, thumbnail_url = ?,
           destination_folder = ?, preferred_quality = ?, preferred_container = ?, is_audio_only = ?,
           subtitles_json = ?, item_count = ?, last_synced_at = ?, updated_at = ?
       WHERE id = ?`,
      [
        merged.sourceUrl,
        merged.platform,
        merged.providerPlaylistId || null,
        merged.title,
        merged.thumbnailUrl || null,
        merged.destinationFolder,
        merged.preferredQuality,
        merged.preferredContainer,
        merged.isAudioOnly ? 1 : 0,
        subtitlesJson,
        merged.itemCount,
        merged.lastSyncedAt || null,
        merged.updatedAt,
        courseId,
      ]
    );
    this.persist(true);
  }

  public deleteCourse(courseId: string): void {
    this.sqlDb.run(`DELETE FROM course_items WHERE course_id = ?`, [courseId]);
    this.sqlDb.run(`DELETE FROM courses WHERE id = ?`, [courseId]);
    this.persist(true);
  }

  private mapCourseRow(row: any): SavedCourse {
    let selectedSubtitles: string[] | undefined;
    if (row.subtitles_json) {
      try {
        selectedSubtitles = JSON.parse(row.subtitles_json);
      } catch {}
    }

    return {
      id: row.id,
      sourceUrl: row.source_url,
      platform: row.platform,
      providerPlaylistId: row.provider_playlist_id || undefined,
      title: row.title,
      thumbnailUrl: row.thumbnail_url || undefined,
      destinationFolder: row.destination_folder,
      preferredQuality: row.preferred_quality,
      preferredContainer: row.preferred_container,
      isAudioOnly: row.is_audio_only === 1,
      selectedSubtitles,
      itemCount: row.item_count || 0,
      lastSyncedAt: row.last_synced_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCourseItemRow(row: any): CourseItem {
    return {
      id: row.id,
      courseId: row.course_id,
      sourceMediaId: row.source_media_id,
      title: row.title,
      url: row.url,
      index: row.index_order ?? row.index,
      duration: row.duration || undefined,
      thumbnailUrl: row.thumbnail_url || undefined,
      jobId: row.job_id || undefined,
      localFilePath: row.local_file_path || undefined,
      status: row.status,
      updatedAt: row.updated_at,
    };
  }

  // --- Subtitles Indexing & Search ---

  public saveSubtitleFile(file: SubtitleFileRow): void {
    this.sqlDb.run(
      `INSERT INTO subtitle_files (
        id, file_path, media_title, media_id, language, format,
        mtime_ms, file_size, cue_count, associated_media_file, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_path) DO UPDATE SET
        media_title = excluded.media_title,
        media_id = excluded.media_id,
        language = excluded.language,
        format = excluded.format,
        mtime_ms = excluded.mtime_ms,
        file_size = excluded.file_size,
        cue_count = excluded.cue_count,
        associated_media_file = excluded.associated_media_file,
        indexed_at = excluded.indexed_at`,
      [
        file.id,
        file.filePath,
        file.mediaTitle,
        file.mediaId || null,
        file.language,
        file.format,
        file.mtimeMs,
        file.fileSize,
        file.cueCount,
        file.associatedMediaFile || null,
        file.indexedAt,
      ]
    );
    this.persist(true);
  }

  public getSubtitleFileByPath(filePath: string): SubtitleFileRow | null {
    const res = this.sqlDb.exec(`SELECT * FROM subtitle_files WHERE file_path = ?`, [filePath]);
    if (res.length === 0 || !res[0].values || res[0].values.length === 0) return null;
    const cols = res[0].columns;
    const obj: any = {};
    cols.forEach((c, idx) => {
      obj[c] = res[0].values[0][idx];
    });
    return {
      id: obj.id,
      filePath: obj.file_path,
      mediaTitle: obj.media_title,
      mediaId: obj.media_id || undefined,
      language: obj.language,
      format: obj.format,
      mtimeMs: obj.mtime_ms,
      fileSize: obj.file_size,
      cueCount: obj.cue_count,
      associatedMediaFile: obj.associated_media_file || undefined,
      indexedAt: obj.indexed_at,
    };
  }

  public getAllSubtitleFiles(): SubtitleFileRow[] {
    const res = this.sqlDb.exec(`SELECT * FROM subtitle_files ORDER BY indexed_at DESC`);
    if (res.length === 0 || !res[0].values) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj: any = {};
      cols.forEach((c, idx) => {
        obj[c] = row[idx];
      });
      return {
        id: obj.id,
        filePath: obj.file_path,
        mediaTitle: obj.media_title,
        mediaId: obj.media_id || undefined,
        language: obj.language,
        format: obj.format,
        mtimeMs: obj.mtime_ms,
        fileSize: obj.file_size,
        cueCount: obj.cue_count,
        associatedMediaFile: obj.associated_media_file || undefined,
        indexedAt: obj.indexed_at,
      };
    });
  }

  public deleteSubtitleFile(fileId: string): void {
    this.deleteSubtitleCuesByFileId(fileId);
    this.sqlDb.run(`DELETE FROM subtitle_files WHERE id = ?`, [fileId]);
    this.persist(true);
  }

  public insertSubtitleCues(cues: SubtitleCue[]): void {
    if (!cues || cues.length === 0) return;

    for (const cue of cues) {
      this.sqlDb.run(
        `INSERT OR REPLACE INTO subtitle_cues (
          id, file_id, cue_index, start_time, end_time, text, normalized_text
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cue.id,
          cue.fileId,
          cue.cueIndex,
          cue.startTime,
          cue.endTime,
          cue.text,
          cue.normalizedText,
        ]
      );

      if (this.ftsAvailable) {
        try {
          this.sqlDb.run(
            `INSERT INTO cues_fts (cue_id, text, normalized_text) VALUES (?, ?, ?)`,
            [cue.id, cue.text, cue.normalizedText]
          );
        } catch {}
      }
    }
    this.persist(true);
  }

  public deleteSubtitleCuesByFileId(fileId: string): void {
    if (this.ftsAvailable) {
      try {
        this.sqlDb.run(
          `DELETE FROM cues_fts WHERE cue_id IN (SELECT id FROM subtitle_cues WHERE file_id = ?)`,
          [fileId]
        );
      } catch {}
    }
    this.sqlDb.run(`DELETE FROM subtitle_cues WHERE file_id = ?`, [fileId]);
    this.persist(true);
  }

  public searchSubtitleCues(
    normalizedQuery: string,
    language?: string,
    limit = 50,
    offset = 0
  ): {
    cues: Array<
      SubtitleCue & {
        filePath: string;
        mediaTitle: string;
        language: string;
        format: 'srt' | 'vtt';
        associatedMediaFile?: string;
      }
    >;
    total: number;
  } {
    if (!normalizedQuery.trim()) {
      return { cues: [], total: 0 };
    }

    const likePattern = `%${normalizedQuery.trim()}%`;
    const params: any[] = [likePattern];
    let langClause = '';
    if (language && language !== 'all') {
      langClause = 'AND f.language = ?';
      params.push(language);
    }

    // 1. Count query
    const countSql = `
      SELECT COUNT(*)
      FROM subtitle_cues c
      JOIN subtitle_files f ON c.file_id = f.id
      WHERE (c.normalized_text LIKE ? OR c.text LIKE ?)
      ${langClause}
    `;
    const countParams = [likePattern, likePattern];
    if (language && language !== 'all') countParams.push(language);

    let total = 0;
    try {
      const countRes = this.sqlDb.exec(countSql, countParams);
      if (countRes.length > 0 && countRes[0].values && countRes[0].values[0]) {
        total = Number(countRes[0].values[0][0]);
      }
    } catch (err) {
      console.error('[DatabaseService] Count query error:', err);
    }

    // 2. Select query
    const selectSql = `
      SELECT
        c.id, c.file_id, c.cue_index, c.start_time, c.end_time, c.text, c.normalized_text,
        f.file_path, f.media_title, f.language, f.format, f.associated_media_file
      FROM subtitle_cues c
      JOIN subtitle_files f ON c.file_id = f.id
      WHERE (c.normalized_text LIKE ? OR c.text LIKE ?)
      ${langClause}
      ORDER BY f.media_title ASC, c.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const selectParams: (string | number | null)[] = [likePattern, likePattern];
    if (language && language !== 'all') selectParams.push(language);
    selectParams.push(limit, offset);

    const cues: any[] = [];
    try {
      const res = this.sqlDb.exec(selectSql, selectParams);
      if (res.length > 0 && res[0].values) {
        const cols = res[0].columns;
        for (const row of res[0].values) {
          const obj: any = {};
          cols.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          cues.push({
            id: obj.id,
            fileId: obj.file_id,
            cueIndex: obj.cue_index,
            startTime: obj.start_time,
            endTime: obj.end_time,
            text: obj.text,
            normalizedText: obj.normalized_text,
            filePath: obj.file_path,
            mediaTitle: obj.media_title,
            language: obj.language,
            format: obj.format as 'srt' | 'vtt',
            associatedMediaFile: obj.associated_media_file || undefined,
          });
        }
      }
    } catch (err) {
      console.error('[DatabaseService] Select query error:', err);
    }

    return { cues, total };
  }
}
