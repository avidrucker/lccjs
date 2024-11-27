// lccBattery.test.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');
const { isCacheValid } = require('./testCacheHandler');

// Define cache directory and options
const LCC_CACHE_DIR = path.join(__dirname, '../test_cache/lcc_test_cache');
const cacheOptions = {
  cacheDir: LCC_CACHE_DIR,
  inputExt: '.a',
  outputExt: '.lst',
};

const argsForAllTests = [
  ['node', './test/lcc.test.js', './demos/demoA.a', 'assemble/interpret mov, dout, nl, and halt'],
  ['node', './test/lcc.test.js', './demos/demoB.a', 'input1', 'input2', 'testing lcc.js with demoB.a'],
  ['node', './test/lcc.test.js', './demos/demoC.a', 'testing lcc.js with demoC.a'],
  ['node', './test/lcc.test.js', './demos/demoD.a', 'testing lcc.js with demoD.a'],
  ['node', './test/lcc.test.js', './demos/demoE.a', 'testing lcc.js with demoE.a'],
  ['node', './test/lcc.test.js', './demos/demoF.a', 'testing lcc.js with demoF.a'],
  ['node', './test/lcc.test.js', './demos/demoG.a', 'g', '-5', 'ff', 'testing lcc.js with demoG.a'],
  ['node', './test/lcc.test.js', './demos/demoH.a', 'testing lcc.js with demoH.a'],
  ['node', './test/lcc.test.js', './demos/demoI.a', 'testing lcc.js with demoI.a'],
  // ['node', './test/lcc.test.js', './demos/demoJ.a', 'testing lcc.js with demoJ.a'], // Disabled if necessary
  ['node', './test/lcc.test.js', './demos/demoK.a', 'testing lcc.js with demoK.a'],
  ['node', './test/lcc.test.js', './demos/demoL.a', 'testing lcc.js with demoL.a'],
  ['node', './test/lcc.test.js', './demos/demoM.a', 'testing lcc.js with demoM.a'],
  // ['node', './test/lcc.test.js', './demos/demoN.a', 'testing lcc.js with demoN.a'],
  ['node', './test/lcc.test.js', './demos/demoO.a', 'cheese', 'testing lcc.js with demoO.a'],
  ['node', './test/lcc.test.js', './demos/demoP.a', 'testing lcc.js with demoP.a'],
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

function runTest(cmd, script, inputFile, userInputs, skipCache, skipSetup) {
  return new Promise((resolve, reject) => {
    const args = [script, inputFile, ...userInputs];
    if (skipCache) {
      args.push('--skip-cache');
    }
    console.log(`Running '${[cmd, ...args].join(' ')}'`);

    // Set SKIP_SETUP to 'true' if skipSetup is true
    const env = Object.assign({}, process.env);
    if (skipSetup) {
      env.SKIP_SETUP = 'true';
    }

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

  const argsLocal = process.argv.slice(2);
  let skipCache = false;
  if (argsLocal.includes('--skip-cache')) {
    skipCache = true;
  }

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);
  const testResults = []; // To collect test results

  let testsNeedingDocker = [];
  let testsCanRunLocally = [];

  // Check cache for all tests
  for (const testArgs of argsForAllTests) {
    const testComment = testArgs[testArgs.length - 1];
    const testArgsWithoutComment = testArgs.slice(0, testArgs.length - 1);
    const [cmd, script, inputFile, ...userInputs] = testArgsWithoutComment;

    const inputFileName = path.basename(inputFile, '.a');

    // Check cache validity
    const isValidCache = isCacheValid(inputFile, cacheOptions);

    if (!skipCache && isValidCache) {
      console.log(`Cache is valid for ${inputFileName}. Test can be run locally.`);
      testsCanRunLocally.push({ cmd, script, inputFile, userInputs, comment: testComment });
    } else {
      console.log(`Cache is invalid or missing for ${inputFileName}. Test needs to be run with Docker.`);
      testsNeedingDocker.push({ cmd, script, inputFile, userInputs, comment: testComment });
    }
  }

  // Create the name.nnn file with specified contents
  const nameFile = path.join(__dirname, '../demos/name.nnn');
  fs.writeFileSync(nameFile, 'Billy, Bob J\n', { encoding: 'utf8' });

  // First, run tests that can be run locally
  for (const test of testsCanRunLocally) {
    const { cmd, script, inputFile, userInputs, comment } = test;
    const testName = path.basename(inputFile, '.a');
    console.log(`\nRunning test for ${testName}: ${comment}`);
    try {
      await runTest(cmd, script, inputFile, userInputs, skipCache = false, skipSetup = true);
      // Record test result as pass
      testResults.push({ name: testName, status: 'Pass', comment });
    } catch (err) {
      console.error(`Error in test ${testName}: ${err.message}`);
      // Record test result as fail
      testResults.push({ name: testName, status: 'Fail', comment });
    }
  }

  ////////////////////////////
  // Proceed to run tests needing Docker if any
  if (testsNeedingDocker.length > 0) {
    // Check if Docker is available
    const dockerAvailable = dockerController.isDockerAvailable();

    if (!dockerAvailable) {
      console.error('Docker is not available. Cannot run tests that require Docker.');
      // Mark tests that need Docker as "Not Run"
      for (const test of testsNeedingDocker) {
        const testName = path.basename(test.inputFile, '.a');
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
          const testName = path.basename(test.inputFile, '.a');
          testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
        }
      }

      // Copy name file to Docker container
      try {
        execSync(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);
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

      // Run tests needing Docker
      for (const test of testsNeedingDocker) {
        const { cmd, script, inputFile, userInputs, comment } = test;
        const testName = path.basename(inputFile, '.a');
        console.log(`\nRunning test for ${testName}: ${comment}`);
        try {
          await runTest(cmd, script, inputFile, userInputs, skipCache = false, skipSetup = false);
          // Record test result as pass
          testResults.push({ name: testName, status: 'Pass', comment });
        } catch (err) {
          console.error(`Error in test ${testName}: ${err.message}`);
          // Record test result as fail
          testResults.push({ name: testName, status: 'Fail', comment });
        }
      }

      // Clean up and stop Docker
      execSyncWithLogging(`rm -f ${inputDir}/name.nnn`, execSyncOptions);
      execSyncWithLogging(`docker exec ${containerName} rm -f /home/name.nnn`, execSyncOptions);

      // Stop the Docker container after all tests
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
