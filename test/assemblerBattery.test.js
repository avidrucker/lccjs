// assemblerBattery.test.js
// how to run from project root directory:
// node ./test/assemblerBattery.test.js

const { spawn } = require('child_process');
const path = require('path');
const DockerController = require('./dockerController');

const argsForAllTests = [
  ['node', './test/assembler.test.js', './demos/demoA.a', 'testing mov, dout, nl, and halt'],
  ['node', './test/assembler.test.js', './demos/demoB.a', 'input1', 'input2', 'testing the simulated input of 2 user inputs'],
  ['node', './test/assembler.test.js', './demos/demoC.a', 'testing load, add, and a labeled .word directive'],
  ['node', './test/assembler.test.js', './demos/demoD.a', 'testing mov, mvi, and mvr instructions'],
  ['node', './test/assembler.test.js', './demos/demoE.a', 'testing custom function definitions and calls'],
  ['node', './test/assembler.test.js', './demos/demoF.a', 'testing various outputs (decimal, hex, and char)'],
  ['node', './test/assembler.test.js', './demos/demoG.a', '-5', 'ff', 'g', 'testing various user inputs (decimal, hex, and char)'],
  ['node', './test/assembler.test.js', './demos/demoH.a', 'testing negative numbers in mov, add, and .word'],
  ['node', './test/assembler.test.js', './demos/demoI.a', 'testing branching and looping'],
  // ['node', './test/assembler.test.js', './demos/demoJ.a'], // demoJ is disabled atm, will reactivate later to test infinite loop detection
  ['node', './test/assembler.test.js', './demos/demoK.a', 'testing m command'],
  ['node', './test/assembler.test.js', './demos/demoL.a', 'testing r command'],
  ['node', './test/assembler.test.js', './demos/demoM.a', 'testing s command'],
  ['node', './test/assembler.test.js', './demos/demoN.a', 'testing division by zero'],
  ['node', './test/assembler.test.js', './demos/demoO.a', 'testing IO and LST generation']
  // Add more test cases as needed
];

function runTest(args) {
  return new Promise((resolve, reject) => {
    console.log(`\nRunning test: ${args.join(' ')}`);

    const testProcess = spawn(args[0], args.slice(1), {
      stdio: 'ignore', // was inherit
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
