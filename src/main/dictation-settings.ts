import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { SILENCE_TIMEOUT_MS } from '../shared/constants';

export type AutoStopPauseMs = 1000 | 1500 | 2000 | 3000 | 5000 | 8000;
export type SilenceThreshold = 0.01 | 0.02 | 0.03 | 0.04 | 0.06 | 0.08;

export interface DictationSettings {
  autoStopPauseMs: AutoStopPauseMs;
  silenceThreshold: SilenceThreshold;
}

export const AUTO_STOP_DELAY_OPTIONS_MS: AutoStopPauseMs[] = [1000, 1500, 2000, 3000, 5000, 8000];
export const SILENCE_THRESHOLD_OPTIONS: SilenceThreshold[] = [0.01, 0.02, 0.03, 0.04, 0.06, 0.08];

const DEFAULT_SETTINGS: DictationSettings = {
  autoStopPauseMs: SILENCE_TIMEOUT_MS as AutoStopPauseMs,
  silenceThreshold: 0.02,
};

let cachedSettings: DictationSettings | null = null;

function getSettingsPath(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'dictation-settings.json');
}

function normalizeAutoStopPauseMs(rawValue: unknown): AutoStopPauseMs {
  if (typeof rawValue !== 'number') return DEFAULT_SETTINGS.autoStopPauseMs;
  if (AUTO_STOP_DELAY_OPTIONS_MS.includes(rawValue as AutoStopPauseMs)) {
    return rawValue as AutoStopPauseMs;
  }
  return DEFAULT_SETTINGS.autoStopPauseMs;
}

function normalizeSilenceThreshold(rawValue: unknown): SilenceThreshold {
  if (typeof rawValue !== 'number') return DEFAULT_SETTINGS.silenceThreshold;
  if (SILENCE_THRESHOLD_OPTIONS.includes(rawValue as SilenceThreshold)) {
    return rawValue as SilenceThreshold;
  }
  return DEFAULT_SETTINGS.silenceThreshold;
}

function normalizeSettings(raw: unknown): DictationSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const data = raw as Partial<DictationSettings>;
  return {
    autoStopPauseMs: normalizeAutoStopPauseMs(data.autoStopPauseMs),
    silenceThreshold: normalizeSilenceThreshold(data.silenceThreshold),
  };
}

function loadSettings(): DictationSettings {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return { ...DEFAULT_SETTINGS };

  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error('[MyVoice] Failed to load dictation settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: DictationSettings): void {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return;

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[MyVoice] Failed to save dictation settings:', error);
  }
}

function getMutableSettings(): DictationSettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return cachedSettings;
}

export function getDictationSettings(): DictationSettings {
  return { ...getMutableSettings() };
}

export function setAutoStopPauseMs(autoStopPauseMs: AutoStopPauseMs): DictationSettings {
  const next: DictationSettings = {
    ...getMutableSettings(),
    autoStopPauseMs: normalizeAutoStopPauseMs(autoStopPauseMs),
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}

export function setSilenceThreshold(silenceThreshold: SilenceThreshold): DictationSettings {
  const next: DictationSettings = {
    ...getMutableSettings(),
    silenceThreshold: normalizeSilenceThreshold(silenceThreshold),
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}

export function formatAutoStopDelayLabel(autoStopPauseMs: AutoStopPauseMs): string {
  return `${(autoStopPauseMs / 1000).toFixed(1)}s`;
}
