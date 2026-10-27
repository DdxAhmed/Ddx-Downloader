# Windows updates: implementation and release runbook

## Diagnosis

The inspected versions are electron-builder 26.18.0, electron-updater 6.8.11 and Electron 45.0.0 (from installed packages and the lockfile).

The former release workflow explicitly uploaded only the setup EXE. It did not explicitly publish `latest.yml` or the generated `.exe.blockmap`. It also let electron-builder infer publishing from CI while using a second release publisher, so the final asset set depended on implicit publishing behavior. Missing metadata prevents discovery; missing old/new blockmaps or cached installer causes differential download to fall back to a full installer. There is no captured diagnostic log from the user's previous full download, so its particular fallback cause cannot be proven retroactively.

Differential downloading was not disabled in the old service: the SDK defaults it to enabled. The interactive wizard was explicitly requested by `quitAndInstall(false, true)`. `autoInstallOnAppQuit = false` also disabled deferred installation. The settings page had no persistent download/restart controls, the update modal was English-only, and checks could overwrite the downloaded state. Downloaded bytes were incorrectly replaced with total bytes on completion.

## Current behavior

- The SDK checks GitHub Releases and downloads in the app. No browser or manual installer path is part of the update UI.
- `disableDifferentialDownload = false`, standard NSIS (not nsis-web), and `differentialPackage: "store-asar"` use the installed builder's supported blockmap mechanism. Storing app.asar makes small source changes more reusable, at the cost of a larger full installer. Runtime/engine changes, compression changes, and the first transition from older packaging can still require substantial data.
- `autoInstallOnAppQuit = true` uses the SDK's silent install-on-exit hook. Explicit restart first prepares shutdown, then calls `quitAndInstall(true, true)`. Normal exit does not force a restart. `oneClick: false` and installation-directory selection remain for first-time installation. Silent updates can still require a Windows elevation/UAC prompt where permissions require it; this is not the first-install wizard.
- Both English and Arabic show the installed version separately from the target, progress, errors, Download update, Restart to update and Later. Download completion is not installation completion. No transfer is labeled differential based on guesswork.
- Checks and downloads are locked until their promises settle, even if SDK events fire first. Downloaded updates survive subsequent checks in memory; the SDK also verifies and reuses cached downloads on a subsequent launch.
- Explicit restart and normal exit share one shutdown coordinator. Active media work triggers a native bilingual prompt with Later as the default. Accepted shutdown pauses the queue, invalidates callbacks/retry timers, flushes SQLite, stops tracked media process trees, waits for termination, and flushes again. Failure aborts exit/update. Conversions may need restarting; partial download files are retained.
- Database writes use a temporary file and rename. Shutdown flush errors propagate, so failed persistence blocks installation. The updater never removes settings, databases, courses, history, media or partial downloads. The stable appId remains `com.ddx.downloader`; no data-directory migration or uninstall cleanup has been introduced. Do not change app identity or userData location between releases.
- NSIS removes/replaces its installation directory. Before applying an update, a canonical-path guard checks userData, the download directory, recorded media, queue folders and course locations. If tracked data is inside the installation folder, installation is deferred with an error; normal exit remains possible without applying the update. Move that data outside the application folder before updating. No automatic relocation or deletion is performed. Keep user files outside the application folder, including files not tracked in the library.

## Publishing

1. Set package.json/lockfile to a new stable version and tag the identical version as `vX.Y.Z`.
2. CI checks types/tests, builds with `--publish never`, and validates the complete output before any release is visible.
3. Publish the original installer filename, `latest.yml`, and **all** generated `.blockmap` files together into a draft. Do not rename binaries after metadata generation. No custom binary patch system is used.
4. The validator checks version/tag agreement, metadata filenames, installer byte size, SHA-512, blockmap structure, then downloads uploaded draft assets through the authenticated GitHub API to verify actual URLs, lengths and hashes before publishing.
5. Releases are immutable in this workflow. An existing tag/release makes the job stop. Fix a failed draft deliberately before rerunning; never overwrite a published version. Keep prior releases and their original blockmaps available. The SDK can fetch the old blockmap when not cached; its URL is derived from old/new versions. Old releases with a different filename convention may need a full download.

