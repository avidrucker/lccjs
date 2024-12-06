// linkerBattery.test.js

/*
* Objectives:
* - Runs multiple linker tests.
* - Manages Docker setup, teardown, and necessary file operations (name.nnn).
* - Checks caches before running tests.
* - Batches Docker-requiring tests together.
* - Avoids using Docker if all caches are valid.
*/

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { isCacheValid, compareHexDumps, getCachedFilePath } = require('./testCacheHandler');
const DockerController = require('./dockerController');

const LINKER_CACHE_DIR = path.join(__dirname, '../test_cache/linker_test_cache');
const cacheOptions = {
    cacheDir: LINKER_CACHE_DIR,
    inputExt: '.a',
    outputExt: '.o',
};

// Ensure the cache directory exists
if (!fs.existsSync(LINKER_CACHE_DIR)) {
    fs.mkdirSync(LINKER_CACHE_DIR, { recursive: true });
}

const argsForAllTests = [
    ['node', './test/linker.test.js', './demos/startup.o', './demos/m1.o', './demos/m2.o', 'textbook example'],
    ['node', './test/linker.test.js', './demos/s1.o', './demos/s2.o', 'custom example1'],
    ['node', './test/linker.test.js', './demos/start.o', './demos/r1.o', './demos/r2.o', 'custom example2'],
    // Add more test cases as needed
];

function parseTestArguments(testArgs) {
    // Remove 'node' and './test/linker.test.js' and the last element (the comment)
    const args = testArgs.slice(2, testArgs.length -1);
    const objectFiles = [];
    const aFiles = [];
    let outputFile = null;

    let i = 0;
    while (i < args.length) {
        if (args[i] === '-o') {
            outputFile = args[i + 1];
            i +=2;
        } else {
            const file = args[i];
            if (file.endsWith('.o')) {
                objectFiles.push(file);
                const aFile = file.replace('.o', '.a');
                aFiles.push(aFile);
            } else if (file.endsWith('.a')) {
                const oFile = file.replace('.a', '.o');
                objectFiles.push(oFile);
                aFiles.push(file);
            } else {
                console.error(`Unknown file type: ${file}`);
                return null;
            }
            i++;
        }
    }
    if (!outputFile) {
        // Generate output file name based on concatenation of object file names
        const baseNames = objectFiles.map(file => path.basename(file, '.o'));
        const outputFileName = baseNames.join('_') + '.e';
        const outputDir = path.dirname(objectFiles[0]); // This will be './demos/'
        outputFile = path.join(outputDir, outputFileName);
    }
    return { objectFiles, aFiles, outputFile };
}

function checkCacheForTest(objectFiles, aFiles, outputFile) {
    let assembleNeededOverall = false;
    let linkNeeded = false;

    // Check .a files
    for (const aFile of aFiles) {
        const cachedAFile = getCachedFilePath(aFile, LINKER_CACHE_DIR);
        if (!fs.existsSync(cachedAFile)) {
            assembleNeededOverall = true;
        } else if (!isCacheValid(aFile, cacheOptions)) {
            assembleNeededOverall = true;
        }
    }

    // Check .o files
    for (let idx = 0; idx < aFiles.length; idx++) {
        const oFile = objectFiles[idx];
        const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);
        if (!fs.existsSync(oFile) || !fs.existsSync(cachedOFile)) {
            assembleNeededOverall = true;
        } else if (!compareHexDumps(oFile, cachedOFile)) {
            assembleNeededOverall = true;
        }
    }

    // Determine if linking is needed
    linkNeeded = assembleNeededOverall;

    const cachedEFile = getCachedFilePath(outputFile, LINKER_CACHE_DIR);
    if (!fs.existsSync(cachedEFile)) {
        linkNeeded = true;
    } else if (!fs.existsSync(outputFile)) {
        linkNeeded = true;
    } else if (!compareHexDumps(outputFile, cachedEFile)) {
        linkNeeded = true;
    }

    const dockerRequired = assembleNeededOverall || linkNeeded;

    return { assembleNeededOverall, linkNeeded, dockerRequired };
}

function runTest(cmd, script, args, skipCache) {
    return new Promise((resolve, reject) => {
        if (skipCache) {
            args.push('--skip-cache');
        }
        console.log(`Running '${[cmd, script, ...args].join(' ')}'`);

        // Set SKIP_SETUP to 'true'
        const env = Object.assign({}, process.env, { SKIP_SETUP: 'true' });

        const testProcess = spawn(cmd, [script, ...args], {
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

    const containerName = 'mycontainer';
    const dockerController = new DockerController(containerName);
    const testResults = []; // To collect test results

    let testsNeedingDocker = [];

    // Check cache for all tests
    for (const testArgs of argsForAllTests) {
        const testComment = testArgs[testArgs.length - 1];
        const testArgsWithoutComment = testArgs.slice(0, testArgs.length - 1);
        const [cmd, script, ...testScriptArgs] = testArgsWithoutComment;

        const { objectFiles, aFiles, outputFile } = parseTestArguments(testArgs);

        if (!objectFiles || !aFiles) {
            console.error('Error parsing test arguments.');
            continue;
        }

        const { assembleNeededOverall, linkNeeded, dockerRequired } = checkCacheForTest(objectFiles, aFiles, outputFile);

        const testName = path.basename(outputFile, '.e');

        if (!dockerRequired) {
            console.log(`Cache is valid for ${testName}. Marking test as passed.`);
            testResults.push({ name: testName, status: 'Pass', comment: testComment });
        } else {
            console.log(`Cache is invalid or missing for ${testName}. Test needs to be run.`);
            testsNeedingDocker.push({ cmd, script, args: testScriptArgs, comment: testComment });
        }
    }

    if (testsNeedingDocker.length > 0) {
        // Check if Docker is available
        const dockerAvailable = dockerController.isDockerAvailable();

        if (!dockerAvailable) {
            console.error('Docker is not available. Cannot run tests that require Docker.');
            // Mark tests that need Docker as "Not Run"
            for (const test of testsNeedingDocker) {
                const testName = path.basename(test.args[test.args.length - 1], '.e');
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
                    const testName = path.basename(test.args[test.args.length - 1], '.e');
                    testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
                }
            }

            // Create and copy name.nnn to Docker container
            const nameFile = path.join(__dirname, '../demos/name.nnn');
            fs.writeFileSync(nameFile, 'Billy, Bob J\n', { encoding: 'utf8' });
            try {
                execSync(`docker cp ${nameFile} ${containerName}:/home/`);
            } catch (err) {
                console.error('Error copying name.nnn to Docker container:', err);
                // Mark tests as "Not Run"
                for (const test of testsNeedingDocker) {
                    const testName = path.basename(test.args[test.args.length - 1], '.e');
                    testResults.push({ name: testName, status: 'Not Run', comment: test.comment });
                }
                // Clean up and stop Docker
                try {
                    dockerController.stopContainer();
                } catch (stopErr) {
                    console.error('Error stopping Docker container:', stopErr);
                }
            }

            for (const test of testsNeedingDocker) {
                const { cmd, script, args, comment } = test;
                const testName = path.basename(args[args.length - 1], '.e');
                console.log(`\nRunning test for ${testName}: ${comment}`);
                try {
                    await runTest(cmd, script, args, skipCache);
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
                execSync(`docker exec ${containerName} rm -f /home/name.nnn`);
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
