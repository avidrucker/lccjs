// interpreterBattery.test.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { isCacheValid } = require('./testCacheHandler');
const DockerController = require('./dockerController');

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

const argsForAllTests = [
  ['node', './test/interpreter.test.js', './demos/demoA.e', 'interpreting mov, dout, nl, and halt'],
  ['node', './test/interpreter.test.js', './demos/demoB.e', 'input1', 'input2', 'interpreting the simulated input of 2 user inputs'],
  ['node', './test/interpreter.test.js', './demos/demoC.e', 'testing interpreter with demoC.e'],
  ['node', './test/interpreter.test.js', './demos/demoD.e', 'testing interpreter with demoD.e'],
  ['node', './test/interpreter.test.js', './demos/demoE.e', 'testing interpreter with demoE.e'],
  ['node', './test/interpreter.test.js', './demos/demoF.e', 'testing interpreter with demoF.e'],
  ['node', './test/interpreter.test.js', './demos/demoG.e', 'g', '-5', 'ff', 'testing interpreter with demoG.e'],
  ['node', './test/interpreter.test.js', './demos/demoH.e', 'testing interpreter with demoH.e'],
  ['node', './test/interpreter.test.js', './demos/demoI.e', 'testing interpreter with demoI.e'],
  // ['node', './test/interpreter.test.js', './demos/demoJ.e', 'testing interpreter with demoJ.e'], // infinite loop detection test
  ['node', './test/interpreter.test.js', './demos/demoK.e', 'testing interpreter with demoK.e'],
  ['node', './test/interpreter.test.js', './demos/demoL.e', 'testing interpreter with demoL.e'],
  ['node', './test/interpreter.test.js', './demos/demoM.e', 'testing interpreter with demoM.e'],
  // TODO: add test to intentionally check for interpreter failure
  // ['node', './test/interpreter.test.js', './demos/demoN.e', 'testing interpreter with demoN.e'],
  ['node', './test/interpreter.test.js', './demos/demoO.e', 'cheese', 'testing interpreter with demoO.e'],
  ['node', './test/interpreter.test.js', './demos/demoP.e', 'testing interpreter with demoP.e'],
  // Add more test cases as needed
];

const ignoreOrInherit = 'ignore'; // Use 'inherit' to see the output in real-time
const execSyncOptions = {
  stdio: ignoreOrInherit,
  timeout: 25000, // Increase timeout to 20 seconds
  maxBuffer: 1024 * 1024, // 1MB buffer limit
};

function execSyncWithLogging(command, options) {
  // console.log(`Executing command: ${command}`);
  // const startTime = Date.now();
  const result = execSync(command, options);
  // const endTime = Date.now();
  // console.log(`Command completed in ${endTime - startTime} ms`);
  return result;
}

