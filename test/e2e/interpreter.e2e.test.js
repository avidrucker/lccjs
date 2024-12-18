/**
 * E2E Interpreter Tests using Jest
 *
 * Behavior:
 * - For each test case:
 *   1. If the .e file does not exist, assemble from .a.
 *   2. Check cache validity:
 *      - If valid, run interpreter and compare with cached output.
 *        If identical: pass.
 *        If not identical: treat as invalid cache scenario.
 *      - If invalid cache or difference:
 *        * Run interpreter locally to produce .lst
 *        * Run Docker LCC to produce reference .lst
 *        * Compare and update cache if matching
 *   3. Docker is started once if needed before tests that require it, and stopped after all tests.
 *   4. `name.nnn` is created once before all tests and cleaned up after all.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Interpreter = require('../../src/core/interpreter');
const Assembler = require('../../src/core/assembler');
const DockerController = require('../../test/dockerController');
const { isCacheValid, updateCache, getCachedFilePaths } = require('../../test/testCacheHandler');

const INTERPRETER_CACHE_DIR = path.join(__dirname, '../../test_cache/interpreter_test_cache');
const execSyncOptions = {
  stdio: 'pipe',
  timeout: 30000,
  maxBuffer: 1024 * 1024,
};

// Ensure the cache directory exists
if (!fs.existsSync(INTERPRETER_CACHE_DIR)) {
  fs.mkdirSync(INTERPRETER_CACHE_DIR, { recursive: true });
}

const cacheOptions = {
  cacheDir: INTERPRETER_CACHE_DIR,
  inputExt: '.e',
  outputExt: '.lst',
};

// Test cases
const testCases = [
  { eFile: './demos/demoA.e', userInputs: [], comment: 'interpretting mov, dout, nl, and halt' },
  { eFile: './demos/demoB.e', userInputs: ['a', 'b'], comment: 'interpreting the simulated input of 2 user inputs' },
  { eFile: './demos/demoC.e', userInputs: [], comment: 'interpretting load, add, and a labeled .word directive' },
  { eFile: './demos/demoD.e', userInputs: [], comment: 'interpretting mov, mvi, and mvr instructions' },
  { eFile: './demos/demoE.e', userInputs: [], comment: 'interpretting push, pop, and custom functions' },
  { eFile: './demos/demoF.e', userInputs: [], comment: 'interpretting various outputs (decimal, hex, and char)' },
  { eFile: './demos/demoG.e', userInputs: ['g', '-5', 'ff'], comment: 'interpretting various inputs (decimal, hex, and char)' },
  { eFile: './demos/demoH.e', userInputs: [], comment: 'interpretting negative numbers in mov, add, and .word' },
  { eFile: './demos/demoI.e', userInputs: [], comment: 'interpretting branching and looping' },
  // { eFile: './demos/demoJ.e', userInputs: ['testing interpreter with demoJ.e'] }, // infinite loop
  { eFile: './demos/demoK.e', userInputs: [], comment: 'interpretting m command'},
  { eFile: './demos/demoL.e', userInputs: [], comment: 'interpretting r command'},
  { eFile: './demos/demoM.e', userInputs: [], comment: 'interpretting s command'},
  // { eFile: './demos/demoN.e', userInputs: ['testing interpreter with demoN.e'] }, // error test
  { eFile: './demos/demoO.e', userInputs: ['cheese'], comment: 'interpretting IO commands to test LST generation'},
  { eFile: './demos/demoP.e', userInputs: [], comment: 'interpretting .start and interleaved data within instructions'},
  { eFile: './demos/demoQ.e', userInputs: [], comment: 'interpreting label args to .word directives'},
  { eFile: './demos/demoR.e', userInputs: [], comment: 'interpreting srl, sra, sll'},
  { eFile: './demos/demoS.e', userInputs: [], comment: 'interpreting rol, ror'},
  { eFile: './demos/demoT.e', userInputs: [], comment: 'interpreting and, or, xor'},
  // { eFile: './demos/demoU.e', userInputs: ['interpreting sext'] },
  { eFile: './demos/demoV.e', userInputs: [], comment: 'interpreting mul, div, rem'},
  { eFile: './demos/demoW.e', userInputs: [], comment: 'interpreting cmp, branch instructions'},
  { eFile: './demos/demoX.e', userInputs: [], comment: 'interpreting hex, cea, implicit r0 args'},
];

// Helper functions
function execSyncWithLogging(command) {
  try {
    return execSync(command, execSyncOptions);
  } catch (error) {
    if (error.stdout) console.log(`stdout:\n'${error.stdout.toString()}'`);
    if (error.stderr) console.log(`stderr:\n'${error.stderr.toString()}'`);
    throw error;
  }
}

function compareLstFiles(file1, file2) {
  const content1 = fs.readFileSync(file1, 'utf8').split('\n');
  const content2 = fs.readFileSync(file2, 'utf8').split('\n');

  const normalizeContent = (lines) => {
    lines = lines.map(line => line.replace(/;.*/, '')); // remove comments
    lines = lines.map(line => line.trim());
    const linesToSkipRegex = /^(Input\s*file\s*name\s*=|LCC\s*Assemble|LCC\.js\s*Assemble)/i;
    lines = lines.filter(line => !linesToSkipRegex.test(line));
    lines = lines.map(line => line.toLowerCase().replace(/\s+/g, ' ').trim());
    return lines;
  };

  const c1 = normalizeContent(content1);
  const c2 = normalizeContent(content2);

  if (c1.length !== c2.length) return false;
  for (let i = 0; i < c1.length; i++) {
    if (c1[i] !== c2[i]) return false;
  }
  return true;
}

