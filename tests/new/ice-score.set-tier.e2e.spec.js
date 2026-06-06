'use strict';

// Regression test for #963: `--set-tier` must NOT record a DB tier — and must exit
// non-zero — when the mandatory gh writes (the priority:* label add and the audit
// comment) fail. Before the fix, the script logged "Applied priority:X with audit
// comment" and wrote the DB row even with gh offline, leaving the DB asserting an
// escalation that had no label and no audit trail (the audit comment is mandatory
// per the rubric).
//
// Serial-safe; each test gets its own tmpdir, a temp DB, and a fake failing `gh`
// on PATH. No network, no real gh, no real GitHub state touched.
//
// Only the failure path is covered here: on success the script re-exports
// stats/ice-scores.csv (a hardcoded repo path), so a positive-path e2e would
// clobber tracked files. Redirecting that output is a separate concern (#966 /
// the export refactor); the pure-function unit specs land in #965.
//
// Run via:  npm test -- --runTestsByPath tests/new/ice-score.set-tier.e2e.spec.js

const { execFileSync } = require('child_process');
const Database = require('better-sqlite3');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ICE_JS = path.resolve(__dirname, '../../scripts/ice-score.js');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS ice_scores (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    issue          INTEGER NOT NULL UNIQUE,
    title          TEXT,
    type           TEXT,
    I              REAL,
    C              REAL,
    E              REAL,
    ice_score      REAL,
    tier           TEXT DEFAULT '',
    yegor_priority INTEGER,
    actionable     TEXT DEFAULT 'Y',
    labels         TEXT,
    notes          TEXT,
    updated_iso    TEXT
  )
`;

let tmpDir, dbPath, env;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ice-settier-'));
  dbPath = path.join(tmpDir, 'ice.db');
  const db = new Database(dbPath);
  db.exec(SCHEMA);
  db.close();

  // Fake `gh`: every subcommand exits non-zero (simulates gh offline / auth gone).
  const fakeBin = path.join(tmpDir, 'bin');
  fs.mkdirSync(fakeBin);
  const ghPath = path.join(fakeBin, 'gh');
  fs.writeFileSync(ghPath, '#!/usr/bin/env bash\necho "fake-gh: simulated failure ($*)" >&2\nexit 1\n');
  fs.chmodSync(ghPath, 0o755);

  env = { ...process.env, LCCJS_DB: dbPath, PATH: `${fakeBin}:${process.env.PATH}` };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function runSetTier(issue) {
  try {
    const out = execFileSync(
      'node',
      [ICE_JS, '--set-tier', 'elevated', '--issue', String(issue),
       '--who', 'tester', '--why', 'repro #963', '--expiry', 'end of test'],
      { env, encoding: 'utf8', stdio: 'pipe' },
    );
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

test('--set-tier exits non-zero and explains the failure when gh writes fail', () => {
  const r = runSetTier(999);
  expect(r.code).not.toBe(0);
  expect(r.out).toMatch(/gh write failed/i);
  expect(r.out).toMatch(/tier NOT recorded/i);
});

test('--set-tier records no DB tier when gh writes fail', () => {
  runSetTier(999);
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT * FROM ice_scores WHERE issue = 999').get();
  db.close();
  expect(row).toBeUndefined();
});
