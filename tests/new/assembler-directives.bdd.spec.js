// assembler-directives.bdd.spec.js — step definitions for the data-defining
// assembler directives BDD feature (#1280; tracker #1269, harness #1252). Lives
// under tests/new/ so `npm test` picks it up; the Gherkin is in tests/features/.
// Drives the real CLI (src/cli/lcc.js) via spawnSync, assembling+running each
// source and asserting on the program's printed output (the text after lcc's
// "Output" banner). --runInBand-safe: own temp dir + pre-written name.nnn.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/assembler-directives.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let sourceName;
  let result;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-dir-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    result = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  // The program's own output is whatever follows lcc's "===... Output" banner.
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

  test('.word stores a value that can be loaded and printed', ({ given, when, then }) => {
    givenSource(given);
    whenRunLcc(when);
    thenProgramPrints(then);
  });

  test('.string stores a printable, null-terminated string', ({ given, when, then }) => {
    givenSource(given);
    whenRunLcc(when);
    thenProgramPrints(then);
  });

  test('.blkw reserves zero-initialized space', ({ given, when, then }) => {
    givenSource(given);
    whenRunLcc(when);
    thenProgramPrints(then);
  });
});
