// assembler.script.js
// how to run from project root directory:
// node ./test/assembler.script.js ./demos/demoA.a

/*
Assembler Script (assembler.script.js)
Summary of Behavior and Objectives
- Purpose: To test the custom Assembler implementation by comparing its output with the output of the standard LCC assembler running inside a Docker container.
- Behavior:
  - Input Handling: Accepts an assembly .a file and optional user inputs.
  - Cache Checking: Checks if a valid cache exists for the input file to avoid unnecessary reassembly.
  - Assembly Process:
    - If the cache is invalid or --skip-cache is specified, it runs the custom Assembler on the input file to produce an executable .e file.
    - It runs the standard LCC assembler inside Docker to produce the expected .e file.
  - Comparison:
    - Compares the hex dumps of the two .e files using xxd.
    - Reports any differences found between the outputs.
  - Cache Update: Updates the cache with the new output from the LCC assembler if differences are found or the cache is invalid.
  - Docker Management:
    - Manages Docker container setup and teardown using DockerController.
    - Copies necessary files into and out of the Docker container.
  - Cleanup: Cleans up any temporary files created during the test, both locally and inside the Docker container.
*/

const Assembler = require('../src/core/assembler');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');
const { isCacheValid, updateCache, getCachedFilePaths } = require('./testCacheHandler');

const execSyncOptions = {
  stdio: 'pipe',
  timeout: 20000, // Increase timeout to 20 seconds
  maxBuffer: 1024 * 1024, // 1MB buffer limit
};

let userInputs;
let dockerCleanupNecessary = false;

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

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
  if(!isFileExists(file1)) {
    console.error('Input file does not exist:', file1);
    return;
  }

  if(!isFileExists(file2)) {
    console.error('Input file does not exist:', file2);
    return;
  }

  try {
    // Check file sizes first
    if (!isFileSizeValid(file1) || !isFileSizeValid(file2)) {
      throw new Error('File size exceeds 1MB limit - possible infinite loop in assembly output');
    }

    // Generate hex dumps using xxd
    const hexDump1 = execSync(`xxd -p ${file1}`).toString().trim();
    const hexDump2 = execSync(`xxd -p ${file2}`).toString().trim();

    // Compare hex dumps
    if (hexDump1 === hexDump2) {
      console.log('✅ Hex dumps are identical. Test PASSED.');
      return true;
    } else {
      console.log('❌ Hex dumps differ. Test FAILED.');

      // Find and log the differences
      const diff1 = hexDump1.split('');
      const diff2 = hexDump2.split('');

      console.log('Differences found:');
      for (let i = 0; i < Math.min(diff1.length, diff2.length); i++) {
        if (diff1[i] !== diff2[i]) {
          console.log(`Position ${i}: ${diff1[i]} !== ${diff2[i]}`);
        }
      }

      if (diff1.length !== diff2.length) {
        console.log(`Length mismatch: File 1 length = ${diff1.length}, File 2 length = ${diff2.length}`);
      }

      return false;
    }
  } catch (error) {
    console.error('Error comparing hex dumps:', error);
    return false;
  }
}

function execSyncWithLogging(command, options) {
  // console.log(`Executing command: ${command}`);
  // const startTime = Date.now();
  try {
    const result = execSync(command, options);
    // const endTime = Date.now();
    // console.log(`Command completed in ${endTime - startTime} ms`);
    return result;
  } catch (error) {
    // const endTime = Date.now();
    // console.log(`Command failed in ${endTime - startTime} ms`);
    if (error.stdout) {
      console.log(`stdout:\n'${error.stdout.toString()}'`);
    }
    if (error.stderr) {
      console.log(`stderr:\n'${error.stderr.toString()}'`);
    }
    throw error;
  }
}

// Define cache directory and options
const ASSEMBLER_CACHE_DIR = path.join(__dirname, '../test_cache/assembler_test_cache');
const cacheOptions = {
  cacheDir: ASSEMBLER_CACHE_DIR,
  inputExt: '.a',
  outputExt: '.e',
};

