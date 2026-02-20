import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
type BridgeListener = (...args: unknown[]) => void;

const sendChannels = new Set<IpcChannel>([
  IPC_CHANNELS.OVERLAY_READY,
  IPC_CHANNELS.OVERLAY_DISMISSED,
  IPC_CHANNELS.OVERLAY_SET_SIZE,
  IPC_CHANNELS.DICTATION_CANCEL_REQUEST,
  IPC_CHANNELS.AUDIO_CAPTURE_READY,
  IPC_CHANNELS.AUDIO_CAPTURE_LEVEL,
  IPC_CHANNELS.AUDIO_CAPTURE_ERROR,
  IPC_CHANNELS.AUDIO_CAPTURE_WAV,
  IPC_CHANNELS.HOTKEY_RECORDER_SAVE,
  IPC_CHANNELS.HOTKEY_RECORDER_CANCEL,
  IPC_CHANNELS.SETTINGS_REQUEST_STATE,
  IPC_CHANNELS.SETTINGS_SET_HOTKEY,
  IPC_CHANNELS.SETTINGS_SET_AUTO_STOP,
  IPC_CHANNELS.SETTINGS_SET_SILENCE_THRESHOLD,
  IPC_CHANNELS.SETTINGS_QUIT_APP,
]);

const invokeChannels = new Set<IpcChannel>([
  IPC_CHANNELS.APP_GET_STATE,
  IPC_CHANNELS.APP_SET_FORMATTING_MODE,
  IPC_CHANNELS.APP_SET_AI_ENHANCEMENT,
  IPC_CHANNELS.APP_SET_AUTO_STOP_PAUSE,
  IPC_CHANNELS.APP_SET_SILENCE_THRESHOLD,
  IPC_CHANNELS.APP_SET_WAVEFORM_SENSITIVITY,
  IPC_CHANNELS.APP_SET_WAVEFORM_DEBUG,
  IPC_CHANNELS.APP_GET_TODAY_LOG,
  IPC_CHANNELS.APP_GET_LOG_BY_DATE,
  IPC_CHANNELS.APP_LIST_LOG_DATES,
  IPC_CHANNELS.APP_EXPORT_LOG,
]);

const receiveChannels = new Set<IpcChannel>([
  IPC_CHANNELS.DICTATION_START,
  IPC_CHANNELS.DICTATION_STOP,
  IPC_CHANNELS.DICTATION_CANCEL,
  IPC_CHANNELS.DICTATION_AUDIO_LEVEL,
  IPC_CHANNELS.DICTATION_PARTIAL_TEXT,
  IPC_CHANNELS.DICTATION_ERROR,
  IPC_CHANNELS.SETUP_PROGRESS,
  IPC_CHANNELS.WAVEFORM_CONFIG,
  IPC_CHANNELS.AUDIO_CAPTURE_START,
  IPC_CHANNELS.AUDIO_CAPTURE_STOP,
  IPC_CHANNELS.AUDIO_CAPTURE_CANCEL,
  IPC_CHANNELS.HOTKEY_RECORDER_SET_CURRENT,
  IPC_CHANNELS.SETTINGS_STATE,
  IPC_CHANNELS.APP_LOG_UPDATED,
  IPC_CHANNELS.APP_NAVIGATE,
]);

contextBridge.exposeInMainWorld('myvoiceIpc', {
  send(channel: IpcChannel, payload?: unknown): void {
    if (!sendChannels.has(channel)) {
      throw new Error(`Blocked IPC send channel: ${channel}`);
    }
    ipcRenderer.send(channel, payload);
  },
  invoke(channel: IpcChannel, payload?: unknown): Promise<unknown> {
    if (!invokeChannels.has(channel)) {
      throw new Error(`Blocked IPC invoke channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, payload);
  },
  on(channel: IpcChannel, listener: BridgeListener): void {
    if (!receiveChannels.has(channel)) {
      throw new Error(`Blocked IPC receive channel: ${channel}`);
    }
    ipcRenderer.on(channel, (_event: IpcRendererEvent, ...args: unknown[]) => {
      listener(...args);
    });
  },
});
