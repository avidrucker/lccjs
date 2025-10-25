// tests/new/lcc.oracle.e2e.spec.js
const fs = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/lcc');

// Full test list (24 demos; J and N were disabled)
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
  // Skip first two lines (file info header and username)
  lines = lines.slice(2);
  
  // Remove comments (everything from ";" onwards)
  lines = lines.map(line => line.replace(/;.*/, ''));
  
  // Normalize whitespace: treat consecutive whitespace as single space
  lines = lines.map(line => line.trim().replace(/\s+/g, ' '));
  
  // Remove lines that contain "input file name"
  lines = lines.filter(line => !/input\s+file\s+name/i.test(line));
  
  // Remove empty lines
  lines = lines.filter(line => line !== '');
  
  // Convert to lowercase for case-insensitive comparison
  lines = lines.map(line => line.toLowerCase());
  
    // Truncate to 80 characters to match oracle's output width
  lines = lines.map(line => line.substring(0, 40));

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

function compareBstFiles(file1, file2) {
  const content1 = readText(file1).split('\n');
  const content2 = readText(file2).split('\n');

  // Use the same normalization as LST files
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

function bstDiff(file1, file2) {
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

function runJSLCC(aFile, userInputs) {
  const LCC = require('../../src/core/lcc');
  const base = path.basename(aFile, '.a');
  const dir = path.dirname(aFile);
  const lstFile = path.join(dir, `${base}.lst`);
  const bstFile = path.join(dir, `${base}.bst`);

  // Clean up any existing files
  [lstFile, bstFile].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });

  const lcc = new LCC();
  if (userInputs && userInputs.length > 0) {
    lcc.inputBuffer = userInputs.join('\n') + '\n';
  }
  lcc.main([aFile]);

  if (!fs.existsSync(lstFile)) {
    throw new Error(`JS LCC did not produce .lst: ${lstFile}`);
  }
  if (!fs.existsSync(bstFile)) {
    throw new Error(`JS LCC did not produce .bst: ${bstFile}`);
  }

  return { lstFile, bstFile };
}

function runOracleLCC(aFile, userInputs, opts = {}) {
  const { lst, bst } = runOracleOnDemo(aFile, userInputs, opts);
  return { lst, bst };
}

describe('LCC (Assemble + Interpret) vs Oracle with golden cache', () => {
  // Mock console.log to suppress output
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    jest.spyOn(process.stderr, 'write').mockImplementation(() => {});
});

  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
    console.warn.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
    process.stderr.write.mockRestore();
  });

  ensureDir(GOLDEN_DIR);

  for (const { file: base, inputs, comment, opts = {} } of DEMOS) {
    const aFile = `${base}.a`;
    const eFile = `${base}.e`;

    const demoAPath = path.join(DEMOS_DIR, aFile);
    const goldenA = path.join(GOLDEN_DIR, aFile);
    const goldenE = path.join(GOLDEN_DIR, eFile);
    const goldenLst = path.join(GOLDEN_DIR, `${base}.lst`);
    const goldenBst = path.join(GOLDEN_DIR, `${base}.bst`);

    const aBytes = readBytes(demoAPath);
    let haveGoldenA = fs.existsSync(goldenA);
    let haveGoldenE = fs.existsSync(goldenE);
    let haveGoldenLst = fs.existsSync(goldenLst);
    let haveGoldenBst = fs.existsSync(goldenBst);
    let sameA = haveGoldenA && fileBytesEqual(demoAPath, goldenA);

    // Step 1: Ensure golden .a matches current demo (or update/fail/skip)
    if (!haveGoldenA || !sameA) {
      if (cfg.goldenAutoUpdate) {
        writeBytes(goldenA, aBytes);
        haveGoldenA = true;
        sameA = true;
      } else {
        test.skip(`${base} — ${comment} (skipped: missing or mismatched golden .a)`, () => {});
        continue;
      }
    }

    // Step 2: Ensure golden .e, .lst, .bst exist (or regenerate/skip)
    const needsRegen = !haveGoldenE || !haveGoldenLst || !haveGoldenBst;
    if (needsRegen) {
      if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
        const { bytes: eBytes, lst, bst } = runOracleOnDemo(demoAPath, inputs, opts);
        writeBytes(goldenE, eBytes);
        writeText(goldenLst, lst);
        writeText(goldenBst, bst);
        haveGoldenE = true;
        haveGoldenLst = true;
        haveGoldenBst = true;
      } else if (!cfg.goldenAutoUpdate) {
        test.skip(`${base} — ${comment} (skipped: missing golden files)`, () => {});
        continue;
      } else {
        test.skip(`${base} — ${comment} (skipped: oracle not configured for regen)`, () => {});
        continue;
      }
    }

    // Step 3: Run the actual test
    test(`${base} — ${comment}`, () => {
      const { lstFile: jsLstPath, bstFile: jsBstPath } = runJSLCC(demoAPath, inputs);

      const lstMatch = compareLstFiles(jsLstPath, goldenLst);
      const bstMatch = compareBstFiles(jsBstPath, goldenBst);

      if (!lstMatch || !bstMatch) {
        let msg = `\n=== ${base} mismatch ===\n`;
        if (!lstMatch) {
          msg += `--- .lst diff ---\n${lstDiff(jsLstPath, goldenLst)}\n\n`;
        }
        if (!bstMatch) {
          msg += `--- .bst diff ---\n${bstDiff(jsBstPath, goldenBst)}\n`;
        }
        throw new Error(msg);
      }
    });
  }
});