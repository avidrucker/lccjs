// test/e2e/assembler.e2e.test.js

/**
 * E2E Assembler Tests using Jest
 *
 * This test suite:
 * - Checks if cache is valid for given input .a files.
 * - If cache is valid, it compares assembler output with cached output (no Docker needed).
 * - If cache is invalid, it runs the assembler and then runs the LCC assembler in Docker to compare outputs.
 * - Docker container is started once if needed (if any test requires it), and stopped after all tests.
 * - Each test corresponds to a different input .a file and optional user inputs.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Assembler = require('../../src/core/assembler');
const DockerController = require('../../test/dockerController');
const { isCacheValid, updateCache, getCachedFilePaths } = require('../../test/testCacheHandler');

// Directory where tests expect cache to be
const ASSEMBLER_CACHE_DIR = path.join(__dirname, '../../test_cache/assembler_test_cache');
const cacheOptions = {
  cacheDir: ASSEMBLER_CACHE_DIR,
  inputExt: '.a',
  outputExt: '.e',
};

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const execSyncOptions = {
  stdio: 'pipe',
  timeout: 20000,
  maxBuffer: 1024 * 1024,
};

// Ensure the cache directory exists
if (!fs.existsSync(ASSEMBLER_CACHE_DIR)) {
  fs.mkdirSync(ASSEMBLER_CACHE_DIR, { recursive: true });
}

// Test cases as in original assemblerBattery.test.js
const testCases = [
  { file: './demos/demoA.a', userInputs: [], comment: 'assembling mov, dout, nl, and halt' },
  { file: './demos/demoB.a', userInputs: ['a', 'b'], comment: 'assembling sin, sout, and .string and .zero directives' },
  { file: './demos/demoC.a', userInputs: [], comment: 'assembling load, add, and a labeled .word directive' },
  { file: './demos/demoD.a', userInputs: [], comment: 'assembling mov, mvi, and mvr instructions' },
  { file: './demos/demoE.a', userInputs: [], comment: 'assembling push, pop, custom function definitions and calls' },
  { file: './demos/demoF.a', userInputs: [], comment: 'assembling various output commands (decimal, hex, and char)' },
  { file: './demos/demoG.a', userInputs: ['g', '-5', 'ff'], comment: 'assembling various user input commands (decimal, hex, and char)' },
  { file: './demos/demoH.a', userInputs: [], comment: 'assembling negative number args in mov, add, and .word' },
  { file: './demos/demoI.a', userInputs: [], comment: 'assembling branching and looping commands' },
  // { file: './demos/demoJ.a', userInputs: [], comment: 'disabled for infinite loop detection test' },
  { file: './demos/demoK.a', userInputs: [], comment: 'assembling m command' },
  { file: './demos/demoL.a', userInputs: [], comment: 'assembling r command' },
  { file: './demos/demoM.a', userInputs: [], comment: 'assembling s command' },
  // { file: './demos/demoN.a', userInputs: [], comment: 'assembling div that when interpretted causes floating point error' },
  { file: './demos/demoO.a', userInputs: ['cheese'], comment: 'assembling IO commands' },
  { file: './demos/demoP.a', userInputs: [], comment: 'assembling .start and interleaved data in instructions' },
  { file: './demos/demoQ.a', userInputs: [], comment: 'assembling label args to .word directives' },
  { file: './demos/demoR.a', userInputs: [], comment: 'assembling srl, sra, sll' },
  { file: './demos/demoS.a', userInputs: [], comment: 'assembling rol, ror' },
  { file: './demos/demoT.a', userInputs: [], comment: 'assembling and, or, xor' },
  { file: './demos/demoU.a', userInputs: [], comment: 'assembling sext' },
  { file: './demos/demoV.a', userInputs: [], comment: 'assembling mul, div, rem' },
  { file: './demos/demoW.a', userInputs: [], comment: 'assembling cmp, branch instructions' },
  { file: './demos/demoX.a', userInputs: [], comment: 'assembling hex, cea, implicit r0 args' },
  { file: './demos/demoY.a', userInputs: [], comment: 'assembling label offsets for ld and .word directive' },
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

function isFileExists(filePath) {
  return fs.existsSync(filePath);
}

function isFileSizeValid(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size <= MAX_FILE_SIZE;
  } catch (error) {
    console.error(`Error accessing file ${filePath}:`, error);
    return false;
  }
}

function compareHexDumps(file1, file2) {
  expect(isFileExists(file1)).toBe(true);
  expect(isFileExists(file2)).toBe(true);

  // Check file sizes
  expect(isFileSizeValid(file1)).toBe(true);
  expect(isFileSizeValid(file2)).toBe(true);

  const hexDump1 = execSync(`xxd -p ${file1}`).toString().trim();
  const hexDump2 = execSync(`xxd -p ${file2}`).toString().trim();
  return hexDump1 === hexDump2;
}

function runDockerLCC(inputFile, containerName, userInputs) {
  const absoluteInputPath = path.resolve(inputFile);
  const inputDir = path.dirname(absoluteInputPath);
  const inputFileName = path.basename(inputFile, '.a');
  const lccInputFile = path.join(inputDir, `${inputFileName}1.a`);
  const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);
  const lccDockerOutputFile = `/home/${inputFileName}1.e`;

  // Copy input file
  fs.copyFileSync(inputFile, lccInputFile);

  const nameFile = path.join(inputDir, 'name.nnn');

  // Copy files to Docker
  execSyncWithLogging(`docker cp ${lccInputFile} ${containerName}:/home/`);

  // Run LCC in docker
  let compileCommand = `cd /home && /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  if (userInputs.length > 0) {
    const echoInputs = userInputs.map((input) => `echo '${input}'`).join(' && ');
    compileCommand = `cd /home && (${echoInputs}) | /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  }

  execSyncWithLogging(`docker exec ${containerName} sh -c "${compileCommand}"`);

  // Copy back output
  execSyncWithLogging(`docker cp ${containerName}:${lccDockerOutputFile} ${lccOutputFile}`);
  expect(fs.existsSync(lccOutputFile)).toBe(true);

  return lccOutputFile;
}

function cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, dockerNeeded) {
  const cleanupCommands = [
    `rm -f ${inputDir}/${inputFileName}1.a`,
    // `rm -f ${inputDir}/name.nnn`,
    // `rm -f ${lccOutputFile}`,
    // `rm -f ${assemblerOutput}`,
  ];

  if (dockerNeeded) {
    const lccDockerOutputFile = `/home/${inputFileName}1.e`;
    cleanupCommands.push(
      `docker exec ${containerName} rm -f /home/${inputFileName}1.a`,
      `docker exec ${containerName} rm -f ${lccDockerOutputFile}`,
      // `docker exec ${containerName} rm -f /home/name.nnn`
    );
  }

  for (const cmd of cleanupCommands) {
    try {
      execSyncWithLogging(cmd);
    } catch (_) {
      // ignore cleanup errors
    }
  }
}

async function runAssemblerTest(inputFile, userInputs, skipCache, dockerNeeded, dockerController, containerName) {
  const inputFileName = path.basename(inputFile, '.a');
  const inputDir = path.dirname(path.resolve(inputFile));
  const assemblerOutput = path.join(inputDir, `${inputFileName}.e`);
  const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);

  let assemblerErrorOccurred = false;
  let assemblerErrorMessage = '';

  // Run assembler
  try {
    const assembler = new Assembler();
    assembler.main([inputFile]);
  } catch (error) {
    assemblerErrorOccurred = true;
    assemblerErrorMessage = error.message;
  }

  if (assemblerErrorOccurred) {
    cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, dockerNeeded);
    throw new Error(`Assembler failed with errors: ${assemblerErrorMessage}`);
  }

  expect(isFileExists(assemblerOutput)).toBe(true);
  expect(isFileSizeValid(assemblerOutput)).toBe(true);

  // If cache is valid and not skipped
  if (!skipCache && isCacheValid(inputFile, cacheOptions)) {
    const { cachedOutputFile } = getCachedFilePaths(inputFile, cacheOptions);
    expect(isFileExists(cachedOutputFile)).toBe(true);
    const identical = compareHexDumps(assemblerOutput, cachedOutputFile);
    cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, dockerNeeded);
    expect(identical).toBe(true);
    return;
  }

  // If cache invalid or skipCache => run Docker LCC
  if (dockerNeeded) {
    if (!dockerController.isContainerRunning()) {
      dockerController.startContainer();
    }
    const lccOutput = runDockerLCC(inputFile, containerName, userInputs);
    const identical = compareHexDumps(assemblerOutput, lccOutput);
    if (identical) {
      // Update cache if needed
      updateCache(inputFile, lccOutput, cacheOptions);
    }
    cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, dockerNeeded);
    expect(identical).toBe(true);
  } else {
    // If docker not needed but cache invalid means we can't produce reference?
    // This scenario should not happen because dockerNeeded is determined by invalid cache scenario.
    cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, dockerNeeded);
    throw new Error('Unexpected scenario: cache invalid but no docker needed?');
  }
}

// Determine which tests need Docker
const testsNeedingDocker = [];
const testsNotNeedingDocker = [];

for (const testCase of testCases) {
  const { file } = testCase;
  if (isCacheValid(file, cacheOptions)) {
    testsNotNeedingDocker.push(testCase);
  } else {
    testsNeedingDocker.push(testCase);
  }
}

const dockerController = new DockerController('mycontainer');
let dockerStarted = false;

describe('Assembler E2E Tests', () => {
  beforeAll(async () => {

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    const absoluteInputPath = path.resolve(testCases[0].file);
    const inputDir = path.dirname(absoluteInputPath);
    // name.nnn file
    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J\n');

    // If any test needs docker, we will start it once here
    if (testsNeedingDocker.length > 0) {
      // Check Docker availability
      const dockerAvailable = dockerController.isDockerAvailable();
      if (!dockerAvailable) {
        console.error('Docker not available. Tests requiring Docker will fail.');
        // We'll just run them and expect them to fail, or you can skip them.
      } else {
        // Start container once
        dockerController.startContainer();
        dockerStarted = true;

        execSyncWithLogging(`docker cp ${nameFile} mycontainer:/home/`); // ${containerName}
      }
    }
  }, 30000); // may need longer timeout to start docker container

  afterAll(async () => {
    if (dockerStarted) {
      dockerController.stopContainer();
    }

    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  // Tests that do not need Docker
  for (const testCase of testsNotNeedingDocker) {
    const { file, userInputs, comment } = testCase;
    const testName = `${path.basename(file, '.a')} - ${comment}`;
    it(testName, async () => {
      await runAssemblerTest(file, userInputs, false, false, dockerController, 'mycontainer');
    }, 60000);
  }

  // Tests that need Docker
  for (const testCase of testsNeedingDocker) {
    const { file, userInputs, comment } = testCase;
    const testName = `${path.basename(file, '.a')} - ${comment}`;
    it(testName, async () => {
      if (!dockerController.isDockerAvailable()) {
        console.warn('Docker not available, this test will fail.');
        await expect(runAssemblerTest(file, userInputs, true, true, dockerController, 'mycontainer'))
          .rejects.toThrow('Assembler failed'); // or some message indicating failure
      } else {
        await runAssemblerTest(file, userInputs, true, true, dockerController, 'mycontainer');
      }
    }, 60000);
  }
});
