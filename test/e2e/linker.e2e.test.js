/**
 * E2E Linker Tests using Jest
 *
 * Behavior:
 * - Each test specifies multiple .o files (or associated .a files).
 * - If .o files are not present or differ from cached copies, assemble .a -> .o in Docker and update cache.
 * - Run the custom linker to produce .e output.
 * - If .e not cached or differs, run Docker LCC linker to produce reference .e and compare.
 * - If identical, update cache and pass; otherwise fail.
 * - Docker container is started once if needed before any test requiring it, and stopped after all tests.
 * - `name.nnn` is managed similarly as in assembler/interpreter tests.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Linker = require('../../src/core/linker');
const DockerController = require('../../test/dockerController');
const {
  ensureDirectoryExists,
  isCacheValid,
  updateCache,
  updateCacheSingular,
  compareHexDumps,
  getCachedFilePath,
  getCachedFilePaths,
} = require('../../test/testCacheHandler');

const LINKER_CACHE_DIR = path.join(__dirname, '../../test_cache/linker_test_cache');
ensureDirectoryExists(LINKER_CACHE_DIR);

const cacheOptions = {
  cacheDir: LINKER_CACHE_DIR,
  inputExt: '.a',  // We'll consider .a as the 'input' files since they determine the .o files
  outputExt: '.e',
};

const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const execSyncOptions = {
  stdio: 'pipe',
  timeout: 30000,
  maxBuffer: 1024 * 1024,
};

// Example test cases
// { oFiles: [], userInputs: [], comment: '' }
// userInputs could represent linker flags like ['-o', 'myoutput.e'] or other arguments.
const testCases = [
  {
    oFiles: ['./demos/startup.o', './demos/m1.o', './demos/m2.o'],
    userInputs: ['-o', './demos/startup_m1_m2.e'],
    comment: 'Linking multiple object files from a textbook example'
  },
  {
    oFiles: ['./demos/s1.o', './demos/s2.o'],
    userInputs: ['-o', './demos/s1_s2.e'],
    comment: 'Linking two object modules custom example 1'
  },
  {
    oFiles: ['./demos/start.o', './demos/r1.o', './demos/r2.o'],
    userInputs: ['-o', './demos/start_r1_r2.e'],
    comment: 'Linking three object modules custom example 2'
  },
  // Add more test cases as needed
];

// Docker setup
const containerName = 'mycontainer';
const dockerController = new DockerController(containerName);

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
  const stat = fs.statSync(filePath);
  return stat.size <= MAX_FILE_SIZE;
}

// Determine if Docker is needed for any test
function needsDockerForAnyTest(testCases) {
  for (const testCase of testCases) {
    if (!isAllCachedAndValid(testCase)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if all .a -> .o -> .e paths are cached and valid for a given testCase.
 * If everything is cached and unchanged, no Docker needed for that test.
 */
function isAllCachedAndValid({ oFiles, userInputs }) {
  // Given oFiles, derive aFiles
  const aFiles = oFiles.map(o => o.replace('.o', '.a'));
  
  let allCached = true;

  // Check .a and corresponding .o
  for (let i = 0; i < aFiles.length; i++) {
    const aFile = aFiles[i];
    const oFile = oFiles[i];

    // .a must match cached input to confirm no re-assembly needed
    if (!isCacheValid(aFile, { ...cacheOptions, outputExt: '.o' })) {
      allCached = false;
      break;
    }

    // Check if corresponding .o matches cache
    const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);
    if (!fs.existsSync(oFile) || !fs.existsSync(cachedOFile) || !compareHexDumps(oFile, cachedOFile)) {
      allCached = false;
      break;
    }
  }

  // Check .e
  const outputFile = getDefaultEFileName(oFiles, userInputs);
  if (!isCacheValid(outputFile, cacheOptions)) {
    // This checks if cached input and output are correct, but since output is .e
    // we must also check if local .e matches cache if it exists
    const { cachedOutputFile } = getCachedFilePaths(outputFile, cacheOptions);
    if (!fs.existsSync(outputFile) || !fs.existsSync(cachedOutputFile) || !compareHexDumps(outputFile, cachedOutputFile)) {
      allCached = false;
    }
  }

  return allCached;
}

