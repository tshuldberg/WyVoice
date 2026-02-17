# MyVoice -- Timeline

## 2026-02-15 -- Release Pipeline Hardening + IPC Consistency

**What:** Hardened macOS packaging for release, fixed IPC channel consistency rules, and removed release-audit blockers.

**Changes:**
- Added canonical setup progress IPC channel in shared types:
  - `IPC_CHANNELS.SETUP_PROGRESS`
  - `SetupProgressPayload`
- Updated setup install flow to use shared channel constants:
  - `src/main/dependency-setup.ts` now sends setup progress on `IPC_CHANNELS.SETUP_PROGRESS`.
  - Added `src/renderer/setup.ts` and moved setup-window IPC listener logic out of inline HTML.
  - Updated `src/renderer/setup.html` to load compiled `dist/renderer/setup.js`.
- Removed duplicated renderer IPC channel definitions:
  - `src/renderer/overlay.ts` now imports `IPC_CHANNELS` and related types from `src/shared/types.ts`.
  - `src/renderer/overlay.ts` now imports overlay sizing/waveform constants from `src/shared/constants.ts`.
- Added release-safe packaging scripts:
  - `scripts/package-mac.sh` packages to `${TMPDIR}/myvoice-release` by default to avoid Desktop/iCloud metadata signing failures.
  - `scripts/release-mac.sh` enforces release prerequisites (Developer ID cert + notarization credentials), then runs staple + Gatekeeper verification.
  - Both scripts now accept `MYVOICE_CODESIGN_ID=<sha1-hash>` and map it to `CSC_NAME` so a specific code-sign identity can be pinned.
  - Updated npm scripts: `package`, `release:mac`.
- Removed unused `electron-rebuild` dev dependency from `package.json` / `package-lock.json` to clear dev-audit vulnerabilities.
- Updated README release docs:
  - architecture-specific artifact note (`arm64` vs `x64`)
  - new packaging output behavior
  - signed/notarized release command path.

**Validation:**
- `npm run build:ts` passed.
- `npm run build` passed (native + TypeScript).
- `npm test` passed (4 tests).
- `npm audit --json` passed (0 vulnerabilities).
- `npm run package` passed and produced:
  - `/var/folders/.../T/myvoice-release/MyVoice-0.1.0-arm64.dmg`
- `npm run release:mac` preflight correctly fails without Developer ID certificate on this machine.

## 2026-02-14 -- User-Controlled Auto-Stop Pause Delay

**What:** Added a user-adjustable dictation auto-stop pause setting so users can control how long silence is required before dictation stops.

**Changes:**
- Added persisted dictation settings module at `src/main/dictation-settings.ts`:
  - stores `autoStopPauseMs` in `dictation-settings.json` under app userData
  - validates allowed delay options (1.0s, 1.5s, 2.0s, 3.0s, 5.0s, 8.0s)
  - provides display label formatter for tray UI.
- Updated tray menu (`src/main/tray.ts`) with new `Auto-Stop Pause` submenu:
  - radio options for each delay value
  - persisted selection and live menu refresh.
- Updated silence detection in `src/main/dictation-controller.ts`:
  - replaced fixed `SILENCE_TIMEOUT_MS` stop threshold with configurable `autoStopPauseMs`
  - logs selected auto-stop delay when recording starts.
- Updated README usage docs to mention tray-based pause delay control.

## 2026-02-14 -- Marketing Landing Page + Donation Strategy Plan

**What:** Added a basic standalone marketing webpage and created a skill-driven marketing execution plan with dual donation channels.

**Changes:**
- Added a static landing page at `website/index.html` and `website/styles.css` with:
  - clear product positioning
  - download CTA
  - dual donation CTAs (Buy Me a Coffee + Venmo)
  - lightweight client-side click logging for donation CTA events.
- Added page setup documentation at `website/README.md`.
- Added marketing strategy report at `docs/reports/marketing-plan-2026-02-14.md`:
  - mapped actions to installed marketing skills
  - included 30/60/90-day plan
  - defined channel mix and KPI framework
  - set recommendation to use both donation platforms with BMAC primary and Venmo secondary.

## 2026-02-14 -- Waveform Bootstrap Hardening

**What:** Hardened overlay boot/runtime diagnostics to unblock "audio levels present but no waveform rendered" reports.

**Changes:**
- Removed renderer dependencies on relative `require('../shared/...')` module paths in `overlay.ts`; IPC channel names and waveform constants are now local in the renderer script so it can boot reliably from file-based HTML.
- Added compatibility fallbacks in renderer boot:
  - auto-create missing waveform containers (`#waveform-bars`, `#mini-waveform-bars`)
  - tolerate missing optional controls (`btn-minimize`, `btn-expand`)
  - fallback hidden status/transcript/debug nodes to prevent hard crashes on markup drift.
