// assembler.test.js
// how to run from project root directory:
// node ./test/assembler.test.js ./demos/demoA.a

const Assembler = require('../src/core/assembler');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');

const execSyncOptions = {
  stdio: 'pipe',
  timeout: 20000, // Increase timeout to 20 seconds
  maxBuffer: 1024 * 1024, // 1MB buffer limit
};

let userInputs;
let dockerCleanupNecessary = false;

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

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
  const startTime = Date.now();
  try {
    const result = execSync(command, options);
    const endTime = Date.now();
    // console.log(`Command completed in ${endTime - startTime} ms`);
    return result;
  } catch (error) {
    const endTime = Date.now();
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

const CACHE_DIR = path.join(__dirname, '../test_cache');

// Ensure the cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR);
}

async function testAssembler() {
  // Collect command-line arguments
  const args = process.argv.slice(2);

  // Default to demoA.a if no argument is provided
  const inputFile = args[0] || path.join(__dirname, '../demos/demoA.a');

  // Collect user inputs (arguments after the assembly file)
  userInputs = args.slice(1);

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);

  // Derive filenames
  const inputFileName = path.basename(inputFile, '.a');
  const inputDir = path.dirname(inputFile);

  // Paths for files
  const assemblerOutput = path.join(inputDir, `${inputFileName}.e`);
  const lccDockerOutputFile = `/home/${inputFileName}1.e`;
  const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);
  const lccDockerOutputBST = `/home/${inputFileName}1.bst`;
  const lccDockerOutputLST = `/home/${inputFileName}1.lst`;

  // Paths for cache files
  const cachedInputFile = path.join(CACHE_DIR, `${inputFileName}.a`);
  const cachedOutputFile = path.join(CACHE_DIR, `${inputFileName}.e`);

  let testResult = false;
  let containerStartedByTest = false; // Keep track if we started the container

  try {
    // Check if cache exists and inputs are identical
    const cacheExists = fs.existsSync(cachedInputFile) && fs.existsSync(cachedOutputFile);

    let inputsAreIdentical = false;
    if (cacheExists) {
      const currentInputContent = fs.readFileSync(inputFile);
      const cachedInputContent = fs.readFileSync(cachedInputFile);
      inputsAreIdentical = currentInputContent.equals(cachedInputContent);
    }

    if (cacheExists && inputsAreIdentical) {
      console.log('Cache exists and inputs are identical. Using cached output for comparison.');

      // Run assembler.js
      const assembler = new Assembler();
      assembler.main([inputFile]);

      // Compare assembler output .e file with cached output .e file
      if (!isFileSizeValid(assemblerOutput)) {
        throw new Error('Assembler output file size exceeds limit - possible assembler error');
      }

      testResult = compareHexDumps(assemblerOutput, cachedOutputFile);
    } else {
      console.log('Cache does not exist or inputs differ.');

      const dockerAvailable = dockerController.isDockerAvailable();

      if (dockerAvailable) {
        // Start Docker container if not running
        if (!dockerController.isContainerRunning()) {
          dockerController.startContainer();
          containerStartedByTest = true;
        }

        // Run assembler.js
        const assembler = new Assembler();
        assembler.main([inputFile]);

        // Run LCC in Docker
        const lccOutput = runDockerLCC(inputFile, containerName);
        dockerCleanupNecessary = true;

        // Check LCC output file size
        if (!isFileSizeValid(lccOutput)) {
          throw new Error('LCC output file size exceeds limit - possible LCC error');
        }

        // Compare assembler output .e file with LCC output
        if (!isFileSizeValid(assemblerOutput)) {
          throw new Error('Assembler output file size exceeds limit - possible assembler error');
        }

        testResult = compareHexDumps(assemblerOutput, lccOutput);

        // Update cache: copy input and output files to cache
        fs.copyFileSync(inputFile, cachedInputFile);
        fs.copyFileSync(lccOutput, cachedOutputFile);
      } else {
        console.log('❓ Docker is not available, and cache issues detected. Test could not be run.');
        console.log('Reason:');

        if (!cacheExists) {
          console.log('- Cache does not exist.');
        } else if (!inputsAreIdentical) {
          console.log('- Input .a file differs from the cached version.');
        }

        process.exitCode = 2;
        return; // Exit the test function
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup: delete created test files in Docker container and locally
    console.log('Cleaning up test files...');

    let cleanupCommands = [];
    if(dockerCleanupNecessary) {
      cleanupCommands = [
        `docker exec ${containerName} rm -f /home/${inputFileName}1.a`,
        `docker exec ${containerName} rm -f ${lccDockerOutputFile}`,
        `docker exec ${containerName} rm -f ${lccDockerOutputBST}`,
        `docker exec ${containerName} rm -f ${lccDockerOutputLST}`,
        `docker exec ${containerName} rm -f /home/name.nnn`,
        `rm -f ${inputDir}/${inputFileName}1.a`,
        `rm -f ${inputDir}/name.nnn`,
        `rm -f ${lccOutputFile}`,
        `rm -f ${assemblerOutput}`,
      ];
    } else {
      cleanupCommands = [
        `rm -f ${inputDir}/${inputFileName}1.a`,
        `rm -f ${inputDir}/name.nnn`,
        `rm -f ${lccOutputFile}`,
        `rm -f ${assemblerOutput}`,
      ];
    }

    cleanupCommands.forEach((cmd) => {
      try {
        execSyncWithLogging(cmd, execSyncOptions);
      } catch (cleanupError) {
        // Ignore cleanup errors
        console.log("Cleanup error:", cleanupError.message);
      }
    });

    // Stop the Docker container if we started it
    if (containerStartedByTest) {
      try {
        dockerController.stopContainer();
      } catch (err) {
        console.error('Error stopping Docker container:', err.message);
      }
    }

    // Exit with appropriate status code
    process.exit(testResult ? 0 : process.exitCode);
  }
}

function runDockerLCC(inputFile, containerName) {
  // Get absolute path of the input file
  const absoluteInputPath = path.resolve(inputFile);
  const inputDir = path.dirname(absoluteInputPath);
  const inputFileName = path.basename(inputFile, '.a');
  const lccInputFile = path.join(inputDir, `${inputFileName}1.a`);
  const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);
  const lccDockerOutputFile = `/home/${inputFileName}1.e`;
  const assemblerOutput = path.join(inputDir, `${inputFileName}.e`);

  try {
    // Copy the input file
    fs.copyFileSync(inputFile, lccInputFile);

    // Create the name.nnn file with specified contents
    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J');

    // Copy files to Docker container
    execSyncWithLogging(`docker cp ${lccInputFile} ${containerName}:/home/`, execSyncOptions);
    execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);

    // Verify files were copied to Docker
    execSyncWithLogging(`docker exec ${containerName} ls -l /home/`, execSyncOptions);

    // Compile in Docker with better error handling
    const lccPaths = ['/cuh/cuh63/lnx/lcc'];

    let compilationSuccessful = false;
    let compilationError = '';

    for (const lccPath of lccPaths) {
      try {
        let compileCommand = '';

        if (userInputs.length === 0) {
          // No inputs: run command directly without any stdin
          compileCommand = `cd /home && ${lccPath} ${inputFileName}1.a`;
        } else if (userInputs.length === 1) {
          // One input: single echo without sleep
          compileCommand = `cd /home && echo '${userInputs[0]}' | ${lccPath} ${inputFileName}1.a`;
        } else {
          // Multiple inputs: echo-sleep chain with 1-second intervals
          const echoSleepChain = userInputs.map((input) => `echo '${input}'`).join('; sleep 1; ');

          compileCommand = `cd /home && (${echoSleepChain}) | ${lccPath} ${inputFileName}1.a`;
        }

        execSyncWithLogging(`docker exec ${containerName} sh -c "${compileCommand}"`, execSyncOptions);

        // Verify the output file exists in Docker
        try {
          execSyncWithLogging(`docker exec ${containerName} ls -l ${lccDockerOutputFile}`, execSyncOptions);
          compilationSuccessful = true;
          break;
        } catch (verifyError) {
          console.log('Output file not found after compilation');
          compilationError = `Output file verification failed: ${verifyError.message}`;
        }
      } catch (err) {
        console.log(`LCC compilation exited with code ${err.status}. Continuing since we're only interested in the .e file.`);
        // Proceed even if there's an error, as long as the .e file exists
        try {
          execSyncWithLogging(`docker exec ${containerName} ls -l ${lccDockerOutputFile}`, execSyncOptions);
          compilationSuccessful = true;
          break;
        } catch (verifyError) {
          console.log('Output file not found after compilation');
          compilationError = `Output file verification failed: ${verifyError.message}`;
        }
      }
    }

    if (!compilationSuccessful) {
      throw new Error(`No working LCC command found. Last error: ${compilationError}`);
    }

    // Copy output from Docker back to local filesystem
    execSyncWithLogging(`docker cp ${containerName}:${lccDockerOutputFile} ${lccOutputFile}`, execSyncOptions);

    // Verify the local output file exists
    if (!fs.existsSync(lccOutputFile)) {
      throw new Error(`Failed to copy output file from Docker. ${lccOutputFile} does not exist.`);
    }

    return lccOutputFile;
  } catch (error) {
    console.error('Comprehensive LCC execution failure:', error);
    throw error;
  }
}

testAssembler();
