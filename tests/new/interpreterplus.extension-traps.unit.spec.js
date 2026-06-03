'use strict';

/**
 * @file interpreterplus.extension-traps.unit.spec.js
 *
 * Unit tests for the five LCC+ extension trap handlers that have no dedicated
 * coverage: sleep (16), nbain (17), cursor (18), millis (20), resetc (21).
 *
 * Test strategy: instantiate InterpreterPlus, set dr/sr and r[] directly (the
 * same approach used in interpreterplus.unit.spec.js for rand/srand), then call
 * the execute*() method and assert the resulting state.  No real file I/O and no
 * async game loop — startNonBlockingLoop is mocked wherever sleep would invoke it.
 */

const InterpreterPlus = require('../../src/plus/interpreterplus');

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

describe('InterpreterPlus — executeSleep (trap 16)', () => {
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

describe('InterpreterPlus — executeNonBlockingAsciiInput / nbain (trap 17)', () => {
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

describe('InterpreterPlus — executeToggleCursor / cursor (trap 18)', () => {
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

describe('InterpreterPlus — executeMillis (trap 20)', () => {
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

describe('InterpreterPlus — executeResetCursor / resetc (trap 21)', () => {
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
