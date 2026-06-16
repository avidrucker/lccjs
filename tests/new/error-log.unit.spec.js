'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'error-log.js');
const ISO = '2026-06-06T12:00:00-1000';

// error-log.js validates argv synchronously and die()s BEFORE opening the DB,
// so these rejection tests never touch ~/.lccjs/lccjs.db.
function run(input) {
  return spawnSync(process.execPath, [SCRIPT, JSON.stringify(input)], {
    encoding: 'utf8',
    env: { ...process.env },
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
