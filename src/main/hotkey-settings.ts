import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { DEFAULT_WINDOWS_HOTKEY } from '../shared/constants';

export interface HotkeySettings {
  accelerator: string;
}

const DEFAULT_SETTINGS: HotkeySettings = {
  accelerator: DEFAULT_WINDOWS_HOTKEY,
};

let cachedSettings: HotkeySettings | null = null;

function getSettingsPath(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'hotkey-settings.json');
}

function normalizeAccelerator(rawValue: unknown): string {
  if (typeof rawValue !== 'string') return DEFAULT_SETTINGS.accelerator;
  const value = rawValue.trim();
  return value.length > 0 ? value : DEFAULT_SETTINGS.accelerator;
}

function normalizeSettings(raw: unknown): HotkeySettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const data = raw as Partial<HotkeySettings>;
  return {
    accelerator: normalizeAccelerator(data.accelerator),
  };
}

function loadSettings(): HotkeySettings {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return { ...DEFAULT_SETTINGS };

  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error('[WyVoice] Failed to load hotkey settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: HotkeySettings): void {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return;

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[WyVoice] Failed to save hotkey settings:', error);
  }
}

function getMutableSettings(): HotkeySettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return cachedSettings;
}

export function getHotkeySettings(): HotkeySettings {
  return { ...getMutableSettings() };
}

export function setHotkeyAccelerator(accelerator: string): HotkeySettings {
  const next: HotkeySettings = {
    ...getMutableSettings(),
    accelerator: normalizeAccelerator(accelerator),
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}
