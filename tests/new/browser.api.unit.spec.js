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
});
