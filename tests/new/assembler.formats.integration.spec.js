/**
 * @file assembler.formats.integration.spec.js
 * Integration tests for assembler.js format-specific input parsing.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const path = require('path');
const realFs = jest.requireActual('fs');

describe('Assembler Format Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  // -------------------------------------------------------------------------
  // 5. Test .bin file parsing
  // -------------------------------------------------------------------------
  test('5a. should assemble a correctly written .bin file (each line 16 bits)', () => {
    const binFilePath = 'binaryExample.bin';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-formats/binaryExample.bin'), 'utf8');
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).not.toThrow();

    expect(assembler.outputBuffer.length).toBe(2);
    expect(assembler.outputBuffer[0]).toBe(parseInt('0001000000000010', 2));
    expect(assembler.outputBuffer[1]).toBe(parseInt('0011100000000101', 2));
  });

  test('5b. should throw if .bin file line is not 16 bits', () => {
    const binFilePath = 'badBinary.bin';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-formats/badBinary.bin'), 'utf8');
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).toThrow();
  });

  test('5c. should throw if .bin file has non-binary characters', () => {
    const binFilePath = 'badBinary2.bin';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-formats/badBinary2.bin'), 'utf8');
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).toThrow();
  });

  // -------------------------------------------------------------------------
  // 6. Test .hex file parsing
  // -------------------------------------------------------------------------
  test('6a. should assemble a .hex file (each line exactly 4 hex digits)', () => {
    const hexFilePath = 'hexExample.hex';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-formats/hexExample.hex'), 'utf8');
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).not.toThrow();

    expect(assembler.outputBuffer.length).toBe(2);
    expect(assembler.outputBuffer[0]).toBe(0x1A2F);
    expect(assembler.outputBuffer[1]).toBe(0xFFFF);
  });

  test('6b. should throw if .hex file line is not 4 hex digits', () => {
    const hexFilePath = 'badHex.hex';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-formats/badHex.hex'), 'utf8');
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).toThrow();
  });

  test('6c. should throw if .hex file has invalid hex characters', () => {
    const hexFilePath = 'badHex2.hex';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-formats/badHex2.hex'), 'utf8');
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).toThrow();
  });
});
