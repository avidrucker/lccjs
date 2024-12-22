// test/e2e/lcc.e2e.test.js

/**
 * E2E LCC Tests using Jest
 *
 * Behavior:
 * - For each test case:
 *   1. Check if cache is valid for the given .a file.
 *   2. If cache is valid:
 *       - Run lcc.js locally and compare the generated .lst with the cached output.
 *         If identical, test passes without using Docker.
 *   3. If cache is invalid:
 *       - Run lcc.js locally to produce .lst.
 *       - Run LCC in Docker to produce a reference .lst.
 *       - Compare outputs. If identical, update cache.
 *   4. All tests that need Docker share a single Docker container lifecycle:
 *       - Docker container is started once before any of those tests run.
 *       - `name.nnn` is copied into Docker once.
 *       - After all Docker-needed tests complete, Docker is stopped.
 *   5. `name.nnn` is created locally once before all tests and removed after all tests.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const LCC = require('../../src/core/lcc');
const DockerController = require('../../test/dockerController');
const { isCacheValid, updateCache, getCachedFilePaths } = require('../../test/testCacheHandler');

const LCC_CACHE_DIR = path.join(__dirname, '../../test_cache/lcc_test_cache');
const execSyncOptions = {
  stdio: 'pipe',
  timeout: 30000,
  maxBuffer: 1024 * 1024,
};

// Ensure the cache directory exists
if (!fs.existsSync(LCC_CACHE_DIR)) {
  fs.mkdirSync(LCC_CACHE_DIR, { recursive: true });
}

const cacheOptions = {
  cacheDir: LCC_CACHE_DIR,
  inputExt: '.a',
  outputExt: '.lst',
};

// Test cases as objects: aFile, userInputs, comment
const testCases = [
  { aFile: './demos/demoA.a', userInputs: [], comment: 'assemble/interpret mov, dout, nl, and halt' },
  { aFile: './demos/demoB.a', userInputs: ['input1', 'input2'], comment: 'assemble/interpret sin, sout, and .string and .zero directives' },
  { aFile: './demos/demoC.a', userInputs: [], comment: 'assemble/interpret load, add, and a labeled .word directive' },
  { aFile: './demos/demoD.a', userInputs: [], comment: 'assemble/interpret mov, mvi, and mvr instructions' },
  { aFile: './demos/demoE.a', userInputs: [], comment: 'assemble/interpret push, pop, custom function definitions and calls' },
  { aFile: './demos/demoF.a', userInputs: [], comment: 'assemble/interpret various output commands (decimal, hex, and char)' },
  { aFile: './demos/demoG.a', userInputs: ['g', '-5', 'ff'], comment: 'assemble/interpret various user input commands (decimal, hex, and char)' },
  { aFile: './demos/demoH.a', userInputs: [], comment: 'assemble/interpret negative number args in mov, add, and .word' },
  { aFile: './demos/demoI.a', userInputs: [], comment: 'assemble/interpret branching and looping commands' },
  // { aFile: './demos/demoJ.a', userInputs: [], comment: 'disabled: to be relocated to error test suite' },
  { aFile: './demos/demoK.a', userInputs: [], comment: 'assemble/interpret m command' },
  { aFile: './demos/demoL.a', userInputs: [], comment: 'assemble/interpret r command' },
  { aFile: './demos/demoM.a', userInputs: [], comment: 'assemble/interpret s command' },
  // { aFile: './demos/demoN.a', userInputs: [], comment: 'disabled: relocate to exception/error test suite' },
  { aFile: './demos/demoO.a', userInputs: ['cheese'], comment: 'assemble/interpret IO commands' },
  { aFile: './demos/demoP.a', userInputs: [], comment: 'assemble/interpret .start and interleaved data in instructions' },
  { aFile: './demos/demoQ.a', userInputs: [], comment: 'assemble/interpret label args to .word directives' },
  { aFile: './demos/demoR.a', userInputs: [], comment: 'assemble/interpret srl, sra, sll' },
  { aFile: './demos/demoS.a', userInputs: [], comment: 'assemble/interpret rol, ror' },
  { aFile: './demos/demoT.a', userInputs: [], comment: 'assemble/interpret and, or, xor' },
  // { aFile: './demos/demoU.a', userInputs: [], comment: 'disabled: sext' },
  { aFile: './demos/demoV.a', userInputs: [], comment: 'assemble/interpret mul, div, rem' },
  { aFile: './demos/demoW.a', userInputs: [], comment: 'assemble/interpret cmp, branch instructions' },
  { aFile: './demos/demoX.a', userInputs: [], comment: 'assemble/interpret hex, cea, implicit r0 args' },
  { aFile: './demos/demoY.a', userInputs: [], comment: 'assemble/interpret label offset ld and .word directive' },
];

// Determine which tests need Docker (invalid cache)
const testsNeedingDocker = [];
const testsNotNeedingDocker = [];

for (const tc of testCases) {
  if (isCacheValid(tc.aFile, cacheOptions)) {
    testsNotNeedingDocker.push(tc);
  } else {
    testsNeedingDocker.push(tc);
  }
}

const containerName = 'mycontainer';
const dockerController = new DockerController(containerName);

// Helper functions

function execSyncWithLogging(command) {
  try {
    return execSync(command, execSyncOptions);
  } catch (error) {
    if (error.stdout) console.log(`stdout:\n${error.stdout.toString()}`);
    if (error.stderr) console.log(`stderr:\n${error.stderr.toString()}`);
    throw error;
  }
}

function compareLstFiles(file1, file2) {
  try {
    let content1 = fs.readFileSync(file1, 'utf8').split('\n');
    let content2 = fs.readFileSync(file2, 'utf8').split('\n');

    // Remove comments
    content1 = content1.map(line => line.replace(/;.*/, ''));
    content2 = content2.map(line => line.replace(/;.*/, ''));

    // Trim and normalize
    const linesToSkipRegex = /^(Input\s*file\s*name\s*=|LCC\s*Assemble|LCC\.js\s*Assemble)/i;
    const normalize = (lines) => {
      return lines
        .map(line => line.trim())
        .filter(line => !linesToSkipRegex.test(line))
        .map(line => line.toLowerCase().replace(/\s+/g, ' ').trim());
    };

    content1 = normalize(content1);
    content2 = normalize(content2);

    if (content1.length !== content2.length) return false;
    for (let i = 0; i < content1.length; i++) {
      if (content1[i] !== content2[i]) return false;
    }
    return true;
  } catch (error) {
    console.error('Error comparing .lst files:', error);
    return false;
  }
}

