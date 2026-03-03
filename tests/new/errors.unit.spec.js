const {
  LccError,
  AssemblerError,
  LinkerError,
  InvalidExecutableFormatError,
  InterpreterRuntimeError,
} = require('../../src/utils/errors');

describe('Errors Unit Tests', () => {
  test('LccError should set the error name from the concrete class', () => {
    const error = new LccError('base error');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LccError');
    expect(error.message).toBe('base error');
  });

  test('AssemblerError should extend LccError', () => {
    const error = new AssemblerError('assembler failed');

    expect(error).toBeInstanceOf(LccError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AssemblerError');
  });

  test('LinkerError should extend LccError', () => {
    const error = new LinkerError('linker failed');

    expect(error).toBeInstanceOf(LccError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('LinkerError');
  });

  test('InvalidExecutableFormatError should extend LccError', () => {
    const error = new InvalidExecutableFormatError('bad executable');

    expect(error).toBeInstanceOf(LccError);
    expect(error.name).toBe('InvalidExecutableFormatError');
  });

  test('InterpreterRuntimeError should extend LccError', () => {
    const error = new InterpreterRuntimeError('runtime failed');

    expect(error).toBeInstanceOf(LccError);
    expect(error.name).toBe('InterpreterRuntimeError');
  });
});
