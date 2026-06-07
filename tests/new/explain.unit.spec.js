// Tests for the --explain infrastructure (#1096): the explanation catalog,
// the explainKey-carrying typed errors, the assembler render seam, and the
// pcoffset9 tracer-bullet wiring. Parity: without explain mode, error output
// is unchanged.

const Assembler = require('../../src/core/assembler');
const {
  AssemblerError,
  InterpreterRuntimeError,
} = require('../../src/utils/errors');
const {
  getExplanation,
  formatExplanation,
} = require('../../src/utils/explanations');

describe('--explain catalog (explanations.js)', () => {
  test('getExplanation returns a {concept, correctForm} for a known key', () => {
    const e = getExplanation('PCOFFSET9_RANGE');
    expect(e).toBeTruthy();
    expect(typeof e.concept).toBe('string');
    expect(e.concept.length).toBeGreaterThan(0);
    expect(typeof e.correctForm).toBe('string');
    expect(e.correctForm.length).toBeGreaterThan(0);
  });

  test('getExplanation returns null for an unknown key and for null/undefined', () => {
    expect(getExplanation('NO_SUCH_KEY')).toBeNull();
    expect(getExplanation(null)).toBeNull();
    expect(getExplanation(undefined)).toBeNull();
  });

  test('formatExplanation renders an "explain:" block for a known key, null otherwise', () => {
    const block = formatExplanation('PCOFFSET9_RANGE');
    expect(block).toContain('explain:');
    expect(block).toContain(getExplanation('PCOFFSET9_RANGE').concept);
    expect(formatExplanation('NO_SUCH_KEY')).toBeNull();
    expect(formatExplanation(null)).toBeNull();
  });
});

describe('typed errors carry an optional explainKey (errors.js)', () => {
  test('single-arg construction is unchanged (back-compat)', () => {
    const e = new AssemblerError('Bad register');
    expect(e.message).toBe('Bad register');
    expect(e.name).toBe('AssemblerError');
    expect(e.explainKey).toBeUndefined();
  });

  test('an options object attaches explainKey', () => {
    const e = new InterpreterRuntimeError('Floating point exception', {
      explainKey: 'DIV_BY_ZERO',
    });
    expect(e.message).toBe('Floating point exception');
    expect(e.explainKey).toBe('DIV_BY_ZERO');
  });
});

describe('assembler render seam (formatAssemblerError)', () => {
  function freshAssembler() {
    const a = new Assembler();
    a.lineNum = 5;
    a.currentLine = '        br far';
    a.inputFileName = 't.a';
    return a;
  }

  test('appends the explain block after the message when explain mode is on', () => {
    const a = freshAssembler();
    a.explainModeOn = true;
    const out = a.formatAssemblerError('pcoffset9 out of range', null, 'PCOFFSET9_RANGE');
    expect(out).toContain('pcoffset9 out of range');
    expect(out).toContain('explain:');
    expect(out.indexOf('explain:')).toBeGreaterThan(out.indexOf('pcoffset9 out of range'));
  });

  test('emits NOTHING extra when explain mode is off (parity)', () => {
    const a = freshAssembler();
    a.explainModeOn = false;
    const out = a.formatAssemblerError('pcoffset9 out of range', null, 'PCOFFSET9_RANGE');
    expect(out).not.toContain('explain:');
  });

  test('emits nothing extra when there is no explainKey, even in explain mode', () => {
    const a = freshAssembler();
    a.explainModeOn = true;
    const out = a.formatAssemblerError('Some other error', null, null);
    expect(out).not.toContain('explain:');
  });

  test('composes with — does not duplicate — a suggestClosest "Did you mean?" suffix', () => {
    const a = freshAssembler();
    a.explainModeOn = true;
    const composed = a.formatAssemblerError(
      "Bad register. Did you mean 'r1'?",
      null,
      'PCOFFSET9_RANGE'
    );
    expect(composed).toContain("Did you mean 'r1'?");
    expect(composed).toContain('explain:');
    // explanation comes last, after the suggestion
    expect(composed.indexOf('explain:')).toBeGreaterThan(composed.indexOf("Did you mean 'r1'?"));
  });
});

describe('pcoffset9 tracer bullet — end to end through assembleSource', () => {
  // A branch whose target is forced far out of the signed-9-bit window.
  const OVERFLOW_SRC = [
    '        br far',
    '        .org 0x200',
    'far:    halt',
    '',
  ].join('\n');

  let errSpy;
  beforeEach(() => {
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function errOutput() {
    return errSpy.mock.calls.map((c) => c.join(' ')).join('\n');
  }

  test('with explain mode on, the pcoffset9 error prints the explain block', () => {
    const a = new Assembler();
    a.explainModeOn = true;
    expect(() => a.assembleSource(OVERFLOW_SRC, { inputFileName: 't.a' })).toThrow();
    const out = errOutput();
    expect(out).toContain('pcoffset9 out of range');
    expect(out).toContain('explain:');
  });

  test('with explain mode off, output is the bare error (no explain block)', () => {
    const a = new Assembler();
    a.explainModeOn = false;
    expect(() => a.assembleSource(OVERFLOW_SRC, { inputFileName: 't.a' })).toThrow();
    const out = errOutput();
    expect(out).toContain('pcoffset9 out of range');
    expect(out).not.toContain('explain:');
  });
});
