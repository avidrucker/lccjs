// interpreter-output-flags.behavior.spec.js — behavioral-effect coverage for the
// interpreter output flags -x / -m / -r / -t (#1369, child of tracker #1343).
//
// Existing tests (ilcc.unit.spec.js) only assert these flags flip an *option*;
// nothing proves the option changes the output. These tests drive the interpreter
// in-memory via executeBuffer(buffer, { runtimeOptions }) over a tiny assembled
// program and assert the observable output difference (with vs without the flag).

'use strict';

const Assembler = require('../../src/core/assembler');
const Interpreter = require('../../src/core/interpreter');

// Assemble a tiny source, suppressing the assembler's pass chatter.
function assemble(src) {
  const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  try {
    const a = new Assembler();
    const r = a.assembleSource(src, { inputFileName: 'p.a' });
    return { bytes: r.outputBytes, sourceMap: a.sourceMap };
  } finally {
    logSpy.mockRestore();
  }
}

function runWith(bytes, runtimeOptions, mutate) {
  const interp = new Interpreter();
  if (mutate) mutate(interp);
  interp.executeBuffer(bytes, { inputFileName: 'p.e', runtimeOptions });
  return interp;
}

describe('interpreter output flags — behavioral effects (#1369)', () => {
  describe('-x / hexOutput: hout width', () => {
    // mvi r0, 5 ; hout (of r0) ; halt
    const { bytes } = assemble('  mvi r0, 5\n  hout\n  halt\n');

    test('hout is 4-digit zero-padded WITH hexOutput', () => {
      const interp = runWith(bytes, { hexOutput: true });
      expect(interp.output).toContain('0005');
    });

    test('hout is plain hex WITHOUT hexOutput', () => {
      const interp = runWith(bytes, {});
      expect(interp.output).toBe('5');
      expect(interp.output).not.toContain('0005');
    });
  });

  describe('-m / memDisplay: post-run memory dump', () => {
    const { bytes } = assemble('  mvi r0, 5\n  halt\n');

    test('memory display banner appears WITH memDisplay', () => {
      const interp = runWith(bytes, { memDisplay: true });
      expect(interp.output).toContain('Memory display');
    });

    test('no memory display banner WITHOUT memDisplay', () => {
      const interp = runWith(bytes, {});
      expect(interp.output).not.toContain('Memory display');
    });
  });

  describe('-r / regDisplay: post-run register dump', () => {
    const { bytes } = assemble('  mvi r0, 5\n  halt\n');

    test('register display banner appears WITH regDisplay', () => {
      const interp = runWith(bytes, { regDisplay: true });
      expect(interp.output).toContain('Register display');
    });

    test('no register display banner WITHOUT regDisplay', () => {
      const interp = runWith(bytes, {});
      expect(interp.output).not.toContain('Register display');
    });
  });

  describe('-t / traceMode: per-step trace to stdout', () => {
    // traceMode writes to process.stdout.write (not interp.output), so capture stdout.
    const { bytes, sourceMap } = assemble('  mvi r0, 5\n  halt\n');
    let spy;
    beforeEach(() => {
      spy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    });
    afterEach(() => {
      spy.mockRestore();
    });
    const stdout = () => spy.mock.calls.map((c) => c[0]).join('');

    test('per-step source-text trace lines reach stdout WITH traceMode', () => {
      runWith(bytes, {}, (i) => { i.traceMode = true; i.sourceMap = sourceMap; });
      expect(stdout()).toContain('mvi r0, 5');
    });

    test('no trace lines WITHOUT traceMode', () => {
      runWith(bytes, {}, (i) => { i.sourceMap = sourceMap; });
      expect(stdout()).not.toContain('mvi r0, 5');
    });
  });
});
