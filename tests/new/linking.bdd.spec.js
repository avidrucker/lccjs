// linking.bdd.spec.js — step definitions for the multi-module linking BDD feature
// (#1258; harness #1252). Lives under tests/new/ so `npm test` picks it up; the
// Gherkin is in tests/features/. Steps drive the real CLI (src/cli/lcc.js):
//   lcc <mod>.a        -> assembles an object module to <mod>.o
//   lcc a.o b.o ...    -> links the objects into link.e (in cwd)
//   lcc link.e         -> runs the linked executable
// Assert the user-visible contract (output, artifacts, error message). Note: an
// undefined-external link reports the error on stderr and writes no executable,
// but exits 0 (deliberate OG-LCC parity, src/cli/lcc.js) — so we assert the
// message + absent artifact, not a non-zero exit. --runInBand-safe: own temp dir
// + pre-written name.nnn per scenario.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { loadFeature, defineFeature } = require('jest-cucumber');

const LCC = path.resolve(__dirname, '../../src/cli/lcc.js');
const feature = loadFeature(path.resolve(__dirname, '../features/linking.feature'));

defineFeature(feature, (test) => {
  let workDir;
  let modules;
  let linkResult;
  let runResult;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-bdd-link-'));
    fs.writeFileSync(path.join(workDir, 'name.nnn'), 'BDD Runner\n');
    modules = [];
    linkResult = null;
    runResult = null;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const lcc = (...args) =>
    spawnSync(process.execPath, [LCC, ...args], {
      cwd: workDir,
      encoding: 'utf8',
      timeout: 15000,
    });

  const givenModule = (step) =>
    step(/^a module "(.*)" containing:$/, (name, source) => {
      fs.writeFileSync(path.join(workDir, name), `${source}\n`);
      modules.push(name);
    });

  const whenAssembleLink = (when) =>
    when(/^I assemble and link the modules$/, () => {
      for (const m of modules) {
        const asm = lcc(m); // lcc <mod>.a -> <mod>.o
        expect(asm.error).toBeUndefined();
        expect(asm.status).toBe(0);
      }
      const objects = modules.map((m) => m.replace(/\.a$/, '.o'));
      linkResult = lcc(...objects); // lcc a.o b.o -> link.e
    });

  const andRunLinked = (and) =>
    and(/^I run the linked executable$/, () => {
      runResult = lcc('link.e');
    });

  const thenOutputContains = (then) =>
    then(/^the output contains "(.*)"$/, (text) => {
      expect(runResult.stdout).toContain(text);
    });

  const andExecutableProduced = (and) =>
    and(/^the executable "(.*)" is produced$/, (artifact) => {
      expect(fs.existsSync(path.join(workDir, artifact))).toBe(true);
    });

  const thenErrorReports = (then) =>
    then(/^the error output reports "(.*)"$/, (text) => {
      expect(linkResult.stderr).toContain(text);
    });

  const andNoExecutable = (and) =>
    and(/^no executable "(.*)" is produced$/, (artifact) => {
      expect(fs.existsSync(path.join(workDir, artifact))).toBe(false);
    });

  test('Two modules linked together resolve a cross-module symbol', ({ given, and, when, then }) => {
    givenModule(given);
    givenModule(and); // the second "And a module ..." line
    whenAssembleLink(when);
    andRunLinked(and);
    thenOutputContains(then);
    andExecutableProduced(and);
  });

  test('An undefined external reference is reported and produces no executable', ({ given, when, then, and }) => {
    givenModule(given);
    whenAssembleLink(when);
    thenErrorReports(then);
    andNoExecutable(and);
  });

  test('An external function called more than once relocates every call', ({ given, and, when, then }) => {
    givenModule(given);
    givenModule(and); // second "And a module ..."
    whenAssembleLink(when);
    andRunLinked(and);
    thenOutputContains(then);
  });

  test('An external data symbol read more than once relocates every reference', ({ given, and, when, then }) => {
    givenModule(given);
    givenModule(and);
    whenAssembleLink(when);
    andRunLinked(and);
    thenOutputContains(then);
  });
});
