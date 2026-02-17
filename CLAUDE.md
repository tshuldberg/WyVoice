# MyVoice

## Overview

Privacy-first macOS dictation app. Double-tap the fn key to activate, speak naturally, and transcribed text is typed into the focused text field. All speech recognition runs on-device via whisper.cpp -- your voice never leaves your Mac.

## Core References

- `.claude/docs/architecture.md` — Startup pipeline, module map, IPC channels, dependency chain
- `.claude/docs/common-mistakes.md` — Known pitfalls for Electron, native addon, TypeScript, and packaging
- `.claude/skills/SKILLS_REGISTRY.md` — All available skills (project + marketing)

## Stack

- **Runtime:** Electron 33+
- **Language:** TypeScript 5.9
- **Speech Engine:** whisper-cpp (via Homebrew)
- **Native Addon:** Objective-C/Objective-C++ via node-addon-api (N-API)
- **macOS APIs:** AVAudioEngine, CGEvent, NSEvent
- **Build:** electron-builder, node-gyp, electron-rebuild
- **Package Manager:** npm

## Key Commands

```bash
# Development
npm install                 # Install dependencies
npm run dev                 # Build all + launch Electron in dev mode
npm start                   # Launch pre-built app

# Build
npm run build:native        # Compile Objective-C native addon via node-gyp
npm run build:ts            # Compile TypeScript to dist/
npm run build               # Build everything (native + TypeScript)
npm run rebuild             # Rebuild native addon for current Electron version

# Testing
npm test                    # Run tests

# Packaging
npm run package             # Create .dmg via electron-builder
```

## Architecture

See `.claude/docs/architecture.md` for the full reference. Summary:

### Directory Layout

```
MyVoice/
  src/
    main/                       # Electron main process (TypeScript)
      index.ts                  # App entry point, tray setup, lifecycle
      dependency-setup.ts       # First-launch: probe/install whisper-cli + download model
      dictation-controller.ts   # State machine: idle -> recording -> stopping
      overlay-window.ts         # Floating pill BrowserWindow management
      tray.ts                   # Menu bar icon and context menu
      native-bridge.ts          # TypeScript wrappers for native addon
    renderer/                   # Overlay UI (floating pill)
      index.html                # Pill HTML structure
      setup.html                # First-launch setup progress window
      overlay.css               # Styling, waveform bars, animations
      overlay.ts                # Waveform rendering, IPC event handlers
    native/                     # Objective-C/C++ native addon
      Sources/
        addon.mm                # N-API bindings (ObjC++ -> JS)
        SpeechBridgeImpl.m      # AVAudioEngine recording
        HotkeyBridgeImpl.m      # fn double-tap detection via NSEvent
        KeyboardBridgeImpl.m    # CGEvent keystroke simulation
      include/
        SwiftBridge.h           # Objective-C interface declarations
      binding.gyp               # node-gyp build configuration
    shared/                     # Shared between main and renderer
      types.ts                  # IPC channel names, payload interfaces
      constants.ts              # Timeouts, dimensions, thresholds
  .claude/                      # Claude Code configuration
    docs/                       # Architecture and reference docs
    skills/                     # Project and marketing skills
    settings.json               # Permission allow/deny lists
  assets/                       # Tray icons, installer background
  tests/                        # Test files
  dist/                         # Compiled output (gitignored)
```

### State Machine

```
IDLE --(fn double-tap)--> RECORDING --(silence timeout / fn double-tap)--> STOPPING --(text typed)--> IDLE
                                      \--(escape / cancel)--------------> IDLE (no text typed)
```

## Non-Negotiable Engineering Rules

- All IPC channel names must be defined in `IPC_CHANNELS` in `src/shared/types.ts` — never use string literals
- All timeout/dimension constants must live in `src/shared/constants.ts` — never hardcode numeric values
- Whisper paths must come from `initDictation()` — never hardcode `/opt/homebrew/...` in dictation code
- Use `showInactive()` not `show()` on overlay windows — never steal focus from the user's active app
- Use `execFile()` for subprocess calls — prevents shell injection
- Use `require()` not `import` for the native `.node` addon — it's CommonJS
- Native addon must be built against Electron headers — always use `npm run build:native`
- Rebuild native addon after any Electron version change — `npm run rebuild`
- Menu bar app only — `app.dock.hide()`, `skipTaskbar: true` on all windows

## Validation Requirements

Before marking work as complete:
1. **TypeScript build:** `npm run build:ts` — zero errors
2. **Full build:** `npm run build` — native + TypeScript both pass
3. **Dev launch:** `npm run dev` — app launches and tray icon appears
4. **Tests:** `npm test` — all tests pass

## Security Rules