function assembleIfNeeded(eFile) {
  const eFilePath = path.resolve(eFile);
  const eFileName = path.basename(eFilePath, '.e');
  const eFileDir = path.dirname(eFilePath);
  const aFilePath = path.join(eFileDir, `${eFileName}.a`);

  if (!fs.existsSync(eFilePath)) {
    if (!fs.existsSync(aFilePath)) {
      throw new Error(`Cannot assemble: missing ${aFilePath}`);
    }
    const assembler = new Assembler();
    assembler.main([aFilePath]);
    if (!fs.existsSync(eFilePath)) {
      throw new Error(`Failed to assemble ${aFilePath} into ${eFile}`);
    }
  }
}

function runLocalInterpreter(eFile, userInputs) {
  const interpreter = new Interpreter();
  if (userInputs && userInputs.length > 0) {
    interpreter.inputBuffer = userInputs.join('\n') + '\n';
  }
  interpreter.generateStats = true;
  interpreter.main([eFile]);
}

function runDockerLCC(eFile, userInputs, containerName) {
  const absEFile = path.resolve(eFile);
  const dir = path.dirname(absEFile);
  const base = path.basename(eFile, '.e');

  const dockerInputFile = path.join(dir, `${base}1.e`);
  const dockerOutputFile = path.join(dir, `${base}1.lst`);

  // Copy .e file to docker naming it base1.e
  fs.copyFileSync(eFile, dockerInputFile);
  execSyncWithLogging(`docker cp ${dockerInputFile} ${containerName}:/home/`);
  fs.unlinkSync(dockerInputFile);

  let runCommand = `cd /home && /cuh/cuh63/lnx/lcc ${base}1.e`;
  const realInputs = userInputs.slice(0, userInputs.length - 1);
  if (realInputs.length === 1) {
    runCommand = `cd /home && echo '${realInputs[0]}' | /cuh/cuh63/lnx/lcc ${base}1.e`;
  } else if (realInputs.length > 1) {
    const inputChain = realInputs.map((inp) => `echo '${inp}'`).join('; sleep 1; ');
    runCommand = `cd /home && (${inputChain}) | /cuh/cuh63/lnx/lcc ${base}1.e`;
  }

  execSyncWithLogging(`docker exec ${containerName} sh -c "${runCommand}"`);
  execSyncWithLogging(`docker cp ${containerName}:/home/${base}1.lst ${dockerOutputFile}`);

  // Cleanup docker side test files (but leave name.nnn as it's shared)
  execSyncWithLogging(`docker exec ${containerName} rm -f /home/${base}1.e /home/${base}1.lst`);

  if (!fs.existsSync(dockerOutputFile)) {
    throw new Error(`Docker LCC output .lst file not found for ${eFile}`);
  }

  return dockerOutputFile;
}

