// tests/new/interpreter.oracle.e2e.spec.js
const fs = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/interpreter');

// Mirror the interpreter test list (25 demos; J and N were disabled)
const DEMOS = [
  { file: 'demoA', inputs: [], comment: 'mov, dout, nl, and halt' },
  { file: 'demoB', inputs: ['input1', 'input2'], comment: 'sin, sout, and .string and .zero directives' },
  { file: 'demoC', inputs: [], comment: 'load, add, and a labeled .word directive' },
  { file: 'demoD', inputs: [], comment: 'mov, mvi, and mvr instructions' },
  { file: 'demoE', inputs: [], comment: 'push, pop, and custom functions' },
  { file: 'demoF', inputs: [], comment: 'various outputs (decimal, hex, and char)' },
  { file: 'demoG', inputs: ['g', '-5', 'ff'], comment: 'various inputs (decimal, hex, and char)' },
  { file: 'demoH', inputs: [], comment: 'negative numbers in mov, add, and .word' },
  { file: 'demoI', inputs: [], comment: 'branching and looping' },
  // { file: 'demoJ', inputs: [], comment: 'infinite loop - not meant for happy-path running' },
  { file: 'demoK', inputs: [], comment: 'm command' },
  { file: 'demoL', inputs: [], comment: 'r command' },
  { file: 'demoM', inputs: [], comment: 's command' },
  // { file: 'demoN', inputs: [], comment: 'div that when interpreted causes floating point error' },
  { file: 'demoO', inputs: ['cheese'], comment: 'IO commands' },
  { file: 'demoP', inputs: [], comment: '.start and interleaved data in instructions' },
  { file: 'demoQ', inputs: [], comment: 'label args to .word directives' },
  { file: 'demoR', inputs: [], comment: 'srl, sra, sll' },
  { file: 'demoS', inputs: [], comment: 'rol, ror' },
  { file: 'demoT', inputs: [], comment: 'and, or, xor' },
  // { file: 'demoU', inputs: [], comment: 'sext' }, // TODO: fix sext implementation to match oracle lcc
  { file: 'demoV', inputs: [], comment: 'mul, div, rem' },
  { file: 'demoW', inputs: [], comment: 'cmp, branch instructions' },
  { file: 'demoX', inputs: [], comment: 'hex, cea, implicit r0 args' },
  { file: 'demoY', inputs: [], comment: 'label offsets for ld and .word directive' },
  { file: 'demoZ', inputs: [], comment: 'label offsets for st, br, and lea instructions' },
];

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readText(p) { return fs.readFileSync(p, 'utf8'); }
function writeText(p, text) { fs.writeFileSync(p, text, 'utf8'); }
function readBytes(p) { return fs.readFileSync(p); }
function writeBytes(p, bytes) { fs.writeFileSync(p, bytes); }

