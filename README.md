# Ddx Downloader

<p align="center">
  <strong>Modern, high-performance, open-source desktop media suite for downloading YouTube videos, educational courses, playlists, and online media.</strong>
</p>

<p align="center">
  <a href="https://github.com/DdxAhmed/Ddx-Downloader/releases/latest">
    <img src="https://img.shields.io/github/v/release/DdxAhmed/Ddx-Downloader?color=indigo&label=Latest%20Release" alt="Latest Release" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-0078D6.svg" alt="Platform: Windows" />
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/framework-Electron%20%7C%20React%20%7C%20Vite-61DAFB.svg" alt="Stack" />
  <img src="https://img.shields.io/badge/engine-yt--dlp%20%26%20FFmpeg-FF0000.svg" alt="Engines" />
  <img src="https://img.shields.io/badge/database-SQLite%20(Drizzle%20ORM)-003B57.svg" alt="Database" />
  <img src="https://img.shields.io/badge/tests-45%20passed-success.svg" alt="Tests" />
</p>

<p align="center">
  <a href="https://github.com/DdxAhmed/Ddx-Downloader/releases/latest"><strong>Download Latest Windows Installer (Setup .exe) &rarr;</strong></a>
</p>

---

## 🌟 Overview & Local-First Philosophy

**Ddx Downloader** is a production-quality Windows desktop application engineered to give users complete control over their downloaded educational lectures, courses, high-resolution videos, and audio.

- **100% Local-First**: Runs entirely on your local machine with zero external cloud dependencies.
- **Zero Cloud Accounts**: No registrations, no logins, no personal backend servers, and zero remote telemetry.
- **Offline Reliability**: Application settings, playlist history, and queue state are persisted locally in SQLite via Drizzle ORM.
- **Safe & Sandboxed**: Electron main and preload processes communicate via strictly validated, isolated IPC bridges.

---

## 🚀 Key Features

### 1. Smart URL Analysis & Format Discovery
- Paste any video, course, or playlist link (supports **Ctrl+V** or 1-click clipboard paste).
- Automatically retrieves live formats, resolutions, audio streams, codecs, uploader details, and thumbnails.
- Supports **YouTube**, **Playlists & Courses**, **Instagram Reels**, **Vimeo**, **TikTok**, and thousands of supported websites via yt-dlp.

### 2. High-Resolution Video Selection & Quality Profiles
- Choose your preferred resolution: **Best Available**, **4K (2160p)**, **2K (1440p)**, **1080p Full HD**, **720p HD**, or **480p SD**.
- View container formats (**MP4**, **MKV**, **WebM**), approximate file sizes, and frame rates.
- Automatic merging of separate high-resolution video and audio streams using bundled FFmpeg.

### 3. Dedicated Audio Extraction
- Convert video streams to standalone audio tracks (**MP3 320kbps**, native **M4A / AAC**, or lossless **FLAC**).
- Zero audio quality loss when keeping original audio streams.

### 4. Educational Course & Playlist Curriculum
- Complete curriculum browser for YouTube playlists and educational courses.
- **Curriculum Organization**: Automatically organizes courses into dedicated folders (e.g., `Downloads/Physics 101/01 - Electric Field.mp4`).
- Bulk selection tools: "Select All", "Deselect All", or custom lesson selection.
- Automatic zero-padded numerical lesson prefixes (`01 - `, `02 - `) to preserve chronological lecture order.

### 5. Real-Time Download Manager with Bounded Retries
- Live progress metrics: completion percentage, real-time download speed (MB/s), downloaded/total bytes, and calculated ETA.
- Queue orchestration with configurable maximum concurrent downloads.
- Non-destructive pause, resume, cancel, and manual/auto retry capabilities for transient network failures.
- Crash recovery: automatically reconciles interrupted jobs safely on application restart.

### 6. Media Converter & Subtitle Manager
- Built-in converter: Convert existing videos or audio files between MP4, MKV, WebM, MP3, AAC, and FLAC using FFmpeg without overwriting originals.
- Subtitles manager: Download standalone SRT or VTT subtitle tracks directly.

### 7. Bilingual UI & Full RTL Support
- Native **English** (LTR) and **Arabic** (RTL) interface modes with proper layout alignment.
- **Dark & Light Mode** design themes with smooth transitions.

