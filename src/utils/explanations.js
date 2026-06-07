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
// This is the infra slice: pcoffset9 is wired end-to-end here. The remaining
// error classes are filled in by the content batches (#1097–#1101); each adds
// its entries to this table and attaches the key at its throw sites.

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