function fileBytesEqual(a, b) {
  const A = readBytes(a); const B = readBytes(b);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

function normalizeContent(lines) {
  lines = lines.map(line => line.replace(/;.*/, '')); // remove comments
  lines = lines.map(line => line.trim());
  const linesToSkipRegex = /^(Input\s*file\s*name\s*=|LCC\s*Assemble|LCC\.js\s*Assemble)/i;
  lines = lines.filter(line => !linesToSkipRegex.test(line));
  lines = lines.filter(line => line !== ''); // remove empty lines
  lines = lines.slice(1); // skip first non-empty line (username)
  lines = lines.map(line => line.toLowerCase().replace(/\s+/g, ' ').trim());
  return lines;
}

function compareLstFiles(file1, file2) {
  const content1 = readText(file1).split('\n');
  const content2 = readText(file2).split('\n');

  const c1 = normalizeContent(content1);
  const c2 = normalizeContent(content2);

  if (c1.length !== c2.length) return false;
  for (let i = 0; i < c1.length; i++) {
    if (c1[i] !== c2[i]) return false;
  }
  return true;
}

function lstDiff(file1, file2) {
  const content1 = readText(file1).split('\n');
  const content2 = readText(file2).split('\n');

  const c1 = normalizeContent(content1);
  const c2 = normalizeContent(content2);

  const lines = [];
  const maxLen = Math.max(c1.length, c2.length);
  for (let i = 0; i < maxLen; i++) {
    const line1 = c1[i] || '<missing>';
    const line2 = c2[i] || '<missing>';
    const mark = line1 === line2 ? ' ' : '!';
    lines.push(`${mark} ${i.toString().padStart(4, '0')}: ${line1} | ${line2}`);
  }
  return lines.join('\n');
}

function runJSInterpreter(eFile, userInputs) {
  const Interpreter = require('../../src/core/interpreter');
  const base = path.basename(eFile, '.e');
  const dir = path.dirname(eFile);
  const lstFile = path.join(dir, `${base}.lst`);

  // Clean up any existing .lst
  if (fs.existsSync(lstFile)) fs.unlinkSync(lstFile);

  const interp = new Interpreter();
  if (userInputs && userInputs.length > 0) {
    interp.inputBuffer = userInputs.join('\n') + '\n';
  }
  interp.generateStats = true;
  interp.main([eFile]);

  if (!fs.existsSync(lstFile)) {
    throw new Error(`JS interpreter did not produce .lst: ${lstFile}`);
  }

  return lstFile;
}

function runOracleInterpreter(eFile, userInputs, opts = {}) {
  const {
    tolerateNonZeroExit = false,
    keepTmp = process.env.KEEP_ORACLE_TMP === '1',
    debug = process.env.DEBUG_ORACLE === '1',
  } = opts;

  if (!cfg.lccPath) throw new Error('LCC_ORACLE is not set (see .env)');
  if (!fs.existsSync(cfg.lccPath)) throw new Error(`LCC oracle not found: ${cfg.lccPath}`);

  const { spawnSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-oracle-interp-'));
  const base = path.basename(eFile, '.e');

  // Oracle naming: base1.e -> base1.lst
  const oracleInBase = `${base}1.e`;
  const oracleOutBase = `${base}1.lst`;
  const oracleIn = path.join(tmp, oracleInBase);
  const oracleOut = path.join(tmp, oracleOutBase);

  fs.copyFileSync(eFile, oracleIn);

  // Create name.nnn
  const nameFile = path.join(tmp, 'name.nnn');
  fs.writeFileSync(nameFile, 'TestUser\n');

  const spawnOpts = {
    cwd: tmp,
    encoding: 'utf8',
    timeout: cfg.lccTimeoutMs,
  };

  if (userInputs && userInputs.length) {
    spawnOpts.input = userInputs.join('\n') + '\n';
  } else {
    spawnOpts.stdio = ['ignore', 'pipe', 'pipe'];
  }

  const res = spawnSync(cfg.lccPath, [oracleInBase], spawnOpts);

  if (res.error) throw res.error;

  const hasLst = fs.existsSync(oracleOut);

  if (debug) {
    // eslint-disable-next-line no-console
    console.warn(`[oracle] exit=${res.status} hasLst=${hasLst} tmp=${tmp}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`);
  }

  if (res.status !== 0) {
    if (!(tolerateNonZeroExit && hasLst)) {
      throw new Error(
        `Oracle lcc (interpreter) exited with ${res.status}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`
      );
    }
  }

  if (!hasLst) {
    throw new Error(`Oracle did not produce expected .lst file: ${oracleOut}`);
  }

  const lstText = readText(oracleOut);
  return { lstText, outPath: oracleOut, tmpDir: tmp, kept: keepTmp ? tmp : null };
}

describe('Interpreter vs Oracle (demos → .lst) with golden cache', () => {
  // Mock console.log to suppress assembler output
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });
  
  ensureDir(GOLDEN_DIR);

  for (const { file: base, inputs, comment, opts = {} } of DEMOS) {
    const aFile = `${base}.a`;
    const eFile = `${base}.e`;
    
    const demoAPath = path.join(DEMOS_DIR, aFile);
    const demoEPath = path.join(DEMOS_DIR, eFile);
    const goldenE = path.join(GOLDEN_DIR, eFile);
    const goldenLst = path.join(GOLDEN_DIR, `${base}.lst`);

    // Step 0: Ensure .e exists (assemble from .a if needed)
    let haveE = fs.existsSync(demoEPath);
    if (!haveE) {
      if (!fs.existsSync(demoAPath)) {
        test.skip(`${base} — ${comment} (skipped: missing .a file)`, () => {});
        continue;
      }
      // Assemble .a -> .e
      const { bytes: eBytes } = assembleWithJS(demoAPath);
      writeBytes(demoEPath, eBytes);
      haveE = true;
    }

    const eBytes = readBytes(demoEPath);
    let haveGoldenE = fs.existsSync(goldenE);
    let haveGoldenLst = fs.existsSync(goldenLst);
    let sameE = haveGoldenE && fileBytesEqual(demoEPath, goldenE);

    // Step 1: Ensure golden .e matches current demo .e (or update/skip)
    if (!haveGoldenE || !sameE) {
      if (cfg.goldenAutoUpdate) {
        writeBytes(goldenE, eBytes);
        haveGoldenE = true;
        sameE = true;
      } else {
        test.skip(`${base} — ${comment} (skipped: missing or mismatched golden .e)`, () => {});
        continue;
      }
    }

    // Step 2: Ensure golden .lst exists (or regenerate/skip)
    if (!haveGoldenLst) {
      if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
        const { lstText } = runOracleInterpreter(demoEPath, inputs, opts);
        writeText(goldenLst, lstText);
        haveGoldenLst = true;
      } else if (!cfg.goldenAutoUpdate) {
        test.skip(`${base} — ${comment} (skipped: missing golden .lst)`, () => {});
        continue;
      } else {
        test.skip(`${base} — ${comment} (skipped: oracle not configured for .lst regen)`, () => {});
        continue;
      }
    }

    // Step 3: Run the actual test
    test(`${base} — ${comment}`, () => {
      const jsLstPath = runJSInterpreter(demoEPath, inputs);
      
      const match = compareLstFiles(jsLstPath, goldenLst);

      if (!match) {
        const msg =
          `\n=== ${base} .lst mismatch ===\n` +
          `--- JS (.lst) vs Golden (.lst) normalized diff ---\n${lstDiff(jsLstPath, goldenLst)}\n`;
        throw new Error(msg);
      }
    });
  }
});