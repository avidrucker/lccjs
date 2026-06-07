'use strict';

// Compliance guard: every script that touches the SQLite store must resolve its
// path through the single shared resolver, scripts/db-path.js, so the canonical
// location stays ~/.lccjs/lccjs.db (the #947 rename) and the DB-path override
// stays centralised (#984). Verifies the invariants #947/#984 established.
//
// This is a static grep-over-source test on purpose: it runs in plain `npm test`
// with no ~/.lccjs/ present, opens no database, writes no temp files in the repo,
// and is serial-safe. See #990.
//
// The two drift modes it locks out (both have happened here before):
//   1. A new script copies the old pattern — a `velocity.db` literal or a
//      hand-rolled `path.join(os.homedir(), '.lccjs', …)` resolver — instead of
//      `require('./db-path').DB_PATH`. This is exactly how ice-score.js drifted.
//   2. A script reads the DB-path env var directly, forking the override away
//      from the single place that is allowed to honour it.

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');

// The one file allowed to build the path / read the env / name the old file:
// it IS the resolver (and owns the one-time velocity.db → lccjs.db migration).
const RESOLVER = 'db-path.js';

// Residual hand-rolled resolvers that #984 did not unify. They use the *new*
// filename (lccjs.db) so the canonical location is correct, but they bypass the
// shared resolver and therefore silently ignore the LCCJS_DB override. Tracked
// for cleanup in #1023 — when that lands and switches them to require('./db-path'),
// it must also delete the corresponding entry here (the exact-match assertion
// below fails otherwise, which is the intended nudge).
const KNOWN_BYPASSERS = ['close.js', 'velocity-seed.js'];

// --- helpers -------------------------------------------------------------

function listScriptFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listScriptFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

// scripts/-relative name with forward slashes (e.g. "archive/rice-log.js").
const rel = (full) => path.relative(SCRIPTS_DIR, full).split(path.sep).join('/');

const ALL_FILES = listScriptFiles(SCRIPTS_DIR).map((full) => ({
  name: rel(full),
  text: fs.readFileSync(full, 'utf8'),
}));

// A line that constructs a path rooted at the home directory's .lccjs dir —
// i.e. a hand-rolled DB-path resolver. Matches `path.join(os.homedir(), '.lccjs'…`
// (the close.js / velocity-seed.js / db-path.js form) without tripping on the
// many doc comments that merely mention "~/.lccjs/lccjs.db".
const HOMEDIR_RESOLVER_RE = /path\.join\([^)]*homedir\(\)[^)]*['"]\.lccjs['"]/;
// A direct read of the DB-path override env var(s).
const DB_ENV_READ_RE = /process\.env\.(?:LCCJS_DB|VELOCITY_DB)/;
// A reference to the pre-rename filename.
const OLD_FILENAME_RE = /velocity\.db/;

describe('DB-path compliance (verifies #947/#984)', () => {
  test('the resolver and at least the known bypassers are present (test is wired to real files)', () => {
    const names = ALL_FILES.map((f) => f.name);
    expect(names).toContain(RESOLVER);
    for (const b of KNOWN_BYPASSERS) expect(names).toContain(b);
  });

  test('only db-path.js references the pre-rename "velocity.db" filename', () => {
    const offenders = ALL_FILES
      .filter((f) => f.name !== RESOLVER && OLD_FILENAME_RE.test(f.text))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  test('the set of hand-rolled ~/.lccjs resolvers is exactly {db-path.js} ∪ KNOWN_BYPASSERS', () => {
    const resolvers = ALL_FILES
      .filter((f) => f.text.split('\n').some((line) => HOMEDIR_RESOLVER_RE.test(line)))
      .map((f) => f.name);
    // Everything that hand-rolls the path, minus the legitimate resolver, must
    // be exactly the tracked bypasser list — no more (new drift) and no fewer
    // (a fixed bypasser left stale in KNOWN_BYPASSERS).
    const nonResolver = resolvers.filter((n) => n !== RESOLVER).sort();
    expect(nonResolver).toEqual([...KNOWN_BYPASSERS].sort());
  });

  test('only db-path.js reads the DB-path override env var (LCCJS_DB / VELOCITY_DB)', () => {
    const offenders = ALL_FILES
      .filter((f) => f.name !== RESOLVER && DB_ENV_READ_RE.test(f.text))
      .map((f) => f.name);
    expect(offenders).toEqual([]);
  });

  test('db-path.js honours LCCJS_DB as the canonical post-rename override name', () => {
    const resolver = ALL_FILES.find((f) => f.name === RESOLVER);
    expect(resolver.text).toMatch(/process\.env\.LCCJS_DB/);
  });

  describe('resolver value', () => {
    const SAVED = {};
    let tmpHome;

    beforeAll(() => {
      // Resolve against an empty temp HOME so the default-path logic is exercised
      // deterministically and the on-import velocity.db→lccjs.db migration cannot
      // touch the real ~/.lccjs/ (the temp dir has no old file to migrate).
      for (const k of ['HOME', 'USERPROFILE', 'LCCJS_DB', 'VELOCITY_DB']) SAVED[k] = process.env[k];
      tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-dbpath-'));
      process.env.HOME = tmpHome;
      process.env.USERPROFILE = tmpHome;
      delete process.env.LCCJS_DB;
      delete process.env.VELOCITY_DB;
      delete require.cache[require.resolve('../../scripts/db-path')];
    });

    afterAll(() => {
      for (const k of ['HOME', 'USERPROFILE', 'LCCJS_DB', 'VELOCITY_DB']) {
        if (SAVED[k] === undefined) delete process.env[k];
        else process.env[k] = SAVED[k];
      }
      delete require.cache[require.resolve('../../scripts/db-path')];
      if (tmpHome) fs.rmSync(tmpHome, { recursive: true, force: true });
    });

    test('DB_PATH resolves to ~/.lccjs/lccjs.db when no override is set', () => {
      const { DB_PATH } = require('../../scripts/db-path');
      expect(DB_PATH.endsWith(`${path.sep}lccjs.db`)).toBe(true);
      expect(DB_PATH).toContain(`${path.sep}.lccjs${path.sep}`);
      expect(DB_PATH.endsWith('velocity.db')).toBe(false);
    });
  });
});
