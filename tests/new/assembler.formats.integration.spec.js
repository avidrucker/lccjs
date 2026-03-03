/**
 * @file assembler.formats.integration.spec.js
 * Integration tests for assembler.js format-specific input parsing.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');

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
    const source = `
      0001000000000010 ; this is a 16-bit binary line
      0011100000000101 ; another 16-bit binary line
    `;
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
    const source = `
      0101001001 ; only 10 bits
    `;
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).toThrow('does not have exactly 16 bits');
  });

  test('5c. should throw if .bin file has non-binary characters', () => {
    const binFilePath = 'badBinary2.bin';
    const source = `
      0101001001001XYZ
    `;
    virtualFs[binFilePath] = source;

    expect(() => {
      assembler.main([binFilePath]);
    }).toThrow('is not purely binary');
  });

  // -------------------------------------------------------------------------
  // 6. Test .hex file parsing
  // -------------------------------------------------------------------------
  test('6a. should assemble a .hex file (each line exactly 4 hex digits)', () => {
    const hexFilePath = 'hexExample.hex';
    const source = `
      1A2F ; 16-bit value in hex
      FFFF
    `;
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
    const source = `
      1A2 ; only 3 hex digits
    `;
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).toThrow('does not have exactly 4 nibbles');
  });

  test('6c. should throw if .hex file has invalid hex characters', () => {
    const hexFilePath = 'badHex2.hex';
    const source = `
      X123
    `;
    virtualFs[hexFilePath] = source;

    expect(() => {
      assembler.main([hexFilePath]);
    }).toThrow('is not purely hexadecimal');
  });
});
