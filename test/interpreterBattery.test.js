// interpreterBattery.test.js

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const DockerController = require('./dockerController');

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

function runTest(args) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning test: ${args.join(' ')}`);

    // Clone the environment variables and set SKIP_SETUP to 'true'
    const env = Object.assign({}, process.env, { SKIP_SETUP: 'true' });

    const testProcess = spawn(args[0], args.slice(1), {
      stdio: 'ignore', // was 'inherit'
      cwd: process.cwd(),
      env: env,
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Test passed with exit code ${code}`);
        resolve();
      } else {
        console.error(`Test failed with exit code ${code}`);
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

  // Collect command-line arguments
  const argsLocal = process.argv.slice(2);
  // Default to demoA.a if no argument is provided
  const inputFile = argsLocal[0] || path.join(__dirname, '../demos/demoA.e');

  const inputDir = path.dirname(inputFile);

  const containerName = 'mycontainer';
  const dockerController = new DockerController(containerName);
  const testResults = []; // To collect test results

  // Start the container at the beginning
  try {
    dockerController.startContainer();
  } catch (err) {
    console.error('Error starting Docker container:', err);
    process.exit(1);
  }

  // Create the name.nnn file with specified contents
  const nameFile = path.join(inputDir, 'name.nnn');
  fs.writeFileSync(nameFile, 'Billy, Bob J\n', { encoding: 'utf8' });

  // Copy name file to Docker container
  execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);

  let testNumber = 1;
  const totalTests = argsForAllTests.length;

  for (const testArgs of argsForAllTests) {
    try {
      const testComment = testArgs[testArgs.length - 1];
      const testArgsWithoutComment = testArgs.slice(0, testArgs.length - 1);
      console.log(`\nRunning test ${testNumber}: ${testComment}`);
      await runTest(testArgsWithoutComment);

      // Record test result as pass
      const testName = path.basename(testArgs[2], '.e');
      testResults.push({ name: testName, status: 'Pass' });
    } catch (err) {
      console.error(`Error in test ${testArgs[2]}: ${err.message}`);

      // Record test result as fail
      const testName = path.basename(testArgs[2], '.e');
      testResults.push({ name: testName, status: 'Fail' });

      // Uncomment the following line if you want to stop execution on the first failure
      // process.exit(1);
    } finally {
      testNumber++;
    }
  }

  // Clean up the name.nnn files
  execSyncWithLogging(`rm -f ${inputDir}/name.nnn`, execSyncOptions);
  execSyncWithLogging(`docker exec ${containerName} rm -f /home/name.nnn`, execSyncOptions);

  // Stop the Docker container after all tests
  try {
    dockerController.stopContainer();
  } catch (err) {
    console.error('Error stopping Docker container:', err);
  }

  // Print test results
  console.log('\nTest Results');
  for (const result of testResults) {
    const statusEmoji = result.status === 'Pass' ? '✅' : '❌';
    console.log(`${result.name}: ${result.status} ${statusEmoji}`);
  }

  console.log('\nAll tests completed.');
}

runAllTests();
