// tests/new/assembler.oracle.e2e.spec.js
const fs = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');
const { diffHex, hexdump } = require('../helpers/hex');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/assembler');

// mirror the old E2E list (26 demos; J was disabled previously)
const DEMOS = [
  { file: 'demoA.a', inputs: [], comment: 'mov, dout, nl, and halt' },
  { file: 'demoB.a', inputs: ['a','b'], comment: 'sin, sout, and .string and .zero directives' },
  { file: 'demoC.a', inputs: [], comment: 'load, add, and a labeled .word directive' },
  { file: 'demoD.a', inputs: [], comment: 'mov, mvi, and mvr instructions' },
  { file: 'demoE.a', inputs: [], comment: 'push, pop, custom function definitions and calls' },
  { file: 'demoF.a', inputs: [], comment: 'various output commands (decimal, hex, and char)' },
  { file: 'demoG.a', inputs: ['g','-5','ff'], comment: 'various user input commands (decimal, hex, and char)' },
  { file: 'demoH.a', inputs: [], comment: 'negative number args in mov, add, and .word' },
  { file: 'demoI.a', inputs: [], comment: 'branching & looping' },
  // { file: 'demoJ.a', inputs: [], comment: 'infinite loop - not meant for happy-path running' },
  { file: 'demoK.a', inputs: [], comment: 'm command' },
  { file: 'demoL.a', inputs: [], comment: 'r command' },
  { file: 'demoM.a', inputs: [], comment: 's command' },
  { file: 'demoN.a', inputs: [], comment: 'div that when interpreted causes floating point error', opts: { tolerateNonZeroExit: true } },
  { file: 'demoO.a', inputs: ['cheese'], comment: 'IO commands' },
  { file: 'demoP.a', inputs: [], comment: '.start and interleaved data in instructions' },
  { file: 'demoQ.a', inputs: [], comment: 'label args to .word directives' },
  { file: 'demoR.a', inputs: [], comment: 'srl, sra, sll' },
  { file: 'demoS.a', inputs: [], comment: 'rol, ror' },
  { file: 'demoT.a', inputs: [], comment: 'and, or, xor' },
  { file: 'demoU.a', inputs: [], comment: 'sext' },
  { file: 'demoV.a', inputs: [], comment: 'mul, div, rem' },
  { file: 'demoW.a', inputs: [], comment: 'cmp, branch instructions' },
  { file: 'demoX.a', inputs: [], comment: 'hex, cea, implicit r0 args' },
  { file: 'demoY.a', inputs: [], comment: 'label offsets for ld and .word directive' },
  { file: 'demoZ.a', inputs: [], comment: 'label offsets for st, br, and lea instructions' },
];

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function readBytes(p) { return fs.readFileSync(p); }
function writeBytes(p, bytes) { fs.writeFileSync(p, bytes); }

function fileBytesEqual(a, b) {
  const A = readBytes(a); const B = readBytes(b);
  if (A.length !== B.length) return false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return false;
  return true;
}

describe('Assembler vs Oracle (demos → .e) with golden cache', () => {
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

  for (const { file, inputs, comment, opts = {} } of DEMOS) {
    const demoPath = path.join(DEMOS_DIR, file);
    const base = path.basename(file, '.a');
    const goldenA = path.join(GOLDEN_DIR, `${base}.a`);
    const goldenE = path.join(GOLDEN_DIR, `${base}.e`);

    const demoBytes = readBytes(demoPath);
    let haveGoldenA = fs.existsSync(goldenA);
    let haveGoldenE = fs.existsSync(goldenE);
    let sameA = haveGoldenA && fileBytesEqual(demoPath, goldenA);

    // Step 1: Ensure golden .a matches current demo (or update/fail/skip)
    if (!haveGoldenA || !sameA) {
      if (cfg.goldenAutoUpdate) {
        writeBytes(goldenA, demoBytes);
        haveGoldenA = true;
        sameA = true;
      } else {
        test.skip(`${file} — ${comment} (skipped: missing or mismatched golden .a)`, () => {});
        continue;
      }
    }

    // Step 2: Ensure golden .e exists (or regenerate/skip)
    if (!haveGoldenE) {
      if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
        const { bytes: eBytes } = runOracleOnDemo(demoPath, inputs, opts);
        writeBytes(goldenE, eBytes);
        haveGoldenE = true;
      } else if (!cfg.goldenAutoUpdate) {
        test.skip(`${file} — ${comment} (skipped: missing golden .e)`, () => {});
        continue;
      } else {
        test.skip(`${file} — ${comment} (skipped: oracle not configured for .e regen)`, () => {});
        continue;
      }
    }

    // Step 3: Run the actual test
    test(`${file} — ${comment}`, () => {
      const { bytes: jsBytes } = assembleWithJS(demoPath);
      const goldenBytes = readBytes(goldenE);

      const sameLen = jsBytes.length === goldenBytes.length;
      let mismatchIndex = -1;
      const minLen = Math.min(jsBytes.length, goldenBytes.length);
      for (let i = 0; i < minLen; i++) {
        if (jsBytes[i] !== goldenBytes[i]) { mismatchIndex = i; break; }
      }
      const match = sameLen && mismatchIndex === -1;

      if (!match) {
        const msg =
          `\n=== ${file} .e mismatch ===\n` +
          `--- JS (.e) hexdump ---\n${hexdump(jsBytes)}\n\n` +
          `--- Golden (.e) hexdump ---\n${hexdump(goldenBytes)}\n\n` +
          `--- Byte diff (index : JS  GOLDEN) ---\n${diffHex(jsBytes, goldenBytes)}\n`;
        throw new Error(msg);
      }
    });
  }
});
