// tests/helpers/runOracle.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { cfg } = require('./env');

function runOracleOnDemo(demoPath, userInputs = [], opts = {}) {
  const {
    tolerateNonZeroExit = false,   // allow oracle to return non-zero if .e exists
    keepTmp = process.env.KEEP_ORACLE_TMP === '1', // keep temp dir for inspection
    debug = process.env.DEBUG_ORACLE === '1',      // log stdout/stderr
  } = opts;
  if (!cfg.lccPath) throw new Error('LCC_ORACLE is not set (see .env)');
  if (!fs.existsSync(cfg.lccPath)) throw new Error(`LCC oracle not found: ${cfg.lccPath}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-oracle-'));
  const base = path.basename(demoPath, '.a');

  // Legacy naming convention: base1.a -> base1.e, base1.lst, base1.bst
  const oracleInBase = `${base}1.a`;
  const oracleOutBase = `${base}1.e`;
  const oracleLstBase = `${base}1.lst`;
  const oracleBstBase = `${base}1.bst`;
  
  const oracleIn = path.join(tmp, oracleInBase);
  const oracleOut = path.join(tmp, oracleOutBase);
  const oracleLst = path.join(tmp, oracleLstBase);
  const oracleBst = path.join(tmp, oracleBstBase);

  // Copy input .a (legacy suite used base1.a)
  fs.copyFileSync(demoPath, oracleIn);

  // create name.nnn because oracle expects it
  const nameFile = path.join(tmp, 'name.nnn');
  if (!fs.existsSync(nameFile)) fs.writeFileSync(nameFile, 'TestUser\n');

  // Prepare stdin if any user inputs were specified (kept for parity; assembler typically ignores stdin)

  // 1) Pass only the BASENAME (oracle expects just the filename, not a path; the file is in the working directory)
  // 2) If inputs are required, pipe them via `input`; otherwise ignore stdin
  // 3) Use generous timeout from .env
  const spawnOpts = {
    cwd: tmp,
    encoding: 'utf8',
    timeout: cfg.lccTimeoutMs,
  };

  if (userInputs && userInputs.length) {
    // Ensure trailing newline; some demos may read multiple lines.
    spawnOpts.input = userInputs.join('\n') + '\n';
    // let Node create a pipe for stdin automatically (don't override stdio)
  } else {
    // no stdin needed; avoid EPIPEs and keep it quiet
    spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
  }

  const res = spawnSync(cfg.lccPath, [oracleInBase], spawnOpts);

  if (res.error) throw res.error;

  const hasE = fs.existsSync(oracleOut);
  const hasLst = fs.existsSync(oracleLst);
  const hasBst = fs.existsSync(oracleBst);

  if (debug) {
    // eslint-disable-next-line no-console
    console.warn(`[oracle] exit=${res.status} hasE=${hasE} hasLst=${hasLst} hasBst=${hasBst} tmp=${tmp}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`);
  }

  if (res.status !== 0) {
    // If we tolerate non-zero, proceed as long as the .e exists.
    if (!(tolerateNonZeroExit && hasE)) {
      throw new Error(
        `Oracle lcc exited with ${res.status}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`
      );
    }
  }

  if (!hasE) {
    throw new Error(`Oracle did not produce expected .e file: ${oracleOut}`);
  }

  const bytes = fs.readFileSync(oracleOut);
  
  // Read .lst and .bst if they exist
  const lst = hasLst ? fs.readFileSync(oracleLst, 'utf8') : undefined;
  const bst = hasBst ? fs.readFileSync(oracleBst, 'utf8') : undefined;

  return { 
    bytes, 
    lst, 
    bst, 
    outPath: oracleOut, 
    tmpDir: tmp, 
    kept: keepTmp ? tmp : null 
  };
}

module.exports = { runOracleOnDemo };