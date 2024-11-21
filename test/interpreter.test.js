// interpreter.test.js

const Interpreter = require('../src/core/interpreter');
const Assembler = require('../src/core/assembler'); // Import the assembler
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');
const { isCacheValid, updateCache, getCachedFilePaths } = require('./testCacheHandler');

const execSyncOptions = {
  stdio: 'ignore', // Change to 'inherit' or 'pipe' to see the output
  timeout: 25000, // Increase timeout to 25 seconds
  maxBuffer: 1024 * 1024, // 1MB buffer limit
};

let userInputs;

// Function to compare .lst files, ignoring whitespace and comments, and ignoring the first line
function compareLstFiles(file1, file2) {
  try {
    // Read files and split into lines
    let content1 = fs.readFileSync(file1, 'utf8').split('\n');
    let content2 = fs.readFileSync(file2, 'utf8').split('\n');

    // Remove comments
    content1 = content1.map(line => line.replace(/;.*/, ''));
    content2 = content2.map(line => line.replace(/;.*/, ''));

    // Trim leading and trailing whitespace
    content1 = content1.map(line => line.trim());
    content2 = content2.map(line => line.trim());

    // Remove the lines that start with "Input file name =" or "LCC Assemble"
    const linesToSkipRegex = /^(Input\s*file\s*name\s*=|LCC\s*Assemble|LCC.js\s*Assemble)/i;

    content1 = content1.filter(line => !linesToSkipRegex.test(line));
    content2 = content2.filter(line => !linesToSkipRegex.test(line));

    // Normalize the content (lowercase, remove extra spaces)
    const normalize = content => content.map(line => line.toLowerCase().replace(/\s+/g, ' ').trim());

    content1 = normalize(content1);
    content2 = normalize(content2);

    // Replace multiple spaces with a single space within lines
    content1 = content1.map(line => line.replace(/\s+/g, ' '));
    content2 = content2.map(line => line.replace(/\s+/g, ' '));

    let differences = [];
    let maxLines = Math.max(content1.length, content2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = content1[i] || '';
      const line2 = content2[i] || '';
      if (line1 !== line2) {
        differences.push({
          lineNumber: i + 1,
          file1Line: line1,
          file2Line: line2
        });
      }
    }

    if (differences.length === 0) {
      console.log('✅ .lst files are identical. Test PASSED.');
      return true;
    } else {
      console.log('❌ .lst files differ. Test FAILED.');
      console.log('Differences found:');
      differences.forEach(diff => {
        console.log(`Line ${diff.lineNumber}:`);
        console.log(`  File1: ${diff.file1Line}`);
        console.log(`  File2: ${diff.file2Line}`);
        console.log();
      });
      return false;
    }
  } catch (error) {
    console.error('Error comparing .lst files:', error);
    return false;
  }
}

function execSyncWithLogging(command, options) {
  // console.log(`Executing command: ${command}`);
  const startTime = Date.now();
  const result = execSync(command, options);
  const endTime = Date.now();
  // console.log(`Command completed in ${endTime - startTime} ms`);
  return result;
}

// Define cache directory and options
const INTERPRETER_CACHE_DIR = path.join(__dirname, '../test_cache/interpreter_test_cache');
const cacheOptions = {
  cacheDir: INTERPRETER_CACHE_DIR,
  inputExt: '.e',
  outputExt: '.lst',
};

// Ensure the cache directory exists
if (!fs.existsSync(INTERPRETER_CACHE_DIR)) {
  fs.mkdirSync(INTERPRETER_CACHE_DIR, { recursive: true });
}

