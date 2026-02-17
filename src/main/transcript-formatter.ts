import type { FormattingMode } from './formatting-settings';

const ORDINAL_WORDS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
];

const PARAGRAPH_MARKERS = [
  'however',
  'meanwhile',
  'on the other hand',
  'in conclusion',
  'in summary',
  'next',
  'finally',
  'additionally',
  'moreover',
  'for example',
];

const SENTENCE_CONNECTORS = new Set([
  'however',
  'meanwhile',
  'next',
  'finally',
  'also',
  'additionally',
  'moreover',
  'instead',
  'then',
  'but',
  'so',
  'therefore',
]);

export function formatTranscript(rawTranscript: string, mode: FormattingMode): string {
  const trimmed = rawTranscript.trim();
  if (!trimmed) return '';
  if (mode === 'off') return trimmed;

  const normalized = normalizeSpacing(trimmed);
  const listFormatted = inferOrdinalList(normalized);
  if (listFormatted) return listFormatted;

  const sentenceNormalized = normalizeSentences(normalized);
  if (mode === 'structured') {
    return applyStructuredParagraphs(sentenceNormalized);
  }

  return applyBasicParagraphs(sentenceNormalized);
}

function normalizeSpacing(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.!?])([A-Za-z])/g, '$1 $2')
    .trim();
}

function normalizeSentences(text: string): string {
  const sentences = splitIntoSentences(text);
  const normalized = sentences.map((sentence) => ensureSentenceStyle(sentence));
  return normalized.join(' ');
}

function splitIntoSentences(text: string): string[] {
  const chunks = text.match(/[^.!?]+[.!?]*/g)?.map((chunk) => chunk.trim()).filter(Boolean) ?? [];
  if (chunks.length > 1) return chunks;

  // Fallback for long unpunctuated transcripts: split on commas or discourse connectors.
  if (!/[.!?]/.test(text) && text.includes(',')) {
    const commaSplit = text
      .split(',')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);
    if (commaSplit.length > 1) return commaSplit;
  }

  if (!/[.!?]/.test(text)) {
    const connectorSplit = splitUnpunctuatedByConnectors(text);
    if (connectorSplit.length > 1) return connectorSplit;
  }

  return [text.trim()];
}

function splitUnpunctuatedByConnectors(text: string): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length < 14) return [text.trim()];

  const segments: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    const cleaned = word.toLowerCase().replace(/[^a-z']/g, '');
    const shouldBreak = current.length >= 7 && SENTENCE_CONNECTORS.has(cleaned);

    if (shouldBreak) {
      segments.push(current.join(' '));
      current = [word];
      continue;
    }

    current.push(word);

    // Safety split for very long run-on phrases.
    if (current.length >= 20) {
      segments.push(current.join(' '));
      current = [];
    }
  }

  if (current.length > 0) {
    segments.push(current.join(' '));
  }

  return segments.filter(Boolean);
}

function ensureSentenceStyle(sentence: string, forceTerminal = false): string {
  const trimmed = sentence.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  const capitalized = capitalizeFirstLetter(trimmed).replace(/\bi\b/g, 'I');
  const hasTerminalPunctuation = /[.!?]$/.test(capitalized);
  if (hasTerminalPunctuation) return capitalized;

  const wordCount = capitalized.split(/\s+/).length;
  if (!forceTerminal && wordCount < 4) return capitalized;
  return `${capitalized}.`;
}

function capitalizeFirstLetter(text: string): string {
  const idx = text.search(/[A-Za-z]/);
  if (idx === -1) return text;
  return `${text.slice(0, idx)}${text[idx].toUpperCase()}${text.slice(idx + 1)}`;
}

function inferOrdinalList(text: string): string | null {
  const ordinalRegex = new RegExp(`\\b(${ORDINAL_WORDS.join('|')})\\b[\\s,:-]*`, 'gi');
  const matches = Array.from(text.matchAll(ordinalRegex));
  if (matches.length < 2) return null;

  const intro = text.slice(0, matches[0].index ?? 0).trim();
  const items: string[] = [];

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const start = (current.index ?? 0) + current[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const rawItem = text.slice(start, end).trim().replace(/^[,;:-\s]+/, '');
    if (!rawItem) continue;
    items.push(ensureSentenceStyle(rawItem, true));
  }

  if (items.length < 2) return null;

  const numbered = items.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
  if (!intro) return numbered;

  return `${ensureSentenceStyle(intro)}\n\n${numbered}`;
}

function applyBasicParagraphs(text: string): string {
  const sentences = splitIntoSentences(text).map((sentence) => ensureSentenceStyle(sentence));
  if (sentences.length < 4) return sentences.join(' ');

  const splitAt = Math.ceil(sentences.length / 2);
  const first = sentences.slice(0, splitAt).join(' ');
  const second = sentences.slice(splitAt).join(' ');
  return `${first}\n\n${second}`;
}

function applyStructuredParagraphs(text: string): string {
  const sentences = splitIntoSentences(text).map((sentence) => ensureSentenceStyle(sentence));
  if (sentences.length < 3) return sentences.join(' ');

  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const startsWithMarker = PARAGRAPH_MARKERS.some((marker) =>
      sentenceLower.startsWith(`${marker} `) || sentenceLower === marker
    );

    if (startsWithMarker && current.length > 0) {
      paragraphs.push(current.join(' '));
      current = [];
    }

    current.push(sentence);

    if (current.length >= 2) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs.join('\n\n');
}
