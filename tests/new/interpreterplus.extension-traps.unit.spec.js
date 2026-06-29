'use strict';

/**
 * @file interpreterplus.extension-traps.unit.spec.js
 *
 * Unit tests for the LCC+ extension trap handlers that have no dedicated
 * coverage: sleep (TRAP_SLEEP), nbain (TRAP_NBAIN), cursor (TRAP_CURSOR),
 * millis (TRAP_MILLIS), resetc (TRAP_RESETC), sound (TRAP_SOUND), who.
 *
 * Test strategy: instantiate InterpreterPlus, set dr/sr and r[] directly (the
 * same approach used in interpreterplus.unit.spec.js for rand/srand), then call
 * the execute*() method and assert the resulting state.  No real file I/O and no
 * async game loop — startNonBlockingLoop is mocked wherever sleep would invoke it.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const InterpreterPlus = require('../../src/plus/interpreterplus');
const { SOUND_SLOTS } = InterpreterPlus;
const {
  TRAP_SLEEP, TRAP_NBAIN, TRAP_CURSOR, TRAP_MILLIS, TRAP_RESETC,
  TRAP_SOUND, TRAP_SOUND_LITERAL_FLAG, TRAP_WHO, TRAP_BOOP,
} = require('../../src/plus/constants');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIp() {
  const ip = new InterpreterPlus();
  ip.r = new Array(8).fill(0);
  return ip;
}

/**
 * Temporarily set process.stdout.isTTY to `true` for the duration of `fn`,
 * then restore the original descriptor.  Used to test the TTY-gated branches
 * of executeToggleCursor and executeResetCursor without actually being on a TTY.
 * (Guards check stdout.isTTY because the escape sequences target stdout.)
 */
function withFakeTTY(fn) {
  const orig = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  try {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true, configurable: true, writable: true,
    });
    fn();
  } finally {
    if (orig) {
      Object.defineProperty(process.stdout, 'isTTY', orig);
    } else {
      // isTTY was not an own property (inherits undefined) — remove the override
      delete process.stdout.isTTY;
    }
  }
}

