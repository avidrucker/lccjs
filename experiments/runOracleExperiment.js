#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });

function expandTilde(p) {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function parseArgs(argv) {
  const inputs = [];
  let keep = process.env.KEEP_ORACLE_TMP === '1';
  let debug = process.env.DEBUG_ORACLE === '1';
  let experimentPath = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--keep') {
      keep = true;
    } else if (arg === '--debug') {
      debug = true;
    } else if (arg === '--input') {
      i++;
      if (i >= argv.length) {
        throw new Error('Missing value after --input');
      }
      inputs.push(argv[i]);
    } else if (!experimentPath) {
      experimentPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!experimentPath) {
    throw new Error('Usage: node experiments/runOracleExperiment.js [--keep] [--debug] [--input "line"] <experiment.a>');
  }

  return { experimentPath, inputs, keep, debug };
}

function main() {
  const { experimentPath, inputs, keep, debug } = parseArgs(process.argv.slice(2));
  const lccPath = expandTilde(process.env.LCC_ORACLE || '');
  const lccTimeoutMs = Number(process.env.LCC_TIMEOUT_MS || 20000);

  if (!lccPath) {
    throw new Error('LCC_ORACLE is not set (see .env)');
  }

  if (!fs.existsSync(lccPath)) {
    throw new Error(`LCC oracle not found: ${lccPath}`);
  }

  const resolvedExperiment = path.resolve(process.cwd(), experimentPath);
  if (!fs.existsSync(resolvedExperiment)) {
    throw new Error(`Experiment file not found: ${resolvedExperiment}`);
  }

  const base = path.basename(resolvedExperiment, '.a');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-experiment-'));
  const oracleInBase = `${base}1.a`;
  const oracleEBase = `${base}1.e`;
  const oracleLstBase = `${base}1.lst`;
  const oracleBstBase = `${base}1.bst`;

  const oracleIn = path.join(tmp, oracleInBase);
  const oracleE = path.join(tmp, oracleEBase);
  const oracleLst = path.join(tmp, oracleLstBase);
  const oracleBst = path.join(tmp, oracleBstBase);

  fs.copyFileSync(resolvedExperiment, oracleIn);
  fs.writeFileSync(path.join(tmp, 'name.nnn'), 'TestUser\n');

  const spawnOpts = {
    cwd: tmp,
    encoding: 'utf8',
    timeout: lccTimeoutMs,
  };

  if (inputs.length > 0) {
    spawnOpts.input = `${inputs.join('\n')}\n`;
  } else {
    spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
  }

  const result = spawnSync(lccPath, [oracleInBase], spawnOpts);

  const exists = {
    e: fs.existsSync(oracleE),
    lst: fs.existsSync(oracleLst),
    bst: fs.existsSync(oracleBst),
  };

  const shouldKeep = keep || debug || result.status !== 0 || result.error;

  console.log(`Experiment: ${resolvedExperiment}`);
  console.log(`Oracle: ${lccPath}`);
  console.log(`Temp dir: ${tmp}`);
  console.log(`Command: ${lccPath} ${oracleInBase}`);
  console.log(`Exit status: ${result.status}`);
  console.log(`Signal: ${result.signal || 'none'}`);
  console.log(`Generated: .e=${exists.e} .lst=${exists.lst} .bst=${exists.bst}`);

  if (debug || result.status !== 0 || result.error) {
    console.log('\n--- stdout ---');
    console.log(result.stdout || '');
    console.log('--- stderr ---');
    console.log(result.stderr || '');
  }

  if (exists.lst) {
    console.log(`\nLST: ${oracleLst}`);
  }
  if (exists.bst) {
    console.log(`BST: ${oracleBst}`);
  }
  if (exists.e) {
    console.log(`E:   ${oracleE}`);
  }

  if (!shouldKeep) {
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('\nTemp dir removed.');
  } else {
    console.log('\nTemp dir kept for inspection.');
  }

  if (result.error) {
    throw result.error;
  }

  process.exitCode = result.status || 0;
}

main();
