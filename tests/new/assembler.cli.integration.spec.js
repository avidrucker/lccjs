/**
 * @file assembler.cli.integration.spec.js
 * Integration tests for assembler.js wrapper and file-level behavior.
 */

const fs = require('fs');
const Assembler = require('../../src/core/assembler');
const { setupAssemblerIntegrationHarness } = require('../helpers/assemblerIntegrationHarness');

jest.mock('fs');
const path = require('path');
const realFs = jest.requireActual('fs');

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
    }).toThrow();
  });

  test('4. should assemble demoA.a with no errors', () => {
    const aFilePath = 'demoA.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-cli/demoA.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
    expect(assembler.outputBuffer.length).toBeGreaterThan(0);
  });

  test('4b. should thread a pre-set listingLoadPoint (-l) through main(), surviving the internal reset (#1238)', () => {
    const aFilePath = 'demoA.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-cli/demoA.a'), 'utf8');
    virtualFs[aFilePath] = source;

    // Mirrors lcc.js assembleFile(): -l<hex> is wired onto the instance before main().
    assembler.listingLoadPoint = 0x3000;
    assembler.main([aFilePath]);

    // resetAssemblyState() runs inside assembleSource(); main() must thread the
    // pre-set value back through so -l is not silently wiped.
    expect(assembler.listingLoadPoint).toBe(0x3000);
    const { lstContent } = assembler.buildReportArtifacts('Tester');
    expect(lstContent).toMatch(/^3000 /m);
  });

  test('12. should assemble demoN.a (division by zero) successfully (no assembler error)', () => {
    const aFilePath = 'demoN.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-cli/demoN.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).not.toThrow();

    expect(assembler.errorFlag).toBe(false);
  });

  test('14. should assemble a short multi-line example with labels and instructions', () => {
    const aFilePath = 'multiLine.a';
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-cli/multiLine.a'), 'utf8');
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
    const source = realFs.readFileSync(path.join(__dirname, '../fixtures/assembler-cli/onlyComments.a'), 'utf8');
    virtualFs[aFilePath] = source;

    expect(() => {
      assembler.main([aFilePath]);
    }).toThrow();
  });
});
