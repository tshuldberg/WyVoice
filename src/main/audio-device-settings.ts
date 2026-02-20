import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface AudioDeviceSettings {
  deviceId: string; // '' means system default
}

const DEFAULT_SETTINGS: AudioDeviceSettings = {
  deviceId: '',
};

let cachedSettings: AudioDeviceSettings | null = null;

function getSettingsPath(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'audio-device-settings.json');
}

function loadSettings(): AudioDeviceSettings {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return { ...DEFAULT_SETTINGS };

  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      deviceId: typeof parsed?.deviceId === 'string' ? parsed.deviceId : '',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: AudioDeviceSettings): void {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return;

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[WyVoice] Failed to save audio device settings:', error);
  }
}

export function getAudioDeviceSettings(): AudioDeviceSettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return { ...cachedSettings };
}

export function setAudioDeviceId(deviceId: string): AudioDeviceSettings {
  const next: AudioDeviceSettings = { deviceId };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}
