// cliExit.js — shared CLI exit/error scaffolding for the toolchain's wrapper paths.
//
// Centralised here so `isTestMode` + `fatalExit` / `cliErrorExit` / `cliWrappedErrorExit`
// stay consistent across assembler, interpreter, linker, lcc, ilcc, and the plus
// subclasses — edit the exit contract in one place, not eight.
//
// These belong on the **wrapper side** of the pure-seam boundary documented in
// docs/core-behavior-matrix.md: they own console output and process exit. The pure
// in-memory APIs (assembleSource, executeBuffer, …) throw typed errors instead and
// never reach here. Under Jest, `isTestMode` flips `fatalExit` from `process.exit`
// to a thrown Error so the harness survives and tests can assert on the failure.

'use strict';

const { formatExplanation } = require('./explanations');

// crude check for Jest
const isTestMode = (typeof global.it === 'function');

// --explain mode (#1096). Off by default; the CLI driver flips it on when
// `--explain` is parsed. When on, the exit helpers append an explanation block
// for any error that carries a stable `explainKey`. Gated so default (and
// oracle-parity) output is byte-for-byte unchanged.
let explainModeOn = false;
function setExplainMode(on) {
  explainModeOn = !!on;
}

// --show-err-id mode (#1562). Off by default; the CLI driver flips it on when
// `--show-err-id` is parsed. When on, cliErrorExit renders a unique error ID inline as
// `Error [int-NNN]: <message>`. Gated so default (and oracle-parity) output is unchanged.
let showErrIdOn = false;
function setShowErrId(on) {
  showErrIdOn = !!on;
}

// withErrorId(message, id) — compose the inline-id form `Error [id]: <core>`, folding a
// leading "Runtime Error: " (the interpreter's parity-locked runtime lead-in) so the id is
// not doubled. Returns the message unchanged when the flag is off or no id resolves.
function withErrorId(message, id) {
  if (!showErrIdOn || !id) return message;
  const core = String(message).replace(/^Runtime Error: /, '');
  return `Error [${id}]: ${core}`;
}

// Prints the `explain:` block for a key when explain mode is on and an entry
// exists. No-op otherwise — keeps the non-explain path unchanged.
function maybeExplain(explainKey) {
  if (!explainModeOn || !explainKey) return;
  const block = formatExplanation(explainKey);
  if (block) console.error(block);
}

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

function cliErrorExit(message, code = 1, explainKey = null, id = null) {
  console.error(withErrorId(message, id));
  maybeExplain(explainKey);
  fatalExit(message, code); // throw/exit text stays the ORIGINAL message (parity, #1562)
}

function cliWrappedErrorExit(prefix, error, code = 1) {
  const id = error && error.id;
  if (showErrIdOn && id) {
    // Under --show-err-id, converge on the consistent `Error [id]: <message>` form
    // (the "<prefix> running <file>:" wrapper is dropped in favor of the citable id). (#1562)
    console.error(withErrorId(error.message, id));
  } else {
    console.error(prefix, error.message); // default — byte-identical
  }
  maybeExplain(error && error.explainKey);
  fatalExit(`${prefix} ${error.message}`, code); // throw/exit text unchanged (parity)
}

module.exports = {
  isTestMode,
  fatalExit,
  cliErrorExit,
  cliWrappedErrorExit,
  setExplainMode,
  maybeExplain,
  setShowErrId,
  withErrorId,
};
