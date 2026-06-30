// check-error-ids.js — coverage guard for the assembler error-ID registry (#1553).
//
// Statically scans src/core/assembler.js for the message literals passed to
// this.failAssembly(...) / this.error(...) and asserts each NORMALIZED literal resolves to
// a registered id in src/utils/errorIds.js. Drift (a reworded or new message with no
// registry entry) becomes a failing test instead of a silently un-identified error.
//
// Limitations (by design): only STRING/TEMPLATE literals as the first arg are checked —
// variable-message calls (e.g. `this.failAssembly(msg, ...)`) can't be resolved statically
// and are covered by runtime tests instead. Purely-dynamic literals are listed in ALLOW_SET.

'use strict';

const fs = require('fs');
const path = require('path');
const { normalize, ASM_ERROR_IDS } = require('../src/utils/errorIds');

// Dynamic placeholder literals: the concrete runtime forms ARE registered and verified by
// runtime tests, so the raw placeholder is intentionally excluded from the static scan.
const ALLOW_SET = new Set([
  '${type} out of range', // evaluateImmediate — concrete imm5/offset6/mov/mvi forms are registered
]);

// First string/template literal argument of a failAssembly/error call.
const CALL_RE = /this\.(?:failAssembly|error)\(\s*(['"`])((?:\\.|[^\\])*?)\1/g;

function scanAssemblerErrorIds(filePath) {
  const src = filePath || path.join(__dirname, '..', 'src', 'core', 'assembler.js');
  // Drop FULL-LINE comments so commented-out dead calls (e.g. a `// this.error(...)`
  // sketch) aren't scanned; real calls with a trailing `// note` keep their code.
  const text = fs.readFileSync(src, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
  const unresolved = [];
  let count = 0;
  let m;
  while ((m = CALL_RE.exec(text)) !== null) {
    const raw = m[2];
    count += 1;
    if (ALLOW_SET.has(raw)) continue;
    const key = normalize(raw);
    if (!Object.prototype.hasOwnProperty.call(ASM_ERROR_IDS, key)) {
      unresolved.push({ raw, key });
    }
  }
  return { unresolved, count };
}

// scanInterpreterErrorIds(filePath) — coverage guard for the interpreter (#1554). The
// interpreter carries ids INLINE on its typed-error throws (and one diagnostic cliErrorExit),
// so this collects the `int-NNN` literals actually used in source AND flags any diagnostic
// typed-error throw that lacks an id (minus the allow-list of non-diagnostic throws).
const INT_THROW_ALLOW = [
  /userName is required/,  // internal/programmer invariant, not a user diagnostic
  /String\(error\)/,       // raiseRuntimeError's generic re-wrap of a non-Error
];

function scanInterpreterErrorIds(filePath) {
  const src = (filePath
    ? fs.readFileSync(filePath, 'utf8')
    : fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'interpreter.js'), 'utf8'))
    .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');

  const usedIds = new Set([...src.matchAll(/\bint-\d{3}\b/g)].map((m) => m[0]));

  const unidentifiedThrows = [];
  const throwRe = /new (?:InterpreterRuntimeError|InvalidExecutableFormatError)\(([^\n]*)/g;
  let m;
  while ((m = throwRe.exec(src)) !== null) {
    const tail = m[1];
    if (/int-\d{3}/.test(tail)) continue;                 // carries an id
    if (INT_THROW_ALLOW.some((re) => re.test(tail))) continue; // intentionally id-less
    unidentifiedThrows.push(tail.slice(0, 60));
  }
  return { usedIds, unidentifiedThrows };
}

// scanLinkerErrorIds(filePath) — coverage guard for the linker (#1555). Like the interpreter,
// ids ride inline on `new LinkerError(...)` / `this.error(...)`. Allow-list the funnel's bare
// re-throw and the catch forwarder (which threads `error.id`, not a literal).
const LNK_THROW_ALLOW = [
  /^message\)/,         // `new LinkerError(message)` — the error() funnel's own re-throw
  /^error\.message,/,   // `this.error(error.message, …, error.id)` — catch forwards the typed error's id
];

function scanLinkerErrorIds(filePath) {
  const src = (filePath
    ? fs.readFileSync(filePath, 'utf8')
    : fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'linker.js'), 'utf8'))
    .split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n');

  const usedIds = new Set([...src.matchAll(/\blnk-\d{3}\b/g)].map((m) => m[0]));

  const unidentified = [];
  const re = /(?:new LinkerError|this\.error)\(([^\n]*)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const tail = m[1];
    if (/lnk-\d{3}/.test(tail)) continue;
    if (LNK_THROW_ALLOW.some((r) => r.test(tail.trim()))) continue;
    unidentified.push(tail.slice(0, 60));
  }
  return { usedIds, unidentified };
}

module.exports = {
  scanAssemblerErrorIds, scanInterpreterErrorIds, scanLinkerErrorIds,
  ALLOW_SET, INT_THROW_ALLOW, LNK_THROW_ALLOW,
};

// CLI: `node scripts/check-error-ids.js` — print the unresolved set (for local debugging).
if (require.main === module) {
  const { unresolved, count } = scanAssemblerErrorIds();
  console.log(`scanned ${count} literal error sites; ${unresolved.length} unresolved`);
  for (const u of unresolved) console.log(`  UNRESOLVED  raw=${JSON.stringify(u.raw)}  key=${JSON.stringify(u.key)}`);
  process.exit(unresolved.length === 0 ? 0 : 1);
}
