/**
 * @file assembler.object-modules.integration.spec.js
 * Integration tests for assembler.js object-module behavior.
 */

const fs = require('fs');
const path = require('path');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const realFs = jest.requireActual('fs');

describe('Assembler Object Module Integration', () => {
  let assembler;
  let virtualFs;
  const { getAssembler, getVirtualFs } = setupAssemblerIntegrationHarness(Assembler);

  beforeEach(() => {
    assembler = getAssembler();
    virtualFs = getVirtualFs();
  });

  // -------------------------------------------------------------------------
  // 10. Test global and .o object-file generation
  // -------------------------------------------------------------------------
  test('10. should produce .o file when .global is used', () => {
    const aFilePath = 'testObject.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/testObject.a'), 'utf8');
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  test('10b. should write .o, .lst, and .bst files when .global is used', () => {
    const aFilePath = 'testObjectArtifacts.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/testObject.a'), 'utf8');
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(virtualFs['testObjectArtifacts.o']).toBeDefined();
    expect(virtualFs['testObjectArtifacts.lst']).toBeDefined();
    expect(virtualFs['testObjectArtifacts.bst']).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 17. Test extern and .o object-file generation
  // -------------------------------------------------------------------------
  test('17. should produce .o file when .extern is used', () => {
    const aFilePath = 'testObject2.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/testObject2.a'), 'utf8');
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.isObjectModule).toBe(true);
    expect(path.extname(assembler.outputFileName)).toBe('.o');
  });

  // -------------------------------------------------------------------------
  // 111. Test global directive (.global) with valid variable
  // -------------------------------------------------------------------------
  test('111. should assemble .global directive with valid variable', () => {
    const aFilePath = 'globalValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/globalValid.a'), 'utf8');
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.globalLabels.has('var1')).toBe(true);
    expect(assembler.isObjectModule).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 112. Test global directive (.global) with invalid variable name
  // -------------------------------------------------------------------------
  test('112. should throw error for .global directive with invalid variable name', () => {
    const aFilePath = 'globalInvalid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/globalInvalid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  // -------------------------------------------------------------------------
  // 113. Test global directive (.global) with missing operand
  // -------------------------------------------------------------------------
  test('113. should throw error for .global directive missing operand', () => {
    const aFilePath = 'globalMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/globalMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  // -------------------------------------------------------------------------
  // 114. Test extern directive (.extern) with valid variable
  // -------------------------------------------------------------------------
  test('114. should assemble .extern directive with valid variable', () => {
    const aFilePath = 'externValid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/externValid.a'), 'utf8');
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.externLabels.has('externalVar')).toBe(true);
    expect(assembler.isObjectModule).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 115. Test extern directive (.extern) with invalid variable name
  // -------------------------------------------------------------------------
  test('115. should throw error for .extern directive with invalid variable name', () => {
    const aFilePath = 'externInvalid.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/externInvalid.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  // -------------------------------------------------------------------------
  // 116. Test extern directive (.extern) with missing operand
  // -------------------------------------------------------------------------
  test('116. should throw error for .extern directive missing operand', () => {
    const aFilePath = 'externMissingOperand.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/externMissingOperand.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });

  // -------------------------------------------------------------------------
  // 175. Test assembly with multiple .extern declarations for the same label
  // -------------------------------------------------------------------------
  test('175. should throw not error for multiple .extern declarations of the same label', () => {
    const aFilePath = 'multipleExterns.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/multipleExterns.a'), 'utf8');
    virtualFs[aFilePath] = source;
    virtualFs['name.nnn'] = 'Cheese\n';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // 269. Output atomicity: a name-resolution failure must abort BEFORE any
  // .o is written, matching OG LCC's all-or-nothing behavior. Regression for
  // the non-atomic-output bug where assembler.js wrote the .o, then resolved
  // the author name, leaving a half-finished build on a non-zero exit. (#269)
  // -------------------------------------------------------------------------
  test('269. should write no .o/.lst/.bst when the author name cannot be resolved', () => {
    const aFilePath = 'atomicNameFail.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/testObject.a'), 'utf8');
    virtualFs[aFilePath] = source;
    // No name.nnn present → createNameFile prompts and reads stdin.

    // No name.nnn + non-TTY stdin (Jest default) → fatalExit throws before any output is written.
    try {
      expect(() => {
        assembler.main([aFilePath]);
      }).toThrow('name.nnn not found');

      expect(assembler.isObjectModule).toBe(true);
      // The crux: the .o (and its reports) must never have been opened/written.
      expect(virtualFs['atomicNameFail.o']).toBeUndefined();
      expect(virtualFs['atomicNameFail.lst']).toBeUndefined();
      expect(virtualFs['atomicNameFail.bst']).toBeUndefined();
    } finally {
      // nothing to restore
    }
  });
});
