// lccBattery.test.js

const { spawn } = require('child_process');
const path = require('path');
const DockerController = require('./dockerController');

const argsForAllTests = [
  ['node', './test/lcc.test.js', './demos/demoA.a', 'testing lcc.js with demoA.a'],
  ['node', './test/lcc.test.js', './demos/demoB.a', 'input1', 'input2', 'testing lcc.js with demoB.a'],
  ['node', './test/lcc.test.js', './demos/demoC.a', 'testing lcc.js with demoC.a'],
  ['node', './test/lcc.test.js', './demos/demoD.a', 'testing lcc.js with demoD.a'],
  ['node', './test/lcc.test.js', './demos/demoE.a', 'testing lcc.js with demoE.a'],
  ['node', './test/lcc.test.js', './demos/demoF.a', 'testing lcc.js with demoF.a'],
  ['node', './test/lcc.test.js', './demos/demoG.a', '-5', 'ff', 'g', 'testing lcc.js with demoG.a'],
  ['node', './test/lcc.test.js', './demos/demoH.a', 'testing lcc.js with demoH.a'],
  ['node', './test/lcc.test.js', './demos/demoI.a', 'testing lcc.js with demoI.a'],
  // ['node', './test/lcc.test.js', './demos/demoJ.a', 'testing lcc.js with demoJ.a'], // Disabled if necessary
  ['node', './test/lcc.test.js', './demos/demoK.a', 'testing lcc.js with demoK.a'],
  ['node', './test/lcc.test.js', './demos/demoL.a', 'testing lcc.js with demoL.a'],
  ['node', './test/lcc.test.js', './demos/demoM.a', 'testing lcc.js with demoM.a'],
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

  for (const testArgs of argsForAllTests) {
    try {
      const testComment = testArgs[testArgs.length - 1];
      const testArgsWithoutComment = testArgs.slice(0, testArgs.length - 1);
      console.log(`\nRunning test ${testNumber}: ${testComment}`);
      await runTest(testArgsWithoutComment);

      // Record test result as pass
      const testName = path.basename(testArgs[2], '.a');
      testResults.push({ name: testName, status: 'Pass' });
    } catch (err) {
      console.error(`Error in test ${testArgs[2]}: ${err.message}`);

      // Record test result as fail
      const testName = path.basename(testArgs[2], '.a');
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
