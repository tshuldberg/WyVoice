import { app, globalShortcut, session } from 'electron';
import { createOverlayWindow } from './overlay-window';
import { createTray } from './tray';
import { toggleDictation, cancelDictation, getDictationState, initDictation } from './dictation-controller';
import { ensureWhisperReady } from './dependency-setup';
import { initHotkey, teardownHotkey } from './hotkey-manager';

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  const whisperPaths = await ensureWhisperReady();

  createTray();
  createOverlayWindow();
  initDictation(whisperPaths);

  initHotkey(() => {
    toggleDictation();
  });

  globalShortcut.register('Escape', () => {
    if (getDictationState() !== 'idle') {
      cancelDictation();
    }
  });

  console.log('WyVoice is running. Press your hotkey to dictate.');
});

app.on('will-quit', () => {
  teardownHotkey();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Keep app running in the tray.
});
