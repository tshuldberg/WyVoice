import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import {
  OVERLAY_EXPANDED_WIDTH,
  OVERLAY_EXPANDED_HEIGHT,
  OVERLAY_TOP_OFFSET,
} from '../shared/constants';
import { IPC_CHANNELS, OverlaySetSizePayload, WaveformConfigPayload } from '../shared/types';
import { getVisualizationSettings } from './visualization-settings';

let overlayWindow: BrowserWindow | null = null;
let ipcRegistered = false;
let overlayReady = false;
let audioLevelSendCount = 0;

function inspectOverlayDom(context: string): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;

  const script = `(() => {
    const main = document.getElementById('waveform-bars');
    const mini = document.getElementById('mini-waveform-bars');
    return {
      href: String(window.location.href),
      readyState: document.readyState,
      hasOverlay: Boolean(document.getElementById('overlay')),
      hasWaveformBars: Boolean(main),
      waveBarCount: main ? main.children.length : 0,
      hasMiniWaveformBars: Boolean(mini),
      miniBarCount: mini ? mini.children.length : 0,
      booted: Boolean(window.__myvoice_overlay_booted),
      bootError: String(window.__myvoice_overlay_boot_error || ''),
    };
  })()`;

  overlayWindow.webContents
    .executeJavaScript(script, true)
    .then((snapshot: any) => {
      console.log(`[MyVoice] Overlay DOM snapshot (${context}): ${JSON.stringify(snapshot)}`);
    })
    .catch((error: any) => {
      console.warn(`[MyVoice] Overlay DOM snapshot failed (${context}): ${error?.message || error}`);
    });
}

function getWaveformConfig(): WaveformConfigPayload {
  const settings = getVisualizationSettings();
  return {
    sensitivity: settings.sensitivity,
    debugOverlay: settings.debugOverlay,
  };
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  // Position on display nearest to cursor
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, width: screenWidth } = activeDisplay.workArea;

  overlayWindow = new BrowserWindow({
    width: OVERLAY_EXPANDED_WIDTH,
    height: OVERLAY_EXPANDED_HEIGHT,
    x: displayX + Math.round((screenWidth - OVERLAY_EXPANDED_WIDTH) / 2),
    y: OVERLAY_TOP_OFFSET,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'floating');

  // Keep mouse events on overlay controls (minimize/expand) instead of forwarding
  // clicks to underlying apps.
  overlayWindow.setIgnoreMouseEvents(false);

  // Visible on all macOS Spaces (desktops) including fullscreen
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Register IPC listeners only once to avoid leaking listeners
  if (!ipcRegistered) {
    ipcMain.on(IPC_CHANNELS.OVERLAY_READY, () => {
      overlayReady = true;
      console.log('[MyVoice] Overlay renderer ready');
      broadcastWaveformConfig();
      inspectOverlayDom('overlay:ready');
    });

    ipcMain.on(IPC_CHANNELS.OVERLAY_DISMISSED, () => {
      hideOverlay();
    });

    ipcMain.on(IPC_CHANNELS.OVERLAY_SET_SIZE, (_event, payload: OverlaySetSizePayload) => {
      if (!overlayWindow || overlayWindow.isDestroyed()) return;

      const cursorPoint = screen.getCursorScreenPoint();
      const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
      const { x: displayX, y: displayY, width: screenWidth } = activeDisplay.workArea;

      let newX: number;
      let newY: number;

      if (payload.position === 'center') {
        newX = displayX + Math.round((screenWidth - payload.width) / 2);
        newY = OVERLAY_TOP_OFFSET;
      } else {
        // top-left with margin
        newX = displayX + 20;
        newY = displayY + OVERLAY_TOP_OFFSET;
      }

      overlayWindow.setSize(payload.width, payload.height);
      overlayWindow.setPosition(newX, newY);
    });

    ipcRegistered = true;
  }

  overlayReady = false;
  overlayWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'));

  overlayWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    console.error(
      `[MyVoice] Overlay failed to load (${errorCode}): ${errorDescription} @ ${validatedURL}`
    );
  });

  overlayWindow.webContents.on('did-finish-load', () => {
    if (!overlayReady) {
      // Renderer may have loaded before OVERLAY_READY listener in earlier versions.
      // Keep this signal for startup diagnostics.
      console.warn('[MyVoice] Overlay did finish load but has not emitted overlay:ready yet');
    }
    inspectOverlayDom('did-finish-load');
  });

  overlayWindow.webContents.on('console-message', (...args: any[]) => {
    // Electron v40 emits deprecated args and also supports an event-object style.
    // Normalize both so renderer failures are always visible in main logs.
    let level = 0;
    let message = '';
    let line = 0;
    let sourceId = '';

    if (typeof args[1] === 'object' && args[1] !== null) {
      const data = args[1];
      level = Number(data.level ?? 0);
      message = String(data.message ?? '');
      line = Number(data.lineNumber ?? 0);
      sourceId = String(data.sourceId ?? '');
    } else {
      level = Number(args[1] ?? 0);
      message = String(args[2] ?? '');
      line = Number(args[3] ?? 0);
      sourceId = String(args[4] ?? '');
    }

    const important = level >= 2 || /error|failed|exception|uncaught/i.test(message);
    if (important && message) {
      console.warn(`[MyVoice][Overlay] ${message} (${sourceId}:${line})`);
    }
  });

  overlayWindow.webContents.on('render-process-gone', (_event, details) => {
    overlayReady = false;
    console.error(`[MyVoice] Overlay render process exited: ${details.reason}`);
  });

  overlayWindow.on('closed', () => {
    overlayReady = false;
    overlayWindow = null;
  });

  return overlayWindow;
}

export function showOverlay(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    createOverlayWindow();
  }
  audioLevelSendCount = 0;

  // Re-center on display nearest to cursor each time (always expanded)
  const cursorPoint = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x: displayX, width: screenWidth } = activeDisplay.workArea;

  overlayWindow!.setSize(OVERLAY_EXPANDED_WIDTH, OVERLAY_EXPANDED_HEIGHT);
  overlayWindow!.setPosition(
    displayX + Math.round((screenWidth - OVERLAY_EXPANDED_WIDTH) / 2),
    OVERLAY_TOP_OFFSET
  );
  overlayWindow!.showInactive();
  overlayWindow!.moveTop();
  // Send start immediately and once again on did-finish-load to avoid startup-race drops.
  overlayWindow!.webContents.send(IPC_CHANNELS.DICTATION_START);
  broadcastWaveformConfig();

  overlayWindow!.webContents.once('did-finish-load', () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.webContents.send(IPC_CHANNELS.DICTATION_START);
    broadcastWaveformConfig();
  });
}

export function hideOverlay(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}

export function sendToOverlay(channel: string, data?: any): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, data);

    if (channel === IPC_CHANNELS.DICTATION_AUDIO_LEVEL) {
      audioLevelSendCount += 1;
      if (audioLevelSendCount <= 5 || audioLevelSendCount % 25 === 0) {
        console.log(
          `[MyVoice] Sent overlay audio-level #${audioLevelSendCount} (overlayReady=${overlayReady})`
        );
      }
    }
  }
}

export function broadcastWaveformConfig(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.webContents.send(IPC_CHANNELS.WAVEFORM_CONFIG, getWaveformConfig());
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow;
}
