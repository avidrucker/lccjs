#!/usr/bin/env node
// potato-input-test.js — per-stdin-prompt input fuzzer with oracle parity.
//
// Reads tests/fixtures/benchmark_isa_inputs.txt (the expected stdin sequence
// for tests/fixtures/benchmark_isa.a), then replaces ONE input at a time with
// the nonsense string "potato" and runs the program — once through the LCC.js
// interpreter and once through the oracle ($LCC_ORACLE) — capturing stdout,
// stderr, and exit code from each. Divergences are flagged in the report.
//
// The goal is discovery, not correctness: surface unhandled runtime-input
// edge cases, surprising error messages, and LCC.js-vs-oracle parity gaps.
//
// Inputs are fuzzed in REVERSE order (last prompt first). Front-loading the
// substitution at the latest prompt means the earlier prompts still receive
// their real values and stay reachable, instead of a fatal rejection at an
// early prompt making the later prompts untestable.
//
// On-demand only — NOT part of `npm test` or `npm run test:all`.
//
// Usage:
//   node scripts/potato-input-test.js
//   npm run test:potato-inputs
//   node scripts/potato-input-test.js > reports/potato-inputs.txt
//
// Behaviour:
//   - Assembles benchmark_isa.a -> .e on the fly (no committed .e fixture).
//   - When LCC_ORACLE is unset/missing, runs interpreter-only and omits the
//     parity column (the tool is still useful without the oracle binary).
//   - Parity is an EXACT comparison of stdout+stderr+exit code, report-only:
//     every difference is flagged but the script always exits 0. Triage is
//     left to the human; known-deviation noise (banners, etc.) is expected.
//
// Inspired by S. Miller's token-substitution fuzzing technique. See #590, #587.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT      = path.resolve(__dirname, '..');
const FIXTURE_A = path.join(ROOT, 'tests/fixtures/benchmark_isa.a');
const INPUTS    = path.join(ROOT, 'tests/fixtures/benchmark_isa_inputs.txt');
const LCCRUN    = path.join(ROOT, 'scripts/lccrun.sh');
const ASM       = path.join(ROOT, 'src/core/assembler.js');
const INTERP    = path.join(ROOT, 'src/core/interpreter.js');

const TIMEOUT   = 10;            // seconds per subprocess (assemble/interp/oracle)
const POTATO    = 'potato';      // the nonsense substitution
const NAME_NNN  = 'TestUser\n';  // both engines read name.nnn from cwd; staging it
                                 // prevents the name prompt from eating the first
                                 // stdin line and corrupting the fuzz sequence.

// Load .env so LCC_ORACLE is picked up the same way the test suite sees it.
try {
  require('dotenv').config({ path: path.join(ROOT, '.env'), quiet: true });
} catch (_) { /* dotenv is a dev dep; absence just means rely on process.env */ }

// Mirror tests/helpers/env.js tilde-expansion for the oracle path.
function expandTilde(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}
const ORACLE = expandTilde(process.env.LCC_ORACLE || '');
const oracleConfigured = Boolean(ORACLE) && fs.existsSync(ORACLE);

// ---------------------------------------------------------------------------
// Read the expected stdin sequence, one input per line (trailing blank dropped).
// ---------------------------------------------------------------------------
function readInputs() {
  const raw = fs.readFileSync(INPUTS, 'utf8');
  return raw.replace(/\n+$/, '').split('\n');
}

// ---------------------------------------------------------------------------
// Assemble benchmark_isa.a -> .e once, in a temp dir. Returns the .e bytes.
// Fails loudly if the fixture does not assemble cleanly.
// ---------------------------------------------------------------------------
function assembleFixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'potato-in-asm-'));
  fs.copyFileSync(FIXTURE_A, path.join(tmp, 'benchmark_isa.a'));
  fs.writeFileSync(path.join(tmp, 'name.nnn'), NAME_NNN);

  const r = spawnSync(
    'bash',
    [LCCRUN, String(TIMEOUT), 'node', ASM, 'benchmark_isa.a'],
    { cwd: tmp, encoding: 'utf8', timeout: (TIMEOUT + 5) * 1000 }
  );

  const ePath = path.join(tmp, 'benchmark_isa.e');
  if (r.status !== 0 || !fs.existsSync(ePath)) {
    console.error(`Failed to assemble ${FIXTURE_A}:`);
    console.error((r.stderr || r.stdout || `exit ${r.status}`).trim());
    try { fs.rmSync(tmp, { recursive: true }); } catch (_) {}
    process.exit(1);
  }

  const bytes = fs.readFileSync(ePath);
  try { fs.rmSync(tmp, { recursive: true }); } catch (_) {}
  return bytes;
}

