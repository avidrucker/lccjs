// assemble-and-run.bdd.spec.js — step definitions for the jest-cucumber pilot
// (#1252, decision #1250). Lives under tests/new/ so the default `npm test` run
// picks it up; the Gherkin lives in tests/features/. Steps drive the REAL CLI
// (src/cli/lcc.js) via spawnSync — the same approach as the e2e specs — and
// assert the user-visible contract (exit code, key stdout, artifacts). Exact
// byte-for-byte output parity stays with the *.oracle.e2e suites (complement,
// not duplicate). Serial-safe under --runInBand: each scenario uses its own
// temp dir and pre-writes name.nnn so the CLI never blocks on the author prompt.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/assemble-and-run.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-'));
    // Pre-create name.nnn so lcc does not block on the interactive author prompt
    // in this non-TTY context (mirrors the existing interpreter e2e specs).
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  // Shared step bodies (reused across scenarios; jest-cucumber still requires each
  // scenario to declare exactly its own steps, so the wiring is per-test below).
  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
    });

  const whenRunLcc = (when) =>
    when(/^I run lcc on "(.*)"$/, (name) => {
      result = spawnSync(process.execPath, [LCC, name], {
        cwd: workDir,
        encoding: 'utf8',
        timeout: 15000,
      });
    });

  const thenExitsOk = (then) =>
    then('the command exits successfully', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
    });

  const andOutputContains = (and) =>
    and(/^the output contains "(.*)"$/, (text) => {
      expect(result.stdout).toContain(text);
    });

  const andExecutableProduced = (and) =>
    and(/^the executable "(.*)" is produced$/, (artifact) => {
      expect(fs.existsSync(path.join(workDir, artifact))).toBe(true);
    });

  test('Running a .a source assembles it and executes the result', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunLcc(when);
    thenExitsOk(then);
    andOutputContains(and);
    andExecutableProduced(and);
  });

  test('A program with no output still assembles and runs cleanly', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunLcc(when);
    thenExitsOk(then);
    andExecutableProduced(and);
  });
});
