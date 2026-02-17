import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTranscript } from '../dist/main/transcript-formatter.js';

test('off mode preserves verbatim transcript except trim', () => {
  const input = '  hello world  ';
  assert.equal(formatTranscript(input, 'off'), 'hello world');
});

test('basic mode infers numbered list from ordinal speech patterns', () => {
  const input = 'here are three reasons first it is private second it is free forever third it works offline';
  const output = formatTranscript(input, 'basic');

  assert.match(output, /1\. It is private\./);
  assert.match(output, /2\. It is free forever\./);
  assert.match(output, /3\. It works offline\./);
});

test('basic mode normalizes casing and adds punctuation for long transcript', () => {
  const input = 'today i tested the app however it was hard to read';
  const output = formatTranscript(input, 'basic');

  assert.match(output, /^Today I tested the app however it was hard to read\.$/);
});

test('structured mode keeps paragraph separators when connector split occurs', () => {
  const input =
    'today i tested the app and captured notes however the output was hard to read so i want better structure';
  const output = formatTranscript(input, 'structured');

  assert.match(output, /\n\n/);
});
