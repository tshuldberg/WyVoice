import { BrowserWindow, globalShortcut, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { GlobalKeyboardListener, IGlobalKeyDownMap, IGlobalKeyEvent } from 'node-global-key-listener';
import { DEFAULT_WINDOWS_HOTKEY } from '../shared/constants';
import { IPC_CHANNELS } from '../shared/types';
import { getHotkeySettings, setHotkeyAccelerator } from './hotkey-settings';
import { refreshTrayMenu } from './tray';

let currentHotkey = DEFAULT_WINDOWS_HOTKEY;
let callbackRef: (() => void) | null = null;
let recorderWindow: BrowserWindow | null = null;
let listenersRegistered = false;
let ctrlDoubleTapListener: GlobalKeyboardListener | null = null;
let ctrlSpaceListener: GlobalKeyboardListener | null = null;
let lastCtrlTapAt = 0;
let ctrlSpaceFallbackRegistered = false;

const CTRL_DOUBLE_TAP_ACCELERATOR = 'Control+Control';
const CTRL_SPACE_FALLBACK = 'Control+Space';
const CTRL_DOUBLE_TAP_THRESHOLD_MS = 450;
const CTRL_KEYS = new Set(['LEFT CTRL', 'RIGHT CTRL']);
const MODIFIER_KEYS = new Set([
  'LEFT CTRL',
  'RIGHT CTRL',
  'LEFT ALT',
  'RIGHT ALT',
  'LEFT SHIFT',
  'RIGHT SHIFT',
  'LEFT META',
  'RIGHT META',
  'CAPS LOCK',
  'NUM LOCK',
  'SCROLL LOCK',
  'FN',
]);

function isCtrlDoubleTapAccelerator(accelerator: string): boolean {
  const normalized = accelerator.replace(/\s+/g, '').toLowerCase();
  return normalized === 'control+control' || normalized === 'ctrl+ctrl';
}

function stopCtrlDoubleTapListener(): void {
  if (!ctrlDoubleTapListener) return;
  ctrlDoubleTapListener.kill();
  ctrlDoubleTapListener = null;
  lastCtrlTapAt = 0;
}

function stopCtrlSpaceListener(): void {
  if (!ctrlSpaceListener) return;
  ctrlSpaceListener.kill();
  ctrlSpaceListener = null;
}

function unregisterCtrlSpaceFallback(): void {
  if (!ctrlSpaceFallbackRegistered) return;
  try {
    globalShortcut.unregister(CTRL_SPACE_FALLBACK);
  } catch (error) {
    console.warn('[WyVoice] Failed to unregister Ctrl+Space fallback:', error);
  }
  ctrlSpaceFallbackRegistered = false;
}

function registerCtrlSpaceFallback(): boolean {
  if (!callbackRef || process.platform !== 'win32') return false;
  unregisterCtrlSpaceFallback();
  try {
    ctrlSpaceFallbackRegistered = globalShortcut.register(CTRL_SPACE_FALLBACK, callbackRef);
  } catch (error) {
    console.warn('[WyVoice] Failed to register Ctrl+Space fallback:', error);
    ctrlSpaceFallbackRegistered = false;
  }
  return ctrlSpaceFallbackRegistered;
}

function hasWinKeyServerBinary(): boolean {
  if (process.platform !== 'win32') return false;

  try {
    const packageRoot = path.dirname(require.resolve('node-global-key-listener/package.json'));
    return fs.existsSync(path.join(packageRoot, 'bin', 'WinKeyServer.exe'));
  } catch {
    return false;
  }
}

function onCtrlSpaceEvent(e: IGlobalKeyEvent, down: IGlobalKeyDownMap): boolean {
  if (e.state !== 'DOWN' || e.name !== 'SPACE') return false;
  const ctrlDown = Boolean(down['LEFT CTRL'] || down['RIGHT CTRL']);
  if (ctrlDown && callbackRef) {
    callbackRef();
  }
  return false;
}

function startCtrlSpaceLowLevelListener(): boolean {
  if (process.platform !== 'win32' || !callbackRef) return false;
  if (!hasWinKeyServerBinary()) {
    console.warn('[WyVoice] WinKeyServer.exe is missing; using Ctrl+Space globalShortcut fallback');
    return registerCtrlSpaceFallback();
  }

  stopCtrlSpaceListener();
  try {
    ctrlSpaceListener = new GlobalKeyboardListener();
    void ctrlSpaceListener.addListener(onCtrlSpaceEvent).catch((error) => {
      console.error('[WyVoice] Failed to start Ctrl+Space low-level listener:', error);
      stopCtrlSpaceListener();
      registerCtrlSpaceFallback();
    });
    return true;
  } catch (error) {
    console.error('[WyVoice] Failed to initialize Ctrl+Space low-level listener:', error);
    stopCtrlSpaceListener();
    return registerCtrlSpaceFallback();
  }
}

function onCtrlDoubleTapEvent(e: IGlobalKeyEvent, down: IGlobalKeyDownMap): boolean {
  if (e.state !== 'DOWN' || !e.name) return false;

  if (CTRL_KEYS.has(e.name)) {
    const now = Date.now();
    const wasDoubleTap = now - lastCtrlTapAt <= CTRL_DOUBLE_TAP_THRESHOLD_MS;
    lastCtrlTapAt = now;

    if (wasDoubleTap && callbackRef) {
      callbackRef();
    }
    return false;
  }

  const hasAnyCtrlDown = Boolean(down['LEFT CTRL'] || down['RIGHT CTRL']);
  if (!MODIFIER_KEYS.has(e.name) && hasAnyCtrlDown) {
    lastCtrlTapAt = 0;
  }
  return false;
}

function startCtrlDoubleTapListener(): boolean {
  if (process.platform !== 'win32' || !callbackRef) return false;
  stopCtrlDoubleTapListener();

  try {
    ctrlDoubleTapListener = new GlobalKeyboardListener();
    void ctrlDoubleTapListener.addListener(onCtrlDoubleTapEvent).catch((error) => {
      console.error('[WyVoice] Failed to start Ctrl+Ctrl listener:', error);
      stopCtrlDoubleTapListener();
    });
    return true;
  } catch (error) {
    console.error('[WyVoice] Failed to initialize Ctrl+Ctrl listener:', error);
    stopCtrlDoubleTapListener();
    return false;
  }
}

function registerHotkey(accelerator: string): boolean {
  if (!callbackRef) return false;

  stopCtrlDoubleTapListener();
  stopCtrlSpaceListener();
  unregisterCtrlSpaceFallback();
  if (!isCtrlDoubleTapAccelerator(currentHotkey)) {
    try {
      globalShortcut.unregister(currentHotkey);
    } catch (error) {
      console.warn('[WyVoice] Failed to unregister previous hotkey:', currentHotkey, error);
    }
  }

  const normalized = accelerator.replace(/\s+/g, '').toLowerCase();
  const ok = isCtrlDoubleTapAccelerator(accelerator)
    ? (() => {
      const primaryOk = startCtrlDoubleTapListener();
      if (primaryOk) {
        registerCtrlSpaceFallback();
      }
      return primaryOk;
    })()
    : normalized === 'control+space' || normalized === 'ctrl+space'
      ? startCtrlSpaceLowLevelListener()
      : (() => {
        try {
          return globalShortcut.register(accelerator, callbackRef!);
        } catch (error) {
          console.error('[WyVoice] Failed to register global shortcut:', accelerator, error);
          return false;
        }
      })();

  if (ok) {
    currentHotkey = isCtrlDoubleTapAccelerator(accelerator)
      ? CTRL_DOUBLE_TAP_ACCELERATOR
      : accelerator;
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
  stopCtrlDoubleTapListener();
  stopCtrlSpaceListener();
  unregisterCtrlSpaceFallback();
  if (!isCtrlDoubleTapAccelerator(currentHotkey)) {
    try {
      globalShortcut.unregister(currentHotkey);
    } catch (error) {
      console.warn('[WyVoice] Failed to unregister hotkey during teardown:', currentHotkey, error);
    }
  }
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
