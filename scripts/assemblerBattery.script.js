// // assemblerBattery.script.js
// // how to run from project root directory:
// // node ./test/assemblerBattery.script.js

// const { spawn } = require('child_process');
// const path = require('path');
// const fs = require('fs');
// const { isCacheValid, getCachedFilePaths } = require('./testCacheHandler');
// const DockerController = require('./dockerController');

// // Define cache directory and options
// const ASSEMBLER_CACHE_DIR = path.join(__dirname, '../test_cache/assembler_test_cache');
// const cacheOptions = {
//   cacheDir: ASSEMBLER_CACHE_DIR,
//   inputExt: '.a',
//   outputExt: '.e',
// };

// // Ensure the cache directory exists
// if (!fs.existsSync(ASSEMBLER_CACHE_DIR)) {
//   fs.mkdirSync(ASSEMBLER_CACHE_DIR, { recursive: true });
// }

// // Note: Simulated user input is provided for some tests. 
// // The input is provided as command line arguments,
// // which are piped to the LCC process when it is run in
// // the Docker container. The simulated user inputs are 
// // used to provide the necessary input to LCC, because
// // (as far as I know) LCC does not currently support
// // *only* assembling a .a file to a .e file - it also 
// // immediately after assembling attempts to interpret.
// const argsForAllTests = [
//   ['node', './test/assembler.script.js', './demos/demoA.a', 'assembling mov, dout, nl, and halt'],
//   ['node', './test/assembler.script.js', './demos/demoB.a', 'a', 'b', 'assembling sin, sout, and .string and .zero directives'],
//   ['node', './test/assembler.script.js', './demos/demoC.a', 'assembling load, add, and a labeled .word directive'],
//   ['node', './test/assembler.script.js', './demos/demoD.a', 'assembling mov, mvi, and mvr instructions'],
//   ['node', './test/assembler.script.js', './demos/demoE.a', 'assembling push, pop, custom function definitions and calls'],
//   ['node', './test/assembler.script.js', './demos/demoF.a', 'assembling various output commands (decimal, hex, and char)'],
//   ['node', './test/assembler.script.js', './demos/demoG.a', 'g', '-5', 'ff', 'assembling various user input commands (decimal, hex, and char)'],
//   ['node', './test/assembler.script.js', './demos/demoH.a', 'assembling negative number args in mov, add, and .word'],
//   ['node', './test/assembler.script.js', './demos/demoI.a', 'assembling branching and looping commands'],
//   // ['node', './test/assembler.script.js', './demos/demoJ.a'], // demoJ is disabled atm, will reactivate later to test infinite loop detection
//   ['node', './test/assembler.script.js', './demos/demoK.a', 'assembling m command'],
//   ['node', './test/assembler.script.js', './demos/demoL.a', 'assembling r command'],
//   ['node', './test/assembler.script.js', './demos/demoM.a', 'assembling s command'],
//   ['node', './test/assembler.script.js', './demos/demoN.a', 'assembling div'],
//   ['node', './test/assembler.script.js', './demos/demoO.a', 'cheese', 'assembling IO commands'],
//   ['node', './test/assembler.script.js', './demos/demoP.a', 'assembling .start and interleaved data in instructions'],
//   ['node', './test/assembler.script.js', './demos/demoQ.a', 'assembling label args to .word directives'],
//   ['node', './test/assembler.script.js', './demos/demoR.a', 'assembling srl, sra, sll'],
//   ['node', './test/assembler.script.js', './demos/demoS.a', 'assembling rol, ror'],
//   ['node', './test/assembler.script.js', './demos/demoT.a', 'assembling and, or, xor'],
//   ['node', './test/assembler.script.js', './demos/demoU.a', 'assembling sext'],
//   ['node', './test/assembler.script.js', './demos/demoV.a', 'assembling mul, div, rem'],
//   ['node', './test/assembler.script.js', './demos/demoW.a', 'assembling cmp, branch instructions'],
//   ['node', './test/assembler.script.js', './demos/demoX.a', 'assembling hex, cea, implicit r0 args'],
//   // Add more test cases as needed
// ];

// function runTest(cmd, script, inputFile, userInputs, skipCache) {
//   return new Promise((resolve, reject) => {
//     const args = [script, inputFile, ...userInputs];
//     if (skipCache) {
//       args.push('--skip-cache');
//     }
//     console.log(`Running '${[cmd, ...args].join(' ')}'`);

//     const testProcess = spawn(cmd, args, {
//       stdio: 'inherit',
//       cwd: process.cwd(),
//       env: process.env,
//     });