function getDefaultEFileName(oFiles, userInputs) {
  // If userInputs include an '-o someFile.e', use that
  const oIndex = userInputs.indexOf('-o');
  if (oIndex !== -1 && userInputs[oIndex + 1]) {
    return userInputs[oIndex + 1];
  }
  // Otherwise generate default output file name
  const baseNames = oFiles.map(file => path.basename(file, '.o'));
  const outputFileName = baseNames.join('_') + '.e';
  const outputDir = path.dirname(oFiles[0]);
  return path.join(outputDir, outputFileName);
}

async function assembleWithDockerLCC(aFile, oFile, containerName) {
  const aFileName = path.basename(aFile);
  const oFileName = path.basename(oFile);

  execSyncWithLogging(`docker cp ${aFile} ${containerName}:/home/${aFileName}`);
  const assembleCommand = `cd /home && /cuh/cuh63/lnx/lcc ${aFileName}`;
  execSyncWithLogging(`docker exec ${containerName} sh -c "${assembleCommand}"`);
  execSyncWithLogging(`docker cp ${containerName}:/home/${oFileName} ${oFile}`);

  // Clean up inside Docker
  execSyncWithLogging(`docker exec ${containerName} rm -f /home/${aFileName} /home/${oFileName}`);
}

/**
 * Run Docker LCC linker to produce reference .e file from .o files.
 */
function runDockerLCCForLink(oFiles, outputFile, containerName) {
  const outputFileName = path.basename(outputFile);
  const dockerOutputFile = `/home/${outputFileName}`;

  // Copy .o files to Docker
  for (const objFile of oFiles) {
    const objFileName = path.basename(objFile);
    execSyncWithLogging(`docker cp ${objFile} ${containerName}:/home/${objFileName}`);
  }

  // Link with LCC inside Docker
  const objFileNames = oFiles.map(file => path.basename(file));
  const linkCommand = `cd /home && /cuh/cuh63/lnx/lcc ${objFileNames.join(' ')} -o ${outputFileName}`;
  execSyncWithLogging(`docker exec ${containerName} sh -c "${linkCommand}"`);

  // Copy output .e file back
  const localDockerEFile = path.join(LINKER_CACHE_DIR, outputFileName);
  execSyncWithLogging(`docker cp ${containerName}:${dockerOutputFile} ${localDockerEFile}`);

  // Clean up inside Docker
  for (const objFile of oFiles) {
    const objFileName = path.basename(objFile);
    execSyncWithLogging(`docker exec ${containerName} rm -f /home/${objFileName}`);
  }
  execSyncWithLogging(`docker exec ${containerName} rm -f ${dockerOutputFile}`);

  return localDockerEFile;
}

