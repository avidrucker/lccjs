/**
 * @file assembler.integeration.spec.js
 * Integration tests for assembler.js using Jest
 * 
 * These tests are meant to test the assembler's core functionalities
 * without creating any real files. Instead, we mock the filesystem
 * to provide the assembler with source code content and to capture
 * the Assembler object's state after running the assembler. This is
 * particularly useful for replicating the various error conditions.
 */

const fs = require('fs');
const path = require('path');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

// Mock filesystem so we don't actually read/write real files:
jest.mock('fs');

describe('Assembler', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  // This file now intentionally holds only the few assembler cases that do not
  // fit cleanly into the more specific split suites. These are language-shape
  // oddities and uncategorizable leftovers rather than a primary home for broad
  // integration coverage.

  // -------------------------------------------------------------------------
  // 123. Test nop-like instruction (assuming 'nop' is not defined)
  // -------------------------------------------------------------------------
  test('123. should throw error for undefined mnemonic', () => {
    const aFilePath = 'undefinedMnemonic.a';
    const source = `
      nop
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  // -------------------------------------------------------------------------
  // 124. Test instruction with too many characters in label
  // -------------------------------------------------------------------------
  // Removed from the active suite:
  // The original LCC appears to have a line-length cap of roughly 300
  // characters per line, but we do not currently have evidence of a separate
  // label-length limit. This case should not remain as a skipped label-limit
  // test until that distinction is verified.
  /*
  test.skip('124. should throw error for label exceeding maximum length', () => {
    // Note: It may not be correct to say there is a maximum label length - 
    //       there might just be a cap on the length of a line of code
    const aFilePath = 'longLabel.a';
    const longLabel = 'a'.repeat(300);
    const source = `
      ${longLabel}: .word 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Label exceeds maximum length');
  });
  */

  // -------------------------------------------------------------------------
  // 125. Test instruction with unsupported operand format (e.g., indirect)
  // -------------------------------------------------------------------------
  test('125. should throw error for instruction with unsupported operand format', () => {
    const aFilePath = 'unsupportedOperandFormat.a';
    const source = `
      ld r1, [cheese]
      halt
    `;
    virtualFs[aFilePath] = source;

    // Assuming indirect addressing ([r2]) is not supported
    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Bad label');
  });

  // -------------------------------------------------------------------------
  // 174. Test undefined directive with missing dot
  // -------------------------------------------------------------------------
  test('174. should throw error for directive without leading dot', () => {
    const aFilePath = 'directiveNoDot.a';
    const source = `
      word 10
      halt
    `;
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow('Invalid operation');
  });

  // -------------------------------------------------------------------------
  // 195. Test instruction (jmp) with label that looks like a reserved keyword
  // -------------------------------------------------------------------------
  test('195. should throw no error for br instruction with label that might seem like a reserved keyword', () => {
    const aFilePath = 'jmpReservedLabel.a';
    const source = `
      br halt
      halt:
        halt
    `;
    virtualFs[aFilePath] = source;

    // The take-away here is that there are no reserved keywords in the LCC assembly language
    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

});
