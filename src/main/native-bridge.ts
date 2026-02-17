import { execFile } from 'child_process';
import { cancelAudioCapture, startAudioCapture, stopAudioCapture } from './audio-capture';

export function speechRequestAuth(): Promise<boolean> {
  return Promise.resolve(true);
}

export function speechIsAvailable(): boolean {
  return true;
}

export function recordStart(
  onAudioLevel: (level: number) => void,
  onError: (error: string) => void
): void {
  startAudioCapture(onAudioLevel, onError).catch((error) => {
    onError(`Failed to start capture: ${String(error)}`);
  });
}

export async function recordStop(): Promise<string | null> {
  return stopAudioCapture();
}

export function speechStop(): void {
  cancelAudioCapture();
}

export function keyboardType(_text: string, _delayMs?: number): void {
  // Kept for API compatibility; WyVoice uses clipboard + paste.
}

export function keyboardPaste(): void {
  if (process.platform !== 'win32') return;

  execFile(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ws = New-Object -ComObject WScript.Shell; Start-Sleep -Milliseconds 40; $ws.SendKeys("^v")',
    ],
    () => {
      // No-op on callback; paste is best-effort.
    }
  );
}

export function keyboardCheckPermission(): boolean {
  return true;
}

export function keyboardRequestPermission(): void {
  // No-op on Windows.
}
