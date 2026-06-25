#!/usr/bin/env node
// char-parity-probe.js — compare OG LCC vs lccjs on char-literal evaluation.
// Tests each literal independently (so a per-literal error doesn't block the rest)
// and prints the numeric value (via dout) or the assembler error for each tool.
//
// Run from the repo's scratch/ directory:   node char-parity-probe.js
// Needs LCC_ORACLE in ../.env (and a name.nnn here, already present).
//
// Expected after #1482 (strict-by-default): single chars + valid escapes MATCH;
// multi-char literals ('ab', '/;', '/n', '//', '/\') and the unknown-escape and
// bare-quote cases are INTENTIONAL divergences (lccjs fails loud) — see
// parity_deviations.md §15 and §31. The OG values return under --oracle-compat
// (#1481). So "match=no" rows below are BY DESIGN, not bugs.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const env = fs.readFileSync(path.join(REPO, '.env'), 'utf8');
const ORACLE = (env.match(/^LCC_ORACLE=(.*)$/m) || [])[1];
const LCC = path.join(REPO, 'src/cli/lcc.js');
const DIR = __dirname;                         // run in scratch/ (has name.nnn)

// Exact asm text of each char-literal token under test.
// '/\' and '\/' probe how a backslash interacts with first-char-wins vs the
// escape path (#1479). '' (empty char) added in #1483: oracle yields 39 (like
// '''), lccjs rejects it as a malformed character literal (§31).
const lits = ["';'", "'-'", "'/'", "'''", "'\\n'", "'\\r'",
              "'/n'", "'//'", "'\\\\'", "'ab'", "'\\;'", "'/;'",
              "'/\\'", "'\\/'", "''"];

function evalLit(bin, args) {
  const r = spawnSync(bin, args, { cwd: DIR, input: '', timeout: 10000, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/=+\s*Output[\s\S]*?\n\s*(-?\d+)/);
  if (m) return `val=${m[1].trim()}`;
  // surface the exact lccjs/oracle error message so the diagnostics are visible
  const e = out.match(/(Character literal[^\n]*|malformed[^\n]*|Invalid[^\n]*|Missing[^\n]*|Bad[^\n]*|Unknown[^\n]*)/i);
  return `ERR: ${e ? e[1].trim() : 'no value'}`;
}

console.log('literal '.padEnd(9), '| oracle'.padEnd(20), '| lccjs'.padEnd(20), '| match');
console.log('-'.repeat(70));
for (let i = 0; i < lits.length; i++) {
  const prog = `        .start main\nmain:   ld r0, c\n        dout\n        nl\n        halt\nc:      .word ${lits[i]}\n`;
  const f = path.join(DIR, `_probe${i}.a`);
  fs.writeFileSync(f, prog);
  const o = ORACLE ? evalLit(ORACLE, [`_probe${i}.a`]) : '(no LCC_ORACLE)';
  const j = evalLit('node', [LCC, `_probe${i}.a`]);
  const match = o === j ? 'YES' : 'no';
  console.log(lits[i].padEnd(8), '|', o.padEnd(18), '|', j.padEnd(18), '|', match);
  // clean up the generated artifacts
  for (const ext of ['.a', '.e', '.lst', '.bst', '.o'])
    try { fs.unlinkSync(path.join(DIR, `_probe${i}${ext}`)); } catch (_) {}
}

// Empty STRING is a directive, not a .word char literal, so probe it separately
// (#1483). Both tools accept `.string ""` and emit only the NUL terminator —
// parity. We report whether each assembles without error.
{
  const prog = '        .start main\nmain:   lea r0, s\n        halt\ns:      .string ""\n';
  const f = path.join(DIR, '_probeES.a');
  fs.writeFileSync(f, prog);
  const assembles = (bin, args) => {
    const r = spawnSync(bin, args, { cwd: DIR, input: '', timeout: 10000, encoding: 'utf8' });
    const out = (r.stdout || '') + (r.stderr || '');
    return /error|invalid|bad|missing/i.test(out) ? 'ERR' : 'OK (\\0 only)';
  };
  const o = ORACLE ? assembles(ORACLE, ['_probeES.a']) : '(no LCC_ORACLE)';
  const j = assembles('node', [LCC, '_probeES.a']);
  console.log('-'.repeat(70));
  console.log('.string "" '.padEnd(8), '|', o.padEnd(18), '|', j.padEnd(18), '|', o === j ? 'YES' : 'no');
  for (const ext of ['.a', '.e', '.lst', '.bst', '.o'])
    try { fs.unlinkSync(path.join(DIR, `_probeES${ext}`)); } catch (_) {}
}
