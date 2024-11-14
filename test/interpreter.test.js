// interpreter.test.js

const Interpreter = require('../src/interpreter');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');

const ignoreOrInherit = 'inherit'; // Use 'inherit' to see the output in real-time
const execSyncOptions = {
  stdio: ignoreOrInherit,
  timeout: 25000, // Increase timeout to 25 seconds
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

      // log each file
      console.log('File 1:', cleanContent1);
      console.log();
      console.log('File 2:', cleanContent2);
      console.log();

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

async function testInterpreter() {
  // Collect command-line arguments
  const args = process.argv.slice(2);

  // Default to demoA.e if no argument is provided
  const inputFile = args[0] || path.join(__dirname, '../demos/demoA.e');

  // Collect user inputs (arguments after the executable file)
  userInputs = args.slice(1);

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);

  // Check if the .e file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Executable file ${inputFile} does not exist.`);
    process.exit(1);
  }

  // Derive filenames
  const inputFileName = path.basename(inputFile, '.e');
  const inputDir = path.dirname(inputFile);

  // Paths for files
  const interpreterOutputLst = path.join(inputDir, `${inputFileName}.lst`);
  const lccDockerOutputLst = `/home/${inputFileName}1.lst`;
  const lccOutputLst = path.join(inputDir, `${inputFileName}1.lst`);
  const lccDockerInputFile = `/home/${inputFileName}1.e`;
  const lccInputFile = path.join(inputDir, `${inputFileName}1.e`);

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

    // Run interpreter.js on the .e file
    const interpreter = new Interpreter();

    // Set up simulated user inputs
    if (userInputs.length > 0) {
      interpreter.inputBuffer = userInputs.join('\n') + '\n';
    }

    // Redirect console.log to capture outputs
    const originalConsoleLog = console.log;
    let interpreterOutput = '';
    console.log = function (message) {
      interpreterOutput += message + '\n';
      originalConsoleLog(message);
    };

    originalConsoleLog('Running interpreter...');
    interpreter.main([inputFile]);
    originalConsoleLog('Interpreter finished.');

    // Restore console.log
    console.log = originalConsoleLog;

    // Write interpreter output to .lst file
    fs.writeFileSync(interpreterOutputLst, interpreterOutput);

    // Copy the .e file to docker container, renaming it appropriately
    fs.copyFileSync(inputFile, lccInputFile);

    // Create the name.nnn file with specified contents
    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J');

    // Copy files to Docker container
    execSyncWithLogging(`docker cp ${lccInputFile} ${containerName}:/home/`, execSyncOptions);
    execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);

    // Run lcc in Docker to generate .lst file
    let runCommand = '';

    if (userInputs.length === 0) {
      // No inputs: run command directly without any stdin
      runCommand = `cd /home && /cuh/cuh63/lnx/lcc ${inputFileName}1.e`;
    } else if (userInputs.length === 1) {
      // One input: single echo without sleep
      runCommand = `cd /home && echo '${userInputs[0]}' | /cuh/cuh63/lnx/lcc ${inputFileName}1.e`;
    } else {
      // Multiple inputs: echo-sleep chain with 1-second intervals
      const echoSleepChain = userInputs.map((input) => `echo '${input}'`).join('; sleep 1; ');
      runCommand = `cd /home && (${echoSleepChain}) | /cuh/cuh63/lnx/lcc ${inputFileName}1.e`;
    }

    execSyncWithLogging(`docker exec ${containerName} sh -c "${runCommand}"`, execSyncOptions);

    // Copy the .lst file back from Docker
    execSyncWithLogging(`docker cp ${containerName}:${lccDockerOutputLst} ${lccOutputLst}`, execSyncOptions);

    // Compare the .lst files
    testResult = compareLstFiles(interpreterOutputLst, lccOutputLst);

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
      `rm -f ${lccOutputLst}`,
      `rm -f ${interpreterOutputLst}`,
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

testInterpreter();
