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

    test('returns waiting-for-input with partialOutput when program pauses at din', () => {
      const { binary } = assemble(PRE_POST_SRC);
      const result = run(binary, { pauseOnInput: true });
      expect(result.status).toBe('waiting-for-input');
      expect(result.partialOutput).toBe('0');
      expect(typeof result.resume).toBe('function');
    });

    test('resume() returns done with preResumeOutputLength equal to pre-pause output length', () => {
      const { binary } = assemble(PRE_POST_SRC);
      const paused = run(binary, { pauseOnInput: true });
      expect(paused.status).toBe('waiting-for-input');

      const done = paused.resume('77');
      expect(done.status).toBe('done');
      // din echoes "77\n", then dout outputs "77", then nl → full: "0" + "77\n77\n"
      expect(done.stdout).toBe('077\n77\n');
      // preResumeOutputLength marks where pre-pause output ("0") ends in the full string
      expect(done.preResumeOutputLength).toBe(1); // '0' has length 1
    });

    test('displayWithSeparator logic: injecting separator at preResumeOutputLength produces separated display', () => {
      const { binary } = assemble(PRE_POST_SRC);
      const paused = run(binary, { pauseOnInput: true });
      const done = paused.resume('77');

      const { stdout, preResumeOutputLength: preLen } = done;
      const pre  = stdout.slice(0, preLen);
      const post = stdout.slice(preLen);
      const display = (pre.endsWith('\n') ? pre : pre + '\n') + post;

      // '0' does not end with \n → separator injected before "77\n77\n"
      expect(display).toBe('0\n77\n77\n');
    });

    test('no separator injected when pre-pause output already ends with newline', () => {
      const { binary } = assemble(`
        mvi r0, 42
        dout r0
        nl
        din  r0
        dout r0
        nl
        halt
      `);
      const paused = run(binary, { pauseOnInput: true });
      expect(paused.status).toBe('waiting-for-input');
      expect(paused.partialOutput).toBe('42\n');

      const done = paused.resume('7');
      expect(done.status).toBe('done');
      // preLen = 3 ('42\n'), pre ends with \n → no extra separator needed
      expect(done.preResumeOutputLength).toBe(3);
      const pre  = done.stdout.slice(0, done.preResumeOutputLength);
      const post = done.stdout.slice(done.preResumeOutputLength);
      const display = (pre.endsWith('\n') ? pre : pre + '\n') + post;
      // pre already ends with \n so display = '42\n' + '7\n7\n' = '42\n7\n7\n'
      expect(display).toBe('42\n7\n7\n');
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

    test('returns preResumeOutputLength capturing the first input boundary', () => {
      const { binary } = assemble(PROMPT_SRC);
      const result = run(binary, { stdin: ['42'], pauseOnInput: true });

      expect(result.status).toBeUndefined();
      expect(result.exitCode).toBe(0);
      // "Enter: " (7) + din echo "42\n" + dout "42" + nl "\n"
      expect(result.stdout).toBe('Enter: 42\n42\n');
      // preResumeOutputLength marks end of "Enter: " (7 chars)
      expect(result.preResumeOutputLength).toBe(7);
    });

    test('displayWithSeparator applied to batch result injects separator before din echo', () => {
      const { binary } = assemble(PROMPT_SRC);
      const result = run(binary, { stdin: ['42'], pauseOnInput: true });

      const pre  = result.stdout.slice(0, result.preResumeOutputLength);
      const post = result.stdout.slice(result.preResumeOutputLength);
      const display = (pre.endsWith('\n') ? pre : pre + '\n') + post;
      // "Enter: " does not end with \n → separator injected before din echo
      expect(display).toBe('Enter: \n42\n42\n');
    });

    test('program with no input trap: no preResumeOutputLength on result', () => {
      const { binary } = assemble(`
        mvi r0, 99
        dout r0
        nl
        halt
      `);
      const result = run(binary, { stdin: ['42'], pauseOnInput: true });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('99\n');
      // No input trap → preResumeOutputLength is absent (undefined)
      expect(result.preResumeOutputLength).toBeUndefined();
    });
  });
});
