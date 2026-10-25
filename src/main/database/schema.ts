import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const jobsTable = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  sourceUrl: text('source_url').notNull(),
  sourcePlatform: text('source_platform').notNull(),
  mediaTitle: text('media_title').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  mediaDuration: integer('media_duration'),
  selectedFormat: text('selected_format').notNull(),
  selectedQuality: text('selected_quality').notNull(),
  targetContainer: text('target_container').notNull().default('mp4'),
  outputPath: text('output_path').notNull(),
  status: text('status').notNull(), // 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused'
  progress: real('progress').notNull().default(0),
  downloadedBytes: integer('downloaded_bytes').notNull().default(0),
  totalBytes: integer('total_bytes').notNull().default(0),
  downloadSpeed: text('download_speed'),
  eta: text('eta'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  isAudioOnly: integer('is_audio_only').notNull().default(0),
  isPlaylist: integer('is_playlist').notNull().default(0),
  playlistTitle: text('playlist_title'),
  playlistIndex: integer('playlist_index'),
});

export const historyTable = sqliteTable('history', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull(),
  mediaTitle: text('media_title').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourcePlatform: text('source_platform').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull().default(0),
  format: text('format').notNull(),
  duration: integer('duration').notNull().default(0),
  thumbnailUrl: text('thumbnail_url'),
  completedAt: text('completed_at').notNull(),
});

export const settingsTable = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const collectionsTable = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  playlistUrl: text('playlist_url').notNull(),
  playlistTitle: text('playlist_title').notNull(),
  createdAt: text('created_at').notNull(),
});