async function runLinkerTestCase({ oFiles, userInputs, comment }) {
  // Derive .a files from .o files
  const aFiles = oFiles.map(o => o.replace('.o', '.a'));
  const outputFile = getDefaultEFileName(oFiles, userInputs);

  let dockerNeeded = false;

  // Check if we need to assemble .o files from .a
  for (let i = 0; i < aFiles.length; i++) {
    const aFile = aFiles[i];
    const oFile = oFiles[i];

    // Check if aFile matches cache
    if (!isCacheValid(aFile, { ...cacheOptions, outputExt: '.o' })) {
      dockerNeeded = true;
    } else {
      // aFile cached correctly, check .o file
      const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);
      if (!fs.existsSync(oFile) || !fs.existsSync(cachedOFile) || !compareHexDumps(oFile, cachedOFile)) {
        dockerNeeded = true;
      }
    }
  }

  // Check if linking needed
  // If outputFile not cached or differs, we need docker LCC reference after linking
  if (!isCacheValid(outputFile, cacheOptions)) {
    dockerNeeded = true;
  } else {
    const { cachedOutputFile } = getCachedFilePaths(outputFile, cacheOptions);
    if (!fs.existsSync(outputFile) || !fs.existsSync(cachedOutputFile) || !compareHexDumps(outputFile, cachedOutputFile)) {
      dockerNeeded = true;
    }
  }

  // If we need docker and it's not running, start it
  if (dockerNeeded && !dockerController.isContainerRunning()) {
    dockerController.startContainer();
    // Copy name.nnn once
    const nameFile = path.join(__dirname, '../../demos/name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J\n');
    execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`);
  }

  // Reassemble as needed
  for (let i = 0; i < aFiles.length; i++) {
    const aFile = aFiles[i];
    const oFile = oFiles[i];
    const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);

    let assembleNeeded = false;
    if (!isCacheValid(aFile, { ...cacheOptions, outputExt: '.o' })) {
      assembleNeeded = true;
    } else if (!fs.existsSync(oFile) || !fs.existsSync(cachedOFile) || !compareHexDumps(oFile, cachedOFile)) {
      assembleNeeded = true;
    }

    if (assembleNeeded) {
      if (!dockerNeeded) {
        throw new Error(`Assembly needed for ${oFile} but Docker not available.`);
      }
      await assembleWithDockerLCC(aFile, oFile, containerName);
      updateCacheSingular(aFile, LINKER_CACHE_DIR);
      updateCacheSingular(oFile, LINKER_CACHE_DIR);
    }
  }

  // Now run linker locally
  const linker = new Linker();
  // We assume userInputs can contain flags like '-o output.e', etc.
  // Extract output file from userInputs if specified
  let linkArgs = [...userInputs, ...oFiles];
  console.log("linkArgs: ", linkArgs);
  linker.main(linkArgs);

  if (!fs.existsSync(outputFile)) {
    throw new Error(`Local linker did not produce output file: ${outputFile}`);
  }

  if (isCacheValid(outputFile, cacheOptions)) {
    // Compare local output to cached output
    const { cachedOutputFile } = getCachedFilePaths(outputFile, cacheOptions);
    const identical = compareHexDumps(outputFile, cachedOutputFile);
    expect(identical).toBe(true);
    return; // Test passes
  }

  // Cache invalid or difference found => run Docker LCC to get reference
  if (!dockerNeeded) {
    throw new Error(`Linker test requires Docker but it's not needed? Unexpected scenario.`);
  }

  const dockerEFile = runDockerLCCForLink(oFiles, outputFile, containerName);
  const identical = compareHexDumps(outputFile, dockerEFile);
  expect(identical).toBe(true);
  if (identical) {
    // Update cache for aFiles -> oFiles and outputFile -> dockerEFile
    for (const aFile of aFiles) {
      if (!isCacheValid(aFile, { ...cacheOptions, outputExt: '.o' })) {
        // If needed, re-cache
        updateCache(aFile, aFile.replace('.a', '.o'), { ...cacheOptions, outputExt: '.o' });
      }
    }

    updateCache(outputFile, dockerEFile, cacheOptions);
  }
}

describe('Linker E2E Tests', () => {
  let dockerStarted = false;
  const dockerNeeded = needsDockerForAnyTest(testCases);

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    if (dockerNeeded) {
      if (!dockerController.isDockerAvailable()) {
        console.error('Docker not available. Tests requiring Docker may fail.');
      } else {
        dockerController.startContainer();
        dockerStarted = true;
        // Copy name.nnn
        const nameFile = path.join(__dirname, '../../demos/name.nnn');
        fs.writeFileSync(nameFile, 'Billy, Bob J\n');
        execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`);
      }
    }
  }, 60000);

  afterAll(() => {
    if (dockerStarted) {
      dockerController.stopContainer();
    }

    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();
  });

  for (const testCase of testCases) {
    const testName = `${testCase.oFiles.map(f => path.basename(f)).join(', ')} - ${testCase.comment}`;
    it(testName, async () => {
      await runLinkerTestCase(testCase);
    }, 60000);
  }
});
