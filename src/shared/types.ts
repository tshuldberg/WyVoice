// IPC channel names
export const IPC_CHANNELS = {
  DICTATION_START: 'dictation:start',
  DICTATION_STOP: 'dictation:stop',
  DICTATION_CANCEL: 'dictation:cancel',
  DICTATION_AUDIO_LEVEL: 'dictation:audio-level',
  DICTATION_PARTIAL_TEXT: 'dictation:partial-text',
  DICTATION_ERROR: 'dictation:error',
  DICTATION_CANCEL_REQUEST: 'dictation:cancel-request',
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
  SETTINGS_REQUEST_STATE: 'settings:request-state',
  SETTINGS_STATE: 'settings:state',
  SETTINGS_SET_HOTKEY: 'settings:set-hotkey',
  SETTINGS_SET_AUTO_STOP: 'settings:set-auto-stop',
  SETTINGS_SET_SILENCE_THRESHOLD: 'settings:set-silence-threshold',
  SETTINGS_QUIT_APP: 'settings:quit-app',
  APP_GET_STATE: 'app:get-state',
  APP_SET_FORMATTING_MODE: 'app:set-formatting-mode',
  APP_SET_AI_ENHANCEMENT: 'app:set-ai-enhancement',
  APP_SET_AUTO_STOP_PAUSE: 'app:set-auto-stop-pause',
  APP_SET_WAVEFORM_SENSITIVITY: 'app:set-waveform-sensitivity',
  APP_SET_SILENCE_THRESHOLD: 'app:set-silence-threshold',
  APP_SET_WAVEFORM_DEBUG: 'app:set-waveform-debug',
  APP_GET_TODAY_LOG: 'app:get-today-log',
  APP_GET_LOG_BY_DATE: 'app:get-log-by-date',
  APP_LIST_LOG_DATES: 'app:list-log-dates',
  APP_EXPORT_LOG: 'app:export-log',
  APP_LOG_UPDATED: 'app:log-updated',
  APP_NAVIGATE: 'app:navigate',
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

export interface SettingsStatePayload {
  hotkey: string;
  autoStopPauseMs: number;
  silenceThreshold: number;
  hotkeyError?: string;
}
