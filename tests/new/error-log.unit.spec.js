'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'error-log.js');
const ISO = '2026-06-06T12:00:00-1000';

// error-log.js validates argv synchronously and die()s BEFORE opening the DB,
// so these rejection tests never touch ~/.lccjs/lccjs.db.
function run(input, extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, JSON.stringify(input)], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

describe('error-log — message is required (#1022)', () => {
  test('omitted message → exit 1 with a clear message', () => {
    const r = run({ occurred_iso: ISO, error_type: 'OTHER' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required field: "message"/);
    expect(r.stderr).toMatch(/analytically useless/);
  });

  test('explicit null message → exit 1', () => {
    const r = run({ occurred_iso: ISO, error_type: 'OTHER', message: null });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required field: "message"/);
  });

  test('empty-string message → exit 1', () => {
    const r = run({ occurred_iso: ISO, message: '' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required field: "message"/);
  });

  test('whitespace-only message → exit 1 (treated as empty)', () => {
    const r = run({ occurred_iso: ISO, message: '   ' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required field: "message"/);
  });

  test('non-empty message passes the message check (fails later on a bad ticket, before any DB write)', () => {
    // Probe pattern (mirrors velocity-log tests): a known-later-failing field —
    // a bad `ticket`, validated before the DB is opened — confirms the message
    // check did not block and that no row was inserted.
    const r = run({ occurred_iso: ISO, message: 'something broke', ticket: 'bad' });
    expect(r.stderr).not.toMatch(/Missing required field: "message"/);
    expect(r.stderr).toMatch(/"ticket" must be a positive integer/);
    expect(r.status).toBe(1);
  });

  test('missing occurred_iso still fails first (the message check does not mask it)', () => {
    const r = run({ message: 'x' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/Missing required field: "occurred_iso"/);
  });
});

describe('error-log — error_type vocabulary (#1118)', () => {
  test('unknown error_type → exit 1 naming the offending value', () => {
    const r = run({ occurred_iso: ISO, message: 'x', error_type: 'NOPE_FAIL' });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unknown error_type "NOPE_FAIL"/);
  });

  // Probe pattern: a valid error_type must pass the type check, so the row fails
  // LATER on a known-bad ticket (validated before the DB opens) — proving the new
  // code was accepted, without writing to ~/.lccjs/lccjs.db.
  test.each(['COMPLIANCE_FAIL', 'BEHAVIORAL_FAIL'])(
    '%s is accepted by the error_type validator',
    (errorType) => {
      const r = run({ occurred_iso: ISO, message: 'x', error_type: errorType, ticket: 'bad' });
      expect(r.stderr).not.toMatch(/unknown error_type/);
      expect(r.stderr).toMatch(/"ticket" must be a positive integer/);
      expect(r.status).toBe(1);
    },
  );
});

describe('error-log — context must be valid JSON (#1386)', () => {
  const os = require('os');
  const fs = require('fs');
  const Database = require('better-sqlite3');

  // Mirror of the real errors table (docs/errors-schema.md).
  const CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_iso TEXT NOT NULL, agent TEXT, model TEXT, ticket INTEGER,
      repo TEXT DEFAULT 'lccjs', error_type TEXT, message TEXT, context TEXT, notes TEXT
    )
  `;

  let testDbPath;
  let testDb;

  beforeEach(() => {
    const suffix = `${process.pid}-${Math.floor(Math.random() * 1e9)}`;
    testDbPath = path.join(os.tmpdir(), `errlog-ctx-${suffix}.db`);
    testDb = new Database(testDbPath);
    testDb.exec(CREATE_TABLE);
  });

  afterEach(() => {
    try { testDb.close(); } catch (_) {}
    for (const p of [testDbPath, testDbPath + '-shm', testDbPath + '-wal']) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  });

  function runWithTestDb(input) {
    return run(input, { LCCJS_DB: testDbPath });
  }

  function lastContext() {
    return testDb.prepare('SELECT context FROM errors ORDER BY id DESC LIMIT 1').get();
  }

  test('a bare non-JSON string context is rejected before any DB write', () => {
    // Validation die()s before the DB opens, so no row is inserted. This is the
    // row-121 footgun (a bare "behavioral=true; ..." string) the guard closes.
    testDb.close();
    const r = runWithTestDb({
      occurred_iso: ISO, message: 'x', context: 'behavioral=true; not json',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/"context" must be valid JSON/);
  });

  test('an object context is serialized to valid JSON, not "[object Object]"', () => {
    // The row-67/68 footgun: an object used to stringify to "[object Object]"
    // via String(), aborting later json_extract() aggregates.
    const r = runWithTestDb({
      occurred_iso: ISO, message: 'x', error_type: 'BEHAVIORAL_FAIL',
      context: { behavioral: true, failure_mode: 'SCOPE_OVERSTEP' },
    });
    expect(r.status).toBe(0);
    const row = lastContext();
    expect(row.context).not.toBe('[object Object]');
    expect(() => JSON.parse(row.context)).not.toThrow();
    expect(JSON.parse(row.context)).toEqual({ behavioral: true, failure_mode: 'SCOPE_OVERSTEP' });
  });

  test('a valid JSON-string context is stored verbatim', () => {
    const r = runWithTestDb({
      occurred_iso: ISO, message: 'x', context: '{"cmd":"git push","exit_code":1}',
    });
    expect(r.status).toBe(0);
    expect(lastContext().context).toBe('{"cmd":"git push","exit_code":1}');
  });
});
