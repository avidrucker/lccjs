/**
 * E2E Linker Tests using Jest
 *
 * Behavior:
 * - Each test specifies multiple .o files (or associated .a files).
 * - If .o files are not present or differ from cached copies, assemble .a -> .o in Docker and update cache.
 * - Run the custom linker to produce .e output.
 * - If .e not cached or differs, run Docker LCC linker to produce reference .e and compare.
 * - If identical, update cache and pass; otherwise fail.
 * - Docker container is started only if needed for that test before linking or assembly, and stopped after all tests.
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

const assemblyCacheOptions = {
  cacheDir: LINKER_CACHE_DIR,
  inputExt: '.a',
  outputExt: '.o',
};

const linkCacheOptions = {
  cacheDir: LINKER_CACHE_DIR,
  inputExt: '.o',
  outputExt: '.e',
};

/**
 * Check if all .a -> .o -> .e paths are cached and valid for a given testCase.
 * If everything is cached and unchanged, no Docker needed for that test.
 */
function isAllCachedAndValid({ oFiles, userInputs }) {
  const aFiles = oFiles.map(o => o.replace('.o', '.a'));

  let allCached = true;

  // Check each .a -> .o
  for (let i = 0; i < aFiles.length; i++) {
    const aFile = aFiles[i];
    const oFile = oFiles[i];

    // Check if aFile -> oFile is cached and valid
    if (!isCacheValid(aFile, assemblyCacheOptions)) {
      allCached = false;
      break;
    }

    const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);
    if (!fs.existsSync(oFile) || !fs.existsSync(cachedOFile) || !compareHexDumps(oFile, cachedOFile)) {
      allCached = false;
      break;
    }
  }

  // Check the final .e file
  const outputFile = getDefaultEFileName(oFiles, userInputs);
  const representativeOFile = oFiles[0]; // Use the first .o file for linking cache key

  // Check if the linking result is cached
  if (!isCacheValid(representativeOFile, linkCacheOptions)) {
    // Not cached at all
    allCached = false;
  } else {
    // Check if local output matches cached output
    const { cachedOutputFile } = getCachedFilePaths(representativeOFile, linkCacheOptions);
    if (!fs.existsSync(outputFile) || !fs.existsSync(cachedOutputFile) || !compareHexDumps(outputFile, cachedOutputFile)) {
      allCached = false;
    }
  }

  return allCached;
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
  const aFiles = oFiles.map(o => o.replace('.o', '.a'));
  const outputFile = getDefaultEFileName(oFiles, userInputs);
  const representativeOFile = oFiles[0];

  // 1. Run local linker first to produce the local .e
  const linker = new Linker();
  let linkArgs = [...userInputs, ...oFiles];
  linker.main(linkArgs);

  if (!fs.existsSync(outputFile)) {
    throw new Error(`Local linker did not produce output file: ${outputFile}`);
  }

  // 2. Check if all caches (.o and .e) are valid and if local .e matches cached .e
  if (isAllCachedAndValid({ oFiles, userInputs })) {
    // Everything matches the cache, no Docker needed, no cache update needed
    return; // Test passes
  }

  // 3. If we reach here, some cache is missing/invalid or .e differs from cached .e.
  //    We may need Docker to reassemble .o files. Determine if .o files need reassembly.
  let oNeedsDocker = false;
  for (let i = 0; i < aFiles.length; i++) {
    const aFile = aFiles[i];
    const oFile = oFiles[i];
    const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);

    if (!isCacheValid(aFile, assemblyCacheOptions) ||
        !fs.existsSync(oFile) ||
        !fs.existsSync(cachedOFile) ||
        !compareHexDumps(oFile, cachedOFile)) {
      oNeedsDocker = true;
      break;
    }
  }

  // 4. Check if `.e` cache is valid and local .e matches cached .e
  //    If not valid or differ, we might need Docker for linking as well.
  let eNeedsDocker = false;
  if (!isCacheValid(representativeOFile, linkCacheOptions)) {
    eNeedsDocker = true;
  } else {
    const { cachedOutputFile } = getCachedFilePaths(representativeOFile, linkCacheOptions);
    if (!fs.existsSync(cachedOutputFile) || !compareHexDumps(outputFile, cachedOutputFile)) {
      eNeedsDocker = true;
    }
  }

  // If we need Docker at all (for .o or .e), ensure the Docker container is running
  if ((oNeedsDocker || eNeedsDocker) && !dockerController.isContainerRunning()) {
    dockerController.startContainer();
    const nameFile = path.join(__dirname, '../../demos/name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J\n');
    execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`);
  }

  // 5. Re-assemble .o files if needed
  if (oNeedsDocker) {
    for (let i = 0; i < aFiles.length; i++) {
      const aFile = aFiles[i];
      const oFile = oFiles[i];
      const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);

      if (!isCacheValid(aFile, assemblyCacheOptions) ||
          !fs.existsSync(oFile) ||
          !fs.existsSync(cachedOFile) ||
          !compareHexDumps(oFile, cachedOFile)) {
        await assembleWithDockerLCC(aFile, oFile, containerName);
        // Update .o cache
        updateCache(aFile, oFile, assemblyCacheOptions);
      }
    }

    // After updating .o files, re-run local linker to get updated .e
    linker.main(linkArgs);
    if (!fs.existsSync(outputFile)) {
      throw new Error(`Local linker did not produce output file after reassembling .o files: ${outputFile}`);
    }

    // Now check if re-linking fixed the issue:
    if (isCacheValid(representativeOFile, linkCacheOptions)) {
      const { cachedOutputFile } = getCachedFilePaths(representativeOFile, linkCacheOptions);
      if (fs.existsSync(cachedOutputFile) && compareHexDumps(outputFile, cachedOutputFile)) {
        // Now local .e matches cached .e, no Docker linking needed
        return; // Test passes
      }
    }
  }

  // 6. If we still need Docker for linking (e.g., .e mismatch or no cache)
  if (eNeedsDocker) {
    const dockerEFile = runDockerLCCForLink(oFiles, outputFile, containerName);
    const identical = compareHexDumps(outputFile, dockerEFile);

    // Expect them to be identical (test passes if so)
    expect(identical).toBe(true);

    if (identical) {
      // Update the .e cache with the Docker reference
      updateCacheSingular(dockerEFile, LINKER_CACHE_DIR);
    }
  }
}

describe('Linker E2E Tests', () => {
  // Removed global dockerNeeded logic and starting Docker in beforeAll
  
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
  }, 60000);

  afterAll(() => {
    if (dockerController.isContainerRunning()) {
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
