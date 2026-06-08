'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'velocity-log.js');

function run(input, extraArgs = [], extraEnv = {}) {
  // Always pass --from-main: the worktree-guard rejects subprocess runs from the
  // main checkout when worktrees are active, masking the validation assertions
  // the tests are actually checking (#940).
  return spawnSync(process.execPath, [SCRIPT, JSON.stringify(input), '--from-main', ...extraArgs], {
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  });
}

describe('velocity-log — negative delta validation (#440)', () => {
  test('rejects negative delta_h_min with exit 1 and error message', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_h_min: -5 });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/delta_h_min must be >= 0/);
    expect(result.stderr).toMatch(/estimate - actual/);
  });

  test('negative delta_c_min is accepted — overrun is valid calibration signal', () => {
    // Protocol: negative delta_c_min means the agent ran over the C estimate.
    // Discarding it destroys calibration signal, so it is allowed. (Contrast: delta_h_min
    // is still rejected when negative — Yegor's H cap is a human discipline boundary.)
    const result = run({ role: 'DEV', agent: 'TEST', delta_c_min: -3, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
  });

  test('zero delta_h_min passes validation (fails later on invalid ticket)', () => {
    // Probe: a bad `ticket` value causes a known later validation error,
    // confirming the delta check did not block.
    const result = run({ role: 'DEV', agent: 'TEST', delta_h_min: 0, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_h_min must be/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('zero delta_c_min passes validation (fails later on invalid ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_c_min: 0, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('positive delta values pass validation (fails later on invalid ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_h_min: 10, delta_c_min: 5, ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_h_min must be/);
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('null/omitted delta fields are allowed (pass validation)', () => {
    // null deltas are valid (row logged without actuals yet)
    const result = run({ role: 'DEV', agent: 'TEST', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/delta_h_min must be/);
    expect(result.stderr).not.toMatch(/delta_c_min must be/);
  });
});

// #453 added a hard reject for non-canonical models; #1184 relaxed it to
// notice-not-prevent — a non-canonical/new model is RECORDED with a note, never
// rejected. An invalid role is used below as a stopper: the role check runs
// *after* the model check, so it both proves we got past the model code and
// halts before the real DB write (the canonical-accept tests use a bad `ticket`,
// but ticket is validated *before* the model, so it can't probe past it).
describe('velocity-log — non-canonical model is a notice, not a reject (#453, #1184)', () => {
  test('records full model ID (claude-sonnet-4-6) with a notice and proceeds', () => {
    const result = run({ role: 'BOGUS', agent: 'TEST', model: 'claude-sonnet-4-6' });
    expect(result.stderr).toMatch(/note: model "claude-sonnet-4-6" is new or non-canonical/);
    expect(result.stderr).toMatch(/recording it anyway/);
    expect(result.stderr).not.toMatch(/must follow canonical/);
    expect(result.stderr).toMatch(/unknown role/); // proceeded past the model check
  });

  test('records full model ID (claude-opus-4-8) with a notice and proceeds', () => {
    const result = run({ role: 'BOGUS', agent: 'TEST', model: 'claude-opus-4-8' });
    expect(result.stderr).toMatch(/note: model "claude-opus-4-8" is new or non-canonical/);
    expect(result.stderr).not.toMatch(/must follow canonical/);
  });

  test('accepts canonical short-form sonnet-4.6 (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'sonnet-4.6', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('accepts canonical short-form opus-4.8 (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'opus-4.8', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('allows omitted model field (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });

  test('allows empty string model field (fails later on bad ticket)', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: '', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/canonical format/);
    expect(result.stderr).toMatch(/ticket/);
  });
});

describe('velocity-log — invalid role hard-fails (#535)', () => {
  test('rejects unknown role with exit 1 and error message', () => {
    const result = run({ role: 'ARCHITECT', agent: 'TEST', ticket: 1 });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/unknown role "ARCHITECT"/);
    expect(result.stderr).toMatch(/valid:/);
  });

  test('rejects full-form role name (ARCHITECT instead of ARC)', () => {
    const result = run({ role: 'ARCHITECT', agent: 'TEST' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/unknown role/);
  });

  test('valid role passes role check (fails later on bad ticket)', () => {
    const result = run({ role: 'ARC', agent: 'TEST', ticket: 'bad' });
    expect(result.stderr).not.toMatch(/unknown role/);
    expect(result.stderr).toMatch(/ticket/);
  });
});

describe('velocity-log — role vocabulary (#519)', () => {
  // velocity-log.js runs at require-time, so we scan the source instead of importing.
  const fs = require('fs');
  const src = fs.readFileSync(require.resolve('../../scripts/velocity-log'), 'utf8');

  // Extract the VALID_ROLES Set literal from the source.
  const match = src.match(/const VALID_ROLES\s*=\s*new Set\(\[([^\]]+)\]\)/);
  const roles = match ? match[1].match(/'([A-Z]+)'/g).map(s => s.replace(/'/g, '')) : [];

  test('REVIEW is in VALID_ROLES (#519)', () => {
    expect(roles).toContain('REVIEW');
  });

  test('ARCHITECT is not in VALID_ROLES (typo for ARC — DB row 378 needs manual correction)', () => {
    expect(roles).not.toContain('ARCHITECT');
  });

  test('all ten original roles are still present', () => {
    ['DEV', 'TEST', 'WRITER', 'RESEARCH', 'SPIKE', 'ARC', 'PM', 'COMBO', 'DATA', 'CHORE'].forEach(r => {
      expect(roles).toContain(r);
    });
  });
});

describe('velocity-log — --update-id flag (#536)', () => {
  const os = require('os');
  const fs = require('fs');
  const Database = require('better-sqlite3');

  const CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS velocity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket INTEGER, title TEXT, role TEXT, h_min REAL, c_min REAL,
      actual_min REAL, delta_h_min REAL, delta_c_min REAL,
      started_iso TEXT, finished_iso TEXT, closed_commit TEXT,
      notes TEXT, agent TEXT, model TEXT, repo TEXT DEFAULT 'lccjs'
    )
  `;
  const CREATE_INDEX = `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_velocity_session
      ON velocity(ticket, agent, started_iso)
      WHERE started_iso IS NOT NULL
  `;

  let testDbPath;
  let testCsvPath;
  let testDb;

  beforeEach(() => {
    // Use pid + counter for unique temp file names (no Date.now in workflow scripts,
    // but tests are plain JS — Math.random() is fine here).
    const suffix = `${process.pid}-${Math.floor(Math.random() * 1e9)}`;
    testDbPath  = path.join(os.tmpdir(), `vel-test-${suffix}.db`);
    testCsvPath = path.join(os.tmpdir(), `vel-test-${suffix}.csv`);
    testDb = new Database(testDbPath);
    testDb.exec(CREATE_TABLE);
    testDb.exec(CREATE_INDEX);
  });

  afterEach(() => {
    try { testDb.close(); } catch (_) {}
    for (const p of [testDbPath, testCsvPath, testCsvPath + '.tmp']) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  });

  function runWithTestDb(input, extraArgs = []) {
    return run(input, extraArgs, { VELOCITY_DB: testDbPath, VELOCITY_CSV: testCsvPath });
  }

  test('--update-id with non-existent id exits 1 with "row not found — nothing updated"', () => {
    const result = runWithTestDb({ role: 'DEV', agent: 'TEST' }, ['--update-id', '99999']);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/row 99999 not found/);
    expect(result.stderr).toMatch(/nothing updated/);
  });

  test('--update-id updates an existing row and prints confirmation', () => {
    const { lastInsertRowid } = testDb
      .prepare("INSERT INTO velocity (role, agent, repo) VALUES ('DEV', 'APPLE', 'lccjs')")
      .run();
    testDb.close();

    const result = runWithTestDb(
      { role: 'ARC', agent: 'BANANA', ticket: 42 },
      ['--update-id', String(lastInsertRowid)]
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(new RegExp(`Updated row id=${lastInsertRowid}`));
    expect(result.stdout).toMatch(/ticket #42/);

    testDb = new Database(testDbPath);
    const row = testDb.prepare('SELECT * FROM velocity WHERE id = ?').get(lastInsertRowid);
    expect(row.role).toBe('ARC');
    expect(row.agent).toBe('BANANA');
    expect(row.ticket).toBe(42);
  });
});

describe('velocity-log — duplicate row rejected by unique index (#536)', () => {
  const os = require('os');
  const fs = require('fs');
  const Database = require('better-sqlite3');

  const CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS velocity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket INTEGER, title TEXT, role TEXT, h_min REAL, c_min REAL,
      actual_min REAL, delta_h_min REAL, delta_c_min REAL,
      started_iso TEXT, finished_iso TEXT, closed_commit TEXT,
      notes TEXT, agent TEXT, model TEXT, repo TEXT DEFAULT 'lccjs'
    )
  `;
  const CREATE_INDEX = `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_velocity_session
      ON velocity(ticket, agent, started_iso)
      WHERE started_iso IS NOT NULL
  `;

  let testDbPath;
  let testCsvPath;
  let testDb;

  beforeEach(() => {
    const suffix = `${process.pid}-${Math.floor(Math.random() * 1e9)}`;
    testDbPath  = path.join(os.tmpdir(), `vel-dup-${suffix}.db`);
    testCsvPath = path.join(os.tmpdir(), `vel-dup-${suffix}.csv`);
    testDb = new Database(testDbPath);
    testDb.exec(CREATE_TABLE);
    testDb.exec(CREATE_INDEX);
  });

  afterEach(() => {
    try { testDb.close(); } catch (_) {}
    for (const p of [testDbPath, testCsvPath, testCsvPath + '.tmp']) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  });

  test('second insert with same (ticket, agent, started_iso) exits 1 with "duplicate row"', () => {
    // Seed the first row directly
    testDb
      .prepare(
        "INSERT INTO velocity (ticket, agent, started_iso, role, repo) VALUES (100, 'TEST', '2026-01-01T00:00:00Z', 'DEV', 'lccjs')"
      )
      .run();
    testDb.close();

    const result = run(
      { ticket: 100, agent: 'TEST', started_iso: '2026-01-01T00:00:00Z', role: 'ARC' },
      [],
      { VELOCITY_DB: testDbPath, VELOCITY_CSV: testCsvPath }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/duplicate row/);
    expect(result.stderr).toMatch(/--update-id/);
  });

  test('two rows with NULL started_iso for the same ticket/agent do not conflict', () => {
    // First insert (NULL started_iso — goes through script to test full path)
    const first = run(
      { ticket: 200, agent: 'TEST', role: 'DEV' },
      [],
      { VELOCITY_DB: testDbPath, VELOCITY_CSV: testCsvPath }
    );
    expect(first.status).toBe(0);

    // Reopen because first run closed it via velocity-export
    testDb = new Database(testDbPath);
    testDb.close();

    // Second insert with same ticket/agent but still NULL started_iso — should succeed
    const second = run(
      { ticket: 200, agent: 'TEST', role: 'ARC' },
      [],
      { VELOCITY_DB: testDbPath, VELOCITY_CSV: testCsvPath }
    );
    expect(second.status).toBe(0);
  });
});

// --- auto-fetch title (#567) ---
describe('velocity-log — auto-fetch title when omitted (#567)', () => {
  const os = require('os');
  const fs = require('fs');
  const Database = require('better-sqlite3');

  const CREATE_TABLE = `
    CREATE TABLE IF NOT EXISTS velocity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket INTEGER, title TEXT, role TEXT, h_min REAL, c_min REAL,
      actual_min REAL, delta_h_min REAL, delta_c_min REAL,
      started_iso TEXT, finished_iso TEXT, closed_commit TEXT,
      notes TEXT, agent TEXT, model TEXT, repo TEXT DEFAULT 'lccjs'
    )
  `;
  const CREATE_INDEX = `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_velocity_session
      ON velocity(ticket, agent, started_iso)
      WHERE started_iso IS NOT NULL
  `;

  let testDbPath, testCsvPath, fakeGh, testDb;

  beforeEach(() => {
    const suffix = `${process.pid}-${Math.floor(Math.random() * 1e9)}`;
    testDbPath  = path.join(os.tmpdir(), `vel-gh-${suffix}.db`);
    testCsvPath = path.join(os.tmpdir(), `vel-gh-${suffix}.csv`);
    fakeGh = path.join(os.tmpdir(), `fake-gh-${suffix}.sh`);

    testDb = new Database(testDbPath);
    testDb.exec(CREATE_TABLE);
    testDb.exec(CREATE_INDEX);
    testDb.close();
  });

  afterEach(() => {
    for (const p of [testDbPath, testCsvPath, testCsvPath + '.tmp', fakeGh]) {
      try { fs.unlinkSync(p); } catch (_) {}
    }
  });

  function makeFakeGh(output, exitCode = 0) {
    const script = exitCode === 0
      ? `#!/bin/sh\necho "${output}"\n`
      : `#!/bin/sh\nexit 1\n`;
    fs.writeFileSync(fakeGh, script, { mode: 0o755 });
  }

  function runWithFakeGh(input, fakeGhPath) {
    return run(input, [], {
      VELOCITY_DB: testDbPath,
      VELOCITY_CSV: testCsvPath,
      VELOCITY_LOG_GH: fakeGhPath || fakeGh,
    });
  }

  test('auto-fetches title from gh when title is omitted', () => {
    makeFakeGh('Fetched Issue Title From GitHub');
    const result = runWithFakeGh({ ticket: 567, role: 'DEV', agent: 'TEST' });
    expect(result.status).toBe(0);

    const db = new Database(testDbPath);
    const row = db.prepare('SELECT title FROM velocity ORDER BY id DESC LIMIT 1').get();
    db.close();
    expect(row.title).toBe('Fetched Issue Title From GitHub');
  });

  test('explicit title is not overridden by auto-fetch', () => {
    makeFakeGh('Should Not Appear');
    const result = runWithFakeGh({ ticket: 567, role: 'DEV', agent: 'TEST', title: 'My Explicit Title' });
    expect(result.status).toBe(0);

    const db = new Database(testDbPath);
    const row = db.prepare('SELECT title FROM velocity ORDER BY id DESC LIMIT 1').get();
    db.close();
    expect(row.title).toBe('My Explicit Title');
  });

  test('falls back to "#N (title unavailable)" and warns when gh fails', () => {
    makeFakeGh('', 1); // exit 1 → execSync throws
    const result = runWithFakeGh({ ticket: 567, role: 'DEV', agent: 'TEST' });
    expect(result.status).toBe(0);
    expect(result.stderr).toMatch(/could not fetch title.*#567.*fallback/);

    const db = new Database(testDbPath);
    const row = db.prepare('SELECT title FROM velocity ORDER BY id DESC LIMIT 1').get();
    db.close();
    expect(row.title).toBe('#567 (title unavailable)');
  });

  test('no auto-fetch when ticket is absent (issueless PM row)', () => {
    makeFakeGh('Should Not Be Called');
    // ticket-less row: gh should never be invoked
    const result = runWithFakeGh({ role: 'PM', agent: 'TEST' });
    expect(result.status).toBe(0);

    const db = new Database(testDbPath);
    const row = db.prepare('SELECT title FROM velocity ORDER BY id DESC LIMIT 1').get();
    db.close();
    expect(row.title).toBeNull();
  });
});
