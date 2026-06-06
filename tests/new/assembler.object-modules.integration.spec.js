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
  // 269. Output atomicity: after DDD gap 7 (#880), assembler.main() no longer
  // resolves userName from the filesystem — that responsibility moved to lcc.js,
  // which pre-resolves it before calling assembler.main(). Atomic-abort when
  // name.nnn is missing is now enforced at the lcc.js level (resolveUserName()
  // throws → assembler.main() is never reached). assembler.main() uses the
  // pre-set this.userName directly, producing reports with the supplied name.
  // -------------------------------------------------------------------------
  test('269. should write .o/.lst/.bst using a pre-set userName (name resolution moved to lcc.js)', () => {
    const aFilePath = 'atomicNameFail.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-object-modules/testObject.a'), 'utf8');
    virtualFs[aFilePath] = source;

    // Caller pre-sets userName — as lcc.js does before invoking assembler.main().
    assembler.userName = 'TestAuthor';

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.isObjectModule).toBe(true);
    // Reports are written using the pre-set userName.
    expect(virtualFs['atomicNameFail.o']).toBeDefined();
    expect(virtualFs['atomicNameFail.lst']).toBeDefined();
    expect(virtualFs['atomicNameFail.bst']).toBeDefined();
  });
});
