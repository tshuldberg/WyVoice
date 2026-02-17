# Plan: MyVoice — Tray Icon, Custom Keybinding, Transcript Logging

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** MyVoice
- **Priority:** 1
- **Effort:** high
- **Dependencies:** none
- **Worktree:** no
- **Created:** 2026-02-15

## Context

MyVoice's tray icon currently renders as a black oval (the SVG mic fallback doesn't look good in the macOS menu bar). The hotkey is hardcoded to fn double-tap with no way to change it. There's no record of dictations — text is pasted and forgotten. This plan adds three features: a distinctive lips tray icon, a key recorder for custom hotkeys, and async transcript logging to markdown files.

## Objective

1. Replace the generic mic tray icon with a **lips** icon that works as a proper macOS template image (auto-adapts to light/dark menu bar).
2. Add a **key recorder** window so users can set any key combo as their dictation toggle (default remains fn+fn).
3. Add **transcript logging** — optionally save each dictation as a timestamped markdown file with metadata, written async so it never slows down the paste.

## Scope
- **Files/dirs affected:**
  - `src/main/tray.ts` — lips icon SVG, new menu items for hotkey + logging settings
  - `src/main/index.ts` — hotkey initialization changes (support both native fn+fn and globalShortcut)
  - `src/main/native-bridge.ts` — no changes needed (existing hotkeyStart/hotkeyStop work as-is)
  - `src/main/hotkey-settings.ts` — **new file** — settings persistence for custom keybinding (follows `dictation-settings.ts` pattern)
  - `src/main/transcript-logger.ts` — **new file** — async markdown file writer
  - `src/main/transcript-settings.ts` — **new file** — settings persistence for log folder + enabled flag
  - `src/main/dictation-controller.ts` — call transcript logger after paste (fire-and-forget)
  - `src/main/hotkey-manager.ts` — **new file** — manages switching between native fn+fn and globalShortcut
  - `src/renderer/hotkey-recorder.html` — **new file** — small key capture window
  - `src/renderer/hotkey-recorder.ts` — **new file** — captures keyboard events, sends accelerator string back via IPC
  - `src/shared/types.ts` — new IPC channels for hotkey recorder
  - `src/shared/constants.ts` — new constants (default hotkey, recorder window dimensions)
- **Files NOT to touch:** `src/native/` (no native addon changes needed), `src/renderer/overlay.ts`, `src/renderer/overlay.css`, `src/renderer/index.html`, `src/renderer/setup.html`

## Phases

### Phase 1: Lips Tray Icon

Replace the SVG mic icon with a lips silhouette. Use Electron's `nativeImage.createFromDataURL()` with an SVG lips path. Mark as template image when idle (auto-adapts to menu bar theme), use red/colored lips when recording.

- [ ] In `src/main/tray.ts`, rename `createMicIcon` to `createTrayIcon`
- [ ] Replace the mic SVG paths with a lips silhouette SVG (open lips shape — distinctive, recognizable at 16px)
- [ ] Idle state: monochrome black lips, call `setTemplateImage(true)` so macOS auto-inverts for dark menu bars
- [ ] Recording state: red lips (`#FF3B30`), NOT a template image (stays red always)
- [ ] Update `tray.setToolTip()` text (keep as "MyVoice" references, no mic mention)
- [ ] Resize to 18x18 (standard macOS tray icon size, slightly larger than current 16x16 for crispness)
- **Acceptance:** `npm run build:ts` passes. `npm run dev` shows lips icon in menu bar. Icon adapts to dark/light menu bar. Turns red when recording.

### Phase 2: Hotkey Settings + Manager

Create the settings persistence layer and a hotkey manager that handles switching between the native fn+fn monitor and Electron's `globalShortcut`.

- [ ] Create `src/main/hotkey-settings.ts` following the exact same pattern as `dictation-settings.ts`:
  - Interface: `HotkeySettings { accelerator: string | null }` — `null` means fn+fn (default), string is an Electron accelerator like `"CommandOrControl+Shift+D"`
  - Persists to `hotkey-settings.json` in `app.getPath('userData')`
  - Exports: `getHotkeySettings()`, `setHotkeyAccelerator(accelerator: string | null)`
- [ ] Create `src/main/hotkey-manager.ts`:
  - `initHotkey(callback: () => void)` — reads settings, registers either native fn+fn or globalShortcut
  - `updateHotkey(accelerator: string | null, callback: () => void)` — tears down current hotkey, registers new one
  - `teardownHotkey()` — cleanup on quit
  - When `accelerator` is `null`: uses `hotkeyStart()` from native-bridge (current fn+fn behavior)
  - When `accelerator` is a string: calls `hotkeyStop()` + `globalShortcut.register(accelerator, callback)`
