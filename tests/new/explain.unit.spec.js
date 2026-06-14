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

describe('encoding/range explain content (#1097)', () => {
  // One row per wired throw site: a minimal source that forces the specific
  // out-of-range error, plus the explainKey whose concept text must appear.
  const CASES = [
    { name: 'imm5 (add immediate)', key: 'IMM5_RANGE',
      message: 'imm5 out of range',
      src: '        add r0, r1, 99\n        halt\n' },
    { name: 'imm9 (mov immediate)', key: 'IMM9_RANGE',
      message: 'mov immediate value out of range',
      src: '        mov r0, 9999\n        halt\n' },
    { name: 'imm9 (mvi immediate)', key: 'IMM9_RANGE',
      message: 'mvi immediate out of range',
      src: '        mvi r0, 9999\n        halt\n' },
    { name: 'pcoffset11 (bl target)', key: 'PCOFFSET11_RANGE',
      message: 'pcoffset11 out of range',
      src: '        bl far\n        .org 0x800\nfar:    halt\n' },
  ];

  test.each(CASES)('$name: catalog has a {concept, correctForm} entry', ({ key }) => {
    const e = getExplanation(key);
    expect(e).toBeTruthy();
    expect(e.concept.length).toBeGreaterThan(0);
    expect(e.correctForm.length).toBeGreaterThan(0);
  });

  describe('end to end through assembleSource', () => {
    let errSpy;
    beforeEach(() => {
      errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());
    const errOut = () => errSpy.mock.calls.map((c) => c.join(' ')).join('\n');

    test.each(CASES)(
      '$name: --explain renders the message AND its explain block',
      ({ key, message, src }) => {
        const a = new Assembler();
        a.explainModeOn = true;
        expect(() => a.assembleSource(src, { inputFileName: 't.a' })).toThrow();
        const out = errOut();
        expect(out).toContain(message);
        expect(out).toContain('explain:');
        expect(out).toContain(getExplanation(key).concept);
      }
    );

    test.each(CASES)(
      '$name: without --explain, the message is bare (no explain block)',
      ({ message, src }) => {
        const a = new Assembler();
        a.explainModeOn = false;
        expect(() => a.assembleSource(src, { inputFileName: 't.a' })).toThrow();
        const out = errOut();
        expect(out).toContain(message);
        expect(out).not.toContain('explain:');
      }
    );
  });
});

describe('register + label/symbol explain content (#1098)', () => {
  // One row per error class wired in #1098. Triggers verified empirically against
  // the assembler (e.g. `add r9,...` fails as "Invalid operation" before reaching
  // the register check — `not r0, r9` is the clean Bad-register path).
  const CASES = [
    { name: 'Bad register (not sr)', key: 'REGISTER',
      message: 'Bad register',
      src: '        not r0, r9\n        halt\n' },
    { name: 'Missing register (not, one operand)', key: 'REGISTER',
      message: 'Missing register',
      src: '        not r0\n        halt\n' },
    { name: 'Bad label (malformed definition)', key: 'BAD_LABEL',
      message: 'Bad label',
      src: '9bad:   halt\n' },
    { name: 'Undefined label (branch to unknown)', key: 'UNDEFINED_LABEL',
      message: 'Undefined label',
      src: '        br nowhere\n        halt\n' },
    { name: 'Duplicate label (defined twice)', key: 'DUPLICATE_LABEL',
      message: 'Duplicate label',
      src: 'x:      halt\nx:      halt\n' },
  ];

  test.each(CASES)('$name: catalog has a {concept, correctForm} entry', ({ key }) => {
    const e = getExplanation(key);
    expect(e).toBeTruthy();
    expect(e.concept.length).toBeGreaterThan(0);
    expect(e.correctForm.length).toBeGreaterThan(0);
  });

  describe('end to end through assembleSource', () => {
    let errSpy;
    beforeEach(() => {
      errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());
    const errOut = () => errSpy.mock.calls.map((c) => c.join(' ')).join('\n');

    test.each(CASES)(
      '$name: --explain renders the message AND its explain block',
      ({ key, message, src }) => {
        const a = new Assembler();
        a.explainModeOn = true;
        expect(() => a.assembleSource(src, { inputFileName: 't.a' })).toThrow();
        const out = errOut();
        expect(out).toContain(message);
        expect(out).toContain('explain:');
        expect(out).toContain(getExplanation(key).concept);
      }
    );

    test.each(CASES)(
      '$name: without --explain, the message is bare (no explain block)',
      ({ message, src }) => {
        const a = new Assembler();
        a.explainModeOn = false;
        expect(() => a.assembleSource(src, { inputFileName: 't.a' })).toThrow();
        const out = errOut();
        expect(out).toContain(message);
        expect(out).not.toContain('explain:');
      }
    );
  });
});

describe('directive + structural explain content (#1099)', () => {
  // One row per wired throw site. Both .org throw sites share ORG_DIRECTIVE; both
  // Invalid-operation sites (the directive default case and the unknown-instruction
  // path) share INVALID_OPERATION. Triggers verified empirically — e.g. `.org foo`
  // fails as a non-numeric operand before any address check.
  const CASES = [
    { name: 'Invalid number for .org (non-numeric operand)', key: 'ORG_DIRECTIVE',
      message: 'Invalid number for .org directive',
      src: '        .org foo\n        halt\n' },
    { name: 'Backward address on .org (rewind)', key: 'ORG_DIRECTIVE',
      message: 'Backward address on .org',
      src: '        .org 0x100\n        halt\n        .org 0x10\n        halt\n' },
    { name: 'Bad operand label (.global numeric)', key: 'BAD_OPERAND_LABEL',
      message: 'Bad operand--not a valid label',
      src: '        .global 9bad\n        halt\n' },
    { name: 'Invalid operation (unknown instruction)', key: 'INVALID_OPERATION',
      message: 'Invalid operation',
      src: '        frobnicate\n        halt\n' },
    { name: 'Invalid operation (unknown directive)', key: 'INVALID_OPERATION',
      message: 'Invalid operation',
      src: '        .frob\n        halt\n' },
    { name: 'Program too big (overflow address space)', key: 'PROGRAM_TOO_BIG',
      message: 'Program too big',
      src: '        .org 0xFFFF\n        halt\n        halt\n' },
  ];

  test.each(CASES)('$name: catalog has a {concept, correctForm} entry', ({ key }) => {
    const e = getExplanation(key);
    expect(e).toBeTruthy();
    expect(e.concept.length).toBeGreaterThan(0);
    expect(e.correctForm.length).toBeGreaterThan(0);
  });

  describe('end to end through assembleSource', () => {
    let errSpy;
    beforeEach(() => {
      errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());
    const errOut = () => errSpy.mock.calls.map((c) => c.join(' ')).join('\n');

    test.each(CASES)(
      '$name: --explain renders the message AND its explain block',
      ({ key, message, src }) => {
        const a = new Assembler();
        a.explainModeOn = true;
        expect(() => a.assembleSource(src, { inputFileName: 't.a' })).toThrow();
        const out = errOut();
        expect(out).toContain(message);
        expect(out).toContain('explain:');
        expect(out).toContain(getExplanation(key).concept);
      }
    );

    test.each(CASES)(
      '$name: without --explain, the message is bare (no explain block)',
      ({ message, src }) => {
        const a = new Assembler();
        a.explainModeOn = false;
        expect(() => a.assembleSource(src, { inputFileName: 't.a' })).toThrow();
        const out = errOut();
        expect(out).toContain(message);
        expect(out).not.toContain('explain:');
      }
    );

    // AC: the Invalid-operation explanation must COMPOSE with the existing
    // verbose suggestClosest "Did you mean?" suffix, not replace it.
    test('Invalid operation: --explain + --verbose shows both the suggestion AND the explain block', () => {
      const a = new Assembler();
      a.explainModeOn = true;
      a.verboseModeOn = true;
      // `addd` is one edit from `add`, so suggestClosest fires.
      expect(() => a.assembleSource('        addd r0, r1, r2\n        halt\n', { inputFileName: 't.a' })).toThrow();
      const out = errOut();
      expect(out).toContain('Invalid operation');
      expect(out).toContain("Did you mean 'add'?");
      expect(out).toContain('explain:');
      // explanation comes last, after the suggestion suffix
      expect(out.indexOf('explain:')).toBeGreaterThan(out.indexOf("Did you mean 'add'?"));
    });
  });
});