// Ensure the cache directory exists
if (!fs.existsSync(ASSEMBLER_CACHE_DIR)) {
  fs.mkdirSync(ASSEMBLER_CACHE_DIR, { recursive: true });
  console.log("Created cache directory:", ASSEMBLER_CACHE_DIR);
} else {
  console.log("Using cache directory:", ASSEMBLER_CACHE_DIR);
}

async function testAssembler() {
  // Collect command-line arguments
  const args = process.argv.slice(2);

  let skipCache = false;

  // Check for --skip-cache
  const skipCacheIndex = args.indexOf('--skip-cache');
  if (skipCacheIndex !== -1) {
    skipCache = true;
    args.splice(skipCacheIndex, 1); // Remove '--skip-cache' from args
  }

  // Default to demoA.a if no argument is provided
  const inputFileArgIndex = args.findIndex((arg) => !arg.startsWith('-'));
  if (inputFileArgIndex === -1) {
    console.error('No input file specified.');
    process.exit(1);
  }

  const inputFile = args[inputFileArgIndex];

  // Collect user inputs (arguments after the assembly file)
  const userInputs = args.slice(inputFileArgIndex + 1);

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);

  // Derive filenames
  const inputFileName = path.basename(inputFile, '.a');
  const inputDir = path.dirname(inputFile);

  // Paths for files
  const assemblerOutput = path.join(inputDir, `${inputFileName}.e`);
  const lccDockerOutputFile = `/home/${inputFileName}1.e`;
  const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);

  let testResult = false;
  let assemblerErrorOccurred = false;
  let assemblerErrorMessage = '';
  let lccOutput;
  let dockerCleanupNecessary = false;

  // Override process.exit
  const originalProcessExit = process.exit;
  process.exit = (code) => {
    throw new Error(`Assembler called process.exit with code ${code}`);
  };

  try {
    // Always run the assembler
    try {
      const assembler = new Assembler();
      assembler.main([inputFile]);
    } catch (error) {
      assemblerErrorOccurred = true;
      assemblerErrorMessage = error.message;
      console.error('Assembler error:', assemblerErrorMessage);
    }

    if (!isFileExists(assemblerOutput) || !isFileSizeValid(assemblerOutput)) {
      console.error('Assembler output file is missing or invalid.');
      testResult = false;
    }

    // If cache is valid and not skipped, compare with cached output
    if (!skipCache && isCacheValid(inputFile, { cacheDir: path.join(__dirname, '../test_cache/assembler_test_cache'), inputExt: '.a', outputExt: '.e' })) {
      console.log('Cache exists and inputs are identical. Using cached output for comparison.');
      const { cachedOutputFile } = getCachedFilePaths(inputFile, { cacheDir: path.join(__dirname, '../test_cache/assembler_test_cache'), inputExt: '.a', outputExt: '.e' });
      if(isFileExists(assemblerOutput) && isFileSizeValid(assemblerOutput)) {
        console.log("Comparing hex dumps of assembler output and cached output...");
        testResult = compareHexDumps(assemblerOutput, cachedOutputFile);
      } else {
        console.log('Assembler output file is missing or invalid.');
        testResult = false;
      }
    } else {
      console.log('Cache is missing or invalid...');

      // Check if Docker is available
      if (!dockerController.isDockerAvailable()) {
        console.error('Docker is not available. Cannot run test that requires Docker.');
        // Cannot proceed without Docker when cache is invalid
        testResult = false;
        return process.exit(2);
      }

      // Start Docker container if necessary
      if (!dockerController.isContainerRunning()) {
        dockerController.startContainer();
        dockerCleanupNecessary = true;
      }

      // Run LCC in Docker
      lccOutput = runDockerLCC(inputFile, containerName, userInputs);

      // Compare outputs
      if (isFileExists(assemblerOutput) && isFileSizeValid(assemblerOutput)) {
        testResult = compareHexDumps(assemblerOutput, lccOutput);
      } else {
        console.error('Assembler output file is missing or invalid.');
        testResult = false;
      }

      // Update cache
      if (lccOutput) {
        console.log(`Updating cache for ${inputFile} with new ${lccOutputFile}`);
        updateCache(inputFile, lccOutput, { cacheDir: path.join(__dirname, '../test_cache/assembler_test_cache'), inputExt: '.a', outputExt: '.e' });
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
    testResult = false;
  } finally {
    // Restore original process.exit
    process.exit = originalProcessExit;

    // Cleanup
    cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, lccDockerOutputFile, dockerCleanupNecessary);

    // Report test result
    if (assemblerErrorOccurred) {
      console.error('Assembler failed with errors. Test marked as FAILED.');
      console.error('Assembler errors were:');
      console.error(assemblerErrorMessage);
      process.exit(1);
    } else {
      process.exit(testResult ? 0 : 1);
    }
  }
}

