// IPC channel names
export const IPC_CHANNELS = {
  DICTATION_START: 'dictation:start',
  DICTATION_STOP: 'dictation:stop',
  DICTATION_CANCEL: 'dictation:cancel',
  DICTATION_AUDIO_LEVEL: 'dictation:audio-level',
  DICTATION_PARTIAL_TEXT: 'dictation:partial-text',
  DICTATION_ERROR: 'dictation:error',
  SETUP_PROGRESS: 'setup:progress',
  WAVEFORM_CONFIG: 'waveform:config',
  OVERLAY_READY: 'overlay:ready',
  OVERLAY_DISMISSED: 'overlay:dismissed',
  OVERLAY_SET_SIZE: 'overlay:set-size',
  AUDIO_CAPTURE_READY: 'audio-capture:ready',
  AUDIO_CAPTURE_START: 'audio-capture:start',
  AUDIO_CAPTURE_STOP: 'audio-capture:stop',
  AUDIO_CAPTURE_CANCEL: 'audio-capture:cancel',
  AUDIO_CAPTURE_LEVEL: 'audio-capture:level',
  AUDIO_CAPTURE_ERROR: 'audio-capture:error',
  AUDIO_CAPTURE_WAV: 'audio-capture:wav',
  HOTKEY_RECORDER_SAVE: 'hotkey-recorder:save',
  HOTKEY_RECORDER_CANCEL: 'hotkey-recorder:cancel',
  HOTKEY_RECORDER_SET_CURRENT: 'hotkey-recorder:set-current',
} as const;

// Dictation state machine
export type DictationState = 'idle' | 'recording' | 'stopping';

// Overlay state
export type OverlayMode = 'expanded' | 'minimized';
export type WaveformSensitivity = 'low' | 'balanced' | 'high';

// IPC payloads
export interface AudioLevelPayload {
  level: number; // 0.0 to 1.0
}

export interface PartialTextPayload {
  text: string;
}

export interface DictationStopPayload {
  transcript: string;
}

export interface DictationErrorPayload {
  message: string;
}

export interface OverlaySetSizePayload {
  width: number;
  height: number;
  position: 'center' | 'top-left';
}

export interface WaveformConfigPayload {
  sensitivity: WaveformSensitivity;
  debugOverlay: boolean;
}

export interface SetupProgressPayload {
  message: string;
  percent: number;
}
