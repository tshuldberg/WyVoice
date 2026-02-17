import { app } from 'electron';
import fs from 'fs';
import path from 'path';

interface StartupSettings {
  autoStartInitialized: boolean;
}

const DEFAULT_SETTINGS: StartupSettings = {
  autoStartInitialized: false,
};

let cachedSettings: StartupSettings | null = null;

function getSettingsPath(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'startup-settings.json');
}

function loadSettings(): StartupSettings {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return { ...DEFAULT_SETTINGS };

  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StartupSettings>;
    return {
      autoStartInitialized: parsed.autoStartInitialized === true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: StartupSettings): void {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return;

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch {
    // no-op
  }
}

function getMutableSettings(): StartupSettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return cachedSettings;
}

export function ensureAutoStartDefault(): void {
  const settings = getMutableSettings();
  if (settings.autoStartInitialized) return;

  app.setLoginItemSettings({ openAtLogin: true });
  settings.autoStartInitialized = true;
  saveSettings(settings);
}
