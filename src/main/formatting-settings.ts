import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export type FormattingMode = 'off' | 'basic' | 'structured';

export interface FormattingSettings {
  mode: FormattingMode;
  aiEnhancementEnabled: boolean;
}

const DEFAULT_SETTINGS: FormattingSettings = {
  mode: 'basic',
  aiEnhancementEnabled: false,
};

let cachedSettings: FormattingSettings | null = null;

function getSettingsPath(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'formatting-settings.json');
}

function normalizeSettings(raw: unknown): FormattingSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const data = raw as Partial<FormattingSettings>;
  const mode: FormattingMode = data.mode === 'off' || data.mode === 'structured' ? data.mode : 'basic';

  return {
    mode,
    aiEnhancementEnabled: Boolean(data.aiEnhancementEnabled),
  };
}

function loadSettings(): FormattingSettings {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return { ...DEFAULT_SETTINGS };

  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error('[MyVoice] Failed to load formatting settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: FormattingSettings): void {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return;

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[MyVoice] Failed to save formatting settings:', error);
  }
}

function getMutableSettings(): FormattingSettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return cachedSettings;
}

export function getFormattingSettings(): FormattingSettings {
  return { ...getMutableSettings() };
}

export function setFormattingMode(mode: FormattingMode): FormattingSettings {
  const next: FormattingSettings = {
    ...getMutableSettings(),
    mode,
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}

export function setAiEnhancementEnabled(enabled: boolean): FormattingSettings {
  const next: FormattingSettings = {
    ...getMutableSettings(),
    aiEnhancementEnabled: enabled,
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}
