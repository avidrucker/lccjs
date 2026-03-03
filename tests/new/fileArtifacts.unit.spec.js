const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  constructSiblingFileName,
  readBinaryInput,
  readTextInput,
  writeBinaryFile,
  writeReportFiles,
  writeTextFile,
} = require('../../src/utils/fileArtifacts');

describe('File Artifacts Unit Tests', () => {
  test('constructSiblingFileName() should replace a nested file extension with the requested sibling extension', () => {
    const result = constructSiblingFileName('/tmp/nested/demoA.a', '.e');

    expect(result).toBe(path.join('/tmp', 'nested', 'demoA.e'));
  });

  test('constructSiblingFileName() should add an extension when the input file has no extension', () => {
    const result = constructSiblingFileName('/tmp/demoA', '.lst');

    expect(result).toBe(path.join('/tmp', 'demoA.lst'));
  });

  test('readTextInput() and writeTextFile() should round-trip text content', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-file-artifacts-text-'));
    const filePath = path.join(tempDir, 'sample.lst');

    writeTextFile(filePath, 'hello\nworld\n');

    expect(readTextInput(filePath)).toBe('hello\nworld\n');
  });

  test('readBinaryInput() and writeBinaryFile() should round-trip binary content', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-file-artifacts-bin-'));
    const filePath = path.join(tempDir, 'sample.e');
    const bytes = Buffer.from([0x6f, 0x43, 0x00, 0xf0]);

    writeBinaryFile(filePath, bytes);

    expect(readBinaryInput(filePath)).toEqual(bytes);
  });

  test('writeReportFiles() should write sibling .lst and .bst report files and return their names', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-file-artifacts-reports-'));
    const baseInputFileName = path.join(tempDir, 'demoA.e');

    const result = writeReportFiles(baseInputFileName, 'lst report', 'bst report');

    expect(result).toEqual({
      lstFileName: path.join(tempDir, 'demoA.lst'),
      bstFileName: path.join(tempDir, 'demoA.bst'),
    });
    expect(fs.readFileSync(result.lstFileName, 'utf8')).toBe('lst report');
    expect(fs.readFileSync(result.bstFileName, 'utf8')).toBe('bst report');
  });
});