- [ ] Update `src/main/index.ts`:
  - Replace direct `hotkeyStart()` call with `initHotkey(toggleDictation)`
  - Replace `hotkeyStop()` in `will-quit` with `teardownHotkey()`
- [ ] Add to `src/shared/types.ts`: IPC channels `HOTKEY_RECORDER_CAPTURE` and `HOTKEY_RECORDER_CANCEL`
- [ ] Add to `src/shared/constants.ts`: `HOTKEY_RECORDER_WIDTH = 360`, `HOTKEY_RECORDER_HEIGHT = 200`, `DEFAULT_HOTKEY_ACCELERATOR = null` (fn+fn)
- **Acceptance:** App starts with fn+fn working as before. Can programmatically call `updateHotkey('CommandOrControl+Shift+D', toggleDictation)` and the new combo works. Switching back to `null` restores fn+fn.

### Phase 3: Key Recorder Window

Build a small BrowserWindow where users press their desired key combo. The window captures the keydown event, displays the combo, and sends it back to the main process.

- [ ] Create `src/renderer/hotkey-recorder.html`:
  - Small frameless window with instructions: "Press your desired key combination..."
  - Shows the captured combo in large text as user presses keys
  - Two buttons: "Save" and "Cancel"
  - Includes "Reset to fn+fn" link/button
  - Styled to match the app's dark aesthetic (similar to overlay)
- [ ] Create `src/renderer/hotkey-recorder.ts`:
  - Listens for `keydown` events on the document
  - Builds an Electron accelerator string from the event (e.g., `event.metaKey` → "Command", `event.ctrlKey` → "Control", `event.key` → the key name)
  - Displays the current combo visually (e.g., "Cmd + Shift + D")
  - On "Save" click: sends `HOTKEY_RECORDER_CAPTURE` IPC with the accelerator string
  - On "Cancel" click: sends `HOTKEY_RECORDER_CANCEL` IPC
  - On "Reset to fn+fn": sends `HOTKEY_RECORDER_CAPTURE` with `null`
- [ ] In `src/main/tray.ts`, add a "Hotkey" submenu:
  - Shows current hotkey label (e.g., "Current: fn + fn" or "Current: Cmd+Shift+D")
  - "Change Hotkey..." item that opens the recorder window
  - "Reset to fn + fn" item
- [ ] In `src/main/hotkey-manager.ts`, add `openRecorderWindow()`:
  - Creates a small BrowserWindow (frameless, `alwaysOnTop`, `showInactive: false` — this one SHOULD take focus since user needs to type)
  - Loads `hotkey-recorder.html`
  - Listens for IPC messages from the recorder
  - On `HOTKEY_RECORDER_CAPTURE`: validates the accelerator, calls `updateHotkey()`, saves settings, closes window, rebuilds tray menu
  - On `HOTKEY_RECORDER_CANCEL`: closes window
- **Acceptance:** Clicking "Change Hotkey..." in tray menu opens a recorder. Pressing Cmd+Shift+D shows it, clicking Save registers it. App responds to new combo. Tray menu shows updated hotkey. "Reset to fn+fn" restores default.

### Phase 4: Transcript Logging

Add async markdown file writing after each successful dictation. Fire-and-forget — never blocks the paste operation.

- [ ] Create `src/main/transcript-settings.ts` following the `dictation-settings.ts` pattern:
  - Interface: `TranscriptSettings { enabled: boolean; folderPath: string | null }`
  - `null` folderPath means use default: `~/Documents/MyVoice Transcripts/`
  - Persists to `transcript-settings.json` in `app.getPath('userData')`
  - Exports: `getTranscriptSettings()`, `setTranscriptEnabled(enabled: boolean)`, `setTranscriptFolder(folderPath: string | null)`
