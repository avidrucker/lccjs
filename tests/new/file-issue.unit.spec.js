'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'file-issue.js');
const { extractTerms, findDuplicates } = require(SCRIPT);

// Offline issue corpus — the dedup logic must never touch the network in tests.
const CORPUS = [
  { number: 1104, title: 'preflight.js bypasses the db-path resolver in npm test', state: 'OPEN' },
  { number: 999,  title: 'feat: add dark mode toggle to the showcase playground', state: 'OPEN' },
  { number: 500,  title: 'docs: document the assembler immediate-width pitfalls', state: 'CLOSED' },
];

let corpusFile;
beforeAll(() => {
  corpusFile = path.join(os.tmpdir(), `file-issue-corpus-${process.pid}.json`);
  fs.writeFileSync(corpusFile, JSON.stringify(CORPUS), 'utf8');
});
afterAll(() => {
  try { fs.unlinkSync(corpusFile); } catch { /* best effort */ }
});

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env },
  });
}

describe('extractTerms — significant-term reduction', () => {
  test('strips a conventional-commit prefix', () => {
    const terms = extractTerms('feat(process): dedup check before filing');
    expect(terms.has('feat')).toBe(false);
    expect(terms.has('process')).toBe(false);
    expect(terms.has('dedup')).toBe(true);
    expect(terms.has('filing')).toBe(true);
  });

  test('drops #refs, stopwords, and sub-3-char tokens', () => {
    const terms = extractTerms('bug: the db-path is not resolved in #1104');
    expect(terms.has('1104')).toBe(false); // ref stripped
    expect(terms.has('the')).toBe(false);  // stopword
    expect(terms.has('db')).toBe(false);   // 2 chars
    expect(terms.has('not')).toBe(false);  // stopword
    expect(terms.has('path')).toBe(true);
    expect(terms.has('resolved')).toBe(true);
  });

  test('empty / non-string input → empty set', () => {
    expect(extractTerms('').size).toBe(0);
    expect(extractTerms(null).size).toBe(0);
  });
});

describe('findDuplicates — overlap ranking', () => {
  const CANDIDATE = 'bug: preflight bypasses the db-path resolver';

  test('flags a near-duplicate title (the #1104/#1128 case)', () => {
    const dups = findDuplicates(CANDIDATE, CORPUS);
    expect(dups).toHaveLength(1);
    expect(dups[0].number).toBe(1104);
    expect(dups[0].overlap).toBeGreaterThanOrEqual(0.5);
    expect(dups[0].shared).toEqual(expect.arrayContaining(['preflight', 'bypasses', 'resolver']));
  });

  test('does not flag unrelated titles', () => {
    const dups = findDuplicates('feat: add solarized theme to the editor', CORPUS);
    expect(dups).toHaveLength(0);
  });

  test('respects minShared — a single shared term is not a duplicate', () => {
    // shares only "resolver" with #1104
    const dups = findDuplicates('refactor: extract the resolver helper', CORPUS, { minShared: 2 });
    expect(dups).toHaveLength(0);
  });

  test('sorts most-similar first when several match', () => {
    const corpus = [
      { number: 10, title: 'preflight bypasses resolver sometimes', state: 'OPEN' },
      { number: 11, title: 'preflight bypasses the db-path resolver entirely', state: 'OPEN' },
    ];
    const dups = findDuplicates('preflight bypasses db-path resolver', corpus);
    expect(dups.length).toBe(2);
    expect(dups[0].overlap).toBeGreaterThanOrEqual(dups[1].overlap);
  });
});

describe('CLI contract', () => {
  test('missing --title → exit 1', () => {
    const r = run(['--issues-file', corpusFile]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/missing required --title/);
  });

  test('likely duplicate → exit 2 and names the existing ticket', () => {
    const r = run(['--title', 'bug: preflight bypasses the db-path resolver', '--issues-file', corpusFile]);
    expect(r.status).toBe(2);
    expect(r.stdout).toMatch(/#1104/);
    expect(r.stderr).toMatch(/blocked/);
  });

  test('no duplicate → exit 0 and reports clear', () => {
    const r = run(['--title', 'feat: add solarized theme to the editor', '--issues-file', corpusFile]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/clear to file/);
  });

  test('--force overrides the duplicate block → exit 0', () => {
    const r = run(['--title', 'bug: preflight bypasses the db-path resolver', '--issues-file', corpusFile, '--force']);
    expect(r.status).toBe(0);
  });

  test('unreadable --issues-file → exit 1', () => {
    const r = run(['--title', 'anything', '--issues-file', '/no/such/file.json']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/cannot read --issues-file/);
  });
});
