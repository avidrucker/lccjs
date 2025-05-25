/**
 * E2E Linker Tests using Jest
 *
 * Behavior:
 * - Each test specifies multiple .o files (or associated .a files).
 * - Run the custom linker to produce .e output.
 * - If .e not cached or differs, run Docker LCC linker to produce reference .e and compare.
 * - If .e output and .e cache are identical, pass. If Docker is run, always update .e cache.
 * - Docker container is started only if needed for that test before linking or assembly, and stopped after all tests.
 * - `name.nnn` is managed similarly as in assembler/interpreter tests.
 */


/**
 * Revised E2E Linker Tests using Jest with batching Docker usage
 *
 * Revised Logic Steps:
 * 1. (locally) assemble .a object modules into .o files using assembler.js
 *    A. If any errors, fail test.
 * 2. (locally) link the .o files into a single .e file using Linker
 *    A. If any linker errors, fail test.
 * 3. (locally) compare the hex dumps of the .o files with their cached versions
 *    A. If .o files not generated, fail test
 *    B. If any .o cache missing, mark that Docker is needed
 *    C. If any .o cache mismatch, mark that Docker is needed
 * 4. (locally) compare hex dump of .e file with cached version
 *    A. If .e cache missing, mark that Docker is needed
 *    B. If .e cache mismatch, mark that Docker is needed
 *    C. If .e cache exists and matches, pass test if no Docker needed
 * 5. (only if Docker needed for that test)
 *    - Run steps 1 & 2 (linking only, no assembly) in Docker to regenerate .e cache
 *    - Update .e cache from Docker result
 *    - Compare Docker-generated .e with locally generated .e
 *    A. If they match, pass test
 *    B. If not, fail test
 *
 * Docker is started only if needed (based on a pre-check of all tests), and started once.
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const Linker = require('../../src/core/linker');
const Assembler = require('../../src/core/assembler');
const DockerController = require('../../test/dockerController');
const {
  ensureDirectoryExists,
  compareHexDumps,
  getCachedFilePath,
  updateCacheSingular,
} = require('../../test/testCacheHandler');

const LINKER_CACHE_DIR = path.join(__dirname, '../../test_cache/linker_test_cache');
ensureDirectoryExists(LINKER_CACHE_DIR);

const execSyncOptions = {
  stdio: 'pipe',
  timeout: 30000,
  maxBuffer: 1024 * 1024,
};

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
];

const containerName = 'mycontainer';
const dockerController = new DockerController(containerName);

/** Helper execution function */
function execSyncWithLogging(command) {
  try {
    return execSync(command, execSyncOptions);
  } catch (error) {
    if (error.stdout) console.log(`stdout:\n'${error.stdout.toString()}'`);
    if (error.stderr) console.log(`stderr:\n'${error.stderr.toString()}'`);
    throw error;
  }
}

/** Determine the default .e filename if not specified */
function getDefaultEFileName(oFiles, userInputs) {
  const oIndex = userInputs.indexOf('-o');
  if (oIndex !== -1 && userInputs[oIndex + 1]) {
    return userInputs[oIndex + 1];
  }
  const baseNames = oFiles.map(file => path.basename(file, '.o'));
  const outputFileName = baseNames.join('_') + '.e';
  const outputDir = path.dirname(oFiles[0]);
  return path.join(outputDir, outputFileName);
}

/** O-File Caching Helpers (unchanged logic, just helper functions) */
function checkMultipleOFilesCache(oFiles) {
  for (let i = 0; i < oFiles.length; i++) {
    // const aFile = aFiles[i];
    const oFile = oFiles[i]; // local oFile in ./demos/

    const { allMatch } = checkSingleOFileCache(oFile);
    if (!allMatch) {
      return { allOFilesPresent: true, allOFilesCachedAndMatch: false };
    }
  }
  return { allOFilesPresent: true, allOFilesCachedAndMatch: true };
}

function checkSingleOFileCache(oFile) {
  const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);
  if (!fs.existsSync(cachedOFile)) {
    return { allMatch: false };
  }

  if (!compareHexDumps(oFile, cachedOFile)) {
    return { allMatch: false };
  }

  return { allMatch: true };
}

function updateMultipleOFilesCache(aFiles, oFiles) {
  for (let i = 0; i < aFiles.length; i++) {
    const oFile = oFiles[i];
    updateCacheSingular(oFile, LINKER_CACHE_DIR);
  }
}

/** E-File Caching Helpers:
 * Instead of using representativeOFile, we cache the final .e based on its own name.
 */
function getCachedEFilePath(eFile) {
  const fileName = path.basename(eFile);
  return path.join(LINKER_CACHE_DIR, fileName);
}

function isECacheValid(eFile) {
  const cachedEFile = getCachedEFilePath(eFile);
  if (!fs.existsSync(eFile) || !fs.existsSync(cachedEFile)) {
    return false;
  }
  return compareHexDumps(eFile, cachedEFile);
}

function doesECacheExist(eFile) {
  const cachedEFile = getCachedEFilePath(eFile);
  return fs.existsSync(cachedEFile);
}

function updateECache(eFile) {
  const cachedEFile = getCachedEFilePath(eFile);
  fs.copyFileSync(eFile, cachedEFile);
}

/** Local assembly from .a to .o using assembler.js (Step 1) */
function localAssembleAtoO(aFiles, oFiles) {
  for (let i = 0; i < aFiles.length; i++) {
    const aFile = aFiles[i];
    const oFile = oFiles[i];
    const assembler = new Assembler();
    // The assembler should produce `oFile` from `aFile`. 
    assembler.main([aFile]);
    if (!fs.existsSync(oFile)) {
      throw new Error(`Assembler did not produce expected .o file: ${oFile}`);
    }
  }
}

