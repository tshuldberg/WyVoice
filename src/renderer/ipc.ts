import { IPC_CHANNELS } from '../shared/types';

type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

interface MyVoiceIpcBridge {
  send: (channel: IpcChannel, payload?: unknown) => void;
  on: (channel: IpcChannel, listener: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    myvoiceIpc?: MyVoiceIpcBridge;
  }
}

function bridge(): MyVoiceIpcBridge {
  if (!window.myvoiceIpc) {
    throw new Error('MyVoice IPC bridge is unavailable');
  }
  return window.myvoiceIpc;
}

export function sendIpc(channel: IpcChannel, payload?: unknown): void {
  bridge().send(channel, payload);
}

export function onIpc(
  channel: IpcChannel,
  listener: (...args: unknown[]) => void
): void {
  bridge().on(channel, listener);
}
