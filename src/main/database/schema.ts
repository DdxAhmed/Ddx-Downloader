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
  retryCount: integer('retry_count').notNull().default(0),
  speedLimit: text('speed_limit'),
  errorCategory: text('error_category'),
  errorDetailsJson: text('error_details_json'),
  clipStart: real('clip_start'),
  clipEnd: real('clip_end'),
  clipLabel: text('clip_label'),
  cutMode: text('cut_mode'),
  estimatedSizeBytes: integer('estimated_size_bytes'),
  sizeEstimationType: text('size_estimation_type'),
  courseId: text('course_id'),
  courseItemId: text('course_item_id'),
  selectedSubtitlesJson: text('selected_subtitles_json'),
  embedSubtitles: integer('embed_subtitles').notNull().default(0),
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
  clipStart: real('clip_start'),
  clipEnd: real('clip_end'),
  clipLabel: text('clip_label'),
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

export const coursesTable = sqliteTable('courses', {
  id: text('id').primaryKey(),
  sourceUrl: text('source_url').notNull(),
  platform: text('platform').notNull(),
  providerPlaylistId: text('provider_playlist_id'),
  title: text('title').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  destinationFolder: text('destination_folder').notNull(),
  preferredQuality: text('preferred_quality').notNull(),
  preferredContainer: text('preferred_container').notNull(),
  isAudioOnly: integer('is_audio_only').notNull().default(0),
  subtitlesJson: text('subtitles_json'),
  itemCount: integer('item_count').notNull().default(0),
  lastSyncedAt: text('last_synced_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const courseItemsTable = sqliteTable('course_items', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  sourceMediaId: text('source_media_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  index: integer('index').notNull(),
  duration: integer('duration'),
  thumbnailUrl: text('thumbnail_url'),
  jobId: text('job_id'),
  localFilePath: text('local_file_path'),
  status: text('status').notNull(), // 'new' | 'queued' | 'downloading' | 'downloaded' | 'missing_local' | 'failed' | 'removed_from_source'
  updatedAt: text('updated_at').notNull(),
});

export const subtitleFilesTable = sqliteTable('subtitle_files', {
  id: text('id').primaryKey(),
  filePath: text('file_path').notNull().unique(),
  mediaTitle: text('media_title').notNull(),
  mediaId: text('media_id'),
  language: text('language').notNull(),
  format: text('format').notNull(), // 'srt' | 'vtt'
  mtimeMs: real('mtime_ms').notNull(),
  fileSize: integer('file_size').notNull(),
  cueCount: integer('cue_count').notNull().default(0),
  associatedMediaFile: text('associated_media_file'),
  indexedAt: text('indexed_at').notNull(),
});

export const subtitleCuesTable = sqliteTable('subtitle_cues', {
  id: text('id').primaryKey(),
  fileId: text('file_id').notNull(),
  cueIndex: integer('cue_index').notNull(),
  startTime: real('start_time').notNull(),
  endTime: real('end_time').notNull(),
  text: text('text').notNull(),
  normalizedText: text('normalized_text').notNull(),
});