// ---------------------------------------------------------------------------
// Run one engine (argv = full command, e.g. ['node', INTERP, 'benchmark_isa.e']
// or [ORACLE, 'benchmark_isa.e']) on the staged .e with the given stdin.
// Each run gets a fresh cwd holding name.nnn + the executable so the two
// engines never share working state. Returns the spawnSync result.
// ---------------------------------------------------------------------------
function runEngine(argv, eBytes, stdinStr) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'potato-in-run-'));
  fs.writeFileSync(path.join(tmp, 'name.nnn'), NAME_NNN);
  fs.writeFileSync(path.join(tmp, 'benchmark_isa.e'), eBytes);

  const r = spawnSync(
    'bash',
    [LCCRUN, String(TIMEOUT), ...argv],
    { cwd: tmp, input: stdinStr, encoding: 'utf8', timeout: (TIMEOUT + 5) * 1000 }
  );

  try { fs.rmSync(tmp, { recursive: true }); } catch (_) {}
  return r;
}

// One-line outcome summary for a spawnSync result.
function outcomeOf(r) {
  if (r.error) return `JS-ERROR: ${r.error.message}`;
  if (r.status === 124) return 'TIMEOUT';
  return `exit ${r.status}`;
}

// Exact comparison of two runs across stdout, stderr, and exit code.
function exactMatch(a, b) {
  return a.status === b.status &&
         (a.stdout || '') === (b.stdout || '') &&
         (a.stderr || '') === (b.stderr || '');
}

// Truncate long captured streams for the mismatch detail dump.
function clip(s, max = 800) {
  s = s || '';
  return s.length > max ? `${s.slice(0, max)}\n… [${s.length - max} more chars]` : s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(FIXTURE_A)) {
    console.error(`Missing fixture: ${FIXTURE_A}`);
    process.exit(1);
  }
  if (!fs.existsSync(INPUTS)) {
    console.error(`Missing inputs list: ${INPUTS}`);
    process.exit(1);
  }

  const inputs = readInputs();
  const eBytes = assembleFixture();

  console.log('potato-input-test: per-stdin-prompt input fuzzer (reverse order)');
  console.log(`fixture : ${FIXTURE_A}`);
  console.log(`inputs  : ${inputs.length} prompts — [${inputs.join(', ')}]`);
  console.log(`oracle  : ${oracleConfigured ? ORACLE : '(unset — interpreter-only)'}`);
  console.log(`timeout : ${TIMEOUT}s per run\n`);

  const IDX_W = 3, ORIG_W = 8;
  const cols = oracleConfigured
    ? `${'IDX'.padStart(IDX_W)}  ${'ORIGINAL'.padEnd(ORIG_W)}  ${'INTERP'.padEnd(12)}  ${'ORACLE'.padEnd(12)}  PARITY`
    : `${'IDX'.padStart(IDX_W)}  ${'ORIGINAL'.padEnd(ORIG_W)}  INTERP`;
  console.log(cols);
  console.log('-'.repeat(cols.length + 10));

  const mismatches = [];
  let matchCount = 0;

  // Reverse order: last prompt first.
  for (let i = inputs.length - 1; i >= 0; i--) {
    const seq = inputs.slice();
    const original = seq[i];
    seq[i] = POTATO;
    const stdin = seq.join('\n') + '\n';

    const js = runEngine(['node', INTERP, 'benchmark_isa.e'], eBytes, stdin);
    const jsOut = outcomeOf(js);

    if (oracleConfigured) {
      const or = runEngine([ORACLE, 'benchmark_isa.e'], eBytes, stdin);
      const orOut = outcomeOf(or);
      const match = exactMatch(js, or);
      if (match) matchCount++;
      else mismatches.push({ index: i, original, js, or });

      console.log(
        `${String(i).padStart(IDX_W)}  ${original.padEnd(ORIG_W)}  ` +
        `${jsOut.padEnd(12)}  ${orOut.padEnd(12)}  ${match ? 'match' : 'DIFF'}`
      );
    } else {
      console.log(`${String(i).padStart(IDX_W)}  ${original.padEnd(ORIG_W)}  ${jsOut}`);
    }
  }

  if (oracleConfigured) {
    console.log(
      `\nSummary: ${inputs.length} runs — match: ${matchCount}, ` +
      `mismatch: ${mismatches.length}`
    );

    for (const m of mismatches) {
      console.log(`\n========== DIFF at index ${m.index} (original "${m.original}" → "${POTATO}") ==========`);
      console.log(`--- INTERP (exit ${m.js.status}) stdout ---\n${clip(m.js.stdout)}`);
      console.log(`--- INTERP stderr ---\n${clip(m.js.stderr)}`);
      console.log(`--- ORACLE (exit ${m.or.status}) stdout ---\n${clip(m.or.stdout)}`);
      console.log(`--- ORACLE stderr ---\n${clip(m.or.stderr)}`);
    }

    if (mismatches.length) {
      console.log(
        '\nNote: parity uses EXACT stdout+stderr+exit comparison; banner/format ' +
        'differences show as DIFF. Triage against docs/parity_deviations.md. ' +
        'For known input-rejection EOF and hin/din→sin newline differences, see §29.'
      );
    }
  } else {
    console.log(`\nSummary: ${inputs.length} interpreter-only runs (oracle not configured).`);
  }

  // Report-only: always exit 0, even on parity mismatches.
}

main();
