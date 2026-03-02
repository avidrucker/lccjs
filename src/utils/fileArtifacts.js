/**
 * Shared filesystem artifact helpers for the file-oriented wrappers.
 *
 * This module centralizes the small set of path and file operations that are
 * still intentionally part of the CLI and wrapper layer:
 * - deriving sibling artifact names such as `.e`, `.lst`, and `.bst`
 * - reading text or binary inputs from disk
 * - writing text or binary outputs to disk
 * - writing paired report artifacts in one place
 *
 * The purpose of this module is to keep these concerns out of the reusable
 * in-memory assembly and interpretation paths while preserving the existing
 * public CLI behavior of `assembler.js`, `interpreter.js`, and `lcc.js`.
 */
const fs = require('fs');
const path = require('path');

function constructSiblingFileName(inputFileName, extension) {
  const parsedPath = path.parse(inputFileName);
  return path.format({ ...parsedPath, base: undefined, ext: extension });
}

function readTextInput(fileName) {
  return fs.readFileSync(fileName, 'utf-8');
}

function readBinaryInput(fileName) {
  return fs.readFileSync(fileName);
}

function writeBinaryFile(fileName, bytes) {
  fs.writeFileSync(fileName, bytes);
}

function writeTextFile(fileName, text) {
  fs.writeFileSync(fileName, text, 'utf-8');
}

function writeReportFiles(baseInputFileName, lstContent, bstContent) {
  const lstFileName = constructSiblingFileName(baseInputFileName, '.lst');
  const bstFileName = constructSiblingFileName(baseInputFileName, '.bst');

  writeTextFile(lstFileName, lstContent);
  writeTextFile(bstFileName, bstContent);

  return { lstFileName, bstFileName };
}

module.exports = {
  constructSiblingFileName,
  readBinaryInput,
  readTextInput,
  writeBinaryFile,
  writeReportFiles,
  writeTextFile,
};
