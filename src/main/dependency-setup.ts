import { app, BrowserWindow, dialog, shell } from 'electron';
import { execFile } from 'child_process';
import {
  accessSync,
  constants,
  cpSync,
  createWriteStream,
  mkdirSync,
  readdirSync,
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

const WHISPER_BIN_URL =
  'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip';

let setupWindow: BrowserWindow | null = null;

function fileExistsAndExecutable(candidate: string): boolean {
  try {
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findFileRecursive(root: string, fileName: string): string | null {
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(root, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
        return full;
      }
      if (entry.isDirectory()) {
        const found = findFileRecursive(full, fileName);
        if (found) return found;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function probeWhisperCli(): string | null {
  const localAppData = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(process.resourcesPath, 'bin', 'whisper-cli.exe'),
    path.join(app.getPath('userData'), 'bin', 'whisper-cli.exe'),
    path.join(process.cwd(), 'bin', 'whisper-cli.exe'),
    path.join(localAppData, 'Programs', 'WhisperCpp', 'whisper-cli.exe'),
  ];

  for (const candidate of candidates) {
    if (fileExistsAndExecutable(candidate)) {
      return candidate;
    }
  }

  try {
    const { execFileSync } = require('child_process');
    const result = String(execFileSync('where', ['whisper-cli.exe'], { encoding: 'utf8', timeout: 5000 }))
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .find((line: string) => line.length > 0);
    if (result && fileExistsAndExecutable(result)) return result;
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

function downloadToFile(url: string, destinationPath: string, progressLabel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      unlinkSync(destinationPath);
    } catch {
      // no-op
    }

    const request = httpsGet(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        request.destroy();
        downloadToFile(response.headers.location, destinationPath, progressLabel)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = createWriteStream(destinationPath);

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (totalBytes > 0) {
          const percent = Math.round((downloaded / totalBytes) * 100);
          const mb = (downloaded / 1024 / 1024).toFixed(0);
          const totalMb = (totalBytes / 1024 / 1024).toFixed(0);
          sendProgress(`${progressLabel} ${mb}/${totalMb} MB`, percent);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => resolve());
      });

      file.on('error', (error) => {
        reject(error);
      });
    });

    request.on('error', reject);
  });
}

function runPowerShell(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { timeout: 120000 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`PowerShell failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve();
      }
    );
  });
}

async function installWhisperCliFromRelease(): Promise<void> {
  const tempRoot = path.join(os.tmpdir(), `wyvoice-whisper-${Date.now()}`);
  const zipPath = path.join(tempRoot, 'whisper-bin-x64.zip');
  const extractPath = path.join(tempRoot, 'extract');
  const installDir = path.join(app.getPath('userData'), 'bin');

  mkdirSync(tempRoot, { recursive: true });
  mkdirSync(extractPath, { recursive: true });
  mkdirSync(installDir, { recursive: true });

  sendProgress('Downloading whisper.cpp binaries...', 0);
  await downloadToFile(WHISPER_BIN_URL, zipPath, 'Downloading whisper.cpp binaries...');

  sendProgress('Extracting whisper.cpp binaries...', -1);
  const escapedZip = zipPath.replace(/'/g, "''");
  const escapedExtract = extractPath.replace(/'/g, "''");
  await runPowerShell(`Expand-Archive -Path '${escapedZip}' -DestinationPath '${escapedExtract}' -Force`);

  const cliPath = findFileRecursive(extractPath, 'whisper-cli.exe');
  if (!cliPath) {
    throw new Error('whisper-cli.exe not found in downloaded archive');
  }

  const binRoot = path.dirname(cliPath);
  cpSync(binRoot, installDir, { recursive: true, force: true });
}

function probeModel(): boolean {
  try {
    const stat = statSync(MODEL_PATH);
    return stat.size > MODEL_MIN_SIZE;
  } catch {
    return false;
  }
}

async function downloadModel(): Promise<void> {
  mkdirSync(MODEL_DIR, { recursive: true });
  const tempPath = `${MODEL_PATH}.download`;
  await downloadToFile(MODEL_URL, tempPath, 'Downloading speech model...');
  renameSync(tempPath, MODEL_PATH);
}

export async function ensureWhisperReady(): Promise<WhisperPaths> {
  let whisperCli = probeWhisperCli();

  if (!whisperCli) {
    showSetupWindow();
    try {
      await installWhisperCliFromRelease();
    } catch {
      closeSetupWindow();
      const choice = dialog.showMessageBoxSync({
        type: 'error',
        title: 'WyVoice Setup',
        message:
          'Failed to install whisper.cpp automatically.\n\nUse "Open whisper.cpp Releases" and download the latest Windows x64 zip.',
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
      throw new Error('model download failed');
    }
  }

  closeSetupWindow();
  return { whisperCli, whisperModel: MODEL_PATH };
}
