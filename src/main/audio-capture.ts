import { BrowserWindow, ipcMain } from 'electron';
import { mkdtempSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { IPC_CHANNELS } from '../shared/types';
import { getAudioDeviceSettings } from './audio-device-settings';

let captureWindow: BrowserWindow | null = null;
let listenersRegistered = false;
let onAudioLevel: ((level: number) => void) | null = null;
let onError: ((message: string) => void) | null = null;
let stopResolver: ((wavPath: string | null) => void) | null = null;
let readyResolver: (() => void) | null = null;
let captureReady = false;

function registerListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  ipcMain.on(IPC_CHANNELS.AUDIO_CAPTURE_LEVEL, (_event, payload: unknown) => {
    const level = typeof payload === 'number' ? payload : 0;
    onAudioLevel?.(level);
  });

  ipcMain.on(IPC_CHANNELS.AUDIO_CAPTURE_READY, () => {
    captureReady = true;
    if (readyResolver) {
      const resolve = readyResolver;
      readyResolver = null;
      resolve();
    }
  });

  ipcMain.on(IPC_CHANNELS.AUDIO_CAPTURE_ERROR, (_event, payload: unknown) => {
    const message = typeof payload === 'string' ? payload : 'Unknown capture error';
    onError?.(message);
    if (readyResolver) {
      const resolve = readyResolver;
      readyResolver = null;
      resolve();
    }
    if (stopResolver) {
      const resolve = stopResolver;
      stopResolver = null;
      resolve(null);
    }
  });

  ipcMain.on(IPC_CHANNELS.AUDIO_CAPTURE_WAV, (_event, payload: unknown) => {
    if (!stopResolver) return;

    try {
      if (!(payload instanceof Uint8Array) || payload.byteLength === 0) {
        const resolve = stopResolver;
        stopResolver = null;
        resolve(null);
        return;
      }

      const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'wyvoice-'));
      const wavPath = path.join(tmpDir, 'dictation.wav');
      writeFileSync(wavPath, Buffer.from(payload));
      const resolve = stopResolver;
      stopResolver = null;
      resolve(wavPath);
    } catch (error) {
      onError?.(`Failed to save recording: ${String(error)}`);
      if (stopResolver) {
        const resolve = stopResolver;
        stopResolver = null;
        resolve(null);
      }
    }
  });
}

function ensureCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) return captureWindow;

  captureWindow = new BrowserWindow({
    width: 320,
    height: 160,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  captureWindow.loadFile(path.join(__dirname, '../../src/renderer/capture.html'));

  captureWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    onError?.(`Capture window failed to load (${errorCode}): ${errorDescription}`);
  });
  captureWindow.webContents.on('render-process-gone', (_event, details) => {
    onError?.(`Capture renderer exited: ${details.reason}`);
  });

  captureWindow.on('closed', () => {
    captureWindow = null;
    captureReady = false;
    if (readyResolver) {
      const resolve = readyResolver;
      readyResolver = null;
      resolve();
    }
  });

  return captureWindow;
}

export async function startAudioCapture(
  onLevel: (level: number) => void,
  onCaptureError: (message: string) => void
): Promise<void> {
  registerListeners();
  onAudioLevel = onLevel;
  onError = onCaptureError;
  captureReady = false;

  const win = ensureCaptureWindow();
  if (win.webContents.isLoadingMainFrame()) {
    await new Promise<void>((resolve) => {
      win.webContents.once('did-finish-load', () => resolve());
    });
  }

  const deviceSettings = getAudioDeviceSettings();
  win.webContents.send(IPC_CHANNELS.AUDIO_CAPTURE_SET_DEVICE, deviceSettings.deviceId);
  win.webContents.send(IPC_CHANNELS.AUDIO_CAPTURE_START);
  await new Promise<void>((resolve) => {
    readyResolver = resolve;
    setTimeout(() => {
      if (!captureReady) {
        onError?.('Audio capture startup timed out.');
      }
      if (readyResolver) {
        const readyResolve = readyResolver;
        readyResolver = null;
        readyResolve();
      }
    }, 2500);
  });
}

export async function stopAudioCapture(): Promise<string | null> {
  if (!captureWindow || captureWindow.isDestroyed()) return null;
  if (stopResolver) return null;

  return new Promise<string | null>((resolve) => {
    stopResolver = resolve;
    captureWindow?.webContents.send(IPC_CHANNELS.AUDIO_CAPTURE_STOP);
    setTimeout(() => {
      if (!stopResolver) return;
      onError?.('Audio capture stop timed out.');
      const stopResolve = stopResolver;
      stopResolver = null;
      stopResolve(null);
    }, 3000);
  });
}

export function cancelAudioCapture(): void {
  if (!captureWindow || captureWindow.isDestroyed()) return;
  captureWindow.webContents.send(IPC_CHANNELS.AUDIO_CAPTURE_CANCEL);
  if (stopResolver) {
    const resolve = stopResolver;
    stopResolver = null;
    resolve(null);
  }
}
