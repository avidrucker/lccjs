// assembler.test.js
// how to run from project root directory:
// node ./test/assembler.test.js ./demos/demoA.a

const Assembler = require('../src/assembler');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');

const ignoreOrInherit = 'ignore'; // Use 'inherit' to see the output in real-time
const execSyncOptions = {
  stdio: ignoreOrInherit,
  timeout: 20000, // Increase timeout to 20 seconds
  maxBuffer: 1024 * 1024, // 1MB buffer limit
};

let userInputs;

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
  console.log(`Executing command: ${command}`);
  const startTime = Date.now();
  const result = execSync(command, options);
  const endTime = Date.now();
  console.log(`Command completed in ${endTime - startTime} ms`);
  return result;
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

  let testResult = false;
  let containerStartedByTest = false; // Keep track if we started the container

  try {
    // Check if Docker container is running
    if (!dockerController.isContainerRunning()) {
      // Start the container
      dockerController.startContainer();
      containerStartedByTest = true;
    } else {
      console.log(`Docker container ${containerName} is already running.`);
    }

    // Run assembler.js
    const assembler = new Assembler();
    assembler.main([inputFile]);

    // Check assembler output file size
    if (!isFileSizeValid(assemblerOutput)) {
      throw new Error('Assembler output file size exceeds limit - possible assembler error');
    }

    // Run LCC in Docker
    const lccOutput = runDockerLCC(inputFile, containerName);

    // Check LCC output file size
    if (!isFileSizeValid(lccOutput)) {
      throw new Error('LCC output file size exceeds limit - possible LCC error');
    }

    // Compare hex dumps
    testResult = compareHexDumps(assemblerOutput, lccOutput);

  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup: delete created test files in Docker container and locally
    console.log('Cleaning up test files...');

    const cleanupCommands = [
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

    cleanupCommands.forEach((cmd) => {
      try {
        execSyncWithLogging(cmd, execSyncOptions);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError.message);
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
    process.exit(testResult ? 0 : 1);
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
        console.log(`Failed with LCC path ${lccPath}:`, err.message);
        compilationError = err.message;
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
