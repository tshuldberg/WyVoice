# WyVoice

Private dictation for Windows. Speak naturally, transcribe locally with `whisper.cpp`, and paste directly into your focused text field.

## Features

- Local transcription with `whisper-cli` (no cloud required)
- Tray-based app flow with always-on-top waveform overlay
- Auto-stop on silence
- Clipboard-safe paste into any focused app
- Fully customizable global dictation hotkey
- Formatting controls and waveform sensitivity controls

## Requirements

- Windows 10/11
- Microphone access enabled in Windows Privacy settings
- `whisper.cpp` CLI (`whisper-cli.exe`) available
- Internet connection for one-time model download (`ggml-base.en.bin`)

## Development

```powershell
git clone https://github.com/tshuldberg/WyVoice.git
cd WyVoice
npm install
npm run build
npm run dev
```

## Packaging

```powershell
npm run package
```

This produces a Windows installer via `electron-builder`.

## Notes

- If `whisper-cli.exe` is missing, WyVoice tries to install it via:
  `winget install --id ggerganov.whisper.cpp --exact`
- Hotkey changes are persisted in:
  `%APPDATA%\\WyVoice\\hotkey-settings.json`
