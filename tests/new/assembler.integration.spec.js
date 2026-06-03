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
    }).toThrow();
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
    }).toThrow();
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
    }).toThrow();
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

  // -------------------------------------------------------------------------
  // sourceMap — built after pass 2 for .a files (#77 / OB-043)
  // -------------------------------------------------------------------------
  describe('assembler.sourceMap — built after pass 2 for .a files (#77)', () => {
    test('sourceMap is null before any assembly', () => {
      expect(assembler.sourceMap).toBeNull();
    });

    test('sourceMap.addressToLine is a Map after assembling a .a file', () => {
      const aFilePath = 'sourceMapTest.a';
      // Instructions must be indented (column 0 = label in LCC assembly)
      virtualFs[aFilePath] = `  mvi r0, 5\n  halt\n`;
      assembler.main([aFilePath]);
      expect(assembler.sourceMap).not.toBeNull();
      expect(assembler.sourceMap.addressToLine).toBeInstanceOf(Map);
    });

    test('sourceMap.allLines contains all source lines', () => {
      const aFilePath = 'sourceMapLines.a';
      const source = `  mvi r0, 5\n  halt\n`;
      virtualFs[aFilePath] = source;
      assembler.main([aFilePath]);
      // allLines is this.sourceLines.slice() — includes the trailing empty entry from split('\n')
      expect(assembler.sourceMap.allLines.length).toBeGreaterThanOrEqual(2);
      expect(assembler.sourceMap.allLines[0]).toContain('mvi');
    });

    test('address 0 maps to the first code-producing line', () => {
      const aFilePath = 'sourceMapAddr0.a';
      virtualFs[aFilePath] = `  mvi r0, 5\n  halt\n`;
      assembler.main([aFilePath]);
      const entry = assembler.sourceMap.addressToLine.get(0);
      expect(entry).toBeDefined();
      expect(entry.lineNumber).toBe(1);
      expect(entry.sourceLine).toContain('mvi');
    });

    test('address 1 maps to the second code-producing line (halt)', () => {
      const aFilePath = 'sourceMapAddr1.a';
      virtualFs[aFilePath] = `  mvi r0, 5\n  halt\n`;
      assembler.main([aFilePath]);
      const entry = assembler.sourceMap.addressToLine.get(1);
      expect(entry).toBeDefined();
      expect(entry.sourceLine).toContain('halt');
    });

    test('comment-only lines are not in addressToLine', () => {
      const aFilePath = 'sourceMapComments.a';
      // Line 1: comment, Line 2: mvi (addr 0), Line 3: halt (addr 1)
      virtualFs[aFilePath] = `; this is a comment\n  mvi r0, 1\n  halt\n`;
      assembler.main([aFilePath]);
      // address 0 → mvi (line 2), address 1 → halt (line 3); no address for the comment
      expect(assembler.sourceMap.addressToLine.size).toBe(2);
      const lineNumbers = Array.from(assembler.sourceMap.addressToLine.values()).map(e => e.lineNumber);
      expect(lineNumbers).not.toContain(1); // line 1 is the comment
    });

    test('sourceMap is reset to null between assemblies', () => {
      const a1 = 'sm1.a';
      virtualFs[a1] = `  mvi r0, 5\n  halt\n`;
      assembler.main([a1]);
      expect(assembler.sourceMap).not.toBeNull();

      // resetAssemblyState() clears it
      assembler.resetAssemblyState();
      expect(assembler.sourceMap).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Regression: writeSync must store Buffer, not corrupt binary via UTF-8 (#527)
  // -------------------------------------------------------------------------
  describe('binary output integrity', () => {
    test('virtualFs output is a Buffer with intact oC signature after assembly', () => {
      const aFilePath = 'sig.a';
      virtualFs[aFilePath] = '  halt\n';
      assembler.main([aFilePath]);
      const output = virtualFs['sig.e'];
      expect(Buffer.isBuffer(output)).toBe(true);
      // Minimal program has no header entries → oC are the first two bytes
      expect(output[0]).toBe(0x6F); // 'o'
      expect(output[1]).toBe(0x43); // 'C'
    });
  });

});
