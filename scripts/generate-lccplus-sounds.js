#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const AMPLITUDE = 0.32;
const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'sounds', 'lccplus');

const SOUNDS = [
  { file: 'ding.wav', frequencies: [880, 1320], durationMs: 180 },
  { file: 'doink.wav', frequencies: [330, 247], durationMs: 190 },
  { file: 'beep.wav', frequencies: [1047], durationMs: 140 },
  { file: 'ping.wav', frequencies: [660, 880], durationMs: 160 },
  { file: 'popsound.wav', frequencies: [523, 784], durationMs: 130 },
  { file: 'softbeep.wav', frequencies: [440, 330], durationMs: 200 },
  { file: 'bop.wav', frequencies: [392], durationMs: 120 },
];

function writeAscii(buffer, offset, text) {
  buffer.write(text, offset, text.length, 'ascii');
}

function makeWav({ frequencies, durationMs }) {
  const samples = Math.round(SAMPLE_RATE * durationMs / 1000);
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  writeAscii(buffer, 0, 'RIFF');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  writeAscii(buffer, 8, 'WAVE');
  writeAscii(buffer, 12, 'fmt ');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  writeAscii(buffer, 36, 'data');
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples; i += 1) {
    const t = i / SAMPLE_RATE;
    const fadeIn = Math.min(1, i / Math.round(SAMPLE_RATE * 0.012));
    const fadeOut = Math.min(1, (samples - i) / Math.round(SAMPLE_RATE * 0.045));
    const envelope = fadeIn * fadeOut;
    const mixed = frequencies.reduce((sum, freq) => {
      return sum + Math.sin(2 * Math.PI * freq * t);
    }, 0) / frequencies.length;
    const sample = Math.round(mixed * envelope * AMPLITUDE * 32767);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return buffer;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const spec of SOUNDS) {
  fs.writeFileSync(path.join(OUT_DIR, spec.file), makeWav(spec));
}

console.log(`Generated ${SOUNDS.length} LCC+ sound asset(s) in ${OUT_DIR}`);