// ---------------------------------------------------------------------------
// sleep (trap 16)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeSleep (TRAP_SLEEP = 0x${TRAP_SLEEP.toString(16).toUpperCase()})`, () => {
  afterEach(() => jest.useRealTimers());

  test('immediately sets running=false and calls startNonBlockingLoop after the delay', () => {
    jest.useFakeTimers();
    const ip = makeIp();
    ip.sr = 0;
    ip.r[0] = 200; // 200 ms
    ip.running = true;
    ip.startNonBlockingLoop = jest.fn();

    ip.executeSleep();

    expect(ip.running).toBe(false);
    expect(ip.startNonBlockingLoop).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);

    expect(ip.running).toBe(true);
    expect(ip.startNonBlockingLoop).toHaveBeenCalledTimes(1);
  });

  test('0 ms sleep: running goes false then immediately true on timer flush', () => {
    jest.useFakeTimers();
    const ip = makeIp();
    ip.sr = 1;
    ip.r[1] = 0;
    ip.running = true;
    ip.startNonBlockingLoop = jest.fn();

    ip.executeSleep();
    expect(ip.running).toBe(false);

    jest.runAllTimers();

    expect(ip.running).toBe(true);
    expect(ip.startNonBlockingLoop).toHaveBeenCalledTimes(1);
  });

  test('does not call startNonBlockingLoop if running was set back to true before timeout fires', () => {
    // Simulates an external resume between executeSleep and the timer callback.
    jest.useFakeTimers();
    const ip = makeIp();
    ip.sr = 0;
    ip.r[0] = 100;
    ip.running = true;
    ip.startNonBlockingLoop = jest.fn();

    ip.executeSleep();
    ip.running = true; // externally re-set before timer fires

    jest.advanceTimersByTime(100);

    // The callback guards: `if (!this.running)` — already true, so no restart
    expect(ip.startNonBlockingLoop).not.toHaveBeenCalled();
  });

  test('reads sleep duration from the sr register, not a hardcoded index', () => {
    jest.useFakeTimers();
    const ip = makeIp();
    ip.sr = 3; // non-zero sr
    ip.r[3] = 50;
    ip.running = true;
    ip.startNonBlockingLoop = jest.fn();

    ip.executeSleep();

    jest.advanceTimersByTime(49);
    expect(ip.startNonBlockingLoop).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(ip.startNonBlockingLoop).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// nbain — non-blocking ASCII input (trap 17)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeNonBlockingAsciiInput / nbain (TRAP_NBAIN = 0x${TRAP_NBAIN.toString(16).toUpperCase()})`, () => {
  test('empty keyQueue stores 0 in the dr register', () => {
    const ip = makeIp();
    ip.dr = 2;
    ip.keyQueue = [];

    ip.executeNonBlockingAsciiInput();

    expect(ip.r[2]).toBe(0);
  });

  test('non-empty keyQueue stores the charCode of the first key in the dr register', () => {
    const ip = makeIp();
    ip.dr = 0;
    ip.keyQueue = ['A', 'B', 'C'];

    ip.executeNonBlockingAsciiInput();

    expect(ip.r[0]).toBe('A'.charCodeAt(0)); // 65
  });

  test('non-empty keyQueue removes the consumed key (queue shrinks by 1)', () => {
    const ip = makeIp();
    ip.dr = 0;
    ip.keyQueue = ['x', 'y'];

    ip.executeNonBlockingAsciiInput();

    expect(ip.keyQueue).toHaveLength(1);
    expect(ip.keyQueue[0]).toBe('y');
  });

  test('keys are consumed in FIFO order across multiple calls', () => {
    const ip = makeIp();
    ip.dr = 0;
    ip.keyQueue = ['a', 'b', 'c'];

    ip.executeNonBlockingAsciiInput();
    expect(ip.r[0]).toBe('a'.charCodeAt(0));

    ip.executeNonBlockingAsciiInput();
    expect(ip.r[0]).toBe('b'.charCodeAt(0));

    ip.executeNonBlockingAsciiInput();
    expect(ip.r[0]).toBe('c'.charCodeAt(0));

    ip.executeNonBlockingAsciiInput();
    expect(ip.r[0]).toBe(0); // queue exhausted
  });

  test('special characters: newline, space, escape return correct charCodes', () => {
    const ip = makeIp();
    ip.dr = 1;

    for (const ch of ['\n', ' ', '\x1B']) {
      ip.keyQueue = [ch];
      ip.executeNonBlockingAsciiInput();
      expect(ip.r[1]).toBe(ch.charCodeAt(0));
    }
  });
});

// ---------------------------------------------------------------------------
// cursor — toggle terminal cursor visibility (trap 18)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeToggleCursor / cursor (TRAP_CURSOR = 0x${TRAP_CURSOR.toString(16).toUpperCase()})`, () => {
  let writeSpy;
  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });
  afterEach(() => writeSpy.mockRestore());

  test('off-TTY: no stdout.write calls regardless of register value', () => {
    // Jest runs with stdout piped, so stdout.isTTY is undefined/falsy by default.
    const ip = makeIp();
    ip.dr = 0;
    ip.r[0] = 0; // hide request

    ip.executeToggleCursor();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('on-TTY, dr register = 0: writes cursor-hide escape sequence', () => {
    const ip = makeIp();
    ip.dr = 0;
    ip.r[0] = 0;

    withFakeTTY(() => ip.executeToggleCursor());

    expect(writeSpy).toHaveBeenCalledWith('[?25l');
  });

  test('on-TTY, dr register != 0: writes cursor-show escape sequence', () => {
    const ip = makeIp();
    ip.dr = 0;
    ip.r[0] = 1;

    withFakeTTY(() => ip.executeToggleCursor());

    expect(writeSpy).toHaveBeenCalledWith('[?25h');
  });

  test('on-TTY: any non-zero dr value triggers show (not just 1)', () => {
    const ip = makeIp();
    ip.dr = 0;
    ip.r[0] = 255;

    withFakeTTY(() => ip.executeToggleCursor());

    expect(writeSpy).toHaveBeenCalledWith('[?25h');
  });
});

