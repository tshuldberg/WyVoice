import { IPC_CHANNELS, SetupProgressPayload } from '../shared/types';
import { onIpc } from './ipc';

const statusEl = document.getElementById('status');
const progressEl = document.getElementById('bar') as HTMLProgressElement | null;

if (!statusEl || !progressEl) {
  throw new Error('Setup window is missing required DOM elements');
}

onIpc(
  IPC_CHANNELS.SETUP_PROGRESS,
  (data: unknown) => {
    const payload = data as SetupProgressPayload | undefined;
    if (!payload) return;
    statusEl.textContent = payload.message;
    if (payload.percent < 0) {
      progressEl.removeAttribute('value');
      return;
    }
    progressEl.value = payload.percent;
  }
);
