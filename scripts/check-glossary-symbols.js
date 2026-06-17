#!/usr/bin/env node
'use strict';
/*
 * check-glossary-symbols.js — rot-detector for ADR 0001 symbol-anchored `Source:` refs.
 *
 * For every `**Source:**` line in the core-module glossaries, verify that each cited
 * symbol / grep-landmark still exists in the source file(s) it names. Catches the failure
 * mode ADR 0001 was meant to kill in line-number form: a rename/removal silently making a
 * glossary ref stale — now in symbol form.
 *
 * LENIENT BY DESIGN (#1362): we verify identifier-like backticked symbols and
 * grep `literal` landmarks, and deliberately SKIP wildcards/ranges (e.g. `TRAP_*`),
 * char-literals, and free-form expressions — minimizing false positives so the check stays
 * green-by-default and trustworthy. A token is resolved if it appears in ANY file cited on
 * its line (basenames can be ambiguous, e.g. constants.js → core + plus).
 *
 * Usage:  node scripts/check-glossary-symbols.js        (exit 1 if any unresolved)
 * API:    require('./check-glossary-symbols').checkGlossarySymbols() -> { unresolved, stats }
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GLOSSARY_DIR = path.join(REPO_ROOT, 'docs', 'glossary');
// The three core-module glossaries. README.md is the convention doc (its one Source line is a
// `<file>.js` template); stats-analysis.md cites notebooks — both intentionally out of scope.
const GLOSSARIES = ['assembler.md', 'interpreter.md', 'linker.md'];

// Build a basename -> [absolute paths] map for every .js under src/.
function buildSrcIndex() {
  const index = new Map();
  (function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.name.endsWith('.js')) {
        if (!index.has(ent.name)) index.set(ent.name, []);
        index.get(ent.name).push(full);
      }
    }
  })(path.join(REPO_ROOT, 'src'));
  return index;
}

const fileCache = new Map();
function readFile(p) {
  if (!fileCache.has(p)) fileCache.set(p, fs.readFileSync(p, 'utf8'));
  return fileCache.get(p);
}

const IDENT = /^[A-Za-z_]\w*(\(\))?$/;          // foo or foo()  → a checkable symbol
const FILE_TOKEN = /^[\w-]+\.js$/;               // assembler.js  → a cited source file

// Parse one `**Source:**` line into checkable obligations.
//
// - Files are basenames cited as `file.js` immediately followed by an em-dash (the entry's
//   "this lives in <file>" clause). A `.js` token NOT followed by `—` is prose/landmark
//   (e.g. the `assemblerPlus.js` string the assembler prints), never a cited file.
// - Grep landmarks: a `grep `lit`` clause may list several comma-separated literals
//   (`grep `A`, `B``); continuation literals are matched as non-paren tokens so a following
//   symbol like `assembleRET()` is NOT slurped into the landmark list.
// - Symbols: remaining identifier-like backticked tokens (`foo`, `foo()`).
function parseSourceLine(text) {
  const backticked = [...text.matchAll(/`([^`]+)`/g)].map(m => m[1]);
  const files = [...text.matchAll(/`([\w-]+\.js)`\s*—/g)].map(m => m[1]);
  const greps = [];
  for (const m of text.matchAll(/grep\s+(`[^`]+`(?:,\s*`[^`(]+`)*)/g)) {
    for (const lit of m[1].matchAll(/`([^`]+)`/g)) greps.push(lit[1]);
  }
  const grepSet = new Set(greps);
  const fileSet = new Set(files);
  const symbols = backticked.filter(t =>
    !fileSet.has(t) && !grepSet.has(t) && IDENT.test(t)
  ).map(t => t.replace(/\(\)$/, ''));
  return { files, symbols, greps };
}

function checkGlossarySymbols() {
  const srcIndex = buildSrcIndex();
  const unresolved = [];
  let lines = 0, symbolsChecked = 0, grepsChecked = 0;

  for (const g of GLOSSARIES) {
    const md = fs.readFileSync(path.join(GLOSSARY_DIR, g), 'utf8').split('\n');
    md.forEach((line, i) => {
      if (!line.startsWith('**Source:**')) return;
      lines++;
      const lineNo = i + 1;
      const text = line.slice('**Source:**'.length);
      const { files, symbols, greps } = parseSourceLine(text);

      // resolve cited files; an unresolvable basename is itself rot
      const paths = [];
      for (const f of files) {
        const hits = srcIndex.get(f);
        if (!hits || !hits.length) {
          unresolved.push({ glossary: g, line: lineNo, kind: 'file', token: f });
        } else paths.push(...hits);
      }
      if (!paths.length) return; // nothing checkable (already flagged files if any)
      const contents = paths.map(readFile);
      symbolsChecked += symbols.length;
      grepsChecked += greps.length;
      for (const miss of tokensNotFound({ symbols, greps }, contents)) {
        unresolved.push({ glossary: g, line: lineNo, kind: miss.kind, token: miss.token, files });
      }
    });
  }
  return { unresolved, stats: { lines, symbolsChecked, grepsChecked } };
}

// Pure verifier: given parsed {symbols, greps} and the cited files' contents (array of
// strings), return the tokens that resolve in NONE of them. Symbols are matched as whole
// words; grep landmarks as literal substrings. Pure + content-injectable so it is unit-
// testable (and provably able to fail) without touching the filesystem.
function tokensNotFound({ symbols = [], greps = [] }, contents) {
  const missing = [];
  const wordIn = (sym) => {
    const re = new RegExp('\\b' + sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    return contents.some(c => re.test(c));
  };
  for (const sym of symbols) if (!wordIn(sym)) missing.push({ kind: 'symbol', token: sym });
  for (const lit of greps) if (!contents.some(c => c.includes(lit))) missing.push({ kind: 'grep', token: lit });
  return missing;
}

module.exports = { checkGlossarySymbols, parseSourceLine, tokensNotFound };

if (require.main === module) {
  const { unresolved, stats } = checkGlossarySymbols();
  console.log(`glossary symbol check — ${stats.lines} Source lines, ` +
    `${stats.symbolsChecked} symbols + ${stats.grepsChecked} grep-landmarks verified across ` +
    `${GLOSSARIES.join(', ')}`);
  if (unresolved.length) {
    console.error(`\n✗ ${unresolved.length} unresolved reference(s):`);
    for (const u of unresolved) {
      console.error(`  ${u.glossary}:${u.line}  [${u.kind}] \`${u.token}\`` +
        (u.files ? `  (cited files: ${u.files.join(', ')})` : ''));
    }
    process.exit(1);
  }
  console.log('✓ all cited symbols & landmarks resolve.');
}