function cleanupFiles(eFile) {
  const absEFile = path.resolve(eFile);
  const dir = path.dirname(absEFile);
  const base = path.basename(eFile, '.e');
  const localLst = path.join(dir, `${base}.lst`);
  const dockerLst = path.join(dir, `${base}1.lst`);

  [localLst, dockerLst].forEach((f) => {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  });
}

const dockerController = new DockerController('mycontainer');
let dockerNeeded = false;

const testsWithInvalidCache = testCases.filter(tc => !isCacheValid(tc.eFile, cacheOptions));
if (testsWithInvalidCache.length > 0) {
  dockerNeeded = true;
}

// We'll place name.nnn in the demos directory (where our .e files are) once
const demosDir = path.resolve(__dirname, '../../demos');
const nameFile = path.join(demosDir, 'name.nnn');

describe('Interpreter E2E Tests', () => {

  beforeAll(() => {

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    fs.writeFileSync(nameFile, 'Billy, Bob J\n');
    if (dockerNeeded) {
      if (!dockerController.isDockerAvailable()) {
        console.error('Docker not available. Tests requiring Docker may fail.');
      } else {
        dockerController.startContainer();
        // Copy name.nnn once to Docker
        execSyncWithLogging(`docker cp ${nameFile} mycontainer:/home/`);
      }
    }
  }, 60000);

  afterAll(() => {
    // Remove local name.nnn
    if (fs.existsSync(nameFile)) {
      fs.unlinkSync(nameFile);
    }

    if (dockerNeeded && dockerController.isContainerRunning()) {
      // Remove name.nnn from Docker
      // execSyncWithLogging(`docker exec mycontainer rm -f /home/name.nnn`);
      dockerController.stopContainer();
    }

    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  for (const testCase of testCases) {
    const { eFile, userInputs, comment } = testCase;
    const testName = `${path.basename(eFile, '.e')} - ${comment}`;

    it(testName, () => {
      assembleIfNeeded(eFile);

      let cacheValid = isCacheValid(eFile, cacheOptions);

      if (cacheValid) {
        runLocalInterpreter(eFile, userInputs);

        const { cachedOutputFile } = getCachedFilePaths(eFile, cacheOptions);
        const localLst = path.join(path.dirname(path.resolve(eFile)), `${path.basename(eFile, '.e')}.lst`);

        if (!fs.existsSync(localLst)) {
          // cleanupFiles(eFile);
          throw new Error(`Local interpreter .lst not found for ${eFile}`);
        }

        const identical = compareLstFiles(localLst, cachedOutputFile);
        if (identical) {
          // cleanupFiles(eFile);
          return; // Pass
        } else {
          // Not identical, need Docker
          cacheValid = false;
        }
      }

      // Cache invalid or difference found => Docker needed
      if (dockerNeeded) {
        if (dockerController.isDockerAvailable()) {
          // Run local interpreter again if needed
          if (!cacheValid) {
            runLocalInterpreter(eFile, userInputs);
          }

          const localLst = path.join(path.dirname(path.resolve(eFile)), `${path.basename(eFile, '.e')}.lst`);
          if (!fs.existsSync(localLst)) {
            // cleanupFiles(eFile);
            throw new Error(`Local interpreter .lst not found after rerun for ${eFile}`);
          }

          const dockerLst = runDockerLCC(eFile, userInputs, 'mycontainer');
          const identical = compareLstFiles(localLst, dockerLst);

          if (!identical || !cacheValid) {
            updateCache(eFile, dockerLst, cacheOptions);
          }

          // cleanupFiles(eFile);
          expect(identical).toBe(true);
        } else {
          // cleanupFiles(eFile);
          throw new Error('Docker is required but not available.');
        }
      }
    }, 60000);
  }
});
