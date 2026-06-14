// assembler-label-resolution.bdd.spec.js — step definitions for the assembler
// label-resolution BDD feature (#1300; tracker #1269, harness #1252). Lives under
// tests/new/ so `npm test` picks it up; the Gherkin is in tests/features/. Drives
// the real CLI (src/cli/lcc.js) via spawnSync: success scenarios assert the
// program output (after lcc's "Output" banner); failure scenarios assert the
// message on stderr and a non-zero exit. --runInBand-safe: own temp dir + name.nnn.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/assembler-label-resolution.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-lbl-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const programOutput = () => {
    const parts = (result.stdout || '').split(/={5,}\s*Output/);
    return parts.length > 1 ? parts[parts.length - 1] : result.stdout || '';
  };

  const givenSource = (given) =>
    given(/^a source file "(.*)" containing:$/, (name, source) => {
      sourceName = name;
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

  const thenProgramPrints = (then) =>
    then(/^the program prints "(.*)"$/, (text) => {
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(programOutput()).toContain(text);
    });

  const thenRunFails = (then) =>
    then('the run fails', () => {
      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
    });

  const andErrContains = (and) =>
    and(/^the error output contains "(.*)"$/, (text) => {
      expect(result.stderr).toContain(text);
    });

  test('a forward reference resolves to a label defined later', ({ given, when, then }) => {
    givenSource(given);
    whenRunLcc(when);
    thenProgramPrints(then);
  });

  test('referencing an undefined label is rejected', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunLcc(when);
    thenRunFails(then);
    andErrContains(and);
  });

  test('defining the same label twice is rejected', ({ given, when, then, and }) => {
    givenSource(given);
    whenRunLcc(when);
    thenRunFails(then);
    andErrContains(and);
  });
});