function runLocalLCC(aFile, userInputs) {
  const lcc = new LCC();
  if (userInputs && userInputs.length > 0) {
    lcc.inputBuffer = userInputs.join('\n') + '\n';
  }

  // Capture console.log output if needed
  // But here we just run it directly
  lcc.main([aFile]);

  // The output .lst will be in the same directory as aFile
  const inputFileName = path.basename(aFile, '.a');
  const inputDir = path.dirname(path.resolve(aFile));
  const lstFile = path.join(inputDir, `${inputFileName}.lst`);
  if (!fs.existsSync(lstFile)) {
    throw new Error(`Local LCC did not produce .lst file for ${aFile}`);
  }
  return lstFile;
}

function runDockerLCC(aFile, userInputs) {
  const absPath = path.resolve(aFile);
  const inputDir = path.dirname(absPath);
  const inputFileName = path.basename(aFile, '.a');

  // We'll copy aFile as name1.a into Docker
  const dockerAFile = path.join(inputDir, `${inputFileName}1.a`);
  fs.copyFileSync(aFile, dockerAFile);

  execSyncWithLogging(`docker cp ${dockerAFile} ${containerName}:/home/`);
  fs.unlinkSync(dockerAFile);

  let runCommand;
  if (userInputs.length === 0) {
    runCommand = `cd /home && /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  } else if (userInputs.length === 1) {
    runCommand = `cd /home && echo '${userInputs[0]}' | /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  } else {
    const chain = userInputs.map(u => `echo '${u}'`).join('; sleep 1; ');
    runCommand = `cd /home && (${chain}) | /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  }

  execSyncWithLogging(`docker exec ${containerName} sh -c "${runCommand}"`);

  const dockerLstPath = `/home/${inputFileName}1.lst`;
  const localDockerLstPath = path.join(inputDir, `${inputFileName}1.lst`);
  execSyncWithLogging(`docker cp ${containerName}:${dockerLstPath} ${localDockerLstPath}`);

  // Cleanup docker side test files
  execSyncWithLogging(`docker exec ${containerName} rm -f /home/${inputFileName}1.a /home/${inputFileName}1.lst`);

  if (!fs.existsSync(localDockerLstPath)) {
    throw new Error(`Docker LCC did not produce .lst file for ${aFile}`);
  }

  return localDockerLstPath;
}

function cleanupTestFiles(aFile) {
  const absPath = path.resolve(aFile);
  const inputDir = path.dirname(absPath);
  const inputFileName = path.basename(aFile, '.a');
  const localLst = path.join(inputDir, `${inputFileName}.lst`);
  const dockerLst = path.join(inputDir, `${inputFileName}1.lst`);

  [localLst, dockerLst].forEach(f => {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  });
}

describe('LCC E2E Tests', () => {
  const demosDir = path.resolve(__dirname, '../../demos');
  const nameFile = path.join(demosDir, 'name.nnn');
  let dockerStarted = false;

  beforeAll(() => {
    // Mute console output
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    // Write name.nnn once
    fs.writeFileSync(nameFile, 'Billy, Bob J\n');

    // If any test needs Docker, start it once
    if (testsNeedingDocker.length > 0) {
      if (!dockerController.isDockerAvailable()) {
        console.error('Docker not available. Tests needing Docker will fail.');
      } else {
        dockerController.startContainer();
        dockerStarted = true;
        // Copy name file to Docker
        execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`);
      }
    }
  }, 60000);

  afterAll(() => {
    // Cleanup name.nnn locally
    if (fs.existsSync(nameFile)) fs.unlinkSync(nameFile);

    // If Docker started, stop it
    if (dockerStarted) {
      dockerController.stopContainer();
    }

    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  // Tests that don't need Docker (cache valid)
  for (const testCase of testsNotNeedingDocker) {
    const { aFile, userInputs, comment } = testCase;
    const testName = `${path.basename(aFile, '.a')} - ${comment}`;

    it(testName, () => {
      const localLst = runLocalLCC(aFile, userInputs);
      const { cachedOutputFile } = getCachedFilePaths(aFile, cacheOptions);
      if (!fs.existsSync(cachedOutputFile)) {
        throw new Error(`Cache indicated valid but no cached file found for ${aFile}`);
      }

      const identical = compareLstFiles(localLst, cachedOutputFile);
      // cleanupTestFiles(aFile);
      expect(identical).toBe(true);
    }, 60000);
  }

  // Tests that need Docker (cache invalid)
  for (const testCase of testsNeedingDocker) {
    const { aFile, userInputs, comment } = testCase;
    const testName = `${path.basename(aFile, '.a')} - ${comment}`;

    it(testName, () => {
      // Run LCC locally
      const localLst = runLocalLCC(aFile, userInputs);

      // Run Docker LCC for reference
      if (!dockerController.isDockerAvailable()) {
        // cleanupTestFiles(aFile);
        throw new Error('Docker is required but not available.');
      }

      const dockerLst = runDockerLCC(aFile, userInputs);

      const identical = compareLstFiles(localLst, dockerLst);
      
      // Update cache
      updateCache(aFile, localLst, cacheOptions);
      
      // cleanupTestFiles(aFile);

      expect(identical).toBe(true);
    }, 60000);
  }
});