The current non-web NSIS target emits an EXE and a separate EXE.blockmap; latest.yml references the EXE. Do not delete the updater's cached `installer.exe`/`current.blockmap`: the old installer supplies unchanged bytes. GitHub/CDN must support byte-range responses. A missing cache/map, blocked ranges, checksum failure, or incompatible previous artifact can legitimately trigger a full download. The application must remain usable in those cases.

## Signing and reproducibility

No signing certificate was configured in the inspected repository or this environment. CI accepts `CSC_LINK` and `CSC_KEY_PASSWORD` secrets for signing. Configure a valid Windows signing identity and keep a compatible publisher identity across releases; validate the generated `app-update.yml` publisherName and signature policy on the signed installed baseline. The implementation does not disable SDK signature checking. Unsigned builds cannot establish publisher authenticity, and Windows reputation/elevation prompts remain possible.

Commit the lockfile and use `npm ci`. The `store-asar` setting is supported by the inspected builder 26.18.0; keep that version or a compatible newer version. The existing workflow downloads latest yt-dlp at build time, so binary churn may legitimately enlarge deltas. Pin that binary to a reviewed release if repeatable output is required.

## Diagnostics

Logs are in `<app userData>/logs/updater.log` with one rotated previous log. They include installed/target versions, metadata retrieval, the SDK's `Download block maps`, `Full: ... To download: ...`, `Differential download`, and actual `Cannot download differentially, fallback to full download: ...` reason, followed by verified download completion. Cache hits are logged by the SDK. These are SDK diagnostics, not a stable public download-mode event; correlate them within the same attempt. URLs retain host/path but credentials, query strings, authorization/cookie headers and tokens are redacted. Debug block dumps are omitted.

SDK progress bytes are preserved as reported and may describe only the current transfer phase. They exclude metadata/blockmap/header traffic and are not an audit of aggregate wire bytes, especially after fallback. Do not interpret reconstructed installer size as transferred bytes.

## Verification

Automated tests cover lifecycle locks, silent restart arguments, postponement, shutdown/persistence failures, timer cleanup, bilingual controls, honest progress, artifact rejection, and reopening a real SQLite database with settings/courses/history/media and paused jobs intact.

`scripts/verify-differential.cjs` runs under Electron against two real locally packaged NSIS releases. It uses the real NsisUpdater and Electron HTTP executor with an isolated application adapter/cache, and a local HTTP range server. It records response-body bytes, compares the reconstructed installer SHA-512, and repeats with a missing old blockmap to verify full fallback. It seeds the old cached installer explicitly; it does not install either release, change a real profile, or publish anything. Run with a fresh output directory:

```powershell
node scripts/run-differential-verification.mjs OLD_RELEASE_DIR NEW_RELEASE_DIR OUTPUT_DIR
```

For complete installed-app verification, use a disposable Windows VM/profile: install baseline A normally, create settings/courses/history/media and record hashes, publish/serve B with its real signed artifacts, download B, capture transfer logs/server byte counts, choose Later while downloads or conversions run, confirm interruption only when intended, then test Restart to update and normal exit separately. Confirm no interactive setup wizard, the running version is B, DB records/media hashes survive, and first install still shows its wizard. Repeat with absent cache/blockmap and interrupted network. Local transfer testing alone does not verify this installation/UI/signature sequence.

Implementation references: the installed `electron-updater/out/NsisUpdater.js`, `BaseUpdater.js`, `AppUpdater.js`, and `app-builder-lib/out/targets/nsis/nsisOptions.d.ts` are the exact-version sources used for these decisions.
