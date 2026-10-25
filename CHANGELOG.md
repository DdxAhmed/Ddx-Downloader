# Changelog

All notable changes to the **DDX Downloader** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-10-25

### Added
- **Initial Production Release** of DDX Downloader.
- **Home Dashboard**: Modern URL input with instant analysis, clipboard paste (Ctrl+V), and live provider badges.
- **Modular Media Providers**: Native support for YouTube (videos, shorts, and playlists), Instagram Reels, Vimeo, TikTok, and thousands of supported websites via yt-dlp.
- **Format & Resolution Selector**: Support for resolutions up to 4K UHD (2160p), 2K, 1080p Full HD, 720p, 480p, and SD.
- **Audio Extraction**: Dedicated MP3 (320kbps) and M4A/AAC extraction with FFmpeg stream merging.
- **Curriculum & Playlist Downloader**: Batch downloading of educational courses with automated lesson numbering (`01 - `, `02 - `) and dedicated folder structuring (`Downloads/Course Name/...`).
- **Download Queue Manager**: Real-time progress percentage, download speed (MB/s), downloaded/total bytes, ETA, pause, cancel, and retry capabilities.
- **Interrupted Job Reconciliation**: Automatically recovers from unexpected application shutdowns and reconciles interrupted jobs safely in SQLite.
- **Local Media Library**: Grid and list views of downloaded content with 1-click playback in system media player and Explorer folder revealing.
- **Audit History**: Complete searchable history log stored in local SQLite via Drizzle ORM.
- **Settings & Dependency Diagnostics**: Configurable download directories, default formats, concurrency limits, and yt-dlp / FFmpeg status verification.
- **Security Protections**: Electron context isolation, sandboxed execution, argument array spawning, and SSRF prevention.
- **Packaging**: Windows NSIS Installer and single-file Portable distribution configurations.
- **Automated Tests**: 23 automated tests covering URL validation, provider detection, filename sanitization, SQLite migrations, queue management, and dependency resolver.
