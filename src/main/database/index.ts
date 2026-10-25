import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { drizzle, SQLJsDatabase } from 'drizzle-orm/sql-js';
import { eq, desc } from 'drizzle-orm';
import { jobsTable, historyTable, settingsTable, collectionsTable } from './schema';
import { DownloadJob, DownloadHistoryEntry, AppSettings, JobStatus } from '../../types';

export class DatabaseService {
  private dbPath: string;
  private sqlDb!: SqlJsDatabase;
  private db!: SQLJsDatabase;
  private isInitialized = false;

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
      // In production or development dist-electron
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
    this.persist();
    this.reconcileStartupJobs();

    this.isInitialized = true;
  }

  private runMigrations(): void {
    // Versioned schema migration execution
    this.sqlDb.run(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    // Create tables
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

    // Safe backwards-compatible migrations on existing database files
    const migrations = [
      'ALTER TABLE jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE jobs ADD COLUMN speed_limit TEXT;',
      'ALTER TABLE jobs ADD COLUMN error_category TEXT;',
      'ALTER TABLE jobs ADD COLUMN error_details_json TEXT;',
    ];

    for (const sql of migrations) {
      try {
        this.sqlDb.run(sql);
      } catch {
        // Column already exists, safe to ignore
      }
    }
  }

  public persist(): void {
    try {
      const data = this.sqlDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      console.error('[DatabaseService] Failed to persist database:', err);
    }
  }

  /**
   * On application restart, reconcile jobs that were left in active/running states
   */
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
      this.persist();
    } catch (err) {
      console.error('[DatabaseService] Error reconciling startup jobs:', err);
    }
  }

  // --- Jobs ---

  // --- Jobs ---

  public saveJob(job: DownloadJob): void {
    const existing = this.getJob(job.id);
    const errorDetailsJson = job.errorDetails ? JSON.stringify(job.errorDetails) : null;
    const errorCategory = job.errorDetails?.category || null;

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
      }).run();
    }
    this.persist();
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
    this.persist();
  }

  public clearCompletedJobs(): void {
    this.sqlDb.run(`DELETE FROM jobs WHERE status = 'completed'`);
    this.persist();
  }

  private mapJobRow(row: any): DownloadJob {
    let errorDetails;
    if (row.errorDetailsJson || row.error_details_json) {
      try {
        errorDetails = JSON.parse(row.errorDetailsJson || row.error_details_json);
      } catch {}
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
    };
  }

  // --- History ---

  public addHistory(entry: DownloadHistoryEntry): void {
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
    }).run();
    this.persist();
  }

  public getHistory(): DownloadHistoryEntry[] {
    const rows = this.db.select().from(historyTable).orderBy(desc(historyTable.completedAt)).all();
    return rows.map((r) => {
      const exists = r.filePath ? fs.existsSync(r.filePath) : false;
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
    this.persist();
  }

  public clearHistory(): void {
    this.sqlDb.run(`DELETE FROM history`);
    this.persist();
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
    this.persist();
    return this.getSettings(defaultDownloadsDir);
  }
}
