import { Tray, Menu, nativeImage, app, shell } from 'electron';
import path from 'path';
import {
  getFormattingSettings,
  setFormattingMode,
  setAiEnhancementEnabled,
} from './formatting-settings';
import {
  getVisualizationSettings,
  setWaveformSensitivity,
  setWaveformDebugOverlay,
} from './visualization-settings';
import { broadcastWaveformConfig } from './overlay-window';
import {
  AUTO_STOP_DELAY_OPTIONS_MS,
  formatAutoStopDelayLabel,
  getDictationSettings,
  setAutoStopPauseMs,
} from './dictation-settings';
import { getCurrentHotkey, openHotkeyRecorder, updateHotkey } from './hotkey-manager';
import { DEFAULT_WINDOWS_HOTKEY } from '../shared/constants';

let tray: Tray | null = null;
let isRecording = false;

function createMicIcon(active: boolean): Electron.NativeImage {
  const fileName = active ? 'tray-icon-active.png' : 'tray-icon.png';
  const iconPath = path.join(__dirname, '../../assets', fileName);

  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      return icon.resize({ width: 16, height: 16 });
    }
  } catch {
    // Fall through to generated icon.
  }

  const color = active ? 'FF3B30' : '8E8E93';
  const buf = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect x="11" y="4" width="10" height="16" rx="5" fill="#${color}"/>
      <path d="M8 16 a8 8 0 0 0 16 0" stroke="#${color}" stroke-width="2" fill="none"/>
      <line x1="16" y1="24" x2="16" y2="28" stroke="#${color}" stroke-width="2"/>
      <line x1="12" y1="28" x2="20" y2="28" stroke="#${color}" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    'utf8'
  );
  const dataUrl = `data:image/svg+xml;base64,${buf.toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl).resize({ width: 16, height: 16 });
}

export function createTray(): Tray {
  const icon = createMicIcon(false);
  tray = new Tray(icon);
  tray.setToolTip('WyVoice - Press hotkey to dictate');
  updateTrayMenu();
  return tray;
}

export function setRecordingState(recording: boolean): void {
  isRecording = recording;
  updateTrayMenu();

  if (tray) {
    tray.setImage(createMicIcon(recording));
    tray.setToolTip(recording ? 'WyVoice - Recording...' : 'WyVoice - Press hotkey to dictate');
  }
}

function updateTrayMenu(): void {
  if (!tray) return;

  const formatting = getFormattingSettings();
  const visualization = getVisualizationSettings();
  const dictation = getDictationSettings();
  const hotkey = getCurrentHotkey();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'WyVoice',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: isRecording ? 'Status: Recording...' : 'Status: Ready',
      enabled: false,
    },
    {
      label: `Hotkey: ${hotkey}`,
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Change Hotkey...',
      click: () => openHotkeyRecorder(),
    },
    {
      label: `Reset Hotkey (${DEFAULT_WINDOWS_HOTKEY})`,
      click: () => {
        updateHotkey(DEFAULT_WINDOWS_HOTKEY);
      },
    },
    { type: 'separator' },
    {
      label: 'Launch at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    {
      label: 'Text Formatting',
      submenu: [
        {
          label: 'Off (verbatim)',
          type: 'radio',
          checked: formatting.mode === 'off',
          click: () => {
            setFormattingMode('off');
            updateTrayMenu();
          },
        },
        {
          label: 'Basic (default)',
          type: 'radio',
          checked: formatting.mode === 'basic',
          click: () => {
            setFormattingMode('basic');
            updateTrayMenu();
          },
        },
        {
          label: 'Structured (more paragraph/list formatting)',
          type: 'radio',
          checked: formatting.mode === 'structured',
          click: () => {
            setFormattingMode('structured');
            updateTrayMenu();
          },
        },
        { type: 'separator' },
        {
          label: 'AI Enhancement (optional)',
          type: 'checkbox',
          checked: formatting.aiEnhancementEnabled,
          click: (menuItem) => {
            setAiEnhancementEnabled(menuItem.checked);
            updateTrayMenu();
          },
        },
      ],
    },
    {
      label: 'Auto-Stop Pause',
      submenu: AUTO_STOP_DELAY_OPTIONS_MS.map((delayMs) => ({
        label:
          delayMs === 3000
            ? `${formatAutoStopDelayLabel(delayMs)} (default)`
            : formatAutoStopDelayLabel(delayMs),
        type: 'radio',
        checked: dictation.autoStopPauseMs === delayMs,
        click: () => {
          setAutoStopPauseMs(delayMs);
          updateTrayMenu();
        },
      })),
    },
    {
      label: 'Waveform',
      submenu: [
        {
          label: 'Sensitivity: Low',
          type: 'radio',
          checked: visualization.sensitivity === 'low',
          click: () => {
            setWaveformSensitivity('low');
            broadcastWaveformConfig();
            updateTrayMenu();
          },
        },
        {
          label: 'Sensitivity: Balanced (default)',
          type: 'radio',
          checked: visualization.sensitivity === 'balanced',
          click: () => {
            setWaveformSensitivity('balanced');
            broadcastWaveformConfig();
            updateTrayMenu();
          },
        },
        {
          label: 'Sensitivity: High',
          type: 'radio',
          checked: visualization.sensitivity === 'high',
          click: () => {
            setWaveformSensitivity('high');
            broadcastWaveformConfig();
            updateTrayMenu();
          },
        },
        { type: 'separator' },
        {
          label: 'Show Waveform Debug Overlay',
          type: 'checkbox',
          checked: visualization.debugOverlay,
          click: (menuItem) => {
            setWaveformDebugOverlay(menuItem.checked);
            broadcastWaveformConfig();
            updateTrayMenu();
          },
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Buy Me a Coffee',
      click: () => shell.openExternal('https://buymeacoffee.com/TreyTre'),
    },
    { type: 'separator' },
    {
      label: 'Quit WyVoice',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
}

export function refreshTrayMenu(): void {
  updateTrayMenu();
}

export function getTray(): Tray | null {
  return tray;
}
