const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const InterpreterPlus = require('../../src/plus/interpreterplus');

// Terminal restoration before a runtime-error print (#1032, child B of #1011).
//
// Child A (#1031) made the async loop *capture* runtime errors. But a program
// that ran `cursor` (hide) and/or `clear` leaves the cursor hidden and the
// screen cleared/repositioned, so the message printed wherever the cursor sat.
// handleRuntimeError now calls restoreTerminal() first: show the cursor, leave
// raw mode, and — when the screen was manipulated — drop to a fresh line so the
// message lands visibly below the program's output. All escape writes are
// guarded on process.stdout.isTTY so piped output is never polluted.

const SHOW_CURSOR = '[?25h';
const ESC = String.fromCharCode(27);

describe('interpreterplus terminal restoration on runtime error (#1032)', () => {
  let orig;
  let events;

  beforeEach(() => {
    events = [];
    orig = {
      stdinIsTTY: process.stdin.isTTY,
      stdoutIsTTY: process.stdout.isTTY,
      setRawMode: process.stdin.setRawMode,
      pause: process.stdin.pause,
    };
    // Pretend we're on a real terminal so the (otherwise isTTY-guarded) escape
    // writes actually run and can be observed.
    process.stdin.isTTY = true;
    process.stdout.isTTY = true;
    process.stdin.setRawMode = jest.fn();
    process.stdin.pause = jest.fn();

    jest.spyOn(process.stdout, 'write').mockImplementation((s) => {
      events.push({ kind: 'write', data: String(s) });
      return true;
    });
    jest.spyOn(console, 'error').mockImplementation((s) => {
      events.push({ kind: 'error', data: String(s) });
    });
    jest.spyOn(console, 'clear').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.stdin.isTTY = orig.stdinIsTTY;
    process.stdout.isTTY = orig.stdoutIsTTY;
    process.stdin.setRawMode = orig.setRawMode;
    process.stdin.pause = orig.pause;
  });

  test('shows the cursor and drops to a fresh line BEFORE printing, when the screen was manipulated', () => {
    const ip = new InterpreterPlus();
    ip.screenManipulated = true;

    // fatalExit throws under Jest (isTestMode) instead of process.exit.
    expect(() => ip.handleRuntimeError(new Error('Floating point exception')))
      .toThrow('Runtime Error: Floating point exception');

    const idxCursor = events.findIndex((e) => e.kind === 'write' && e.data.includes(SHOW_CURSOR));
    const idxNewline = events.findIndex((e) => e.kind === 'write' && e.data === '\n');
    const idxError = events.findIndex(
      (e) => e.kind === 'error' && e.data.includes('Runtime Error: Floating point exception'),
    );

    expect(idxCursor).toBeGreaterThanOrEqual(0);
    expect(idxNewline).toBeGreaterThanOrEqual(0);
    expect(idxError).toBeGreaterThanOrEqual(0);
    // Restoration must happen before the message lands.
    expect(idxCursor).toBeLessThan(idxError);
    expect(idxNewline).toBeLessThan(idxError);
    expect(process.stdin.setRawMode).toHaveBeenCalledWith(false);
  });

  test('shows the cursor but adds no spurious blank line when the screen was untouched', () => {
    const ip = new InterpreterPlus(); // screenManipulated defaults false

    expect(() => ip.handleRuntimeError(new Error('boom')))
      .toThrow('Runtime Error: boom');

    const newlineWrites = events.filter((e) => e.kind === 'write' && e.data === '\n');
    expect(newlineWrites).toHaveLength(0);
    const idxCursor = events.findIndex((e) => e.kind === 'write' && e.data.includes(SHOW_CURSOR));
    expect(idxCursor).toBeGreaterThanOrEqual(0);
  });

  test('executeClear marks the screen manipulated', () => {
    const ip = new InterpreterPlus();
    expect(ip.screenManipulated).toBe(false);
    ip.executeClear();
    expect(ip.screenManipulated).toBe(true);
  });

  test('executeToggleCursor (hide) marks the screen manipulated', () => {
    const ip = new InterpreterPlus();
    ip.r = new Array(8).fill(0);
    ip.dr = 0;
    ip.r[0] = 0; // 0 → hide
    expect(ip.screenManipulated).toBe(false);
    ip.executeToggleCursor();
    expect(ip.screenManipulated).toBe(true);
  });

  test('executeResetCursor marks the screen manipulated', () => {
    const ip = new InterpreterPlus();
    expect(ip.screenManipulated).toBe(false);
    ip.executeResetCursor();
    expect(ip.screenManipulated).toBe(true);
  });
});

// Off-TTY end-to-end: the #1032 repro (hide cursor + clear + divide-by-zero).
// With a non-TTY stdout every escape write is guarded off, so the message must
// still surface cleanly and NO escape byte may leak into the piped output.
const ASSEMBLER = path.resolve(__dirname, '../../src/plus/assemblerplus.js');
const INTERPRETER = path.resolve(__dirname, '../../src/plus/interpreterplus.js');

const CLEAR_CURSOR_DIVZERO_AP = `        .lccplus
        mov  r0, 0
        cursor r0
        clear
        mov  r1, 10
        mov  r2, 0
        div  r1, r2
        halt
`;

describe('interpreterplus runtime error after screen manipulation, off-TTY (#1032)', () => {
  test('prints a clean "Runtime Error", exit 1, and leaks no escape sequence into piped output', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-iplus-restore-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'clr.ap'), CLEAR_CURSOR_DIVZERO_AP);
      const asm = spawnSync(process.execPath, [ASSEMBLER, 'clr.ap'], {
        cwd: tmpDir, encoding: 'utf8', timeout: 10000,
      });
      expect(asm.status).toBe(0);
      expect(fs.existsSync(path.join(tmpDir, 'clr.ep'))).toBe(true);

      const run = spawnSync(process.execPath, [INTERPRETER, 'clr.ep'], {
        cwd: tmpDir, encoding: 'utf8', input: '', timeout: 10000,
      });

      expect(run.status).toBe(1);
      expect(run.stderr).toContain('Runtime Error: Floating point exception');
      expect(run.stdout).not.toContain(ESC);
      expect(run.stderr).not.toContain(ESC);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
