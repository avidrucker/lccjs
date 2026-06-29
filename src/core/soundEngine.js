'use strict';

// soundEngine.js — shared sound subsystem for LCC+ and (gated) core LCC.
//
// Extracted from src/plus/interpreterplus.js (#1503, per ADR
// docs/research/1502-sounds-in-core-lcc.md §Q4) so both interpreters consume one
// slot table + player set instead of copy-pasting it. Behavior-preserving: the
// table, the player probe order, the env/dotenv resolution, and the SYNCHRONOUS
// spawnSync playback are byte-for-byte the originals. Playback is synchronous —
// no async loop is required to use this from core LCC (ADR §Q2).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const BUNDLED_SOUND_DIR = path.resolve(__dirname, '../../assets/sounds/lccplus');

// Sound slot table — index = sound code used by the `sound` trap.
// Override any slot via its LCCPLUS_SOUND_* env var (absolute path to a
// .wav/.oga/.ogg file). When SOUND_FILES_FROM_SYSTEM=1, the osDefaults
// paths are tried before the bundled fallback; otherwise only the bundled
// WAV is used. See docs/lccplus-isa.md § Sounds.
const SOUND_SLOTS = [
  {
    name: 'ding',
    envVar: 'LCCPLUS_SOUND_DING',
    bundled: path.join(BUNDLED_SOUND_DIR, 'ding.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/complete.oga'],
  },
  {
    name: 'doink',
    envVar: 'LCCPLUS_SOUND_DOINK',
    bundled: path.join(BUNDLED_SOUND_DIR, 'doink.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/bell.oga'],
  },
  {
    name: 'beep',
    envVar: 'LCCPLUS_SOUND_BEEP',
    bundled: path.join(BUNDLED_SOUND_DIR, 'beep.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/phone-outgoing-calling.oga'],
  },
  {
    name: 'ping',
    envVar: 'LCCPLUS_SOUND_PING',
    bundled: path.join(BUNDLED_SOUND_DIR, 'ping.wav'),
    osDefaults: ['/usr/share/sounds/LinuxMint/stereo/system-ready.ogg'],
  },
  {
    name: 'popsound',
    envVar: 'LCCPLUS_SOUND_POPSOUND',
    bundled: path.join(BUNDLED_SOUND_DIR, 'popsound.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/dialog-information.oga'],
  },
  {
    name: 'softbeep',
    envVar: 'LCCPLUS_SOUND_SOFTBEEP',
    bundled: path.join(BUNDLED_SOUND_DIR, 'softbeep.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/dialog-warning.oga'],
  },
  {
    name: 'bop',
    envVar: 'LCCPLUS_SOUND_BOP',
    bundled: path.join(BUNDLED_SOUND_DIR, 'bop.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/message.oga'],
  },
];

const SOUND_PLAYERS = [
  { command: 'paplay', args: (filePath) => [filePath] },
  { command: 'canberra-gtk-play', args: (filePath) => ['--file', filePath] },
  { command: 'ffplay', args: (filePath) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath] },
  { command: 'aplay', args: (filePath) => [filePath] },
];

let dotenvLoaded = false;
const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

function loadDotenvOnce() {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  try {
    require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  } catch (_) {
    // dotenv is a local convenience; sound fallbacks still work without it.
  }
}

function soundFilesFromSystem() {
  const value = process.env.SOUND_FILES_FROM_SYSTEM;
  if (value == null) return false;
  return TRUE_ENV_VALUES.has(String(value).trim().toLowerCase());
}

function firstExistingSoundPath(slot) {
  const envPath = process.env[slot.envVar];
  const candidates = (soundFilesFromSystem()
    ? [envPath, ...(slot.osDefaults || []), slot.bundled]
    : [slot.bundled]).filter(Boolean);
  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch (_) {
      return false;
    }
  });
}

function playSoundFile(filePath) {
  for (const player of SOUND_PLAYERS) {
    const result = spawnSync(player.command, player.args(filePath), {
      stdio: 'ignore',
      timeout: 5000,
    });
    if (!result.error && result.status === 0) {
      return true;
    }
    if (result.error && result.error.code !== 'ENOENT') {
      continue;
    }
  }
  return false;
}

// Play the sound for `slotIndex`, or emit ASCII BEL (\x07) as a fallback when the
// slot is unknown or no audio player succeeds — the shared play-or-BEL decision both
// core LCC (--sounds-on, #1504) and LCC+ consume (ADR 1502 §Q4). `playFn` is
// injectable (default the synchronous spawnSync `playSoundFile`) so InterpreterPlus
// can route through its stubbable instance method (#1503 test seam) while core uses
// the default. Returns { played }. Synchronous — no async loop required (§Q2).
function playSlot(slotIndex, playFn = playSoundFile) {
  const slot = SOUND_SLOTS[slotIndex];
  if (!slot) {
    process.stdout.write('\x07');
    return { played: false };
  }
  const filePath = firstExistingSoundPath(slot);
  if (filePath && playFn(filePath)) {
    return { played: true };
  }
  process.stdout.write('\x07');
  return { played: false };
}

module.exports = {
  BUNDLED_SOUND_DIR,
  SOUND_SLOTS,
  SOUND_PLAYERS,
  loadDotenvOnce,
  soundFilesFromSystem,
  firstExistingSoundPath,
  playSoundFile,
  playSlot,
};