- Added explicit overlay boot markers on `window`:
  - `__myvoice_overlay_booted`
  - `__myvoice_overlay_boot_error`
- Added main-process overlay DOM snapshots after `did-finish-load` and `overlay:ready` to verify live renderer state from terminal logs.
- Updated overlay console bridging to handle Electron v40 console-message argument shape changes, so renderer errors are consistently mirrored in main logs.
- Added throttled telemetry for outbound `dictation:audio-level` IPC sends from main to renderer.

**Validation:**
- `npm run build:ts` passed.
- `npm test` passed (4 tests).
- `npm run build` passed (native + TypeScript).

## 2026-02-14 -- Waveform Recovery + Local Formatting Pipeline

**What:** Fixed non-animating overlay waveform, added live waveform calibration controls, and introduced local transcript formatting modes (offline by default).

**Changes:**
- Fixed renderer script path so overlay waveform renderer actually loads.
- Added overlay renderer readiness handshake (`overlay:ready`) and main-process diagnostics for failed loads / renderer exits.
- Fixed overlay startup race where `overlay:ready` could be missed and `dictation:start` would not fire (causing static "Listening..." with no waveform animation).
- Changed overlay mouse-event handling to keep clicks on overlay controls instead of forwarding them to underlying windows (fixes minimize button affecting other apps).
- Added waveform render recovery path: first incoming audio level now auto-enables recording animation even if start event was missed.
- Added canvas bar-drawing fallback when `roundRect` is unavailable.
- Replaced renderer waveform loop with fixed-timer rendering plus per-audio-level redraw to avoid transparent-window `requestAnimationFrame` throttling edge cases.
- Fixed renderer crash (`exports is not defined`) by removing TypeScript `import` module emission from script-tag overlay runtime and switching to `require` + local type declarations.
- Replaced canvas waveform rendering with deterministic DOM bar rendering in both expanded and minimized overlay states (Old.mov-style behavior).
- Added waveform config IPC (`waveform:config`) and runtime broadcast from main to renderer.
- Added persisted visualization settings (`low|balanced|high` sensitivity, debug overlay toggle).
- Added tray controls for waveform sensitivity and debug overlay.
- Implemented adaptive waveform normalization in renderer:
  - sensitivity profiles
  - dynamic peak tracking + decay
  - level smoothing
  - "Listening... (no input)" hint when no signal is detected.
- Added on-overlay debug panel (optional) with live raw/mapped/peak/floor telemetry.
- Added persisted transcript formatting settings (`off|basic|structured` plus optional AI toggle flag).
- Added local transcript formatter module:
  - spacing and sentence cleanup
  - paragraph splitting heuristics
  - ordinal list inference (`first/second/third` -> numbered list).
- Wired formatter into dictation pipeline before clipboard paste.
- Added Node test coverage for formatter behavior (`tests/transcript-formatter.test.mjs`) and updated `npm test` to run the suite.

**Validation:**
- `npm run build:ts` passed.
- `npm run build` (native + TypeScript) passed.
- `npm test` passed (4 formatter tests).

**Design decisions:**
- Kept formatting fully local/offline by default to preserve privacy-first behavior.
- Added AI enhancement as an opt-in setting stub with explicit local fallback (no provider wired yet).
- Added runtime waveform calibration in tray to avoid rebuilding for quiet/loud microphone environments.

## 2026-02-13 -- Project Created

**What:** Designed and built MyVoice from scratch as a privacy-first macOS dictation app.

**Changes:**
- Created project scaffold: Electron + TypeScript + Objective-C native addon
- Implemented three native bridges: SpeechBridge (SFSpeechRecognizer + AVAudioEngine), HotkeyBridge (NSEvent fn double-tap detection), KeyboardBridge (CGEvent keystroke simulation)
- Built N-API addon wrapper (addon.mm) bridging Objective-C to Node.js
- Created TypeScript wrappers for the native addon
- Built floating pill overlay with waveform visualization (10 bars, 20 FPS, smoothed)
- Implemented dictation controller state machine (idle -> recording -> stopping)
- Created system tray with status display, launch-at-login toggle, quit
- Wired end-to-end flow: fn double-tap -> speech capture -> overlay display -> text injection
- Added project documentation: CLAUDE.md, README.md, timeline.md

**Design decisions:**
- Used Objective-C instead of Swift for native bridges (eliminates Swift-ObjC bridging complexity, same macOS APIs)
- On-device recognition only (`requiresOnDeviceRecognition = YES`) for absolute privacy
- 400ms double-tap threshold for fn key to avoid conflict with emoji picker
- 1.5s silence timeout for auto-stop, configurable in future
- Electron chosen for fast iteration; native Swift rewrite planned for v2 App Store distribution
