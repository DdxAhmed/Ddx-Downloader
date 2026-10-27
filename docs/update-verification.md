# Update verification results — 27 October 2026

## Real Windows differential download

Built two unsigned Windows x64 NSIS packages locally using electron-builder 26.18.0, Electron 45.0.0 and electron-updater 6.8.11. Both use the configured `store-asar` differential package option and contain actual application bundles and bundled media engines. Test target version 1.1.1 was supplied only as a packaging override; package.json remains 1.1.0. Neither version was published or installed.

Validated both releases' latest.yml, versioned installer filename, byte size, SHA-512 and external blockmap structure. The second installer is **262,839,658 bytes**.

Ran the real NsisUpdater and Electron HTTP executor against a local range-capable HTTP server, with a separate test application adapter/profile/cache. Seeded the old installer cache explicitly, matching a prerequisite of an installed NSIS baseline. This is a real transfer/reconstruction test using two actual packages, not a mock or a custom patch algorithm.

| Scenario | Installer bytes received | All response-body bytes | Result |
| --- | ---: | ---: | --- |
| Old installer and old/new blockmaps present | 447,331 | 1,071,265 | HTTP 206 differential ranges; target SHA-512 matched |
| Old blockmap intentionally unavailable | 262,839,658 | 263,151,823 | HTTP 404 on old blockmap, then HTTP 200 full download; target SHA-512 matched |

The first transfer fetched approximately **0.17%** of the installer bytes (approximately **0.41%** including metadata and both blockmaps). These are measured HTTP response-body bytes, excluding HTTP/TCP headers. They are not a prediction for future releases; engine/runtime changes can be much larger.

The recorded fallback was the SDK's actual `Cannot download differentially, fallback to full download` error, identifying a 404 for `Ddx-Downloader-Setup-1.1.0.exe.blockmap`.

Raw local artifacts (ignored build outputs):

- `release/differential-measurement/report.json`: per-request response sizes, ranges and SDK progress.
- `release/differential-measurement/differential/updater.log`: successful differential attempt.
- `release/differential-measurement/fallback/updater.log`: exact fallback reason.
- `release/update-verification/` and `release/update-verification-next/`: locally packaged test releases and metadata.

## Scope and remaining verification

Final automated verification: `npm run typecheck` passed; `npm test` passed **82 tests in 12 files**; `npm run build` passed for both renderer and Electron bundles. Release metadata validation passed for both locally packaged versions. Git diff whitespace checks passed. The first restricted test run hit a filesystem permission error on SQLite's atomic rename; the complete suite passed with normal filesystem access.

- No installed application was replaced. Silent NSIS arguments and the SDK install-on-exit setting are covered by automated tests and inspected exact-version SDK code; absence of the interactive wizard has **not** been observed in an actual installed-app upgrade.
- A real SQLite reopen regression test verifies saved settings, courses/course items, history, paused queue progress and unchanged media bytes through the application shutdown preparation. Preservation across a running NSIS upgrade still requires the disposable-VM procedure in `updates.md`.
- GitHub publication and authenticated draft-asset verification were not run against the user's repository. CI implements them; local artifact validation and mocked uploaded-asset verification are tested.
- No signing certificate was available. Generated app-update.yml has no publisherName. Signing, publisher verification, Windows reputation and elevation behavior need testing with the production signing identity.
- The two local packages were snapshots during implementation, suitable for measuring the packaging/differential mechanism. The final source includes subsequent shutdown/data-location hardening and is verified separately by typecheck, tests and bundle build. The test installers are not production releases.
