// tests/new/integration.oracle.spec.js
const fs = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { runOracleOnDemo } = require('../helpers/runOracle');
const { assembleWithJS } = require('../helpers/assembleJS');
const { diffHex, hexdump } = require('../helpers/hex');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/demos');

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
  if (!assertOracleConfigured()) {
    test.skip('Oracle not configured', () => {
      throw new Error(
        'Set LCC_ORACLE in .env to enable oracle tests (see tests/new/integration.oracle.spec.js header).'
      );
    });
    return;
  }

  ensureDir(GOLDEN_DIR);

  for (const { file, inputs, comment, opts = {} } of DEMOS) {
    const demoPath = path.join(DEMOS_DIR, file);
    const base = path.basename(file, '.a');
    const goldenA = path.join(GOLDEN_DIR, `${base}.a`);
    const goldenE = path.join(GOLDEN_DIR, `${base}.e`);

    test(`${file} — ${comment}`, () => {
      // --- Step 1: ensure golden .a matches current demo (or update/fail)
      const demoBytes = readBytes(demoPath);
      const haveGoldenA = fs.existsSync(goldenA);
      if (haveGoldenA) {
        const same = fileBytesEqual(demoPath, goldenA);
        if (!same) {
          if (cfg.goldenAutoUpdate) {
            writeBytes(goldenA, demoBytes);
          } else {
            throw new Error(
              `Demo source changed: ${file}\n` +
              `Golden .a mismatch.\n` +
              `Either set GOLDEN_AUTO_UPDATE=1 or manually update ${goldenA}.`
            );
          }
        }
      } else {
        if (cfg.goldenAutoUpdate) {
          writeBytes(goldenA, demoBytes);
        } else {
          throw new Error(
            `Missing golden .a for ${file}.\n` +
            `Either set GOLDEN_AUTO_UPDATE=1 or create ${goldenA}.`
          );
        }
      }

      // --- Step 2: ensure golden .e exists (or regenerate with oracle)
      if (!fs.existsSync(goldenE)) {
        if (cfg.goldenAutoUpdate) {
          const { bytes: eBytes } = runOracleOnDemo(demoPath, inputs, (opts || {}));
          writeBytes(goldenE, eBytes);
        } else {
          throw new Error(
            `Missing golden .e for ${file}.\n` +
            `Either set GOLDEN_AUTO_UPDATE=1 or generate ${goldenE} using oracle.`
          );
        }
      }

      // --- Step 3: build with JS and compare to golden .e
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
