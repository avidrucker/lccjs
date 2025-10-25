// tests/new/linker.oracle.e2e.spec.js
const fs = require('fs');
const path = require('path');
const { cfg, assertOracleConfigured } = require('../helpers/env');
const { assembleWithJS } = require('../helpers/assembleJS');
const { diffHex, hexdump } = require('../helpers/hex');

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const GOLDEN_DIR = path.resolve(__dirname, '../goldens/linker');

// Linker test cases (multi-module demos)
const DEMOS = [
  {
    modules: ['startup', 'm1', 'm2'],
    outputName: 'startup_m1_m2',
    comment: 'Linking multiple object files from textbook example',
  },
  {
    modules: ['s1', 's2'],
    outputName: 's1_s2',
    comment: 'Linking two object modules custom example 1',
  },
  {
    modules: ['start', 'r1', 'r2'],
    outputName: 'start_r1_r2',
    comment: 'Linking three object modules custom example 2',
  },
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

function assembleWithJSToO(sourcePath) {
  const Assembler = require('../../src/core/assembler');
  const os = require('os');
  
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-asm-o-'));
  const base = path.basename(sourcePath, '.a');
  const tmpSrc = path.join(tmp, `${base}.a`);
  fs.copyFileSync(sourcePath, tmpSrc);

  // Create name.nnn in temp directory
  const nameFile = path.join(tmp, 'name.nnn');
  fs.writeFileSync(nameFile, 'TestUser\n');

  const asm = new Assembler();
  asm.main([tmpSrc]);

  const outO = path.join(tmp, `${base}.o`);
  if (!fs.existsSync(outO)) {
    throw new Error(`JS assembler did not produce expected .o: ${outO}`);
  }
  const bytes = fs.readFileSync(outO);
  return { bytes, outPath: outO, tmpDir: tmp };
}

function linkWithJS(oFiles, outputName) {
  const Linker = require('../../src/core/linker');
  const os = require('os');
  
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-link-'));
  
  // Create name.nnn in temp directory
  const nameFile = path.join(tmp, 'name.nnn');
  fs.writeFileSync(nameFile, 'TestUser\n');
  
  // Copy all .o files to temp directory
  const tmpOFiles = oFiles.map(oFile => {
    const base = path.basename(oFile);
    const tmpO = path.join(tmp, base);
    fs.copyFileSync(oFile, tmpO);
    return tmpO;
  });

  const outE = path.join(tmp, `${outputName}.e`);
  
  const linker = new Linker();
  linker.main(['-o', outE, ...tmpOFiles]);

  if (!fs.existsSync(outE)) {
    throw new Error(`JS linker did not produce expected .e: ${outE}`);
  }
  const bytes = fs.readFileSync(outE);
  return { bytes, outPath: outE, tmpDir: tmp };
}

function runOracleAssembleToO(aFile, opts = {}) {
  const {
    tolerateNonZeroExit = false,
    keepTmp = process.env.KEEP_ORACLE_TMP === '1',
    debug = process.env.DEBUG_ORACLE === '1',
  } = opts;

  if (!cfg.lccPath) throw new Error('LCC_ORACLE is not set (see .env)');
  if (!fs.existsSync(cfg.lccPath)) throw new Error(`LCC oracle not found: ${cfg.lccPath}`);

  const { spawnSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-oracle-asm-o-'));
  const base = path.basename(aFile, '.a');

  // Oracle naming: base1.a -> base1.o
  const oracleInBase = `${base}1.a`;
  const oracleOutBase = `${base}1.o`;
  const oracleIn = path.join(tmp, oracleInBase);
  const oracleOut = path.join(tmp, oracleOutBase);

  fs.copyFileSync(aFile, oracleIn);

  // Create name.nnn
  const nameFile = path.join(tmp, 'name.nnn');
  fs.writeFileSync(nameFile, 'TestUser\n');

  const spawnOpts = {
    cwd: tmp,
    encoding: 'utf8',
    timeout: cfg.lccTimeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  const res = spawnSync(cfg.lccPath, [oracleInBase], spawnOpts);

  if (res.error) throw res.error;

  const hasO = fs.existsSync(oracleOut);

  if (debug) {
    // eslint-disable-next-line no-console
    console.warn(`[oracle asm->o] exit=${res.status} hasO=${hasO} tmp=${tmp}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`);
  }

  if (res.status !== 0) {
    if (!(tolerateNonZeroExit && hasO)) {
      const errorMsg = res.stdout.includes('needs linking') 
        ? `Oracle produced object module (exit ${res.status}), but tolerateNonZeroExit not set. Set opts.tolerateNonZeroExit=true for .o files.`
        : `Oracle lcc (asm->o) exited with ${res.status}`;
      
      throw new Error(
        `${errorMsg}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`
      );
    }
  }

  if (!hasO) {
    throw new Error(`Oracle did not produce expected .o file: ${oracleOut}`);
  }

  const bytes = fs.readFileSync(oracleOut);
  return { bytes, outPath: oracleOut, tmpDir: tmp, kept: keepTmp ? tmp : null };
}

function runOracleLink(oFiles, outputName, opts = {}) {
  const {
    tolerateNonZeroExit = false,
    keepTmp = process.env.KEEP_ORACLE_TMP === '1',
    debug = process.env.DEBUG_ORACLE === '1',
  } = opts;

  if (!cfg.lccPath) throw new Error('LCC_ORACLE is not set (see .env)');
  if (!fs.existsSync(cfg.lccPath)) throw new Error(`LCC oracle not found: ${cfg.lccPath}`);

  const { spawnSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lccjs-oracle-link-'));

  // Copy all .o files with oracle naming (base1.o)
  const oracleOFiles = oFiles.map(oFile => {
    const base = path.basename(oFile, '.o');
    const oracleOBase = `${base}1.o`;
    const oracleO = path.join(tmp, oracleOBase);
    fs.copyFileSync(oFile, oracleO);
    return oracleOBase; // Return just the basename for command line
  });

  const oracleOutBase = `${outputName}1.e`;
  const oracleOut = path.join(tmp, oracleOutBase);

  // Create name.nnn
  const nameFile = path.join(tmp, 'name.nnn');
  fs.writeFileSync(nameFile, 'TestUser\n');

  const spawnOpts = {
    cwd: tmp,
    encoding: 'utf8',
    timeout: cfg.lccTimeoutMs,
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  // Link: lcc base1.o base2.o ... -o output1.e
  const args = [...oracleOFiles, '-o', oracleOutBase];
  const res = spawnSync(cfg.lccPath, args, spawnOpts);

  if (res.error) throw res.error;

  const hasE = fs.existsSync(oracleOut);

  if (debug) {
    // eslint-disable-next-line no-console
    console.warn(`[oracle link] exit=${res.status} hasE=${hasE} tmp=${tmp}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`);
  }

  if (res.status !== 0) {
    if (!(tolerateNonZeroExit && hasE)) {
      throw new Error(
        `Oracle lcc (link) exited with ${res.status}\nstdout:\n${res.stdout || ''}\nstderr:\n${res.stderr || ''}`
      );
    }
  }

  if (!hasE) {
    throw new Error(`Oracle did not produce expected .e file: ${oracleOut}`);
  }

  const bytes = fs.readFileSync(oracleOut);
  return { bytes, outPath: oracleOut, tmpDir: tmp, kept: keepTmp ? tmp : null };
}

describe('Linker vs Oracle (multi-module demos → .o → .e) with golden cache', () => {
  // Mock console.log to suppress assembler/linker output
  beforeAll(() => {
    // jest.spyOn(console, 'log').mockImplementation(() => {});
    // jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create name.nnn file in DEMOS_DIR for any tests that might need it
    const nameFile = path.join(DEMOS_DIR, 'name.nnn');
    if (!fs.existsSync(nameFile)) {
      fs.writeFileSync(nameFile, 'TestUser\n');
    }
  });

  afterAll(() => {
    // console.log.mockRestore();
    // console.error.mockRestore();
  });

  ensureDir(GOLDEN_DIR);

  for (const { modules, outputName, comment, opts = {} } of DEMOS) {
    const testName = `${outputName} (${modules.join(', ')}) — ${comment}`;

    test(testName, () => {
      const aFiles = modules.map(m => path.join(DEMOS_DIR, `${m}.a`));
      const goldenAFiles = modules.map(m => path.join(GOLDEN_DIR, `${m}.a`));
      const goldenOFiles = modules.map(m => path.join(GOLDEN_DIR, `${m}.o`));
      const goldenE = path.join(GOLDEN_DIR, `${outputName}.e`);

      // Step 0: Ensure all .a files exist
      for (const aFile of aFiles) {
        if (!fs.existsSync(aFile)) {
          throw new Error(`Missing .a file: ${aFile}`);
        }
      }

      // Step 1: Ensure golden .a files match current demos (or update/skip)
      for (let i = 0; i < modules.length; i++) {
        const aFile = aFiles[i];
        const goldenA = goldenAFiles[i];
        const aBytes = readBytes(aFile);
        let haveGoldenA = fs.existsSync(goldenA);
        let sameA = haveGoldenA && fileBytesEqual(aFile, goldenA);

        if (!haveGoldenA || !sameA) {
          if (cfg.goldenAutoUpdate) {
            writeBytes(goldenA, aBytes);
          } else {
            throw new Error(`Golden .a missing or mismatched: ${goldenA}`);
          }
        }
      }

      // Step 2: Ensure golden .o files exist (or regenerate/skip)
      const oracleNeededForO = [];
      for (let i = 0; i < modules.length; i++) {
        const goldenO = goldenOFiles[i];
        if (!fs.existsSync(goldenO)) {
          oracleNeededForO.push(i);
        }
      }

      if (oracleNeededForO.length > 0) {
        if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
          // Regenerate missing .o files
          for (const idx of oracleNeededForO) {
            const aFile = aFiles[idx];
            const goldenO = goldenOFiles[idx];
            // Add tolerateNonZeroExit for object module assembly
            const { bytes: oBytes } = runOracleAssembleToO(aFile, { ...opts, tolerateNonZeroExit: true });
            writeBytes(goldenO, oBytes);
          }
        } else if (!cfg.goldenAutoUpdate) {
          throw new Error(`Missing golden .o files, auto-update disabled`);
        } else {
          throw new Error(`Oracle not configured, cannot regenerate golden .o files`);
        }
      }

      // Step 3: Assemble all .a -> .o with JS assembler
      const jsOFiles = [];
      for (let i = 0; i < modules.length; i++) {
        const aFile = aFiles[i];
        const { bytes: oBytes, outPath } = assembleWithJSToO(aFile);
        jsOFiles.push(outPath);

        // Compare JS .o with golden .o
        const goldenO = goldenOFiles[i];
        const goldenOBytes = readBytes(goldenO);

        const sameLen = oBytes.length === goldenOBytes.length;
        let mismatchIndex = -1;
        const minLen = Math.min(oBytes.length, goldenOBytes.length);
        for (let j = 0; j < minLen; j++) {
          if (oBytes[j] !== goldenOBytes[j]) { mismatchIndex = j; break; }
        }
        const match = sameLen && mismatchIndex === -1;

        if (!match) {
          const msg =
            `\n=== ${modules[i]}.o mismatch (assembly step) ===\n` +
            `--- JS (.o) hexdump ---\n${hexdump(oBytes)}\n\n` +
            `--- Golden (.o) hexdump ---\n${hexdump(goldenOBytes)}\n\n` +
            `--- Byte diff (index : JS  GOLDEN) ---\n${diffHex(oBytes, goldenOBytes)}\n`;
          throw new Error(msg);
        }
      }

      // Step 4: Ensure golden .e exists (or regenerate/skip)
      let haveGoldenE = fs.existsSync(goldenE);
      if (!haveGoldenE) {
        if (cfg.goldenAutoUpdate && assertOracleConfigured()) {
          // Use golden .o files for linking (they're already validated)
          const { bytes: eBytes } = runOracleLink(goldenOFiles, outputName, opts);
          writeBytes(goldenE, eBytes);
          haveGoldenE = true;
        } else if (!cfg.goldenAutoUpdate) {
          throw new Error(`Missing golden .e file, auto-update disabled: ${goldenE}`);
        } else {
          throw new Error(`Oracle not configured, cannot regenerate golden .e file`);
        }
      }

      // Step 5: Link all .o -> .e with JS linker
      const { bytes: jsEBytes } = linkWithJS(jsOFiles, outputName);
      const goldenEBytes = readBytes(goldenE);

      const sameLen = jsEBytes.length === goldenEBytes.length;
      let mismatchIndex = -1;
      const minLen = Math.min(jsEBytes.length, goldenEBytes.length);
      for (let i = 0; i < minLen; i++) {
        if (jsEBytes[i] !== goldenEBytes[i]) { mismatchIndex = i; break; }
      }
      const match = sameLen && mismatchIndex === -1;

      if (!match) {
        const msg =
          `\n=== ${outputName}.e mismatch (linking step) ===\n` +
          `--- JS (.e) hexdump ---\n${hexdump(jsEBytes)}\n\n` +
          `--- Golden (.e) hexdump ---\n${hexdump(goldenEBytes)}\n\n` +
          `--- Byte diff (index : JS  GOLDEN) ---\n${diffHex(jsEBytes, goldenEBytes)}\n`;
        throw new Error(msg);
      }
    });
  }
});