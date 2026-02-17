import { app, BrowserWindow, dialog, shell } from 'electron';
import { execFile } from 'child_process';
import {
  accessSync,
  constants,
  createWriteStream,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'fs';
import { get as httpsGet } from 'https';
import os from 'os';
import path from 'path';
import { IPC_CHANNELS } from '../shared/types';

export interface WhisperPaths {
  whisperCli: string;
  whisperModel: string;
}

const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
const MODEL_DIR = path.join(os.homedir(), '.cache', 'whisper');
const MODEL_FILE = 'ggml-base.en.bin';
const MODEL_PATH = path.join(MODEL_DIR, MODEL_FILE);
const MODEL_MIN_SIZE = 100 * 1024 * 1024;

let setupWindow: BrowserWindow | null = null;

function probeWhisperCli(): string | null {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'ggerganov.whisper.cpp_Microsoft.Winget.Source_8wekyb3d8bbwe', 'whisper-cli.exe'),
    path.join(localAppData, 'Programs', 'WhisperCpp', 'whisper-cli.exe'),
    path.join(process.cwd(), 'bin', 'whisper-cli.exe'),
  ];

  for (const candidate of candidates) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // continue
    }
  }

  try {
    const { execFileSync } = require('child_process');
    const result = String(execFileSync('where', ['whisper-cli.exe'], { encoding: 'utf8', timeout: 5000 }))
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .find((line: string) => line.length > 0);
    if (result) return result;
  } catch {
    // not found
  }

  return null;
}

function showSetupWindow(): BrowserWindow {
  if (setupWindow && !setupWindow.isDestroyed()) return setupWindow;

  setupWindow = new BrowserWindow({
    width: 420,
    height: 200,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  setupWindow.loadFile(path.join(__dirname, '../../src/renderer/setup.html'));
  setupWindow.once('ready-to-show', () => setupWindow?.show());
  setupWindow.on('closed', () => {
    setupWindow = null;
  });

  return setupWindow;
}

function sendProgress(message: string, percent: number): void {
  if (!setupWindow || setupWindow.isDestroyed()) return;
  setupWindow.webContents.send(IPC_CHANNELS.SETUP_PROGRESS, { message, percent });
}

function closeSetupWindow(): void {
  if (!setupWindow || setupWindow.isDestroyed()) return;
  setupWindow.close();
  setupWindow = null;
}

function installWhisperCliWithWinget(): Promise<void> {
  return new Promise((resolve, reject) => {
    sendProgress('Installing whisper.cpp with winget...', -1);

    execFile(
      'winget',
      [
        'install',
        '--id',
        'ggerganov.whisper.cpp',
        '--exact',
        '--silent',
        '--accept-package-agreements',
        '--accept-source-agreements',
      ],
      { timeout: 10 * 60 * 1000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`winget install failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve();
      }
    );
  });
}

function downloadModel(): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(MODEL_DIR, { recursive: true });
    const tempPath = `${MODEL_PATH}.download`;
    try {
      unlinkSync(tempPath);
    } catch {
      // no-op
    }

    sendProgress('Downloading speech model...', 0);

    const request = httpsGet(MODEL_URL, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        request.destroy();
        httpsGet(response.headers.location, (redirected) => {
          handleDownloadResponse(redirected, tempPath, resolve, reject);
        }).on('error', reject);
        return;
      }
      handleDownloadResponse(response, tempPath, resolve, reject);
    });

    request.on('error', reject);
  });
}

function handleDownloadResponse(
  response: import('http').IncomingMessage,
  tempPath: string,
  resolve: () => void,
  reject: (error: Error) => void
): void {
  if (response.statusCode !== 200) {
    reject(new Error(`Download failed: HTTP ${response.statusCode}`));
    return;
  }

  const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
  let downloaded = 0;
  const file = createWriteStream(tempPath);

  response.on('data', (chunk: Buffer) => {
    downloaded += chunk.length;
    if (totalBytes > 0) {
      const percent = Math.round((downloaded / totalBytes) * 100);
      const mb = (downloaded / 1024 / 1024).toFixed(0);
      const totalMb = (totalBytes / 1024 / 1024).toFixed(0);
      sendProgress(`Downloading speech model... ${mb}/${totalMb} MB`, percent);
    }
  });

  response.pipe(file);

  file.on('finish', () => {
    file.close(() => {
      try {
        renameSync(tempPath, MODEL_PATH);
        resolve();
      } catch (error) {
        reject(error as Error);
      }
    });
  });

  file.on('error', (error) => {
    try {
      unlinkSync(tempPath);
    } catch {
      // no-op
    }
    reject(error);
  });
}

function probeModel(): boolean {
  try {
    const stat = statSync(MODEL_PATH);
    return stat.size > MODEL_MIN_SIZE;
  } catch {
    return false;
  }
}

export async function ensureWhisperReady(): Promise<WhisperPaths> {
  let whisperCli = probeWhisperCli();

  if (!whisperCli) {
    showSetupWindow();
    try {
      await installWhisperCliWithWinget();
    } catch {
      closeSetupWindow();
      const choice = dialog.showMessageBoxSync({
        type: 'error',
        title: 'WyVoice Setup',
        message:
          'Failed to install whisper.cpp automatically.\n\nInstall it with:\nwinget install --id ggerganov.whisper.cpp --exact',
        buttons: ['Open whisper.cpp Releases', 'Quit'],
        defaultId: 0,
      });
      if (choice === 0) {
        shell.openExternal('https://github.com/ggml-org/whisper.cpp/releases');
      }
      app.quit();
      throw new Error('whisper-cli not installed');
    }

    whisperCli = probeWhisperCli();
    if (!whisperCli) {
      closeSetupWindow();
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'WyVoice Setup',
        message: 'whisper-cli.exe was not found after install.',
        buttons: ['Quit'],
      });
      app.quit();
      throw new Error('whisper-cli not found after install');
    }
  }

  if (!probeModel()) {
    if (!setupWindow) showSetupWindow();
    await downloadModel();

    if (!probeModel()) {
      closeSetupWindow();
      dialog.showMessageBoxSync({
        type: 'error',
        title: 'WyVoice Setup',
        message: 'Model download failed. Check your connection and retry.',
        buttons: ['Quit'],
      });
      app.quit();
      throw new Error('Model download failed');
    }
  }

  closeSetupWindow();
  return { whisperCli, whisperModel: MODEL_PATH };
}
