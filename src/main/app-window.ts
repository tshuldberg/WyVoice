import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS, type WaveformSensitivity } from '../shared/types';
import {
  getFormattingSettings,
  setAiEnhancementEnabled,
  setFormattingMode,
  type FormattingMode,
} from './formatting-settings';
import {
  AUTO_STOP_DELAY_OPTIONS_MS,
  SILENCE_THRESHOLD_OPTIONS,
  getDictationSettings,
  setAutoStopPauseMs,
  setSilenceThreshold,
  type AutoStopPauseMs,
  type SilenceThreshold,
} from './dictation-settings';
import {
  getVisualizationSettings,
  setWaveformDebugOverlay,
  setWaveformSensitivity,
} from './visualization-settings';
import { broadcastWaveformConfig } from './overlay-window';
import {
  listRecordingLogDates,
  readRecordingLogByDate,
  readTodayRecordingLog,
  getTodayDateKey,
  type RecordingLogEntry,
} from './recording-log';
import { getCurrentHotkey } from './hotkey-manager';
import { getAudioDeviceSettings, setAudioDeviceId } from './audio-device-settings';

export type AppSection = 'settings' | 'logs';

export interface AppStatePayload {
  formatting: ReturnType<typeof getFormattingSettings>;
  dictation: ReturnType<typeof getDictationSettings>;
  visualization: ReturnType<typeof getVisualizationSettings>;
  hotkey: string;
  todayLog: ReturnType<typeof readTodayRecordingLog>;
  todayDateKey: string;
  availableLogDates: string[];
  autoStopOptionsMs: typeof AUTO_STOP_DELAY_OPTIONS_MS;
  silenceThresholdOptions: typeof SILENCE_THRESHOLD_OPTIONS;
  audioDeviceId: string;
}

interface ExportLogPayload {
  date: string;
  search: string;
  entries: RecordingLogEntry[];
  format: 'txt' | 'json';
}

let appWindow: BrowserWindow | null = null;
let handlersRegistered = false;
let pendingSection: AppSection = 'settings';
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

function getAppState(): AppStatePayload {
  return {
    formatting: getFormattingSettings(),
    dictation: getDictationSettings(),
    visualization: getVisualizationSettings(),
    hotkey: getCurrentHotkey(),
    todayLog: readTodayRecordingLog(),
    todayDateKey: getTodayDateKey(),
    availableLogDates: listRecordingLogDates(),
    autoStopOptionsMs: AUTO_STOP_DELAY_OPTIONS_MS,
    silenceThresholdOptions: SILENCE_THRESHOLD_OPTIONS,
    audioDeviceId: getAudioDeviceSettings().deviceId,
  };
}

function registerHandlers(): void {
  if (handlersRegistered) return;

  ipcMain.handle(IPC_CHANNELS.APP_GET_STATE, () => getAppState());
  ipcMain.handle(IPC_CHANNELS.APP_GET_TODAY_LOG, () => readTodayRecordingLog());
  ipcMain.handle(IPC_CHANNELS.APP_GET_LOG_BY_DATE, (_event, date: string) => {
    return readRecordingLogByDate(String(date || ''));
  });
  ipcMain.handle(IPC_CHANNELS.APP_LIST_LOG_DATES, () => listRecordingLogDates());
  ipcMain.handle(IPC_CHANNELS.APP_EXPORT_LOG, async (_event, payload: ExportLogPayload) => {
    const format = payload?.format === 'json' ? 'json' : 'txt';
    const safeDate = String(payload?.date || getTodayDateKey());
    const safeSearch = String(payload?.search || '').trim();
    const entries = Array.isArray(payload?.entries) ? payload.entries : [];

    const defaultFileName = `wyvoice-log-${safeDate}${safeSearch ? '-filtered' : ''}.${format}`;
    const result = await dialog.showSaveDialog({
      title: 'Export WyVoice Log',
      defaultPath: defaultFileName,
      filters: format === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : [{ name: 'Text', extensions: ['txt'] }],
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    const output = format === 'json'
      ? JSON.stringify({
          date: safeDate,
          search: safeSearch,
          exportedAt: new Date().toISOString(),
          entries,
        }, null, 2)
      : [
          `WyVoice Log Export`,
          `Date: ${safeDate}`,
          `Search: ${safeSearch || '(none)'}`,
          `Exported: ${new Date().toISOString()}`,
          '',
          ...entries.map((entry) => `[${entry.timestamp}] ${entry.transcript}`),
          '',
        ].join('\n');

    fs.writeFileSync(result.filePath, output, 'utf8');
    return { ok: true, canceled: false, filePath: result.filePath };
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_FORMATTING_MODE, (_event, mode: FormattingMode) => {
    setFormattingMode(mode);
    return getAppState();
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_AI_ENHANCEMENT, (_event, enabled: boolean) => {
    setAiEnhancementEnabled(Boolean(enabled));
    return getAppState();
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_AUTO_STOP_PAUSE, (_event, pauseMs: AutoStopPauseMs) => {
    setAutoStopPauseMs(pauseMs);
    return getAppState();
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_SILENCE_THRESHOLD, (_event, threshold: SilenceThreshold) => {
    setSilenceThreshold(threshold);
    return getAppState();
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_WAVEFORM_SENSITIVITY, (_event, sensitivity: WaveformSensitivity) => {
    setWaveformSensitivity(sensitivity);
    broadcastWaveformConfig();
    return getAppState();
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_WAVEFORM_DEBUG, (_event, enabled: boolean) => {
    setWaveformDebugOverlay(Boolean(enabled));
    broadcastWaveformConfig();
    return getAppState();
  });
  ipcMain.handle(IPC_CHANNELS.APP_SET_AUDIO_DEVICE, (_event, deviceId: string) => {
    setAudioDeviceId(typeof deviceId === 'string' ? deviceId : '');
    return getAppState();
  });

  handlersRegistered = true;
}

export function createAppWindow(): BrowserWindow {
  if (appWindow && !appWindow.isDestroyed()) return appWindow;

  registerHandlers();

  appWindow = new BrowserWindow({
    width: 940,
    height: 700,
    minWidth: 860,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'WyVoice',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  appWindow.loadFile(path.join(__dirname, '../../src/renderer/app.html'));

  appWindow.webContents.on('did-finish-load', () => {
    if (!appWindow || appWindow.isDestroyed()) return;
    appWindow.webContents.send(IPC_CHANNELS.APP_NAVIGATE, pendingSection);
  });

  appWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    appWindow?.hide();
  });

  appWindow.once('ready-to-show', () => {
    appWindow?.show();
  });

  return appWindow;
}

export function showAppWindow(section: AppSection = 'settings'): void {
  pendingSection = section;
  const win = createAppWindow();
  win.show();
  win.focus();
  win.webContents.send(IPC_CHANNELS.APP_NAVIGATE, section);
}

export function broadcastLogUpdated(): void {
  if (!appWindow || appWindow.isDestroyed()) return;
  const todayDate = getTodayDateKey();
  appWindow.webContents.send(IPC_CHANNELS.APP_LOG_UPDATED, {
    date: todayDate,
    entries: readTodayRecordingLog(),
    availableDates: listRecordingLogDates(),
  });
}
