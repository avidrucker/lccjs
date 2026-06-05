'use strict';

const { assemble, run } = require('../../src/browser/api');

describe('browser API', () => {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    process.stdout.write.mockRestore();
  });

  const HELLO_SRC = `
    mov r0, 5
    dout r0
    nl
    halt
  `;

  describe('assemble()', () => {
    test('returns ok:true and a binary buffer on valid source', () => {
      const result = assemble(HELLO_SRC);
      expect(result.ok).toBe(true);
      expect(result.binary).toBeInstanceOf(Buffer);
      expect(result.binary.length).toBeGreaterThan(0);
    });

    test('returns ok:false and an errors string on invalid source', () => {
      const result = assemble('  notanopcode r0\n  halt\n');
      expect(result.ok).toBe(false);
      expect(typeof result.errors).toBe('string');
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('run()', () => {
    test('returns stdout and exitCode:0 on a successful program', () => {
      const { binary } = assemble(HELLO_SRC);
      const result = run(binary);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('5\n');
    });

    test('returns exitCode:1 on an invalid binary', () => {
      const bad = Buffer.from([0x41, 0x00]);
      const result = run(bad);
      expect(result.exitCode).toBe(1);
    });
  });

  describe('run() with pauseOnInput', () => {
    const PRE_POST_SRC = `
      mvi r0, 0
      dout r0
      din  r0
      dout r0
      nl
      halt
    `;
    // Expected values for PRE_POST_SRC tests
    const PRE_POST_INITIAL_OUTPUT = '0';        // dout of mvi r0,0 before din
    const PRE_POST_RESUME_INPUT   = '77';       // arbitrary resume value
    const PRE_POST_FULL_OUTPUT    = '077\n77\n'; // initial '0' + din echo + dout + nl
    const PRE_POST_PAUSE_LEN      = 1;          // PRE_POST_INITIAL_OUTPUT.length

    // Source whose pre-din output ends with \n — tests the newline-before-pause path
    const NEWLINE_PRE_SRC = `
      mvi r0, 42
      dout r0
      nl
      din  r0
      dout r0
      nl
      halt
    `;
    const NEWLINE_PRE_OUTPUT   = '42\n'; // dout+nl before din
    const NEWLINE_PAUSE_LEN    = 3;      // NEWLINE_PRE_OUTPUT.length
    const NEWLINE_RESUME_INPUT = '7';    // arbitrary resume value
    const NEWLINE_FULL_OUTPUT  = '42\n7\n7\n'; // pre + din echo + dout + nl

    test('returns waiting-for-input with partialOutput when program pauses at din', () => {
      const { binary } = assemble(PRE_POST_SRC);
      const result = run(binary, { pauseOnInput: true });
      expect(result.status).toBe('waiting-for-input');
      expect(result.partialOutput).toBe(PRE_POST_INITIAL_OUTPUT);
      expect(typeof result.resume).toBe('function');
    });

    test('resume() returns done with preResumeOutputLength equal to pre-pause output length', () => {
      const { binary } = assemble(PRE_POST_SRC);
      const paused = run(binary, { pauseOnInput: true });
      expect(paused.status).toBe('waiting-for-input');

      const done = paused.resume(PRE_POST_RESUME_INPUT);
      expect(done.status).toBe('done');
      expect(done.stdout).toBe(PRE_POST_FULL_OUTPUT);
      expect(done.preResumeOutputLength).toBe(PRE_POST_PAUSE_LEN);
    });

    test('displayWithSeparator logic: full output is returned as-is (no newline injected)', () => {
      const { binary } = assemble(PRE_POST_SRC);
      const paused = run(binary, { pauseOnInput: true });
      const done = paused.resume(PRE_POST_RESUME_INPUT);

      const { stdout, preResumeOutputLength: preLen } = done;
      const pre  = stdout.slice(0, preLen);
      const post = stdout.slice(preLen);
      const display = pre + post; // no injection — matches real terminal output

      expect(display).toBe(PRE_POST_FULL_OUTPUT);
    });

    test('output already ending with newline before din is also returned unchanged', () => {
      const { binary } = assemble(NEWLINE_PRE_SRC);
      const paused = run(binary, { pauseOnInput: true });
      expect(paused.status).toBe('waiting-for-input');
      expect(paused.partialOutput).toBe(NEWLINE_PRE_OUTPUT);

      const done = paused.resume(NEWLINE_RESUME_INPUT);
      expect(done.status).toBe('done');
      expect(done.preResumeOutputLength).toBe(NEWLINE_PAUSE_LEN);
      const pre  = done.stdout.slice(0, done.preResumeOutputLength);
      const post = done.stdout.slice(done.preResumeOutputLength);
      const display = pre + post; // no injection
      expect(display).toBe(NEWLINE_FULL_OUTPUT);
    });
  });

  describe('run() with pre-supplied stdin and pauseOnInput (batch mode)', () => {
    // Mirrors the repro in issue #801: prompt without trailing newline, then din
    const PROMPT_SRC = `
      lea  r0, prompt
      sout r0
      din  r1
      dout r1
      nl
      halt
prompt: .string "Enter: "
    `;
    const BATCH_DIN_INPUT    = '42';              // arbitrary din value for PROMPT_SRC tests
    const PROMPT_FULL_OUTPUT = 'Enter: 42\n42\n'; // prompt + din echo + dout + nl
    const PROMPT_LEN         = 7;                 // 'Enter: '.length (preResumeOutputLength)

    const NO_INPUT_OUTPUT = '99\n'; // dout+nl of static mvi r0,99 — no din trap

    test('returns preResumeOutputLength capturing the first input boundary', () => {
      const { binary } = assemble(PROMPT_SRC);
      const result = run(binary, { stdin: [BATCH_DIN_INPUT], pauseOnInput: true });

      expect(result.status).toBeUndefined();
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(PROMPT_FULL_OUTPUT);
      expect(result.preResumeOutputLength).toBe(PROMPT_LEN);
    });

    test('displayWithSeparator applied to batch result: prompt and din echo appear on same line', () => {
      const { binary } = assemble(PROMPT_SRC);
      const result = run(binary, { stdin: [BATCH_DIN_INPUT], pauseOnInput: true });

      const pre  = result.stdout.slice(0, result.preResumeOutputLength);
      const post = result.stdout.slice(result.preResumeOutputLength);
      const display = pre + post; // no injection — prompt stays inline with echo
      expect(display).toBe(PROMPT_FULL_OUTPUT);
    });

    test('program with no input trap: no preResumeOutputLength on result', () => {
      const { binary } = assemble(`
        mvi r0, 99
        dout r0
        nl
        halt
      `);
      const result = run(binary, { stdin: [BATCH_DIN_INPUT], pauseOnInput: true });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(NO_INPUT_OUTPUT);
      // No input trap → preResumeOutputLength is absent (undefined)
      expect(result.preResumeOutputLength).toBeUndefined();
    });
  });
});
