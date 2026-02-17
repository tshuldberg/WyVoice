import { IPC_CHANNELS } from '../shared/types';
import { onIpc, sendIpc } from './ipc';

const currentEl = document.getElementById('current') as HTMLSpanElement;
const capturedEl = document.getElementById('captured') as HTMLSpanElement;
const saveBtn = document.getElementById('save') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel') as HTMLButtonElement;

let currentHotkey = '';
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

window.addEventListener('keydown', (event) => {
  event.preventDefault();
  const accelerator = toAccelerator(event);
  if (!accelerator) return;

  capturedHotkey = accelerator;
  capturedEl.textContent = `Captured: ${capturedHotkey}`;
  saveBtn.disabled = false;
});

saveBtn.addEventListener('click', () => {
  if (!capturedHotkey) return;
  sendIpc(IPC_CHANNELS.HOTKEY_RECORDER_SAVE, capturedHotkey);
});

cancelBtn.addEventListener('click', () => {
  sendIpc(IPC_CHANNELS.HOTKEY_RECORDER_CANCEL);
});

onIpc(IPC_CHANNELS.HOTKEY_RECORDER_SET_CURRENT, (payload: unknown) => {
  const text = typeof payload === 'string' ? payload : currentHotkey;
  if (text.endsWith('|failed')) {
    capturedEl.textContent = `Could not register. Current remains: ${currentHotkey}`;
    saveBtn.disabled = true;
    return;
  }
  currentHotkey = text;
  currentEl.textContent = `Current: ${currentHotkey}`;
});
