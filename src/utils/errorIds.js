// errorIds.js — the assembler error-ID registry (#1553; mechanism amended per #1480 D2).
//
// Each distinct assembler error CONDITION maps to one unique, citable, append-only id
// (format `asm-NNN`). Unlike `explanations.js` (keyed by category `explainKey`), this
// table is keyed by the NORMALIZED error MESSAGE — the stable identity of the condition —
// so one id covers a condition no matter how many call sites (or which method,
// `this.error` vs `failAssembly`) emit it. `formatAssemblerError` resolves
// `id || lookupErrorId(message)` and surfaces it inline only under --show-err-id.
//
// APPEND-ONLY: ids are a published API. Never renumber or reuse a retired number. This
// file IS the id record; a coverage-guard test (tests/new/error-ids.spec.js) asserts every
// error literal in assembler.js resolves here, so the table cannot silently rot.
//
// Pure data + pure functions — no console, no I/O (same invariant as explanations.js).

'use strict';

// key = normalized message; value = { id, explainKey } (explainKey links to the --explain
// catalog and may be null; it is independent of the id).
const ASM_ERROR_IDS = Object.freeze({
  'Bad label':                              { id: 'asm-001', explainKey: 'BAD_LABEL' },
  'Duplicate label':                        { id: 'asm-002', explainKey: 'DUPLICATE_LABEL' },
  'Program too big':                        { id: 'asm-003', explainKey: 'PROGRAM_TOO_BIG' },
  'Missing operand':                        { id: 'asm-004', explainKey: null },
  'Missing register':                       { id: 'asm-005', explainKey: 'REGISTER' },
  'Bad number':                             { id: 'asm-006', explainKey: null },
  'Missing number':                         { id: 'asm-007', explainKey: null },
  'Bad operand--not a valid label':         { id: 'asm-008', explainKey: 'BAD_OPERAND_LABEL' },
  'Undefined label':                        { id: 'asm-009', explainKey: 'UNDEFINED_LABEL' },
  'Missing terminating quote':              { id: 'asm-010', explainKey: null },
  'Invalid operation':                      { id: 'asm-011', explainKey: 'INVALID_OPERATION' },
  'Bad register':                           { id: 'asm-012', explainKey: 'REGISTER' },
  'pcoffset9 out of range':                 { id: 'asm-013', explainKey: 'PCOFFSET9_RANGE' },
  'pcoffset9 out of range for ld':          { id: 'asm-014', explainKey: 'PCOFFSET9_RANGE' },
  'pcoffset9 out of range for st':          { id: 'asm-015', explainKey: 'PCOFFSET9_RANGE' },
  'pcoffset11 out of range':                { id: 'asm-016', explainKey: 'PCOFFSET11_RANGE' },
  'invalid header entry error':             { id: 'asm-017', explainKey: null },
  'Invalid number for .org directive':      { id: 'asm-018', explainKey: 'ORG_DIRECTIVE' },
  'Backward address on .org':               { id: 'asm-019', explainKey: 'ORG_DIRECTIVE' },
  'String constant missing leading quote':  { id: 'asm-020', explainKey: null },
  'malformed character literal':            { id: 'asm-021', explainKey: 'MALFORMED_CHAR_LITERAL' },
  'Unknown escape sequence':                { id: 'asm-022', explainKey: null },
  'Invalid mnemonic':                       { id: 'asm-023', explainKey: null },
  'Invalid escape sequence':                { id: 'asm-024', explainKey: null },
  'Character literal must contain exactly one character': { id: 'asm-025', explainKey: 'MULTICHAR_CHAR_LITERAL' },
  'Unspecified label error for':            { id: 'asm-026', explainKey: null },
  'imm5 out of range':                      { id: 'asm-027', explainKey: 'IMM5_RANGE' },
  'offset6 out of range':                   { id: 'asm-028', explainKey: null },
  'mov immediate value out of range':       { id: 'asm-029', explainKey: 'IMM9_RANGE' },
  'mvi immediate out of range':             { id: 'asm-030', explainKey: 'IMM9_RANGE' },
});

// normalize(message) — recover the condition key from a rendered message by stripping the
// two runtime suffixes that vary per occurrence:
//   - interpolation: `Invalid mnemonic: ${x}` → `Invalid mnemonic`
//   - verbose suggestClosest: `Bad register. Did you mean 'r0'?` → `Bad register`
function normalize(message) {
  return String(message == null ? '' : message)
    .replace(/\. Did you mean .*$/, '')   // verbose "Did you mean '…'?" suffix
    .replace(/:\s.*$/, '')                // ": ${…}" interpolation suffix
    .trim();
}

// lookupErrorId(message) — the registry id for a (possibly rendered) message, or null.
function lookupErrorId(message) {
  if (!message) return null;
  const entry = ASM_ERROR_IDS[normalize(message)];
  return entry ? entry.id : null;
}

// validateErrorIds(reg) — load-time guard (mirrors ilcc validateCommandRegistry): every id
// must match /^asm-\d{3}$/ and be unique. Throws on violation so a bad/duplicate id breaks
// require(), not silently ships. Exported so a spec can prove it has teeth.
function validateErrorIds(reg) {
  const seen = new Set();
  for (const [key, entry] of Object.entries(reg)) {
    const id = entry && entry.id;
    if (typeof id !== 'string' || !/^asm-\d{3}$/.test(id)) {
      throw new Error(`errorIds: malformed id '${id}' for '${key}' (expected asm-NNN)`);
    }
    if (seen.has(id)) {
      throw new Error(`errorIds: duplicate id '${id}'`);
    }
    seen.add(id);
  }
  return reg;
}

validateErrorIds(ASM_ERROR_IDS); // fires at require()

module.exports = { ASM_ERROR_IDS, lookupErrorId, normalize, validateErrorIds };
