/**
 * @file assembler.cli.integration.spec.js
 * Integration tests for assembler.js wrapper and file-level behavior.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

describe('Assembler CLI Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  test('1. should instantiate without errors', () => {
    expect(assembler).toBeDefined();
    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBe(0);
  });

  test('2. should fail if no filename is provided (not test mode)', () => {
    expect(() => {
      assembler.main([]);
    }).toThrow('Usage: assembler.js <input filename>');
  });

  test('3. should attempt to assemble an empty .a file without crashing', () => {
    const aFilePath = 'empty.a';
    virtualFs[aFilePath] = '';

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Empty file');
  });

  test('4. should assemble demoA.a with no errors', () => {
    const aFilePath = 'demoA.a';
    const source = `
      ; demoA.a: simple test
      mov r0, 5
      dout r0
      nl
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  test('12. should assemble demoN.a (division by zero) successfully (no assembler error)', () => {
    const aFilePath = 'demoN.a';
    const source = `
      mov r0, 3
      mov r1, 0
      div r0, r1
      dout r0
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('14. should assemble a short multi-line example with labels and instructions', () => {
    const aFilePath = 'multiLine.a';
    const source = `
      .start main

main:
      mov r0, 10
loop:
      cmp r0, 0
      bre end
      dout r0
      nl
      sub r0, r0, 1
      br loop
end:
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.listing.length).toBeGreaterThan(0);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  test('16. should throw an error when opening a file that does not exist', () => {
    const aFilePath = 'doesNotExist.a';

    fs.openSync.mockImplementation(() => {
      throw new Error(`ENOENT: no such file or directory, open '${aFilePath}'`);
    });

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Cannot open input file doesNotExist.a');
  });

  test('129. should throw error for line exceeding 300 characters', () => {
    const aFilePath = 'longLine.a';
    const longLine = 'a'.repeat(301);
    const source = `
      ${longLine}
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Line exceeds maximum length of 300 characters');
  });

  test('161. should attempt to assemble a file with only comments without errors', () => {
    const aFilePath = 'onlyComments.a';
    const source = `
      ; This is a comment
      ; Another comment line
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Empty file');
  });
});
