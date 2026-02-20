import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { IPC_CHANNELS, SettingsStatePayload } from '../shared/types';
import { getCurrentHotkey, updateHotkey } from './hotkey-manager';
import { getDictationSettings, setAutoStopPauseMs, setSilenceThreshold } from './dictation-settings';

let settingsWindow: BrowserWindow | null = null;
let listenersRegistered = false;

function getSettingsState(hotkeyError?: string): SettingsStatePayload {
  const dictation = getDictationSettings();
  return {
    hotkey: getCurrentHotkey(),
    autoStopPauseMs: dictation.autoStopPauseMs,
    silenceThreshold: dictation.silenceThreshold,
    hotkeyError,
  };
}

function sendSettingsState(targetWindow: BrowserWindow, hotkeyError?: string): void {
  if (targetWindow.isDestroyed()) return;
  targetWindow.webContents.send(IPC_CHANNELS.SETTINGS_STATE, getSettingsState(hotkeyError));
}

function registerListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  ipcMain.on(IPC_CHANNELS.SETTINGS_REQUEST_STATE, (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow) return;
    sendSettingsState(targetWindow);
  });

  ipcMain.on(IPC_CHANNELS.SETTINGS_SET_HOTKEY, (event, payload: unknown) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow) return;

    const accelerator = typeof payload === 'string' ? payload.trim() : '';
    if (!accelerator) {
      sendSettingsState(targetWindow, 'Hotkey cannot be empty.');
      return;
    }

    if (!updateHotkey(accelerator)) {
      sendSettingsState(
        targetWindow,
        'Could not register that hotkey. Try Ctrl+Ctrl or a different key combination.'
      );
      return;
    }

    (app as unknown as NodeJS.EventEmitter).emit('refresh-tray');
    sendSettingsState(targetWindow);
  });

  ipcMain.on(IPC_CHANNELS.SETTINGS_SET_AUTO_STOP, (event, payload: unknown) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || typeof payload !== 'number') return;

    setAutoStopPauseMs(payload as ReturnType<typeof getDictationSettings>['autoStopPauseMs']);
    sendSettingsState(targetWindow);
  });

  ipcMain.on(IPC_CHANNELS.SETTINGS_SET_SILENCE_THRESHOLD, (event, payload: unknown) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender);
    if (!targetWindow || typeof payload !== 'number') return;

    setSilenceThreshold(payload as ReturnType<typeof getDictationSettings>['silenceThreshold']);
    sendSettingsState(targetWindow);
  });

  ipcMain.on(IPC_CHANNELS.SETTINGS_QUIT_APP, () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy();
    }
    app.quit();
    setTimeout(() => app.exit(0), 200);
  });
}

export function openSettingsWindow(): BrowserWindow {
  registerListeners();

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 560,
    height: 580,
    minWidth: 520,
    minHeight: 520,
    autoHideMenuBar: true,
    title: 'WyVoice Settings',
    icon: path.join(__dirname, '../../assets/icon.icns'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '../../src/renderer/settings.html'));
  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}
