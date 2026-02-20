import { IPC_CHANNELS } from '../shared/types';
import { onIpc, sendIpc } from './ipc';

let stream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let analyser: AnalyserNode | null = null;
let processor: ScriptProcessorNode | null = null;
let zeroGain: GainNode | null = null;
let levelTimer: ReturnType<typeof setInterval> | null = null;
let recording = false;
let chunks: Float32Array[] = [];
let selectedDeviceId = '';

function stopTracks(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

function clearTimer(): void {
  if (!levelTimer) return;
  clearInterval(levelTimer);
  levelTimer = null;
}

function teardownAudioGraph(): void {
  clearTimer();
  processor?.disconnect();
  analyser?.disconnect();
  sourceNode?.disconnect();
  zeroGain?.disconnect();
  processor = null;
  analyser = null;
  sourceNode = null;
  zeroGain = null;
}

function to16BitPcm(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, to16BitPcm(samples[i]), true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function mergeChunks(parts: Float32Array[]): Float32Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Float32Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function sendLevelSnapshot(): void {
  if (!analyser) return;
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);

  let sumSquares = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    sumSquares += value * value;
  }
  const rms = Math.sqrt(sumSquares / data.length);
  sendIpc(IPC_CHANNELS.AUDIO_CAPTURE_LEVEL, Math.min(1, Math.max(0, rms)));
}

async function startCapture(): Promise<void> {
  if (recording) return;

  try {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (selectedDeviceId) {
      audioConstraints.deviceId = { exact: selectedDeviceId };
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    audioContext = new AudioContext();
    sourceNode = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    processor = audioContext.createScriptProcessor(4096, 1, 1);
    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0;

    chunks = [];
    recording = true;

    processor.onaudioprocess = (event) => {
      if (!recording) return;
      const input = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
    };

    sourceNode.connect(analyser);
    analyser.connect(processor);
    processor.connect(zeroGain);
    zeroGain.connect(audioContext.destination);

    levelTimer = setInterval(sendLevelSnapshot, 50);
    sendIpc(IPC_CHANNELS.AUDIO_CAPTURE_READY);
  } catch (error) {
    sendIpc(IPC_CHANNELS.AUDIO_CAPTURE_ERROR, `Microphone unavailable: ${String(error)}`);
  }
}

async function stopCapture(sendWav: boolean): Promise<void> {
  if (!recording || !audioContext) {
    if (sendWav) sendIpc(IPC_CHANNELS.AUDIO_CAPTURE_WAV, new Uint8Array());
    return;
  }

  recording = false;
  teardownAudioGraph();
  stopTracks();

  const merged = mergeChunks(chunks);
  chunks = [];
  const wav = encodeWav(merged, audioContext.sampleRate);

  try {
    await audioContext.close();
  } catch {
    // ignore
  }
  audioContext = null;

  if (sendWav) {
    sendIpc(IPC_CHANNELS.AUDIO_CAPTURE_WAV, wav);
  }
}

onIpc(IPC_CHANNELS.AUDIO_CAPTURE_START, () => {
  startCapture();
});

onIpc(IPC_CHANNELS.AUDIO_CAPTURE_STOP, () => {
  stopCapture(true);
});

onIpc(IPC_CHANNELS.AUDIO_CAPTURE_CANCEL, () => {
  stopCapture(false);
});

onIpc(IPC_CHANNELS.AUDIO_CAPTURE_SET_DEVICE, (payload: unknown) => {
  selectedDeviceId = typeof payload === 'string' ? payload : '';
});
