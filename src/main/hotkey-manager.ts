import { BrowserWindow, globalShortcut, ipcMain } from 'electron';
import path from 'path';
import { DEFAULT_WINDOWS_HOTKEY } from '../shared/constants';
import { IPC_CHANNELS } from '../shared/types';
import { getHotkeySettings, setHotkeyAccelerator } from './hotkey-settings';
import { refreshTrayMenu } from './tray';

let currentHotkey = DEFAULT_WINDOWS_HOTKEY;
let callbackRef: (() => void) | null = null;
let recorderWindow: BrowserWindow | null = null;
let listenersRegistered = false;

function registerHotkey(accelerator: string): boolean {
  if (!callbackRef) return false;

  globalShortcut.unregister(currentHotkey);
  const ok = globalShortcut.register(accelerator, callbackRef);
  if (ok) {
    currentHotkey = accelerator;
  }
  return ok;
}

function registerRecorderListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  ipcMain.on(IPC_CHANNELS.HOTKEY_RECORDER_SAVE, (_event, payload: unknown) => {
    const accelerator = typeof payload === 'string' ? payload.trim() : '';
    if (!accelerator) return;

    if (!updateHotkey(accelerator)) {
      recorderWindow?.webContents.send(
        IPC_CHANNELS.HOTKEY_RECORDER_SET_CURRENT,
        `${currentHotkey}|failed`
      );
      return;
    }
    recorderWindow?.close();
  });

  ipcMain.on(IPC_CHANNELS.HOTKEY_RECORDER_CANCEL, () => {
    recorderWindow?.close();
  });
}

export function initHotkey(onTrigger: () => void): void {
  callbackRef = onTrigger;
  registerRecorderListeners();

  const desired = getHotkeySettings().accelerator;
  if (!registerHotkey(desired)) {
    registerHotkey(DEFAULT_WINDOWS_HOTKEY);
    setHotkeyAccelerator(DEFAULT_WINDOWS_HOTKEY);
  }
}

export function updateHotkey(accelerator: string): boolean {
  if (!registerHotkey(accelerator)) {
    return false;
  }
  setHotkeyAccelerator(accelerator);
  refreshTrayMenu();
  return true;
}

export function teardownHotkey(): void {
  globalShortcut.unregister(currentHotkey);
  if (recorderWindow && !recorderWindow.isDestroyed()) {
    recorderWindow.close();
  }
}

export function getCurrentHotkey(): string {
  return currentHotkey;
}

export function openHotkeyRecorder(): void {
  if (recorderWindow && !recorderWindow.isDestroyed()) {
    recorderWindow.focus();
    return;
  }

  recorderWindow = new BrowserWindow({
    width: 420,
    height: 240,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    title: 'Choose Hotkey',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  recorderWindow.loadFile(path.join(__dirname, '../../src/renderer/hotkey-recorder.html'));

  recorderWindow.webContents.once('did-finish-load', () => {
    recorderWindow?.webContents.send(IPC_CHANNELS.HOTKEY_RECORDER_SET_CURRENT, currentHotkey);
  });

  recorderWindow.on('closed', () => {
    recorderWindow = null;
  });
}