async function testInterpreter() {
  // Collect command-line arguments
  const args = process.argv.slice(2);

  // Check for --skip-cache
  let skipCache = false;
  const skipCacheIndex = args.indexOf('--skip-cache');
  if (skipCacheIndex !== -1) {
    skipCache = true;
    args.splice(skipCacheIndex, 1); // Remove '--skip-cache' from args
  }

  // Default to demoA.e if no argument is provided
  const inputFileArgIndex = args.findIndex(arg => !arg.startsWith('-'));
  if (inputFileArgIndex === -1) {
    console.error('No input file specified.');
    process.exit(1);
  }

  const inputFile = args[inputFileArgIndex];

  // Collect user inputs (arguments after the executable file)
  userInputs = args.slice(inputFileArgIndex + 1);

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);
  let containerStartedByTest = false;

  // Check if the .e file exists
  if (!fs.existsSync(inputFile)) {
    console.log(`Executable file ${inputFile} does not exist.`);
    if (process.env.SKIP_ASSEMBLY === 'true') {
      console.error('SKIP_ASSEMBLY is set. Cannot assemble .a file.');
      process.exit(1);
    } else {
      // Try to assemble the corresponding .a file
      const inputFileName = path.basename(inputFile, '.e');
      const inputDir = path.dirname(inputFile);
      const assemblyFile = path.join(inputDir, `${inputFileName}.a`);
      if (fs.existsSync(assemblyFile)) {
        console.log(`Assembling ${assemblyFile} into ${inputFile}...`);
        try {
          const assembler = new Assembler();
          assembler.main([assemblyFile]);
          if (!fs.existsSync(inputFile)) {
            console.error(`Failed to assemble ${assemblyFile} into ${inputFile}.`);
            process.exit(1);
          }
        } catch (err) {
          console.error(`Error assembling ${assemblyFile}:`, err);
          process.exit(1);
        }
      } else {
        console.error(`Assembly file ${assemblyFile} does not exist.`);
        process.exit(1);
      }
    }
  }

  // Derive filenames
  const inputFileName = path.basename(inputFile, '.e');
  const inputDir = path.dirname(inputFile);

  // Paths for files
  const interpreterJsOutputLst = path.join(inputDir, `${inputFileName}.lst`);
  const lccDockerOutputLst = `/home/${inputFileName}1.lst`;
  const lccOutputLst = path.join(inputDir, `${inputFileName}1.lst`);
  const lccDockerInputFile = `/home/${inputFileName}1.e`;
  const lccInputFile = path.join(inputDir, `${inputFileName}1.e`);

  let testResult = false;
  const skipSetup = process.env.SKIP_SETUP === 'true';

  try {

    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J\n');

    if (!skipCache) {
      // Perform cache checking
      const cacheValid = isCacheValid(inputFile, cacheOptions);
  
      if (cacheValid) {
        console.log('Cache exists and inputs are identical. Using cached output for comparison.');
  
        // Run interpreter.js on the .e file
        const interpreter = new Interpreter();
  
        // Set up simulated user inputs
        if (userInputs.length > 0) {
          interpreter.inputBuffer = userInputs.join('\n') + '\n';
          console.log('Simulated inputBuffer:', JSON.stringify(interpreter.inputBuffer));
        }
  
        // Redirect console.log and process.stdout.write to capture outputs
        const originalConsoleLog = console.log;
        const originalProcessStdoutWrite = process.stdout.write;
  
        let interpreterOutput = '';
        console.log = function (...args) {
          const message = args.join(' ');
          interpreterOutput += message + '\n';
          originalConsoleLog.apply(console, args);
        };
  
        process.stdout.write = function (chunk, encoding, callback) {
          interpreterOutput += chunk;
          return originalProcessStdoutWrite.call(process.stdout, chunk, encoding, callback);
        };
  
        // Run interpreter
        interpreter.generateStats = true;
        interpreter.main([inputFile]);
  
        // Restore console.log and process.stdout.write
        console.log = originalConsoleLog;
        process.stdout.write = originalProcessStdoutWrite;
  
        // Compare the .lst file generated by interpreter with the cached .lst file
        const { cachedOutputFile } = getCachedFilePaths(inputFile, cacheOptions);
        testResult = compareLstFiles(interpreterJsOutputLst, cachedOutputFile);
  
        // We do not update the cache here because it's already valid.

        process.exit(testResult ? 0 : 1);
      }
    } else {
      console.log('Skipping cache checking as per --skip-cache argument.');
    }

    if (!skipSetup) {
      // **Check if Docker is available**
      if (!dockerController.isDockerAvailable()) {
        console.error('Docker is not available. Cannot run test that requires Docker.');
        console.error('Test could not be run because Docker was not available.');
        process.exit(2); // Exit code 2 indicates Docker is unavailable
      }

      // Check if Docker container is running
      if (!dockerController.isContainerRunning()) {
        // Start the container
        dockerController.startContainer();
        containerStartedByTest = true;
      } else {
        console.log(`Docker container ${containerName} is already running.`);
      }
    } else {
      console.log('Skipping Docker container setup because SKIP_SETUP is true.');
    }    

    // Run interpreter.js on the .e file
    const interpreter = new Interpreter();

    // Set up simulated user inputs
    if (userInputs.length > 0) {
      interpreter.inputBuffer = userInputs.join('\n') + '\n';
      console.log('Simulated inputBuffer:', JSON.stringify(interpreter.inputBuffer));
    }

    // Use process.env.SKIP_SETUP to control name.nnn creation
    if (!skipSetup) {
      // Copy name.nnn to Docker container
      execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);
    } else {
      console.log('Skipping Docker name.nnn file copy because SKIP_SETUP is true.');
    }

    // Redirect console.log and process.stdout.write to capture outputs
    const originalConsoleLog = console.log;
    const originalProcessStdoutWrite = process.stdout.write;

    let interpreterOutput = '';
    console.log = function (...args) {
      const message = args.join(' ');
      interpreterOutput += message + '\n';
      originalConsoleLog.apply(console, args);
    };

    process.stdout.write = function (chunk, encoding, callback) {
      interpreterOutput += chunk;
      return originalProcessStdoutWrite.call(process.stdout, chunk, encoding, callback);
    };

    // originalConsoleLog('Running interpreter...');
    interpreter.generateStats = true;
    interpreter.main([inputFile]);
    // originalConsoleLog('Interpreter finished.');

    // Restore console.log and process.stdout.write
    console.log = originalConsoleLog;
    process.stdout.write = originalProcessStdoutWrite;

    // Copy the .e file to docker container, renaming it appropriately
    fs.copyFileSync(inputFile, lccInputFile);

    // Copy file to Docker container // TODO: clarify which file is being copied
    execSyncWithLogging(`docker cp ${lccInputFile} ${containerName}:/home/`, execSyncOptions);

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

    // Run the command in Docker // TODO: clarify what command is being run
    execSyncWithLogging(`docker exec ${containerName} sh -c "${runCommand}"`, execSyncOptions);

    // Copy the .lst file back from Docker
    execSyncWithLogging(`docker cp ${containerName}:${lccDockerOutputLst} ${lccOutputLst}`, execSyncOptions);

    if (!fs.existsSync(interpreterJsOutputLst)) {
      console.error(`Interpreter .lst file not found at ${interpreterJsOutputLst}`);
      process.exit(1);
    }

    // Compare the .lst files
    testResult = compareLstFiles(interpreterJsOutputLst, lccOutputLst);

    if (testResult) {
      // Update cache: copy input and output files to cache
      updateCache(inputFile, lccOutputLst, cacheOptions);
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exitCode = 1;
  } finally {
    // Cleanup: delete created test files in Docker container and locally
    console.log('Cleaning up test files...');

    const cleanupCommands = [
      `rm -f ${lccInputFile}`,
      `rm -f ${lccOutputLst}`,
      `rm -f ${interpreterJsOutputLst}`,
    ];

    if(containerStartedByTest) {
      cleanupCommands.push(
        `docker exec ${containerName} rm -f ${lccDockerInputFile}`,
        `docker exec ${containerName} rm -f ${lccDockerOutputLst}`);
    }
    
    if (!skipSetup) {
      cleanupCommands.push(`rm -f ${inputDir}/name.nnn`);
      if(containerStartedByTest) {
        cleanupCommands.push(`docker exec ${containerName} rm -f /home/name.nnn`);
      }
    }

    cleanupCommands.forEach((cmd) => {
      try {
        execSyncWithLogging(cmd, execSyncOptions);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError.message);
      }
    });

    // Stop the Docker container if we started it
    if (!skipSetup && containerStartedByTest) {
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
