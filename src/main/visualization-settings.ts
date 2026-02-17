import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { WaveformSensitivity } from '../shared/types';

export interface VisualizationSettings {
  sensitivity: WaveformSensitivity;
  debugOverlay: boolean;
}

const DEFAULT_SETTINGS: VisualizationSettings = {
  sensitivity: 'balanced',
  debugOverlay: false,
};

let cachedSettings: VisualizationSettings | null = null;

function getSettingsPath(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'visualization-settings.json');
}

function normalizeSettings(raw: unknown): VisualizationSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const data = raw as Partial<VisualizationSettings>;
  const sensitivity: WaveformSensitivity =
    data.sensitivity === 'low' || data.sensitivity === 'high' ? data.sensitivity : 'balanced';

  return {
    sensitivity,
    debugOverlay: Boolean(data.debugOverlay),
  };
}

function loadSettings(): VisualizationSettings {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return { ...DEFAULT_SETTINGS };

  try {
    if (!fs.existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return normalizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error('[MyVoice] Failed to load visualization settings, using defaults:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: VisualizationSettings): void {
  const settingsPath = getSettingsPath();
  if (!settingsPath) return;

  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (error) {
    console.error('[MyVoice] Failed to save visualization settings:', error);
  }
}

function getMutableSettings(): VisualizationSettings {
  if (!cachedSettings) {
    cachedSettings = loadSettings();
  }
  return cachedSettings;
}

export function getVisualizationSettings(): VisualizationSettings {
  return { ...getMutableSettings() };
}

export function setWaveformSensitivity(sensitivity: WaveformSensitivity): VisualizationSettings {
  const next: VisualizationSettings = {
    ...getMutableSettings(),
    sensitivity,
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}

export function setWaveformDebugOverlay(enabled: boolean): VisualizationSettings {
  const next: VisualizationSettings = {
    ...getMutableSettings(),
    debugOverlay: enabled,
  };
  cachedSettings = next;
  saveSettings(next);
  return { ...next };
}