### 8. Local Media Library & History Log
- Browse all downloaded media with responsive cards, search filters, and missing file detection.
- Direct actions: **Play** in your default system media player or **Reveal** in local Windows Explorer folder.
- Safe deletion policy: removing items from your library or history never silently deletes files on disk without explicit confirmation.

---

## 🏛 Architecture

Ddx Downloader adheres to clean architectural separation between interface, lifecycle orchestration, and native media execution:

```mermaid
graph TD
    Renderer[React + Vite Frontend]
    Preload[Secure Preload Bridge / contextBridge]
    Main[Electron Main Process]
    DB[(SQLite + Drizzle ORM)]
    Queue[Download Queue Manager]
    Engine[Media Engine Service]
    YTDLP[yt-dlp.exe]
    FFMPEG[ffmpeg.exe]

    Renderer -->|Typed IPC Calls| Preload
    Preload -->|Validated Channels| Main
    Main -->|Queries & Saves| DB
    Main -->|Orchestrates| Queue
    Queue -->|Spawns Safe Args| Engine
    Engine --> YTDLP
    Engine --> FFMPEG
    Engine -.->|Real-time stdout progress| Queue
    Queue -.->|IPC Progress Events| Renderer
```

---

## 📦 Tech Stack

- **Desktop Framework**: Electron 45 (Main, Preload, Context Isolation)
- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4, Framer Motion, Lucide Icons
- **Local Database**: SQLite with Drizzle ORM (`sql.js` WASM engine for 100% portable cross-platform execution without requiring native C++ build tools)
- **Media Engines**: `yt-dlp` & `FFmpeg`
- **Testing**: Vitest & React Testing Library (45 automated tests)
- **Packaging**: `electron-builder` (NSIS x64 Windows installer)

---

## 🛠 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v20+ or v22+
- `npm` v10+

### Installation & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/DdxAhmed/Ddx-Downloader.git
   cd Ddx-Downloader
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application in development mode**:
   ```bash
   # Electron desktop development with live HMR
   npm run dev

   # Or fast browser-only preview (opens in Chrome/Edge)
   npm run dev:web
   ```

---

## 🧪 Running Automated Tests

Run the complete Vitest test suite covering URL safety validation, media providers, filename sanitization, error classification, SQLite migrations, queue management, and dependency diagnostics:

```bash
npm run test
```

To run TypeScript verification:
```bash
npm run typecheck
```

---

## 🏗 Building & Packaging for Windows

Build production bundles and the single Windows installer:

```bash
# Build Vite frontend and Electron main process
npm run build

# Package Windows NSIS Installer
npm run dist:nsis
```

The installer will be generated in the `./release` directory matching the official filename pattern:
- `Ddx-Downloader-Setup-${version}.exe` (e.g., `Ddx-Downloader-Setup-1.0.0.exe`)

---

## 🔒 Security Practices

- **Strict IPC Boundaries**: The renderer process runs with `nodeIntegration: false` and `contextIsolation: true`.
- **Safe Process Invocation**: yt-dlp and FFmpeg are executed exclusively via `child_process.spawn` with an array of arguments, never via shell command interpolation.
- **SSRF & Traversal Protection**: User-supplied URLs are strictly validated to public HTTP/HTTPS endpoints; loopback (`localhost`, `127.0.0.1`) and private LAN addresses are blocked.
- **Filename Sanitization**: Forbidden characters (`\ / : * ? " < > |`), Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`), and directory traversal sequences (`../`) are systematically stripped and sanitized.
- **Diagnostic Privacy**: Process logs and error details are automatically sanitized to redact tokens, cookies, and authorization credentials before display.

---

## 📄 License & Attributions

- **Ddx Downloader** is open-source under the [MIT License](LICENSE).
- **GitHub Repository**: [https://github.com/DdxAhmed/Ddx-Downloader](https://github.com/DdxAhmed/Ddx-Downloader)
- **Latest Releases**: [https://github.com/DdxAhmed/Ddx-Downloader/releases/latest](https://github.com/DdxAhmed/Ddx-Downloader/releases/latest)
- **yt-dlp**: Distributed under the [The Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE).
- **FFmpeg**: Licensed under the [GNU LGPL v2.1+](https://www.ffmpeg.org/legal.html).
