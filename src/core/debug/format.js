// format.js — shared display-formatting helpers for the debug / interactive layers.
//
// Canonical home for the 4-digit-hex helper and the register name/alias tables,
// shared across interpreter.js and iinterpreter.js. Pure formatting only — no
// machine state, no I/O — so both the oracle-parity debugger and the interactive
// TUI can depend on it without coupling their presentation.

'use strict';

// Format a value as zero-padded, 4-digit, 16-bit hex (e.g. 5 -> "0005").
const h4 = (v) => (v & 0xFFFF).toString(16).padStart(4, '0');

// Register display names by index. LCC convention: r5=fp, r6=sp, r7=lr.
const REG_NAMES = ['r0', 'r1', 'r2', 'r3', 'r4', 'fp', 'sp', 'lr'];

// Accepted register-name aliases -> index (both the rN names and the role names).
const REG_ALIASES = {
  r0: 0, r1: 1, r2: 2, r3: 3, r4: 4,
  fp: 5, r5: 5, sp: 6, r6: 6, lr: 7, r7: 7,
};

module.exports = { h4, REG_NAMES, REG_ALIASES };
