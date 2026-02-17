import { clipboard } from 'electron';
import { execFile } from 'child_process';
import { DictationState, IPC_CHANNELS } from '../shared/types';
import { showOverlay, hideOverlay, sendToOverlay } from './overlay-window';
import { setRecordingState } from './tray';
import * as native from './native-bridge';
import type { WhisperPaths } from './dependency-setup';
import { getFormattingSettings } from './formatting-settings';
import { formatTranscript } from './transcript-formatter';
import { getDictationSettings, formatAutoStopDelayLabel } from './dictation-settings';

let state: DictationState = 'idle';
let silenceTimer: ReturnType<typeof setTimeout> | null = null;
let lastAudioAboveThreshold = 0;
let isFinishing = false;
let permissionsChecked = false;
let audioLevelCount = 0;
const SILENCE_AUDIO_THRESHOLD = 0.02;

let whisperCli: string | null = null;
let whisperModel: string | null = null;

export function initDictation(paths: WhisperPaths): void {
  whisperCli = paths.whisperCli;
  whisperModel = paths.whisperModel;
  console.log('[WyVoice] Dictation initialized:', { whisperCli, whisperModel });
}

export function getDictationState(): DictationState {
  return state;
}

export function toggleDictation(): void {
  if (state === 'idle') {
    startDictation();
  } else if (state === 'recording') {
    stopDictation();
  }
}

export function cancelDictation(): void {
  if (state !== 'recording' && state !== 'stopping') return;

  clearSilenceTimer();
  native.speechStop();
  sendToOverlay(IPC_CHANNELS.DICTATION_CANCEL);
  resetState();
}

async function checkPermissions(): Promise<boolean> {
  if (permissionsChecked) return true;

  const micAuthorized = await native.speechRequestAuth();
  if (!micAuthorized) {
    console.error('[WyVoice] Microphone permission denied');
    return false;
  }

  permissionsChecked = true;
  return true;
}

async function startDictation(): Promise<void> {
  if (!whisperCli || !whisperModel) {
    console.error('[WyVoice] Dictation not initialized - call initDictation() first');
    return;
  }

  const permitted = await checkPermissions();
  if (!permitted) return;

  state = 'recording';
  isFinishing = false;
  setRecordingState(true);
  showOverlay();
  lastAudioAboveThreshold = Date.now();
  audioLevelCount = 0;

  console.log('[WyVoice] Starting audio recording for Whisper');
  console.log(
    `[WyVoice] Auto-stop pause: ${formatAutoStopDelayLabel(getDictationSettings().autoStopPauseMs)}`
  );

  native.recordStart(
    (level: number) => {
      audioLevelCount++;
      if (audioLevelCount <= 5 || (level > SILENCE_AUDIO_THRESHOLD && audioLevelCount % 10 === 0)) {
        console.log(`[WyVoice] Audio level #${audioLevelCount}: ${level.toFixed(4)}`);
      }

      sendToOverlay(IPC_CHANNELS.DICTATION_AUDIO_LEVEL, level);

      if (level > SILENCE_AUDIO_THRESHOLD) {
        lastAudioAboveThreshold = Date.now();
      }

      checkSilenceTimeout();
    },
    (error: string) => {
      console.error('[WyVoice] Recording error:', error);
      clearSilenceTimer();
      native.speechStop();
      sendToOverlay(IPC_CHANNELS.DICTATION_ERROR, error);
      resetState();
    }
  );

  startSilenceTimer();
}

function stopDictation(): void {
  if (state !== 'recording') return;

  state = 'stopping';
  clearSilenceTimer();

  console.log('[WyVoice] Stopping recording...');
  sendToOverlay(IPC_CHANNELS.DICTATION_PARTIAL_TEXT, 'Transcribing...');

  native.recordStop().then((wavPath) => {
    if (!wavPath) {
      console.log('[WyVoice] No audio recorded');
      resetState();
      return;
    }

    console.log('[WyVoice] WAV saved:', wavPath);
    transcribeWithWhisper(wavPath);
  }).catch((error) => {
    console.error('[WyVoice] Failed to stop recording:', error);
    sendToOverlay(IPC_CHANNELS.DICTATION_ERROR, 'Recording stop failed.');
    resetState();
  });
}

function transcribeWithWhisper(wavPath: string): void {
  if (!whisperCli || !whisperModel) {
    sendToOverlay(IPC_CHANNELS.DICTATION_ERROR, 'Whisper is not configured.');
    resetState();
    return;
  }

  execFile(
    whisperCli,
    ['-m', whisperModel, '--no-timestamps', '-l', 'en', '-f', wavPath],
    { timeout: 30000 },
    (error, stdout, stderr) => {
      if (error) {
        console.error('[WyVoice] Whisper error:', error.message);
        if (stderr) console.error('[WyVoice] Whisper stderr:', stderr);
        sendToOverlay(
          IPC_CHANNELS.DICTATION_ERROR,
          'Transcription failed. Check whisper-cli installation.'
        );
        resetState();
        return;
      }

      const transcript = stdout.trim();
      if (transcript.length === 0) {
        sendToOverlay(IPC_CHANNELS.DICTATION_ERROR, 'No speech detected.');
        resetState();
        return;
      }

      const formatting = getFormattingSettings();
      const formatted = formatTranscript(transcript, formatting.mode);
      finishDictation(formatted || transcript);
    }
  );
}

function finishDictation(transcript: string): void {
  if (isFinishing) return;
  isFinishing = true;

  clearSilenceTimer();
  sendToOverlay(IPC_CHANNELS.DICTATION_STOP, transcript);

  const originalClipboard = clipboard.readText();
  clipboard.writeText(transcript);

  setTimeout(() => {
    native.keyboardPaste();
    setTimeout(() => {
      clipboard.writeText(originalClipboard);
      resetState();
    }, 300);
  }, 150);
}

function resetState(): void {
  state = 'idle';
  isFinishing = false;
  setRecordingState(false);
  clearSilenceTimer();

  setTimeout(() => {
    hideOverlay();
  }, 250);
}

function startSilenceTimer(): void {
  clearSilenceTimer();
  silenceTimer = setInterval(() => {
    checkSilenceTimeout();
  }, 100);
}

function clearSilenceTimer(): void {
  if (silenceTimer) {
    clearInterval(silenceTimer);
    silenceTimer = null;
  }
}

function checkSilenceTimeout(): void {
  if (state !== 'recording') return;

  const silenceDuration = Date.now() - lastAudioAboveThreshold;
  const autoStopPauseMs = getDictationSettings().autoStopPauseMs;
  if (silenceDuration >= autoStopPauseMs) {
    stopDictation();
  }
}
