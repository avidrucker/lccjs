// explanations.js — the --explain catalog (#1096).
//
// A keyed table of student-friendly explanations for the toolchain's error
// classes. Each entry teaches the underlying concept and shows a correct form.
// Errors map to an entry via a stable `explainKey` set at the throw site (NOT by
// matching the rendered message text, which interpolates values and may carry a
// suggestClosest "Did you mean?" suffix — see #1042 §2).
//
// Pure data + lookup: no console, no I/O. The render wrappers (assembler's
// formatAssemblerError, cliExit's exit helpers) own where the block is printed.
//
// pcoffset9 was wired end-to-end by the infra slice (#1096). The encoding/range
// batch (#1097) adds imm5/imm9/pcoffset11. The remaining error classes are
// filled in by the later content batches (#1098–#1101); each adds its entries to
// this table and attaches the key at its throw sites.

'use strict';

const EXPLANATIONS = {
  PCOFFSET9_RANGE: {
    concept:
      'A branch/load/store target is encoded as a PC-relative offset in a signed ' +
      '9-bit field, so it must lie within -256..+255 words of the instruction that ' +
      'follows it. A label farther away than that cannot be reached by this form.',
    correctForm:
      'Move the label nearer, or load its address into a register first ' +
      '(e.g. `lea r0, far_label`) and use the register-indirect form.',
  },
  PCOFFSET11_RANGE: {
    concept:
      'A bl/jsr target is encoded as a PC-relative offset in a signed 11-bit field, ' +
      'so it must lie within -1024..+1023 words of the following instruction.',
    correctForm:
      'Place the callee within range, or compute its address in a register and ' +
      'call through the register form.',
  },
  IMM5_RANGE: {
    concept:
      'An immediate operand on a register/immediate instruction (e.g. add, sub) is ' +
      'encoded in a signed 5-bit field, so it must lie within -16..15. A literal ' +
      'outside that window cannot be encoded inline.',
    correctForm:
      'Use a value in -16..15, or load the constant into a register first ' +
      '(e.g. `mvi r2, 1000`) and use the register-register form (e.g. `add r0, r1, r2`).',
  },
  IMM9_RANGE: {
    concept:
      'A mov/mvi immediate is encoded in a signed 9-bit field, so it must lie ' +
      'within -256..255. A larger constant cannot be moved in a single immediate.',
    correctForm:
      'Use a value in -256..255, or store the constant in memory with `.word` and ' +
      'load it (e.g. `lea r0, k` then `ldr r0, r0, 0`, with `k: .word 30000`).',
  },
};

// Returns the { concept, correctForm } entry for a key, or null if the key is
// absent / falsy. Callers treat null as "no explanation available".
function getExplanation(key) {
  if (!key) return null;
  return Object.prototype.hasOwnProperty.call(EXPLANATIONS, key)
    ? EXPLANATIONS[key]
    : null;
}

// Renders the indented `explain:` block for a key, or null if there is no entry.
// Format: a distinct `explain:` prefix, with the correct-form line aligned under
// the concept text so it reads as one block, separate from the error line above.
function formatExplanation(key) {
  const entry = getExplanation(key);
  if (!entry) return null;
  return `explain: ${entry.concept}\n         ${entry.correctForm}`;
}

module.exports = { EXPLANATIONS, getExplanation, formatExplanation };
