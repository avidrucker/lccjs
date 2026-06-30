// cliexit.unit.spec.js — the shared cliExit --show-err-id display seam (#1562).
//
// Interpreter (and later linker) errors print through cliErrorExit. This seam lets an
// error ID surface inline as `Error [int-NNN]: <message>` under --show-err-id, folding a
// leading "Runtime Error: " so the id isn't doubled. Off by default ⇒ byte-identical
// (oracle parity); fatalExit still throws the ORIGINAL message so existing assertions hold.

'use strict';

const cliExit = require('../../src/utils/cliExit');
const { cliErrorExit, cliWrappedErrorExit, setShowErrId } = cliExit;
const { InterpreterRuntimeError } = require('../../src/utils/errors');

describe('cliExit --show-err-id seam (#1562)', () => {
  let errSpy;
  beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { setShowErrId(false); errSpy.mockRestore(); });

  const printed = () => errSpy.mock.calls.map((c) => c.join(' ')).join('\n');

  test('under showErrId + id, renders "Error [int-NNN]: <msg>" (clean exec-format path)', () => {
    setShowErrId(true);
    expect(() => cliErrorExit('Incomplete start address in header', 1, 'BAD_EXE_HEADER', 'int-002')).toThrow();
    expect(printed()).toContain('Error [int-002]: Incomplete start address in header');
  });

  test('folds a leading "Runtime Error: " so the id is not doubled', () => {
    setShowErrId(true);
    expect(() => cliErrorExit('Runtime Error: Unknown opcode: 5', 1, 'UNKNOWN_OPCODE', 'int-001')).toThrow();
    const out = printed();
    expect(out).toContain('Error [int-001]: Unknown opcode: 5');
    expect(out).not.toContain('Error [int-001]: Runtime Error:'); // no double prefix
  });

  test('off by default: the printed line is byte-identical even with an id present', () => {
    // showErrId stays false (default)
    expect(() => cliErrorExit('Runtime Error: Unknown opcode: 5', 1, 'UNKNOWN_OPCODE', 'int-001')).toThrow();
    expect(printed()).toBe('Runtime Error: Unknown opcode: 5');
    expect(printed()).not.toContain('[int-');
  });

  test('showErrId on but no id resolves → message unchanged (no empty bracket)', () => {
    setShowErrId(true);
    expect(() => cliErrorExit('Usage: ...', 1)).toThrow();
    expect(printed()).toBe('Usage: ...');
  });

  test('fatalExit/throw text stays the ORIGINAL message even with an id (parity for existing assertions)', () => {
    setShowErrId(true);
    expect(() => cliErrorExit('Runtime Error: Floating point exception', 1, 'DIV_BY_ZERO', 'int-003'))
      .toThrow('Runtime Error: Floating point exception'); // not the id-formatted line
  });

  // cliWrappedErrorExit — the lcc.js-orchestrated path (e.g. "Error running foo.e:").
  test('cliWrappedErrorExit: default keeps the "<prefix> <message>" form (parity)', () => {
    const err = new InterpreterRuntimeError('Floating point exception', { explainKey: 'DIV_BY_ZERO', id: 'int-001' });
    expect(() => cliWrappedErrorExit('Error running foo.e:', err, 1)).toThrow();
    expect(printed()).toBe('Error running foo.e: Floating point exception');
  });

  test('cliWrappedErrorExit: under showErrId converges on "Error [int-NNN]: <message>"', () => {
    setShowErrId(true);
    const err = new InterpreterRuntimeError('Floating point exception', { explainKey: 'DIV_BY_ZERO', id: 'int-001' });
    expect(() => cliWrappedErrorExit('Error running foo.e:', err, 1)).toThrow();
    expect(printed()).toBe('Error [int-001]: Floating point exception');
  });

  test('a typed error carries its optional id (LccError option, #1562)', () => {
    const err = new InterpreterRuntimeError('Floating point exception', { explainKey: 'DIV_BY_ZERO', id: 'int-001' });
    expect(err.id).toBe('int-001');
    expect(err.explainKey).toBe('DIV_BY_ZERO');
    expect(new InterpreterRuntimeError('x').id).toBeUndefined(); // optional
  });
});
