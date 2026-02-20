import { app, globalShortcut, ipcMain, session } from 'electron';
import fs from 'fs';
import path from 'path';
import { createOverlayWindow } from './overlay-window';
import { createTray, refreshTrayMenu } from './tray';
import { toggleDictation, cancelDictation, getDictationState, initDictation } from './dictation-controller';
import { ensureWhisperReady } from './dependency-setup';
import { initHotkey, teardownHotkey } from './hotkey-manager';
import { ensureAutoStartDefault } from './startup-settings';
import { openSettingsWindow } from './settings-window';
import { showAppWindow } from './app-window';
import { IPC_CHANNELS } from '../shared/types';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}
app.setAppUserModelId('com.trey.wyvoice');

const userDataPath = app.getPath('userData');
const sessionDataPath = path.join(userDataPath, 'session-data');
fs.mkdirSync(sessionDataPath, { recursive: true });
app.setPath('sessionData', sessionDataPath);
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

app.whenReady().then(async () => {
  ensureAutoStartDefault();

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  const whisperPaths = await ensureWhisperReady();

  createTray();
  createOverlayWindow();
  showAppWindow();
  initDictation(whisperPaths);

  initHotkey(() => {
    toggleDictation();
  });

  globalShortcut.register('Escape', () => {
    if (getDictationState() !== 'idle') {
      cancelDictation();
    }
  });

  ipcMain.on(IPC_CHANNELS.DICTATION_CANCEL_REQUEST, () => {
    cancelDictation();
  });

  console.log('WyVoice is running. Press your hotkey to dictate.');
});

const appEvents = app as unknown as NodeJS.EventEmitter;

appEvents.on('open-settings', () => {
  if (!app.isReady()) return;
  showAppWindow('settings');
});

appEvents.on('refresh-tray', () => {
  if (!app.isReady()) return;
  refreshTrayMenu();
});

app.on('will-quit', () => {
  teardownHotkey();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep app running in the tray.
});