//     testProcess.on('close', (code) => {
//       if (code === 0) {
//         resolve();
//       } else {
//         reject(new Error(`Test failed with exit code ${code}`));
//       }
//     });

//     testProcess.on('error', (err) => {
//       console.error(`Error running test: ${err.message}`);
//       reject(err);
//     });
//   });
// }

// async function runAllTests() {
//   const containerName = 'mycontainer';
//   const dockerController = new DockerController(containerName);
//   const testResults = []; // To collect test results

//   let testsNeedingDocker = [];
//   let testsNotNeedingDocker = [];

//   // First, check cache for all tests
//   for (const testArgs of argsForAllTests) {
//     const testComment = testArgs[testArgs.length - 1];
//     const testArgsWithoutComment = testArgs.slice(0, testArgs.length - 1);
//     const [cmd, script, inputFile, ...userInputs] = testArgsWithoutComment;

//     const inputFileName = path.basename(inputFile, '.a');

//     // Use the same cache options as assembler.script.js
//     const isValidCache = isCacheValid(inputFile, cacheOptions);

//     if (isValidCache) {
//       console.log(`Cache is valid for ${inputFileName}. Docker not needed for testing. Batching for local test running.`);
//       testsNotNeedingDocker.push({ cmd, script, inputFile, userInputs, comment: testComment });
//     } else {
//       console.log(`Cache is invalid or missing for ${inputFileName}. Test needs to be run.`);
//       testsNeedingDocker.push({ cmd, script, inputFile, userInputs, comment: testComment });
//     }
//   }

//   // Run tests that do not need Docker
//   if (testsNotNeedingDocker.length > 0) {
//     for (const test of testsNotNeedingDocker) {
//       const { cmd, script, inputFile, userInputs, comment } = test;
//       const testName = path.basename(inputFile, '.a');
//       console.log(`\nRunning test for ${testName}: ${comment}`);
//       try {
//         await runTest(cmd, script, inputFile, userInputs, false); // Pass skipCache=false
//         // Record test result as pass
//         testResults.push({ name: testName, status: 'Pass', comment });
//       } catch (err) {
//         console.error(`Error in test ${testName}: ${err.message}`);
//         // Record test result as fail
//         testResults.push({ name: testName, status: 'Fail', comment });
//       }
//     }
//   }

//   if (testsNeedingDocker.length > 0) {
//     // Check if Docker is available
//     const dockerAvailable = dockerController.isDockerAvailable();

//     if (!dockerAvailable) {
//       console.error('Docker is not available. Cannot run tests that require Docker.');
//       // Mark tests that need Docker as "Not Run"
//       for (const test of testsNeedingDocker) {
//         const testName = path.basename(test.inputFile, '.a');
//         testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
//       }
//     } else {
//       // Start the Docker container
//       try {
//         dockerController.startContainer();
//       } catch (err) {
//         console.error('Error starting Docker container:', err);
//         // Mark tests as "Not Run"
//         for (const test of testsNeedingDocker) {
//           const testName = path.basename(test.inputFile, '.a');
//           testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
//         }
//         // Optionally, exit or continue
//       }

//       for (const test of testsNeedingDocker) {
//         const { cmd, script, inputFile, userInputs, comment } = test;
//         const testName = path.basename(inputFile, '.a');
//         console.log(`\nRunning test for ${testName}: ${comment}`);
//         try {
//           await runTest(cmd, script, inputFile, userInputs, true); // Pass skipCache=true
//           // Record test result as pass
//           testResults.push({ name: testName, status: 'Pass', comment });
//         } catch (err) {
//           console.error(`Error in test ${testName}: ${err.message}`);
//           // Record test result as fail
//           testResults.push({ name: testName, status: 'Fail', comment });
//         }
//       }

//       // Stop the Docker container
//       try {
//         dockerController.stopContainer();
//       } catch (err) {
//         console.error('Error stopping Docker container:', err);
//       }
//     }
//   }

//   // Output test results sorted alphabetically
//   testResults.sort((a, b) => a.name.localeCompare(b.name));

//   console.log('\nTest Results');
//   for (const result of testResults) {
//     let statusEmoji;
//     if (result.status === 'Pass') {
//       statusEmoji = '✅';
//     } else if (result.status === 'Fail') {
//       statusEmoji = '❌';
//     } else if (result.status === 'Not Run') {
//       statusEmoji = '❓';
//     } else {
//       statusEmoji = '❗️';
//     }
//     console.log(`${result.name}: ${result.status} ${statusEmoji} - ${result.comment}`);
//   }

//   console.log('\nAll tests completed.');
// }

// runAllTests();
