// lcc.test.js

const LCC = require('../src/lcc');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');

const ignoreOrInherit = 'inherit'; // Use 'inherit' to see the output in real-time
const execSyncOptions = {
  stdio: ignoreOrInherit,
  timeout: 20000, // Increase timeout to 20 seconds
  maxBuffer: 1024 * 1024, // 1MB buffer limit
};

let userInputs;

function isFileSizeValid(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size <= 1024 * 1024; // 1MB limit
  } catch (error) {
    console.error(`Error accessing file ${filePath}:`, error);
    return false;
  }
}

// Function to compare .lst files, ignoring whitespace and comments, and ignoring the first line
function compareLstFiles(file1, file2) {
  try {
    // Read files
    const content1 = fs.readFileSync(file1, 'utf8').split('\n').slice(1);
    const content2 = fs.readFileSync(file2, 'utf8').split('\n').slice(1);

    // Remove comments and whitespace
    const cleanContent1 = content1
      .map((line) => line.replace(/;.*/, '').replace(/\s+/g, ''))
      .join('\n');
    const cleanContent2 = content2
      .map((line) => line.replace(/;.*/, '').replace(/\s+/g, ''))
      .join('\n');

    if (cleanContent1 === cleanContent2) {
      console.log('✅ .lst files are identical. Test PASSED.');
      return true;
    } else {
      console.log('❌ .lst files differ. Test FAILED.');

      // Log differences
      console.log('Local .lst file content:\n', cleanContent1);
      console.log('Docker .lst file content:\n', cleanContent2);

      return false;
    }
  } catch (error) {
    console.error('Error comparing .lst files:', error);
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

async function testLCC() {
  // Collect command-line arguments
  const args = process.argv.slice(2);

  // Default to demoA.a if no argument is provided
  const inputFile = args[0] || path.join(__dirname, '../demos/demoA.a');

  // Collect user inputs (arguments after the assembly file)
  userInputs = args.slice(1);

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);

  // Check if the .a file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Assembly file ${inputFile} does not exist.`);
    process.exit(1);
  }

  // Derive filenames
  const inputFileName = path.basename(inputFile, '.a');
  const inputDir = path.dirname(inputFile);

  // Paths for files
  const lccOutputLst = path.join(inputDir, `${inputFileName}.lst`);
  const lccDockerOutputLst = `/home/${inputFileName}1.lst`;
  const lccDockerInputFile = `/home/${inputFileName}1.a`;
  const lccInputFile = path.join(inputDir, `${inputFileName}1.a`);

  let testResult = false;
  let containerStartedByTest = false;

  try {
    // Check if Docker container is running
    if (!dockerController.isContainerRunning()) {
      // Start the container
      dockerController.startContainer();
      containerStartedByTest = true;
    } else {
      console.log(`Docker container ${containerName} is already running.`);
    }

    // Create the name.nnn file with specified contents
    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J', { encoding: 'utf8' });

    // Run lcc.js on the .a file
    const lcc = new LCC();

    // Set up simulated user inputs
    if (userInputs.length > 0) {
      lcc.inputBuffer = userInputs.join('\n') + '\n';
    }

    // Redirect console.log to capture outputs
    const originalConsoleLog = console.log;
    let lccOutput = '';
    console.log = function (message) {
      lccOutput += message + '\n';
      originalConsoleLog(message);
    };

    originalConsoleLog('Running lcc.js...');
    lcc.main([inputFile]);
    originalConsoleLog('lcc.js finished.');

    // Restore console.log
    console.log = originalConsoleLog;

    // Check if .lst file was created
    if (!fs.existsSync(lccOutputLst)) {
      console.error(`.lst file ${lccOutputLst} was not created.`);
      process.exit(1);
    }

    // Copy the .a file to Docker container, renaming it appropriately
    fs.copyFileSync(inputFile, lccInputFile);

    // Copy files to Docker container
    execSyncWithLogging(`docker cp ${lccInputFile} ${containerName}:/home/`, execSyncOptions);
    execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);

    // Run lcc in Docker to generate .lst file
    let runCommand = '';

    if (userInputs.length === 0) {
      // No inputs: run command directly without any stdin
      runCommand = `cd /home && /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
    } else if (userInputs.length === 1) {
      // One input: single echo without sleep
      runCommand = `cd /home && echo '${userInputs[0]}' | /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
    } else {
      // Multiple inputs: echo-sleep chain with 1-second intervals
      const echoSleepChain = userInputs.map((input) => `echo '${input}'`).join('; sleep 1; ');
      runCommand = `cd /home && (${echoSleepChain}) | /cuh/cuh63/lnx/lcc ${inputFileName}1.a`;
    }

    execSyncWithLogging(`docker exec ${containerName} sh -c "${runCommand}"`, execSyncOptions);

    // Copy the .lst file back from Docker
    const lccOutputLst1 = path.join(inputDir, `${inputFileName}1.lst`);
    execSyncWithLogging(`docker cp ${containerName}:${lccDockerOutputLst} ${lccOutputLst1}`, execSyncOptions);

    // Compare the .lst files
    testResult = compareLstFiles(lccOutputLst, lccOutputLst1);
  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup: delete created test files in Docker container and locally
    console.log('Cleaning up test files...');

    const cleanupCommands = [
      `docker exec ${containerName} rm -f ${lccDockerInputFile}`,
      `docker exec ${containerName} rm -f ${lccDockerOutputLst}`,
      `docker exec ${containerName} rm -f /home/name.nnn`,
      `rm -f ${lccInputFile}`,
      `rm -f ${path.join(inputDir, `${inputFileName}1.lst`)}`,
      `rm -f ${inputDir}/name.nnn`,
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

testLCC();
