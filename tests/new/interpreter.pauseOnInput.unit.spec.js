'use strict';

const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const { InputPauseSignal } = require('../../src/utils/errors');

// Assemble a source string and return the outputBytes buffer.
function asm(src) {
  const a = new Assembler();
  return a.assembleSource(src, { inputFileName: 'test.a' }).outputBytes;
}

describe('pauseOnInput option', () => {
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

  // ── pauseOnInput disabled (default) ──────────────────────────────────────

  test('without pauseOnInput, pre-supplied inputBuffer is consumed normally', () => {
    const binary = asm(`
      din r0
      dout r0
      nl
      halt
    `);
    const interp = new Interpreter();
    const result = interp.executeBuffer(binary, {
      inputFileName: 'test.e',
      inputBuffer: '42\n',
    });
    // DIN echoes simulated input ('42\n'), then dout outputs '42' and nl adds '\n'
    expect(result.output).toBe('42\n42\n');
  });

  // ── pauseOnInput: true — initial pause ───────────────────────────────────

  test('returns waiting-for-input sentinel when inputBuffer empty on first din', () => {
    const binary = asm(`
      din r0
      dout r0
      nl
      halt
    `);
    const interp = new Interpreter();
    const result = interp.executeBuffer(binary, {
      inputFileName: 'test.e',
      inputBuffer: '',
      pauseOnInput: true,
    });
    expect(result).toEqual({ status: 'waiting-for-input', trapType: 'din' });
  });

  test('returns waiting-for-input with trapType hin for hin trap', () => {
    const binary = asm(`
      hin r0
      halt
    `);
    const interp = new Interpreter();
    const result = interp.executeBuffer(binary, {
      inputFileName: 'test.e',
      inputBuffer: '',
      pauseOnInput: true,
    });
    expect(result).toEqual({ status: 'waiting-for-input', trapType: 'hin' });
  });

  test('returns waiting-for-input with trapType ain for ain trap', () => {
    const binary = asm(`
      ain r0
      halt
    `);
    const interp = new Interpreter();
    const result = interp.executeBuffer(binary, {
      inputFileName: 'test.e',
      inputBuffer: '',
      pauseOnInput: true,
    });
    expect(result).toEqual({ status: 'waiting-for-input', trapType: 'ain' });
  });

  test('returns waiting-for-input with trapType sin for sin trap', () => {
    const binary = asm(`
      sin r0
      halt
      buffer: .zero 16
    `);
    const interp = new Interpreter();
    const result = interp.executeBuffer(binary, {
      inputFileName: 'test.e',
      inputBuffer: '',
      pauseOnInput: true,
    });
    expect(result).toEqual({ status: 'waiting-for-input', trapType: 'sin' });
  });

  // ── resume() — single input ───────────────────────────────────────────────

  test('resume() with valid din input completes execution', () => {
    const binary = asm(`
      din r0
      dout r0
      nl
      halt
    `);
    const interp = new Interpreter();
    interp.executeBuffer(binary, { inputFileName: 'test.e', inputBuffer: '', pauseOnInput: true });

    const result = interp.resume('7\n');
    // DIN echoes '7\n', dout outputs '7', nl adds '\n'
    expect(result.output).toBe('7\n7\n');
    expect(result.pc).toBeGreaterThan(0);
  });

  test('resume() returns another waiting-for-input if a second din is reached with no more input', () => {
    const binary = asm(`
      din r0
      din r1
      add r0, r0, r1
      dout r0
      nl
      halt
    `);
    const interp = new Interpreter();

    // First pause — first din
    const pause1 = interp.executeBuffer(binary, { inputFileName: 'test.e', inputBuffer: '', pauseOnInput: true });
    expect(pause1.status).toBe('waiting-for-input');
    expect(pause1.trapType).toBe('din');

    // Resume with '3' — second din fires immediately, buffer empty → pause again
    const pause2 = interp.resume('3\n');
    expect(pause2.status).toBe('waiting-for-input');
    expect(pause2.trapType).toBe('din');

    // Resume with '4' — completes, output is 3+4=7
    const final = interp.resume('4\n');
    expect(final.output).toBe('3\n4\n7\n');
  });

  // ── resume() — output accumulates correctly ───────────────────────────────

  test('partial output before pause is preserved in interp.output', () => {
    const binary = asm(`
      mvi r0, 99
      dout r0
      nl
      din r1
      dout r1
      nl
      halt
    `);
    const interp = new Interpreter();
    const pause = interp.executeBuffer(binary, { inputFileName: 'test.e', inputBuffer: '', pauseOnInput: true });

    expect(pause.status).toBe('waiting-for-input');
    // The dout/nl before din should have already produced output
    expect(interp.output).toBe('99\n');

    const result = interp.resume('5\n');
    // DIN echoes '5\n', dout outputs '5', nl adds '\n' → appended to existing '99\n'
    expect(result.output).toBe('99\n5\n5\n');
  });

  // ── pauseOnInput: true with pre-supplied buffer drains normally ───────────

  test('with pauseOnInput and sufficient inputBuffer, executes without pausing', () => {
    const binary = asm(`
      din r0
      din r1
      add r0, r0, r1
      dout r0
      nl
      halt
    `);
    const interp = new Interpreter();
    const result = interp.executeBuffer(binary, {
      inputFileName: 'test.e',
      inputBuffer: '10\n20\n',
      pauseOnInput: true,
    });
    // Both inputs pre-supplied — no pause, runs to completion
    expect(result.output).toBe('10\n20\n30\n');
    expect(result.status).toBeUndefined();
  });

  // ── InputPauseSignal class ────────────────────────────────────────────────

  test('InputPauseSignal carries the trapType', () => {
    const sig = new InputPauseSignal('din');
    expect(sig.trapType).toBe('din');
    expect(sig instanceof InputPauseSignal).toBe(true);
  });
});
