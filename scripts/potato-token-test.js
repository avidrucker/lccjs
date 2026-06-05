#!/usr/bin/env node
// potato-token-test.js — per-token source substitution fuzzer
//
// Reads tests/fixtures/benchmark_isa.a, finds every non-comment token,
// replaces it with the string "potato" one at a time, assembles the result,
// and reports the outcome (ok / error message / timeout) for each token.
//
// On-demand only — not part of npm test or npm run test:all.
//
// Usage:
//   node scripts/potato-token-test.js
//   node scripts/potato-token-test.js > reports/potato-tokens.txt
//
// Inspired by S. Miller's token-substitution fuzzing technique. See #589.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT    = path.resolve(__dirname, '..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/benchmark_isa.a');
const LCCRUN  = path.join(ROOT, 'scripts/lccrun.sh');
const ASM     = path.join(ROOT, 'src/core/assembler.js');
const TOKEN_TIMEOUT = 10; // seconds per assembler invocation

// ---------------------------------------------------------------------------
// Tokenise: split source into non-comment tokens, recording file offsets.
// A token is a whitespace-delimited unit on the code portion of each line
// (i.e. after stripping ';' to end-of-line comments).
// ---------------------------------------------------------------------------
function tokenize(source) {
  const tokens = [];
  let fileOffset = 0;
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const commentPos = line.indexOf(';');
    const code = commentPos >= 0 ? line.slice(0, commentPos) : line;
    const re = /\S+/g;
    let m;
    while ((m = re.exec(code)) !== null) {
      tokens.push({
        index: tokens.length,
        value: m[0],
        line: i + 1,
        start: fileOffset + m.index,
        end: fileOffset + m.index + m[0].length,
      });
    }
    fileOffset += line.length + 1; // +1 for '\n'
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Substitute token i with "potato" and assemble the result.
// Returns { status, stdout, stderr }.
// ---------------------------------------------------------------------------
function assemble(source, tok) {
  const mutated = source.slice(0, tok.start) + 'potato' + source.slice(tok.end);

  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'potato-'));
  const tmpFile = path.join(tmpDir, 'potato_test.a');
  fs.writeFileSync(tmpFile, mutated, 'utf8');

  const result = spawnSync(
    'bash',
    [LCCRUN, String(TOKEN_TIMEOUT), 'node', ASM, tmpFile],
    {
      cwd: ROOT,           // name.nnn is resolved from cwd
      encoding: 'utf8',
      timeout: (TOKEN_TIMEOUT + 5) * 1000,  // outer JS guard
    }
  );

  try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}

  return result;
}

// ---------------------------------------------------------------------------
// Map a spawnSync result to a one-line outcome string.
// ---------------------------------------------------------------------------
// Assembler stderr format on error:
//   Error on line N of /tmp/.../potato_test.a:
//       <source line>
//   <error reason>
// We want the error reason — the last non-empty line of stderr.
function outcomeOf(result) {
  if (result.error) return `JS-ERROR: ${result.error.message}`;
  if (result.status === 124) return 'TIMEOUT';
  if (result.status === 0)   return 'ok';
  const lines = (result.stderr || '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
  // Last non-empty line is the error reason; fall back to exit code if nothing.
  return lines[lines.length - 1] || `exit ${result.status}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!fs.existsSync(FIXTURE)) {
    console.error(`Missing fixture: ${FIXTURE}`);
    console.error('Run: node src/core/assembler.js tests/fixtures/benchmark_isa.a');
    process.exit(1);
  }

  const source = fs.readFileSync(FIXTURE, 'utf8');
  const tokens = tokenize(source);

  console.log(`potato-token-test: ${tokens.length} non-comment tokens`);
  console.log(`fixture : ${FIXTURE}`);
  console.log(`timeout : ${TOKEN_TIMEOUT}s per token\n`);

  const IDX_W  = 4;
  const LINE_W = 4;
  const TOK_W  = 22;
  const header = `${'IDX'.padStart(IDX_W)}  ${'LINE'.padStart(LINE_W)}  ${'TOKEN'.padEnd(TOK_W)}  OUTCOME`;
  console.log(header);
  console.log('-'.repeat(header.length + 20));

  let okCount = 0;
  let errCount = 0;
  let timeoutCount = 0;

  for (const tok of tokens) {
    const result  = assemble(source, tok);
    const outcome = outcomeOf(result);

    if (outcome === 'ok')          okCount++;
    else if (outcome === 'TIMEOUT') timeoutCount++;
    else                           errCount++;

    console.log(
      `${String(tok.index).padStart(IDX_W)}  ` +
      `${String(tok.line).padStart(LINE_W)}  ` +
      `${tok.value.padEnd(TOK_W)}  ` +
      outcome
    );
  }

  console.log(`\nSummary: ${tokens.length} tokens — ok: ${okCount}, errors: ${errCount}, timeouts: ${timeoutCount}`);
}

main();