- [ ] Create `src/main/transcript-logger.ts`:
  - `logTranscript(text: string): void` — fire-and-forget (no await needed by caller)
  - Checks if logging is enabled via `getTranscriptSettings()`
  - If disabled, returns immediately
  - Determines folder: settings `folderPath` or default `~/Documents/MyVoice Transcripts/`
  - Creates folder with `fs.mkdirSync(folder, { recursive: true })`
  - Filename: `YYYY-MM-DD-HHmmss.md` (e.g., `2026-02-15-121430.md`)
  - Content format:
    ```markdown
    ---
    date: 2026-02-15
    time: "12:14:30"
    words: 42
    characters: 238
    ---

    [transcript text here]
    ```
  - Writes with `fs.writeFile` (async callback, logs error but doesn't throw)
- [ ] In `src/main/dictation-controller.ts`, in `finishDictation()`:
  - After the `clipboard.writeText(transcript)` line (before the paste setTimeout), call `logTranscript(transcript)`
  - This is fire-and-forget — the paste continues immediately regardless
- [ ] In `src/main/tray.ts`, add a "Transcript Log" submenu:
  - "Save Transcripts" checkbox (toggles enabled)
  - "Choose Folder..." opens `dialog.showOpenDialog` with `properties: ['openDirectory']`, saves selection
  - Shows current folder path (truncated, disabled label)
  - "Open Folder" item that calls `shell.openPath()` on the transcript folder
- **Acceptance:** Enable logging in tray. Dictate something. A `.md` file appears in the folder with frontmatter + transcript. Paste speed is unaffected (logging is async). Changing folder works. Disabling stops new files from being created.

### Phase 5: Integration Testing + Tray Menu Cleanup

Verify all three features work together. Clean up the tray menu organization.

- [ ] Reorder tray menu for clarity:
  1. MyVoice (header)
  2. Status: Ready/Recording
  3. ---
  4. Launch at Login
  5. Hotkey (submenu)
  6. Text Formatting (submenu)
  7. Auto-Stop Pause (submenu)
  8. Waveform (submenu)
  9. Transcript Log (submenu)
  10. ---
  11. Buy Me a Coffee
  12. ---
  13. Quit MyVoice
- [ ] Run `npm run build:ts` — zero errors
- [ ] Run `npm run build` — native + TypeScript pass
- [ ] Run `npm run dev` — full manual test:
  - Lips icon visible in menu bar, adapts to theme
  - Lips turn red when recording
  - fn+fn works by default
  - Can change hotkey via recorder, new combo works
  - Can reset to fn+fn
  - Can enable transcript logging, dictate, verify .md file created
  - Can change transcript folder
  - Paste speed feels the same (logging doesn't block)
- [ ] Run `npm test` — all tests pass
- **Acceptance:** All features work independently and together. No regressions to existing functionality.

## Acceptance Criteria
- [ ] `npm run build:ts` — zero TypeScript errors
- [ ] `npm run build` — full build passes
- [ ] `npm run dev` — app launches, all three features functional
- [ ] `npm test` — all existing tests pass
- [ ] Tray icon is lips, adapts to light/dark menu bar, red when recording
- [ ] Custom hotkey can be set via key recorder, persists across restarts
- [ ] fn+fn default still works when no custom hotkey is set
- [ ] Transcript logging writes timestamped .md files with frontmatter
- [ ] Transcript logging is async — paste speed unaffected
- [ ] Timeline updated

## Constraints
- Do NOT modify files in `src/native/` — no native addon changes needed
- Do NOT modify overlay renderer files (`overlay.ts`, `overlay.css`, `index.html`)
- All new IPC channels must be defined in `IPC_CHANNELS` in `src/shared/types.ts`
- All new constants must live in `src/shared/constants.ts`
- New settings files follow the exact pattern of `dictation-settings.ts` (cached JSON in userData)
- Use `showInactive()` on all windows except the hotkey recorder (which needs focus to capture keys)
- Use `execFile()` never `exec()` for any subprocess calls
- Transcript logging must be fire-and-forget — never `await` it in the dictation flow

## Notes
- The lips SVG will be hand-crafted as an inline data URL (same approach as the current mic SVG fallback). A clean lips silhouette at 32x32 viewbox works well at menu bar sizes.
- Electron's `globalShortcut` handles standard accelerators (Cmd+Shift+key, Ctrl+key, etc.) but cannot handle modifier-only combos like fn+fn. The hotkey manager handles both modes: native NSEvent monitor for fn+fn, globalShortcut for everything else.
- The key recorder must translate DOM KeyboardEvent properties to Electron accelerator syntax. Map: `metaKey` → "Command", `ctrlKey` → "Control", `altKey` → "Alt", `shiftKey` → "Shift", plus the key name. Platform-aware: on macOS, `CommandOrControl` maps to Cmd.
- Transcript files use 24-hour time in filenames to avoid AM/PM ambiguity and ensure alphabetical = chronological sorting.
- Default transcript folder `~/Documents/MyVoice Transcripts/` is created on first write, not on enable. This avoids creating empty folders.