- Never commit secrets or credentials
- Keep application secrets in `.env` (gitignored), not committed configs
- Do not store API tokens in `.claude/settings.json` (it's committed to git)
- `nodeIntegration: true` only with local `file://` URLs — never with remote URLs
- Renderer windows loading external content must use `contextIsolation: true`
- Model downloads use HTTPS only — verify Hugging Face URL in `dependency-setup.ts`

## Testing

Tests live in `tests/`. Run with `npm test`.

## Code Style

- TypeScript strict mode enabled
- Conventional Commits for commit messages
- No lint tool configured yet (future: ESLint)

## Environment Setup

### Prerequisites

- macOS 13 (Ventura) or later
- Node.js 18+
- Xcode Command Line Tools (`xcode-select --install`)
- Homebrew (for whisper-cpp — auto-prompted on first launch)
- npm

### Installation

```bash
cd MyVoice
npm install
npm run build
npm run dev
```

On first run, the app will:
1. Install `whisper-cpp` via Homebrew (if not present)
2. Download the speech model (~148MB, one-time)
3. Prompt for **Microphone** and **Accessibility** permissions

## Git Workflow

### Branch Naming

- `feature/` -- new features
- `fix/` -- bug fixes
- `docs/` -- documentation changes

### Commit Messages

Conventional Commits format:
- `feat(myvoice): add silence timeout configuration`
- `fix(myvoice): handle permission denied gracefully`
- `docs(myvoice): update README with install instructions`

### Merge Strategy

Squash merge to `main`.

## Important Notes

- **Permissions are critical:** The app will not function without Microphone and Accessibility permissions. Accessibility requires manual approval in System Settings > Privacy & Security > Accessibility.
- **Auto-setup on first launch:** `ensureWhisperReady()` in `dependency-setup.ts` runs before tray/hotkey init. It probes for `whisper-cli` (ARM and Intel paths), installs via Homebrew if missing, and downloads the `ggml-base.en.bin` model (~148MB) to `~/.cache/whisper/`. A frameless progress window (`setup.html`) shows status during install/download.
- **On-device only:** Transcription runs via `whisper-cli` (whisper.cpp). Zero network calls after the one-time model download.
- **Menu bar app:** No dock icon. The app runs as a tray-only application (`app.dock.hide()`).
- **Native rebuild required:** After `npm install` or any Electron version change, run `npm run rebuild` to recompile the native addon against the correct Electron headers.
- **fn key behavior:** Double-tap fn avoids conflict with single-tap fn (emoji picker). The 400ms threshold prevents false positives from normal typing.
- **CGEvent limitations:** Some heavily sandboxed apps may not accept CGEvent keystrokes. This is a macOS limitation, not a bug.

## Project Skills

- `/add-to-timeline` — `.claude/skills/add-to-timeline/SKILL.md`
- `/resume-session` — `.claude/skills/resume-session/SKILL.md`
- `/audit-code` — `.claude/skills/audit-code/SKILL.md`

When a task matches one of these workflows, read and follow the relevant skill file.

## Development Tracking (Mandatory)

### After Commits

1. Update `timeline.md` with completed work, files changed, decisions, and validation.
2. Use the `/add-to-timeline` skill for properly-formatted entries.

### Self-Improvement Loop

- Review `.claude/docs/common-mistakes.md` periodically
- If a new mistake pattern occurs 3+ times, add it to the common-mistakes doc

## Parallel Agent Work

This project participates in the workspace plan queue system. See `/Users/trey/Desktop/Apps/CLAUDE.md` for the full Plan Queue Protocol.

### Worktree Setup
- Bootstrap: `.cmux/setup` handles env symlinks and dependency installation
- Branch naming: `plan/[plan-name]` for plan-driven work, `feature/[name]` for ad-hoc

### File Ownership Boundaries
When multiple agents work on this project simultaneously, use these boundaries to avoid conflicts:

| Agent Role | Owned Paths |
|------------|-------------|
| Main process | `src/main/` (index.ts, dictation-controller.ts, overlay-window.ts, tray.ts, native-bridge.ts, dependency-setup.ts) |
| Renderer | `src/renderer/` (index.html, setup.html, overlay.css, overlay.ts) |
| Native addon | `src/native/` (addon.mm, SpeechBridgeImpl.m, HotkeyBridgeImpl.m, KeyboardBridgeImpl.m, binding.gyp, headers) |
| Shared | `src/shared/` (IPC types, constants shared between main and renderer) |
| Assets/packaging | `assets/`, electron-builder config, `package.json` |
| Tests | `tests/` (all test files) |
| Docs | `timeline.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.claude/docs/` |

**Rules:**
- Each file belongs to exactly one zone
- Never have two agents editing the same file simultaneously

### Conflict Prevention
- Check which files other active plans target before starting (read `docs/plans/active/*.md`)
- If your scope overlaps with an active plan, coordinate or wait
- After completing work, run `npm run build && npm test` before marking the plan done

### Agent Teams Strategy
When `/dispatch` detects 2+ plans targeting this project with overlapping scope, it creates an Agent Team instead of parallel subagents. Custom agent definitions from `/Users/trey/Desktop/Apps/.claude/agents/` are available:
- `plan-executor` — Execute plan phases with testing and verification
- `test-writer` — Write tests without modifying source code
- `docs-agent` — Update documentation (CLAUDE.md, timeline, diagrams)
- `reviewer` — Read-only code review and quality gates (uses Sonnet)

## Development Timeline

**File:** timeline.md
Update after every development session.
