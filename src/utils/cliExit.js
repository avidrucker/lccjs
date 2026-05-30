// cliExit.js — shared CLI exit/error scaffolding for the toolchain's wrapper paths.
//
// This block (`isTestMode` + `fatalExit` / `cliErrorExit` / `cliWrappedErrorExit`)
// was copy-pasted across 8 entry points in src/ (core assembler/interpreter/linker/lcc,
// the interactive ilcc, and the plus subclasses) and had begun to drift. Extracted to
// one canonical home so the exit contract is edited in a single place. See #167.
//
// These belong on the **wrapper side** of the pure-seam boundary documented in
// docs/core-behavior-matrix.md: they own console output and process exit. The pure
// in-memory APIs (assembleSource, executeBuffer, …) throw typed errors instead and
// never reach here. Under Jest, `isTestMode` flips `fatalExit` from `process.exit`
// to a thrown Error so the harness survives and tests can assert on the failure.

'use strict';

// crude check for Jest
const isTestMode = (typeof global.it === 'function');

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

function cliErrorExit(message, code = 1) {
  console.error(message);
  fatalExit(message, code);
}

function cliWrappedErrorExit(prefix, error, code = 1) {
  console.error(prefix, error.message);
  fatalExit(`${prefix} ${error.message}`, code);
}

module.exports = { isTestMode, fatalExit, cliErrorExit, cliWrappedErrorExit };