function runDockerLCC(inputFile, containerName, userInputs) {
  const absoluteInputPath = path.resolve(inputFile);
  const inputDir = path.dirname(absoluteInputPath);
  const inputFileName = path.basename(inputFile, '.a');
  const lccInputFile = path.join(inputDir, `${inputFileName}1.a`);
  const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);
  const lccDockerOutputFile = `/home/${inputFileName}1.e`;

  // Copy the input file
  fs.copyFileSync(inputFile, lccInputFile);

  // Create the name.nnn file with specified contents
  const nameFile = path.join(inputDir, 'name.nnn');
  fs.writeFileSync(nameFile, 'Billy, Bob J');

  // Copy files to Docker container
  execSyncWithLogging(`docker cp ${lccInputFile} ${containerName}:/home/`, execSyncOptions);
  execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);

  // Compile in Docker
  let compileCommand = `cd /home && /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  if (userInputs.length > 0) {
    const echoInputs = userInputs.map((input) => `echo '${input}'`).join(' && ');
    compileCommand = `cd /home && (${echoInputs}) | /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
  }

  execSyncWithLogging(`docker exec ${containerName} sh -c "${compileCommand}"`, execSyncOptions);

  // Copy output from Docker back to local filesystem
  execSyncWithLogging(`docker cp ${containerName}:${lccDockerOutputFile} ${lccOutputFile}`, execSyncOptions);

  // Verify the local output file exists
  if (!fs.existsSync(lccOutputFile)) {
    throw new Error(`Failed to copy output file from Docker. ${lccOutputFile} does not exist.`);
  }

  return lccOutputFile;
}

function cleanupFiles(inputDir, inputFileName, assemblerOutput, lccOutputFile, dockerController, containerName, lccDockerOutputFile, dockerCleanupNecessary) {
  console.log('Cleaning up test files...');

  const cleanupCommands = [
    `rm -f ${inputDir}/${inputFileName}1.a`,
    `rm -f ${inputDir}/name.nnn`,
    `rm -f ${lccOutputFile}`,
    `rm -f ${assemblerOutput}`,
  ];

  if (dockerCleanupNecessary) {
    cleanupCommands.push(
      `docker exec ${containerName} rm -f /home/${inputFileName}1.a`,
      `docker exec ${containerName} rm -f ${lccDockerOutputFile}`,
      `docker exec ${containerName} rm -f /home/name.nnn`
    );
  }

  cleanupCommands.forEach((cmd) => {
    try {
      execSyncWithLogging(cmd, execSyncOptions);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  });

  // Stop the Docker container if we started it
  if (dockerCleanupNecessary && dockerController.isContainerRunning()) {
    try {
      dockerController.stopContainer();
    } catch (err) {
      console.error('Error stopping Docker container:', err.message);
    }
  }
}

testAssembler();
