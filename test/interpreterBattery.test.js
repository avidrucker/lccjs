// interpreterBattery.test.js

const { spawn } = require('child_process');
const path = require('path');
const DockerController = require('./dockerController');

const argsForAllTests = [
  ['node', './test/interpreter.test.js', './demos/demoA.e', 'testing interpreter with demoA.e'],
  ['node', './test/interpreter.test.js', './demos/demoB.e', 'input1', 'input2', 'testing interpreter with demoB.e'],
  ['node', './test/interpreter.test.js', './demos/demoC.e', 'testing interpreter with demoC.e'],
  ['node', './test/interpreter.test.js', './demos/demoD.e', 'testing interpreter with demoD.e'],
  ['node', './test/interpreter.test.js', './demos/demoE.e', 'testing interpreter with demoE.e'],
  ['node', './test/interpreter.test.js', './demos/demoF.e', 'testing interpreter with demoF.e'],
  ['node', './test/interpreter.test.js', './demos/demoG.e', '-5', 'ff', 'g', 'testing interpreter with demoG.e'],
  ['node', './test/interpreter.test.js', './demos/demoH.e', 'testing interpreter with demoH.e'],
  ['node', './test/interpreter.test.js', './demos/demoI.e', 'testing interpreter with demoI.e'],
  // ['node', './test/interpreter.test.js', './demos/demoJ.e', 'testing interpreter with demoJ.e'], // Disabled if necessary
  ['node', './test/interpreter.test.js', './demos/demoK.e', 'testing interpreter with demoK.e'],
  ['node', './test/interpreter.test.js', './demos/demoL.e', 'testing interpreter with demoL.e'],
  ['node', './test/interpreter.test.js', './demos/demoM.e', 'testing interpreter with demoM.e'],
  // Add more test cases as needed
];

function runTest(args) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning test: ${args.join(' ')}`);

    const testProcess = spawn(args[0], args.slice(1), {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
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
