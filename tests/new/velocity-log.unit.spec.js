'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'velocity-log.js');

function run(input, extraArgs = [], extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, JSON.stringify(input), ...extraArgs], {
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

  test('rejects negative delta_c_min with exit 1 and error message', () => {
    const result = run({ role: 'DEV', agent: 'TEST', delta_c_min: -3 });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/delta_c_min must be >= 0/);
    expect(result.stderr).toMatch(/estimate - actual/);
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

describe('velocity-log — model canonical format validation (#453)', () => {
  test('rejects full model ID (claude-sonnet-4-6) with exit 1 and error message', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'claude-sonnet-4-6' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/canonical format/);
    expect(result.stderr).toMatch(/claude-sonnet-4-6/);
  });

  test('rejects full model ID (claude-opus-4-8) with exit 1', () => {
    const result = run({ role: 'DEV', agent: 'TEST', model: 'claude-opus-4-8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/canonical format/);
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