// ---------------------------------------------------------------------------
// millis (trap 20)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeMillis (TRAP_MILLIS = 0x${TRAP_MILLIS.toString(16).toUpperCase()})`, () => {
  test('stores a value in [0, 999] in the dr register', () => {
    const ip = makeIp();
    ip.dr = 4;

    ip.executeMillis();

    expect(ip.r[4]).toBeGreaterThanOrEqual(0);
    expect(ip.r[4]).toBeLessThanOrEqual(999);
    expect(Number.isInteger(ip.r[4])).toBe(true);
  });

  test('value equals Date.now() % 1000 (pinned with Date.now mock)', () => {
    const ip = makeIp();
    ip.dr = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);

    ip.executeMillis();

    expect(ip.r[0]).toBe(789); // 123456789 % 1000
    nowSpy.mockRestore();
  });

  test('result is written to the dr register, not a hardcoded index', () => {
    const ip = makeIp();
    ip.dr = 7;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(500);

    ip.executeMillis();

    expect(ip.r[7]).toBe(500);
    nowSpy.mockRestore();
  });

  test('milliseconds at boundary values: 0 and 999', () => {
    const ip = makeIp();
    ip.dr = 0;

    jest.spyOn(Date, 'now').mockReturnValueOnce(1000); // 1000 % 1000 = 0
    ip.executeMillis();
    expect(ip.r[0]).toBe(0);
    jest.restoreAllMocks();

    jest.spyOn(Date, 'now').mockReturnValueOnce(999);
    ip.executeMillis();
    expect(ip.r[0]).toBe(999);
    jest.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// resetc — reset cursor to home position (trap 21)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeResetCursor / resetc (TRAP_RESETC = 0x${TRAP_RESETC.toString(16).toUpperCase()})`, () => {
  let writeSpy;
  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });
  afterEach(() => writeSpy.mockRestore());

  test('off-TTY: no stdout.write calls (returns immediately)', () => {
    const ip = makeIp();

    ip.executeResetCursor();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('on-TTY: writes the ANSI cursor-home escape sequence', () => {
    const ip = makeIp();

    withFakeTTY(() => ip.executeResetCursor());

    expect(writeSpy).toHaveBeenCalledWith('[H');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// sound (TRAP_SOUND = 0xF8)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeSound / sound (TRAP_SOUND = 0x${TRAP_SOUND.toString(16).toUpperCase()})`, () => {
  const originalEnv = { ...process.env };
  const originalPath = process.env.PATH;
  const originalBundled = SOUND_SLOTS.map((slot) => slot.bundled);
  const originalOsDefaults = SOUND_SLOTS.map((slot) => slot.osDefaults.slice());
  let writeSpy;

  beforeEach(() => {
    delete process.env.SOUND_FILES_FROM_SYSTEM;
    for (const slot of SOUND_SLOTS) {
      delete process.env[slot.envVar];
      slot.bundled = null;
      slot.osDefaults = [];
    }
    process.env.PATH = '/tmp/lccjs-no-sound-player';
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterEach(() => {
    writeSpy.mockRestore();
    delete process.env.SOUND_FILES_FROM_SYSTEM;
    for (const slot of SOUND_SLOTS) {
      delete process.env[slot.envVar];
    }
    Object.assign(process.env, originalEnv);
    process.env.PATH = originalPath;
    SOUND_SLOTS.forEach((slot, index) => {
      slot.bundled = originalBundled[index];
      slot.osDefaults = originalOsDefaults[index].slice();
    });
  });

  test.each([
    [0, 'ding'],
    [1, 'doink'],
    [2, 'beep'],
    [3, 'ping'],
    [4, 'popsound'],
    [5, 'softbeep'],
    [6, 'bop'],
  ])('literal slot %i (%s) falls back to ASCII BEL when no file is configured', (slotIndex) => {
    const ip = makeIp();
    ip.ir = TRAP_SOUND_LITERAL_FLAG;
    ip.sr = slotIndex;

    ip.executeSound();

    expect(writeSpy).toHaveBeenCalledWith('\x07');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  test('register form reads the slot number from the register value', () => {
    const ip = makeIp();
    ip.ir = 0;
    ip.sr = 2;
    ip.r[2] = 4;

    ip.executeSound();

    expect(writeSpy).toHaveBeenCalledWith('\x07');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  test('env-configured sound path is used when SOUND_FILES_FROM_SYSTEM=1', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-sound-'));
    try {
      const fakeSound = path.join(tmpDir, 'ding.oga');
      fs.writeFileSync(fakeSound, 'not-real-audio');

      process.env.SOUND_FILES_FROM_SYSTEM = '1';
      process.env.LCCPLUS_SOUND_DING = fakeSound;

      const ip = makeIp();
      ip.playSoundFile = jest.fn().mockReturnValue(true);
      ip.ir = TRAP_SOUND_LITERAL_FLAG;
      ip.sr = 0;
      ip.executeSound();

      expect(ip.playSoundFile).toHaveBeenCalledWith(fakeSound);
      expect(writeSpy).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('bundled project sound is used by default even when an env sound path exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-sound-'));
    try {
      const fakeSound = path.join(tmpDir, 'ding.oga');
      fs.writeFileSync(fakeSound, 'not-real-audio');
      process.env.LCCPLUS_SOUND_DING = fakeSound;

      const ip = makeIp();
      ip.playSoundFile = jest.fn().mockReturnValue(true);
      ip.ir = TRAP_SOUND_LITERAL_FLAG;
      ip.sr = 0;
      SOUND_SLOTS[0].bundled = originalBundled[0];

      ip.executeSound();

      expect(ip.playSoundFile).toHaveBeenCalledWith(originalBundled[0]);
      expect(writeSpy).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('SOUND_FILES_FROM_SYSTEM=0 forces bundled project sound', () => {
    const ip = makeIp();
    ip.playSoundFile = jest.fn().mockReturnValue(true);
    ip.ir = TRAP_SOUND_LITERAL_FLAG;
    ip.sr = 0;
    process.env.SOUND_FILES_FROM_SYSTEM = '0';
    SOUND_SLOTS[0].bundled = originalBundled[0];

    ip.executeSound();

    expect(ip.playSoundFile).toHaveBeenCalledWith(originalBundled[0]);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('system mode falls back to bundled sound when local files are absent', () => {
    const ip = makeIp();
    ip.playSoundFile = jest.fn().mockReturnValue(true);
    ip.ir = TRAP_SOUND_LITERAL_FLAG;
    ip.sr = 0;
    process.env.SOUND_FILES_FROM_SYSTEM = 'true';
    process.env.LCCPLUS_SOUND_DING = '/tmp/lccjs-missing-custom-ding.wav';
    SOUND_SLOTS[0].bundled = originalBundled[0];

    ip.executeSound();

    expect(ip.playSoundFile).toHaveBeenCalledWith(originalBundled[0]);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('bundled project sounds exist and are WAV files', () => {
    for (const filePath of originalBundled) {
      const header = fs.readFileSync(filePath).subarray(0, 12).toString('ascii');
      expect(header.slice(0, 4)).toBe('RIFF');
      expect(header.slice(8, 12)).toBe('WAVE');
    }
  });

  test('unknown sound slots are non-fatal and fall back to BEL', () => {
    const ip = makeIp();
    ip.ir = 0;
    ip.sr = 7;
    ip.r[7] = 9;

    ip.executeSound();

    expect(writeSpy).toHaveBeenCalledWith('\x07');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// who / whodis (TRAP_WHO = 0xF5)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeWho / who+whodis (TRAP_WHO = 0x${TRAP_WHO.toString(16).toUpperCase()})`, () => {
  const fs = require('fs');
  let writeSpy;
  let readSpy;

  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });
  afterEach(() => {
    writeSpy.mockRestore();
    if (readSpy) readSpy.mockRestore();
  });

  test('writes name.nnn contents to stdout with no trailing newline', () => {
    readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('Doe, Jane M\n');
    const ip = makeIp();
    ip.executeWho();
    expect(writeSpy).toHaveBeenCalledWith('Doe, Jane M');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  test('trims leading/trailing whitespace from name.nnn', () => {
    readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('  Smith, Bob  \r\n');
    const ip = makeIp();
    ip.executeWho();
    expect(writeSpy).toHaveBeenCalledWith('Smith, Bob');
  });

  test('absent name.nnn: writes nothing (silent empty string)', () => {
    readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });
    const ip = makeIp();
    ip.executeWho();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('takes no register operand — does not read dr or sr', () => {
    readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue('Test, User\n');
    const ip = makeIp();
    ip.r.fill(0xFFFF);
    ip.dr = 0;
    ip.sr = 7;
    ip.executeWho();
    expect(ip.r[0]).toBe(0xFFFF);
    expect(ip.r[7]).toBe(0xFFFF);
  });
});

// ---------------------------------------------------------------------------
// boop (TRAP_BOOP = 0xF6) — logging/testing trap, distinct from `bop` (sound)
// ---------------------------------------------------------------------------

describe(`InterpreterPlus — executeBoop / boop (TRAP_BOOP = 0x${TRAP_BOOP.toString(16).toUpperCase()})`, () => {
  let writeSpy;
  let savedBoopEnv;
  beforeEach(() => {
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    // Isolate from any LCCPLUS_BOOP_MESSAGE in the ambient env / loaded .env (#1511).
    savedBoopEnv = process.env.LCCPLUS_BOOP_MESSAGE;
    delete process.env.LCCPLUS_BOOP_MESSAGE;
  });
  afterEach(() => {
    writeSpy.mockRestore();
    if (savedBoopEnv === undefined) delete process.env.LCCPLUS_BOOP_MESSAGE;
    else process.env.LCCPLUS_BOOP_MESSAGE = savedBoopEnv;
  });

  test('default (LCCPLUS_BOOP_MESSAGE unset): writes exactly "Boop!\\n" in a single write', () => {
    const ip = makeIp();
    ip.executeBoop();
    expect(writeSpy).toHaveBeenCalledWith('Boop!\n');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  test('does not emit ASCII BEL — boop is a text trap, not a sound', () => {
    const ip = makeIp();
    ip.executeBoop();
    expect(writeSpy).not.toHaveBeenCalledWith('\x07');
  });

  test('takes no register operand — does not read dr or sr', () => {
    const ip = makeIp();
    ip.r.fill(0xFFFF);
    ip.dr = 3;
    ip.sr = 5;
    ip.executeBoop();
    expect(ip.r[3]).toBe(0xFFFF);
    expect(ip.r[5]).toBe(0xFFFF);
  });

  test('message comes from bopMessage() — executeBoop delegates to the seam', () => {
    const ip = makeIp();
    ip.bopMessage = () => 'CUSTOM\n';
    ip.executeBoop();
    expect(writeSpy).toHaveBeenCalledWith('CUSTOM\n');
  });

  test('LCCPLUS_BOOP_MESSAGE override: writes the custom text plus a trailing newline', () => {
    process.env.LCCPLUS_BOOP_MESSAGE = 'Beep';
    const ip = makeIp();
    ip.executeBoop();
    expect(writeSpy).toHaveBeenCalledWith('Beep\n');
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });

  test('LCCPLUS_BOOP_MESSAGE with spaces/punctuation is preserved verbatim (+ newline)', () => {
    process.env.LCCPLUS_BOOP_MESSAGE = 'boop received, ok!';
    const ip = makeIp();
    ip.executeBoop();
    expect(writeSpy).toHaveBeenCalledWith('boop received, ok!\n');
  });

  test('empty LCCPLUS_BOOP_MESSAGE falls back to the default "Boop!\\n"', () => {
    process.env.LCCPLUS_BOOP_MESSAGE = '';
    const ip = makeIp();
    ip.executeBoop();
    expect(writeSpy).toHaveBeenCalledWith('Boop!\n');
  });
});
