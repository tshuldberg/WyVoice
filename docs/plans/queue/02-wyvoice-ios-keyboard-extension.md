# Plan: WyVoice iOS - Keyboard Extension Dictation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Metadata
- **Project:** WyVoice
- **Priority:** 1
- **Effort:** high
- **Dependencies:** none
- **Worktree:** yes
- **Created:** 2026-02-17

## Objective
Build an iOS WyVoice app plus custom keyboard extension that captures speech, transcribes locally, and inserts text into the active field using keyboard APIs. Match core desktop behavior where platform rules allow it: start/stop control, silence auto-stop, formatting options, and privacy-first local processing.

## Scope
- **Files/dirs affected:**
  - `ios/WyVoiceApp/` (new) - iOS container app target
  - `ios/WyVoiceKeyboard/` (new) - custom keyboard extension target
  - `ios/WyVoiceShared/` (new) - shared speech/settings/storage modules
  - `ios/WyVoice.xcodeproj` (new) - Xcode project
  - `docs/ios/architecture.md` (new)
  - `docs/ios/privacy.md` (new)
  - `docs/ios/test-matrix.md` (new)
  - `README.md` (update with iOS section)
- **Files NOT to touch:**
  - `src/main/` desktop runtime files
  - `src/renderer/` desktop overlay/setup files
  - `src/native/` desktop native addon files

## Phases

### Phase 1: iOS Project Foundation
- [ ] Create `WyVoice.xcodeproj` with targets:
  - `WyVoiceApp` (host app)
  - `WyVoiceKeyboard` (keyboard extension)
  - `WyVoiceShared` (shared Swift module)
- [ ] Configure App Group for shared settings/model directory
- [ ] Configure entitlements and Info.plist entries for microphone and speech use
- [ ] Add CI-friendly build scripts for simulator and device debug builds
- **Acceptance:** Project opens/builds in Xcode with all targets; shared App Group path resolves in both app and extension.

### Phase 2: Shared Speech + Settings Layer
- [ ] Implement `WyVoiceShared/SpeechSession` abstraction with:
  - start/stop/cancel
  - audio level callback
  - partial/final transcript callbacks
- [ ] Implement on-device-first recognizer backend:
  - Primary: Apple Speech on-device mode when available
  - Fallback option hook for embedded Whisper runtime (stubbed integration point)
- [ ] Implement silence detection and auto-stop timer policy
- [ ] Implement shared settings store in App Group:
  - formatting mode
  - auto-stop delay
  - keyboard UI preferences
- **Acceptance:** Unit tests validate settings persistence and silence auto-stop behavior; recognizer runs on-device in debug test harness.

### Phase 3: Keyboard Extension UX + Text Injection
- [ ] Build keyboard UI with:
  - mic button
  - recording state indicator
  - waveform strip
  - stop/cancel controls
- [ ] Wire transcript insertion via `textDocumentProxy.insertText(...)`
- [ ] Add formatting pass (off/basic/structured) before insertion
- [ ] Implement graceful handling when host app blocks custom keyboards or input context is unavailable
- **Acceptance:** In supported text fields, speaking and stopping inserts transcript directly; cancel does not insert text.

### Phase 4: Host App Onboarding + Controls
- [ ] Build onboarding flow:
  - enable keyboard in iOS Settings
  - verify keyboard enabled status
  - explain limitations and privacy
- [ ] Add settings screens:
  - formatting mode
  - auto-stop pause
  - recognizer/model status
- [ ] Add diagnostics screen:
  - mic permission state
  - quick test dictation
  - logs export
- **Acceptance:** First-time user can follow app steps to enable keyboard and successfully run a dictation test.

### Phase 5: Reliability, Privacy, and App Store Readiness
- [ ] Add resilient state machine in keyboard extension (`idle -> recording -> transcribing -> inserting -> idle`)
- [ ] Add interruption handling (calls, route changes, permission revokes)
- [ ] Add privacy hardening:
  - local-only default
  - explicit opt-in for any network feature
  - no transcript retention unless explicitly enabled
- [ ] Write docs:
  - `docs/ios/architecture.md`
  - `docs/ios/privacy.md`
  - `docs/ios/test-matrix.md`
- **Acceptance:** End-to-end manual matrix passes on target iOS versions/devices; documentation is complete for release prep.

## Acceptance Criteria
- [ ] iOS app and keyboard extension compile and run in debug on current supported iOS
- [ ] Keyboard inserts dictated text directly in supported apps (including Telegram input fields that allow custom keyboards)
- [ ] Speech recognition is local/on-device by default
- [ ] Auto-stop on silence works and is configurable
- [ ] Formatting modes (off/basic/structured) work in extension insertion path
- [ ] App Group shared settings persist across app and extension
- [ ] Test matrix completed with pass/fail notes and known limitations
- [ ] README includes iOS setup and platform limitations

## Constraints
- iOS does not allow global background hotkeys or out-of-band text injection into other apps
- Text insertion must occur through keyboard extension APIs only
- Keep keyboard extension memory and startup overhead low
- Do not require cloud transcription for MVP
- Any network use must be explicit, user-visible, and off by default
- Avoid storing transcripts by default in extension context

## Notes
- Telegram and other apps may vary by field and security posture; include per-app verification in `docs/ios/test-matrix.md`.
- If embedded Whisper proves too heavy for extension memory limits, keep transcription in host app as an optional path and document tradeoffs; MVP should still ship with on-device Apple Speech where available.
- Build this as a parallel track to desktop WyVoice without regressing existing Windows functionality.