function runTest(cmd, script, inputFile, userInputs, skipCache) {
  return new Promise((resolve, reject) => {
    const args = [script, inputFile, ...userInputs];
    if (skipCache) {
      args.push('--skip-cache');
    }
    console.log(`Running '${[cmd, ...args].join(' ')}'`);

    // Set SKIP_SETUP and SKIP_ASSEMBLY to 'true'
    const env = Object.assign({}, process.env, { SKIP_SETUP: 'true', SKIP_ASSEMBLY: 'true' });

    const testProcess = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: env,
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test failed with exit code ${code}`));
      }
    });

    testProcess.on('error', (err) => {
      console.error(`Error running test: ${err.message}`);
      reject(err);
    });
  });
}

async function runAllTests() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  let skipCache = false;
  if (args.includes('--skip-cache')) {
    skipCache = true;
  }

  // We will not assemble all the demos, instead, we will
  // assemble on the fly as needed

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);
  const testResults = []; // To collect test results

  let testsNeedingDocker = [];

  // Check cache for all tests
  for (const testArgs of argsForAllTests) {
    const testComment = testArgs[testArgs.length - 1];
    const testArgsWithoutComment = testArgs.slice(0, testArgs.length - 1);
    const [cmd, script, inputFile, ...userInputs] = testArgsWithoutComment;

    const inputFileName = path.basename(inputFile, '.e');

    // Check cache validity
    const isValidCache = isCacheValid(inputFile, cacheOptions);

    if (!skipCache && isValidCache) {
      console.log(`Cache is valid for ${inputFileName}. Marking test as passed.`);
      testResults.push({ name: inputFileName, status: 'Pass', comment: testComment });
    } else {
      console.log(`Cache is invalid or missing for ${inputFileName}. Test needs to be run.`);
      testsNeedingDocker.push({ cmd, script, inputFile, userInputs, comment: testComment });
    }
  }

  if (testsNeedingDocker.length > 0) {
    // Check if Docker is available
    const dockerAvailable = dockerController.isDockerAvailable();

    if (!dockerAvailable) {
      console.error('Docker is not available. Cannot run tests that require Docker.');
      // Mark tests that need Docker as "Not Run"
      for (const test of testsNeedingDocker) {
        const testName = path.basename(test.inputFile, '.e');
        testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
      }
    } else {
      // Start the Docker container
      try {
        dockerController.startContainer();
      } catch (err) {
        console.error('Error starting Docker container:', err);
        // Mark tests as "Not Run"
        for (const test of testsNeedingDocker) {
          const testName = path.basename(test.inputFile, '.e');
          testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
        }
        // Optionally, exit or continue based on your preference
      }

      // Create and copy name.nnn to Docker container
      const nameFile = path.join(__dirname, '../demos/name.nnn');
      fs.writeFileSync(nameFile, 'Billy, Bob J\n', { encoding: 'utf8' });
      try {
        execSync(`docker cp ${nameFile} ${containerName}:/home/`, { stdio: 'inherit' });
      } catch (err) {
        console.error('Error copying name.nnn to Docker container:', err);
        // Mark tests as "Not Run"
        for (const test of testsNeedingDocker) {
          const testName = path.basename(test.inputFile, '.e');
          testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
        }
        // Clean up and stop Docker
        try {
          dockerController.stopContainer();
        } catch (stopErr) {
          console.error('Error stopping Docker container:', stopErr);
        }
        // Proceed to output results
      }

      for (const test of testsNeedingDocker) {
        const { cmd, script, inputFile, userInputs, comment } = test;
        const testName = path.basename(inputFile, '.e');
        console.log(`\nRunning test for ${testName}: ${comment}`);
        try {
          await runTest(cmd, script, inputFile, userInputs, skipCache);
          // Record test result as pass
          testResults.push({ name: testName, status: 'Pass', comment });
        } catch (err) {
          console.error(`Error in test ${testName}: ${err.message}`);
          // Record test result as fail
          testResults.push({ name: testName, status: 'Fail', comment });
        }
      }

      // Clean up name.nnn files
      try {
        fs.unlinkSync(nameFile);
        execSync(`docker exec ${containerName} rm -f /home/name.nnn`, { stdio: 'inherit' });
      } catch (err) {
        console.error('Error cleaning up name.nnn files:', err);
      }

      // Stop the Docker container
      try {
        dockerController.stopContainer();
      } catch (err) {
        console.error('Error stopping Docker container:', err);
      }
    }
  }

  // Output test results sorted alphabetically
  testResults.sort((a, b) => a.name.localeCompare(b.name));

  console.log('\nTest Results');
  for (const result of testResults) {
    let statusEmoji;
    if (result.status === 'Pass') {
      statusEmoji = '✅';
    } else if (result.status === 'Fail') {
      statusEmoji = '❌';
    } else if (result.status === 'Not Run') {
      statusEmoji = '❓';
    } else {
      statusEmoji = '❓';
    }
    console.log(`${result.name}: ${result.status} ${statusEmoji} - ${result.comment}`);
  }

  console.log('\nAll tests completed.');
}

runAllTests();
