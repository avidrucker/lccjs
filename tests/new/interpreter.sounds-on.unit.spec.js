'use strict';

/**
 * Unit tests for the core-LCC `--sounds-on` flag (#1504, ADR
 * docs/research/1502-sounds-in-core-lcc.md).
 *
 * The `sound` trap (TRAP_SOUND = 0xF8) is LCC+'s by origin, but with `--sounds-on`
 * it becomes a GATED core trap delegating to the shared SoundEngine (#1503).
 *   - Flag OFF (default): 0xF8 stays an unknown core trap → "Trap vector out of
 *     range" (byte-identical to today; no oracle-parity / golden-snapshot impact).
 *   - Flag ON: resolve the 7-slot table and play, or emit ASCII BEL when no audio
 *     player is on PATH.
 *
 * Playback is synchronous (spawnSync) — no async loop needed (ADR §Q2). Tests run
 * with PATH pointed at a non-existent dir so playback always falls back to BEL.
 */

const Interpreter = require('../../src/core/interpreter');
const soundEngine = require('../../src/core/soundEngine');
const { TRAP_SOUND, TRAP_SOUND_LITERAL_FLAG } = require('../../src/core/constants');

describe('core Interpreter — --sounds-on flag (TRAP_SOUND gating, #1504)', () => {
  let writeSpy;
  let savedPath;

  beforeEach(() => {
    savedPath = process.env.PATH;
    process.env.PATH = '/tmp/lccjs-no-sound-player'; // no audio player on PATH → BEL
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.PATH = savedPath;
    jest.restoreAllMocks();
  });

  function makeInterp(soundsOn) {
    const interp = new Interpreter();
    interp.soundsOn = soundsOn;
    interp.inputFileName = 'sound.e';
    return interp;
  }

  test('flag ON: TRAP_SOUND resolves a known slot and falls back to BEL when the sound file is unavailable', () => {
    // Point slot 1 (doink) at a nonexistent file so playback never runs — a
    // deterministic BEL, mirroring the LCC+ extension-traps test (avoids depending
    // on whether a real audio player happens to be installed).
    const slot = soundEngine.SOUND_SLOTS[1];
    const savedBundled = slot.bundled;
    const savedOsDefaults = slot.osDefaults;
    slot.bundled = '/tmp/lccjs-nonexistent-sound.wav';
    slot.osDefaults = [];
    try {
      const interp = makeInterp(true);
      interp.trapvec = TRAP_SOUND;
      interp.ir = TRAP_SOUND_LITERAL_FLAG; // literal-slot form → slotIndex = sr
      interp.sr = 1;
      interp.executeTRAP();
      expect(writeSpy).toHaveBeenCalledWith('\x07');
    } finally {
      slot.bundled = savedBundled;
      slot.osDefaults = savedOsDefaults;
    }
  });

  test('flag ON: an out-of-range sound slot is non-fatal → BEL (not a runtime error)', () => {
    const interp = makeInterp(true);
    interp.trapvec = TRAP_SOUND;
    interp.ir = TRAP_SOUND_LITERAL_FLAG;
    interp.sr = 99; // no such slot
    expect(() => interp.executeTRAP()).not.toThrow();
    expect(writeSpy).toHaveBeenCalledWith('\x07');
  });

  test('flag OFF (default): TRAP_SOUND is an unknown trap → "Trap vector out of range"', () => {
    const interp = makeInterp(false);
    interp.trapvec = TRAP_SOUND;
    interp.ir = TRAP_SOUND_LITERAL_FLAG;
    interp.sr = 1;
    expect(() => interp.executeTRAP()).toThrow('Trap vector out of range');
    expect(writeSpy).not.toHaveBeenCalledWith('\x07'); // no BEL, no sound
  });

  test('default constructor: soundsOn is off (falsy) by default', () => {
    const interp = new Interpreter();
    expect(interp.soundsOn).toBeFalsy();
  });

  test('constructor honors { soundsOn: true }', () => {
    const interp = new Interpreter({ soundsOn: true });
    expect(interp.soundsOn).toBe(true);
  });
});
