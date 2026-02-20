import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface RecordingLogEntry {
  timestamp: string;
  date: string;
  transcript: string;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLogDirectory(): string | null {
  if (!app.isReady()) return null;
  return path.join(app.getPath('userData'), 'recording-logs');
}

function getLogFilePath(dateKey: string): string | null {
  const directory = getLogDirectory();
  if (!directory) return null;
  return path.join(directory, `${dateKey}.jsonl`);
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getTodayDateKey(): string {
  return toDateKey(new Date());
}

export function appendRecordingLog(transcript: string, date = new Date()): RecordingLogEntry | null {
  const normalized = transcript.trim();
  if (!normalized) return null;

  const dateKey = toDateKey(date);
  const filePath = getLogFilePath(dateKey);
  if (!filePath) return null;

  const entry: RecordingLogEntry = {
    timestamp: date.toISOString(),
    date: dateKey,
    transcript: normalized,
  };

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  } catch (error) {
    console.error('[WyVoice] Failed to append recording log:', error);
    return null;
  }
}

export function readRecordingLogByDate(dateKey: string): RecordingLogEntry[] {
  const filePath = getLogFilePath(dateKey);
  if (!filePath) return [];

  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    const entries: RecordingLogEntry[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as Partial<RecordingLogEntry>;
        if (
          parsed &&
          typeof parsed.timestamp === 'string' &&
          typeof parsed.date === 'string' &&
          typeof parsed.transcript === 'string'
        ) {
          entries.push({
            timestamp: parsed.timestamp,
            date: parsed.date,
            transcript: parsed.transcript,
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    return entries;
  } catch (error) {
    console.error('[WyVoice] Failed to read recording log:', error);
    return [];
  }
}

export function readTodayRecordingLog(): RecordingLogEntry[] {
  return readRecordingLogByDate(getTodayDateKey());
}

export function listRecordingLogDates(): string[] {
  const directory = getLogDirectory();
  if (!directory) return [];

  try {
    if (!fs.existsSync(directory)) return [];
    const dates = fs.readdirSync(directory)
      .map((fileName) => path.basename(fileName, path.extname(fileName)))
      .filter((dateKey) => isDateKey(dateKey))
      .sort((a, b) => b.localeCompare(a));
    return dates;
  } catch (error) {
    console.error('[WyVoice] Failed to list recording log dates:', error);
    return [];
  }
}
