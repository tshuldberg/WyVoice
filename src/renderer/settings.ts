import { IPC_CHANNELS, SettingsStatePayload } from '../shared/types';
import { onIpc, sendIpc } from './ipc';

const currentEl = document.getElementById('hotkey-current') as HTMLSpanElement;
const captureBtn = document.getElementById('hotkey-capture') as HTMLButtonElement;
const useCtrlDoubleBtn = document.getElementById('hotkey-use-ctrl-double') as HTMLButtonElement;
const saveBtn = document.getElementById('hotkey-save') as HTMLButtonElement;
const capturedEl = document.getElementById('hotkey-captured') as HTMLParagraphElement;
const errorEl = document.getElementById('hotkey-error') as HTMLParagraphElement;
const delaySelect = document.getElementById('delay-select') as HTMLSelectElement;
const thresholdSelect = document.getElementById('threshold-select') as HTMLSelectElement;
const quitBtn = document.getElementById('quit') as HTMLButtonElement;

let captureMode = false;
let capturedHotkey = '';

function normalizeKey(event: KeyboardEvent): string | null {
  const key = event.key;
  if (!key) return null;

  const ignored = new Set(['Control', 'Shift', 'Alt', 'Meta']);
  if (ignored.has(key)) return null;

  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toUpperCase();
  if (key.startsWith('F') && /^[Ff]\d+$/.test(key)) return key.toUpperCase();

  const map: Record<string, string> = {
    Escape: 'Esc',
    Enter: 'Enter',
    Tab: 'Tab',
    Backspace: 'Backspace',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };

  return map[key] ?? key;
}

function toAccelerator(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Super');

  const key = normalizeKey(event);
  if (!key) return null;
  parts.push(key);
  return parts.join('+');
}

captureBtn.addEventListener('click', () => {
  captureMode = true;
  capturedHotkey = '';
  capturedEl.textContent = 'Listening... press your desired key combo.';
  errorEl.textContent = '';
  saveBtn.disabled = true;
});

useCtrlDoubleBtn.addEventListener('click', () => {
  sendIpc(IPC_CHANNELS.SETTINGS_SET_HOTKEY, 'Control+Control');
});

window.addEventListener('keydown', (event) => {
  if (!captureMode) return;

  event.preventDefault();
  const accelerator = toAccelerator(event);
  if (!accelerator) {
    capturedEl.textContent = 'For Ctrl+Ctrl use "Use Ctrl+Ctrl". Otherwise add a non-modifier key.';
    saveBtn.disabled = true;
    return;
  }

  capturedHotkey = accelerator;
  capturedEl.textContent = `Captured: ${capturedHotkey}`;
  saveBtn.disabled = false;
});

saveBtn.addEventListener('click', () => {
  if (!capturedHotkey) return;
  sendIpc(IPC_CHANNELS.SETTINGS_SET_HOTKEY, capturedHotkey);
});

delaySelect.addEventListener('change', () => {
  const value = Number(delaySelect.value);
  if (!Number.isFinite(value)) return;
  sendIpc(IPC_CHANNELS.SETTINGS_SET_AUTO_STOP, value);
});

thresholdSelect.addEventListener('change', () => {
  const value = Number(thresholdSelect.value);
  if (!Number.isFinite(value)) return;
  sendIpc(IPC_CHANNELS.SETTINGS_SET_SILENCE_THRESHOLD, value);
});

quitBtn.addEventListener('click', () => {
  sendIpc(IPC_CHANNELS.SETTINGS_QUIT_APP);
});

onIpc(IPC_CHANNELS.SETTINGS_STATE, (payload: unknown) => {
  const state = payload as SettingsStatePayload | undefined;
  if (!state) return;

  currentEl.textContent = `Current: ${state.hotkey}`;
  delaySelect.value = String(state.autoStopPauseMs);
  thresholdSelect.value = String(state.silenceThreshold);
  errorEl.textContent = state.hotkeyError ?? '';

  if (!state.hotkeyError) {
    captureMode = false;
    capturedHotkey = '';
    capturedEl.textContent = 'Press keys after clicking Capture.';
    saveBtn.disabled = true;
  }
});

sendIpc(IPC_CHANNELS.SETTINGS_REQUEST_STATE);
