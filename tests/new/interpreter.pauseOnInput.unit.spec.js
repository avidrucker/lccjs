'use strict';

const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');
const { InputPauseSignal } = require('../../src/utils/errors');

// Assemble a source string and return the outputBytes buffer.
function asm(src) {
  const a = new Assembler();
  return a.assembleSource(src, { inputFileName: 'test.a' }).outputBytes;
}

// Named constants for test inputs/outputs — prevents magic literals in expect() calls
const DIN_BASIC_INPUT  = '42\n';
const DIN_BASIC_OUTPUT = '42\n42\n'; // DIN echoes input, then DOUT+NL prints value

const RESUME_SINGLE_INPUT  = '7\n';
const RESUME_SINGLE_OUTPUT = '7\n7\n'; // DIN echoes, then DOUT+NL

// Partial-output-before-pause test: mvi r0, 99 → dout r0 → nl → pause at din
const PARTIAL_PRE_VALUE    = 99;
const PARTIAL_PRE_OUTPUT   = '99\n'; // dout+nl before din
const PARTIAL_RESUME_INPUT = '5\n';
const PARTIAL_FULL_OUTPUT  = '99\n5\n5\n'; // pre + din echo + dout + nl

// Multi-input (add) test: din a; din b; add r0,r0,r1; dout r0; nl
const MULTI_INPUT_A   = 10;
const MULTI_INPUT_B   = 20;
const MULTI_INPUT_BUF = '10\n20\n';   // both inputs pre-supplied
const MULTI_OUTPUT    = '10\n20\n30\n'; // echo a + echo b + dout of sum

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
      inputBuffer: DIN_BASIC_INPUT,
    });
    expect(result.output).toBe(DIN_BASIC_OUTPUT);
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

    const result = interp.resume(RESUME_SINGLE_INPUT);
    expect(result.output).toBe(RESUME_SINGLE_OUTPUT);
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
      mvi r0, ${PARTIAL_PRE_VALUE}
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
    expect(interp.output).toBe(PARTIAL_PRE_OUTPUT);

    const result = interp.resume(PARTIAL_RESUME_INPUT);
    expect(result.output).toBe(PARTIAL_FULL_OUTPUT);
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
      inputBuffer: MULTI_INPUT_BUF, // ${MULTI_INPUT_A}\n${MULTI_INPUT_B}\n
      pauseOnInput: true,
    });
    // Both inputs pre-supplied — no pause, runs to completion
    expect(result.output).toBe(MULTI_OUTPUT);
    expect(result.status).toBeUndefined();
  });

  // ── InputPauseSignal class ────────────────────────────────────────────────

  test('InputPauseSignal carries the trapType', () => {
    const sig = new InputPauseSignal('din');
    expect(sig.trapType).toBe('din');
    expect(sig instanceof InputPauseSignal).toBe(true);
  });
});