/** Local linking (Step 2) */
function linkLocally(oFiles, userInputs) {
  const linker = new Linker();
  const linkArgs = [...userInputs, ...oFiles];
  linker.main(linkArgs);
}

/** Docker linking (Step 5) */
function dockerLink(oFiles, outputFile, containerName) {
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
  const dockerEFile = path.join(LINKER_CACHE_DIR, outputFileName);
  execSyncWithLogging(`docker cp ${containerName}:${dockerOutputFile} ${dockerEFile}`);

  // Clean up inside Docker
  for (const objFile of oFiles) {
    const objFileName = path.basename(objFile);
    execSyncWithLogging(`docker exec ${containerName} rm -f /home/${objFileName}`);
  }
  execSyncWithLogging(`docker exec ${containerName} rm -f ${dockerOutputFile}`);

  return dockerEFile;
}

/**
 * Check if Docker is needed for a test without making it fail the suite
 * This is a "dry run" that attempts steps 1-4 locally and determines if Docker is needed.
 */
function preCheckDockerNeeded({ oFiles, userInputs }) {
  const aFiles = oFiles.map(o => o.replace('.o', '.a'));
  const eFile = getDefaultEFileName(oFiles, userInputs);

  try {
    // Steps 1 & 2: Just ensure no error. We won't throw if fails, just mark docker needed.
    localAssembleAtoO(aFiles, oFiles);
    linkLocally(oFiles, userInputs);
  
    // Step 3: Check .o caches
    const { allOFilesPresent, allOFilesCachedAndMatch } = checkMultipleOFilesCache(oFiles);
    if (!allOFilesPresent) {
      return true; // Docker needed
    }

    let dockerNeeded = false;
    if (!allOFilesCachedAndMatch) {
      dockerNeeded = true;
    }

    // Step 4: Check .e cache
    const eCacheExists = doesECacheExist(eFile);
    const eCacheMatches = eCacheExists && isECacheValid(eFile);
    if (!eCacheExists || !eCacheMatches) {
      dockerNeeded = true;
    }

    return dockerNeeded;
  } catch {
    // If local steps fail, definitely docker needed to fix caches
    return true;
  }
}

/**
 * Run the full test now that we know if Docker is needed.
 * If dockerNeeded == false, run steps 1-4 and ensure test passes locally.
 * If dockerNeeded == true, run steps 1-4, then step 5 with Docker.
 */
async function runLinkerTestCase({ oFiles, userInputs, comment }, dockerNeeded) {
  const aFiles = oFiles.map(o => o.replace('.o', '.a'));
  const eFile = getDefaultEFileName(oFiles, userInputs);

  // Steps 1-2 (local)
  localAssembleAtoO(aFiles, oFiles);
  for (const oFile of oFiles) {
    if (!fs.existsSync(oFile)) {
      throw new Error(`Assembly did not produce expected .o file: ${oFile}`);
    }
  }

  linkLocally(oFiles, userInputs);
  if (!fs.existsSync(eFile)) {
    throw new Error(`Local linker did not produce output file: ${eFile}`);
  }

  // Steps 3-4 (local cache checks)
  const { allOFilesPresent, allOFilesCachedAndMatch } = checkMultipleOFilesCache(oFiles);
  if (!allOFilesPresent) {
    throw new Error('Some .o files not present after assembly');
  }

  const eCacheExists = doesECacheExist(eFile);
  const eCacheMatches = eCacheExists && isECacheValid(eFile);

  // If no docker needed, we expect caches to match or we can update them now
  if (!dockerNeeded) {
    // If we got here with no dockerNeeded, ensure now that local matches:
    if (!allOFilesCachedAndMatch) {
      // Update .o cache since local is correct and no docker needed
      updateMultipleOFilesCache(aFiles, oFiles);
    }
    if (!eCacheMatches) {
      // Update eCache
      updateECache(eFile);
    }
    // Test passes with local only
    return;
  }

  // If dockerNeeded:
  // Docker was started in beforeAll if needed
  const dockerEFile = dockerLink(oFiles, eFile, containerName);

  // Update .o cache now that we trust local assembly
  updateMultipleOFilesCache(aFiles, oFiles);

  // Compare Docker .e with local .e
  const identical = compareHexDumps(eFile, dockerEFile);
  if (!identical) {
    throw new Error('Docker-generated .e does not match locally generated .e');
  }

  // Update eCache
  updateECache(dockerEFile);
}

let anyDockerNeeded = false;
let dockerNeededForTest = new Map();

describe('Linker E2E Tests', () => {

  beforeAll(() => {

    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    const nameFile = path.join(__dirname, '../../demos/name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J\n');

    // Pre-check all tests to see if Docker is needed at all
    for (const testCase of testCases) {
      const needed = preCheckDockerNeeded(testCase);
      dockerNeededForTest.set(testCase, needed);
      if (needed) {
        anyDockerNeeded = true;
      }
    }

    // If needed by at least one test, start Docker once
    if (anyDockerNeeded) {
      dockerController.startContainer();
      execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`);
    }
  }, 60000);

  afterAll(() => {
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
    console.info.mockRestore();
    process.stdout.write.mockRestore();

    if (dockerController.isContainerRunning()) {
      dockerController.stopContainer();
    }
  });

  for (const testCase of testCases) {
    const testName = `${testCase.oFiles.map(f => path.basename(f)).join(', ')} - ${testCase.comment}`;
    it(testName, async () => {
      const needed = dockerNeededForTest.get(testCase);
      await runLinkerTestCase(testCase, needed);
    }, 60000);
  }
});
