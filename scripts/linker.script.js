// // linker.script.js
// // TODO: write example here of how to run linker.script.js (see linkerBattery.test.js for example)

// /*
// Summary of Behavior and Objectives
// - Purpose: To test the custom Linker by comparing its output with the output of the standard LCC linker running inside a Docker container.
// - Behavior:
// - Input Handling: Accepts multiple object .o files (or assembly .a files) and an optional output file name.
// - Cache Checking:
//   - Checks the validity of .a, .o, and .e files against the cache.
//   - Determines if reassembly or relinking is needed based on file changes.
// - Assembly and Linking Process:
//   - Assembles .a files into .o files using the LCC assembler inside Docker if necessary.
//   - Runs the custom Linker to produce the executable .e file.
//   - Runs the LCC linker inside Docker to produce the expected .e file.
// - Comparison:
//   - Compares the hex dumps of the custom Linker's output and the LCC linker's output.
//   - Reports any differences found.
// - Cache Update: Updates the cache with new outputs as needed.
// - Docker Management:
//   - Manages Docker container setup and teardown.
//   - Handles copying files and necessary resources into the container.
// - Cleanup: Cleans up temporary files created during the test.
// */

// const Linker = require('../src/core/linker');
// const path = require('path');
// const fs = require('fs');
// const { execSync } = require('child_process');
// const DockerController = require('./dockerController');
// const {
//     ensureDirectoryExists,
//     getCachedFilePath,
//     isCacheValid,
//     updateCacheSingular,
//     compareHexDumps,
// } = require('./testCacheHandler');

// const execSyncOptions = {
//     stdio: 'ignore', // 'pipe' or 'inherit' for verbose logging
//     timeout: 25000, // Increase timeout if necessary
//     maxBuffer: 1024 * 1024, // 1MB buffer limit
// };

// const LINKER_CACHE_DIR = path.join(__dirname, '../test_cache/linker_test_cache');
// const initialCacheOptions = {
//     cacheDir: LINKER_CACHE_DIR,
//     inputExt: '.a',
//     outputExt: '.o',
// };

// ensureDirectoryExists(LINKER_CACHE_DIR);

// async function assembleWithDockerLCC(aFile, oFile, containerName) {
//     const aFileName = path.basename(aFile);
//     const oFileName = path.basename(oFile);
//     try {
//         // Copy the .a file into Docker
//         execSyncWithLogging(`docker cp ${aFile} ${containerName}:/home/${aFileName}`, execSyncOptions);

//         // Assemble using LCC inside Docker
//         const assembleCommand = `cd /home && /cuh/cuh63/lnx/lcc ${aFileName}`;
//         console.log(`Assembling ${aFileName} into ${oFileName} using Docker LCC with assemble command ${assembleCommand}...`);
//         execSyncWithLogging(`docker exec ${containerName} sh -c "${assembleCommand}"`, execSyncOptions);

//         // console.log("copying .o file back normally ...");
//         // Copy the resulting .o file back
//         execSyncWithLogging(`docker cp ${containerName}:/home/${oFileName} ${oFile}`, execSyncOptions);
//         // console.log("... copied .o file back.");

//         // Clean up inside Docker
//         execSyncWithLogging(`docker exec ${containerName} rm -f /home/${aFileName} /home/${oFileName}`, execSyncOptions);
//     } catch (error) {
//         // very important here, if the .o file was created, we can continue
//         // regardless if the exit code was non-zero

//         // console.log("copying .o file back in the error case ...");
//         // Copy the resulting .o file back
//         execSyncWithLogging(`docker cp ${containerName}:/home/${oFileName} ${oFile}`, execSyncOptions);
//         // console.log("... copied .o file back.");

//         console.log("Checking for oFile: ", oFileName, " at oFile: ", oFile);
//         if (fs.existsSync(oFile)) {
//             console.warn(`Warning: LCC returned a non-zero exit code (${error.status}) but the .o file was created.`);
//         } else {
//             console.error(`Error assembling ${aFile} using Docker LCC:`, error);
//             throw error;
//         }
//     }
// }

// async function testLinker() {
//     // Collect command-line arguments
//     const args = process.argv.slice(2);

//     let skipCache = false;

//     // Check for --skip-cache
//     const skipCacheIndex = args.indexOf('--skip-cache');
//     if (skipCacheIndex !== -1) {
//         skipCache = true;
//         args.splice(skipCacheIndex, 1); // Remove '--skip-cache' from args
//     }

//     // Check for SKIP_SETUP environment variable
//     const skipSetup = process.env.SKIP_SETUP === 'true';

//     if (args.length < 1) {
//         console.error('Usage: node linker.test.js [-o outputfile.e] <object module 1> <object module 2> ...');
//         process.exit(1);
//     }

//     const objectFiles = [];
//     const aFiles = [];
//     let outputFile = null;

//     // Process arguments to extract object files and -o flag
//     let i = 0;
//     while (i < args.length) {
//         if (args[i] === '-o') {
//             outputFile = args[i + 1];
//             i += 2;
//         } else {
//             const file = args[i];
//             if (file.endsWith('.o')) {
//                 objectFiles.push(file);
//                 const aFile = file.replace('.o', '.a');
//                 aFiles.push(aFile);
//             } else if (file.endsWith('.a')) {
//                 const oFile = file.replace('.a', '.o');
//                 objectFiles.push(oFile);
//                 aFiles.push(file);
//             } else {
//                 console.error(`Unknown file type: ${file}`);
//                 process.exit(1);
//             }
//             i++;
//         }
//     }

//     if (!outputFile) {
//         // Generate output file name based on concatenation of object file names
//         const baseNames = objectFiles.map(file => path.basename(file, '.o'));
//         const outputFileName = baseNames.join('_') + '.e';
//         const outputDir = path.dirname(objectFiles[0]); // This will be './demos/'
//         outputFile = path.join(outputDir, outputFileName);
//         console.log(`Output file not specified. Using default: ${outputFile}`);
//     } else {
//         console.log("Output file specified: ", outputFile);
//     }

//     const containerName = 'mycontainer';
//     const dockerController = new DockerController(containerName);
//     let containerStartedByTest = false;

//     let testResult = false;

//     try {
//         // Variables to track whether we need to assemble or link
//         let assembleNeededOverall = false;
//         let oFilesChanged = false;
//         let linkNeeded = false;
//         let dockerRequired = false;

//         // For each .a file, compare against cache
//         for (const aFile of aFiles) {
//             const cachedAFile = getCachedFilePath(aFile, LINKER_CACHE_DIR);

//             if (!fs.existsSync(cachedAFile)) {
//                 console.log(`Cached .a file missing for ${aFile}. Updating cache.`);
//                 updateCacheSingular(aFile, LINKER_CACHE_DIR);
//                 assembleNeededOverall = true;
//             } else if (!isCacheValid(aFile, initialCacheOptions)) {
//                 console.log(`.a file ${aFile} has changed. Updating cache.`);
//                 updateCacheSingular(aFile, LINKER_CACHE_DIR);
//                 assembleNeededOverall = true;
//             } else {
//                 console.log(`.a file ${aFile} matches the cache.`);
//             }
//         }

//         // For each .a file, determine if assembly is needed
//         for (let idx = 0; idx < aFiles.length; idx++) {
//             const aFile = aFiles[idx];
//             const oFile = objectFiles[idx];

//             const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);

//             let assembleNeeded = false;

//             if (!fs.existsSync(oFile)) {
//                 console.log(`.o file ${oFile} does not exist. Need to assemble.`);
//                 assembleNeeded = true;
//             } else if (!fs.existsSync(cachedOFile)) {
//                 console.log(`Cached .o file missing for ${oFile}. Need to assemble.`);
//                 assembleNeeded = true;
//             } else if (!compareHexDumps(oFile, cachedOFile)) {
//                 console.log(`.o file ${oFile} differs from cache. Need to assemble.`);
//                 assembleNeeded = true;
//             } else {
//                 console.log(`.o file ${oFile} matches the cache.`);
//             }

//             if (assembleNeeded) {
//                 assembleNeededOverall = true;
//             }
//         }

//         // Determine if Docker is required
//         dockerRequired = assembleNeededOverall;

//         if (dockerRequired) {
//             // Ensure Docker is running if needed
//             if (!skipSetup) {
//                 if (!dockerController.isDockerAvailable()) {
//                     console.error('Docker is not available. Cannot run test that requires Docker.');
//                     process.exit(2);
//                 }

//                 if (!dockerController.isContainerRunning()) {
//                     dockerController.startContainer();
//                     containerStartedByTest = true;
//                     console.log("Starting up Docker...");
//                 } else {
//                     console.log(`Docker container ${containerName} is already running.`);
//                 }

//                 // Create the name file
//                 const nameFile = path.join(__dirname, 'name.nnn');
//                 fs.writeFileSync(nameFile, 'Billy, Bob J\n');
//                 // Send the file to /home in container
//                 execSyncWithLogging(`docker cp ${nameFile} ${containerName}:/home/`, execSyncOptions);

//             } else {
//                 console.log('Skipping Docker container setup because SKIP_SETUP is true.');
//             }
//         }

//         // Proceed to assemble if needed
//         if (assembleNeededOverall) {
//             // Assemble with Docker
//             for (let idx = 0; idx < aFiles.length; idx++) {
//                 const aFile = aFiles[idx];
//                 const oFile = objectFiles[idx];

//                 const cachedOFile = getCachedFilePath(oFile, LINKER_CACHE_DIR);

//                 let assembleNeeded = false;

//                 if (!fs.existsSync(oFile)) {
//                     assembleNeeded = true;
//                 } else if (!fs.existsSync(cachedOFile)) {
//                     assembleNeeded = true;
//                 } else if (!compareHexDumps(oFile, cachedOFile)) {
//                     assembleNeeded = true;
//                 }

//                 if (assembleNeeded) {
//                     await assembleWithDockerLCC(aFile, oFile, containerName);
//                     // Update cache for .o file
//                     updateCacheSingular(oFile, LINKER_CACHE_DIR);
//                     oFilesChanged = true; // Set flag indicating that .o files have changed
//                 }
//             }
//         }

//         // After assembly, determine if linking is needed
//         linkNeeded = oFilesChanged;

//         // Check if the combined .e output file needs to be generated
//         const cachedEFile = getCachedFilePath(outputFile, LINKER_CACHE_DIR);

//         if (!fs.existsSync(cachedEFile)) {
//             console.log(`Cached .e file missing for ${outputFile}. Need to link.`);
//             linkNeeded = true;
//         } else if (!fs.existsSync(outputFile)) {
//             console.log(`Output .e file ${outputFile} does not exist. Need to link.`);
//             linkNeeded = true;
//         } else if (!compareHexDumps(outputFile, cachedEFile)) {
//             console.log(`Output .e file ${outputFile} differs from cache. Need to link.`);
//             linkNeeded = true;
//         } else {
//             console.log(`Output .e file ${outputFile} matches the cache.`);
//         }

//         // Determine if Docker is required
//         dockerRequired = assembleNeededOverall || linkNeeded;
//         // console.log("--- linkNeeded: ", linkNeeded);
//         // console.log("--- assembleNeededOverall: ", assembleNeededOverall);
//         // console.log("--- dockerRequired: ", dockerRequired);

//         if (linkNeeded) {
//             if (dockerRequired && !assembleNeededOverall) {
//                 // Docker might not have been started yet
//                 if (!skipSetup) {
//                     if (!dockerController.isDockerAvailable()) {
//                         console.error('Docker is not available. Cannot run test that requires Docker.');
//                         process.exit(2);
//                     }

//                     if (!dockerController.isContainerRunning()) {
//                         dockerController.startContainer();
//                         containerStartedByTest = true;
//                         console.log("Starting up Docker...");
//                     } else {
//                         console.log(`Docker container ${containerName} is already running.`);
//                     }
//                 } else {
//                     console.log('Skipping Docker container setup because SKIP_SETUP is true.');
//                 }
//             }

//             // Run linker.js
//             const linker = new Linker();
//             linker.link(objectFiles, outputFile);
//             console.log(">>> linker.js executable: ", outputFile);

//             // Run LCC in Docker to generate the expected .e file
//             const lccOutputFile = await runDockerLCC(objectFiles, outputFile, containerName);

//             // Compare the .e files
//             testResult = compareHexDumps(outputFile, lccOutputFile);

//             if (testResult) {
//                 console.log('✅ Linked .e file matches Docker LCC output.');
//             } else {
//                 console.log('❌ Linked .e file does not match Docker LCC output.');
//             }

//             // Update cache for .e file
//             updateCacheSingular(lccOutputFile, LINKER_CACHE_DIR); // Cache the Docker LCC output

//         } else {
//             console.log('No linking needed. Using cached .e file.');

//             // Run linker.js to generate the output file
//             const linker = new Linker();
//             linker.link(objectFiles, outputFile);
//             console.log(">>> linker.js executable: ", outputFile);

//             // Compare the output with cached .e file
//             testResult = compareHexDumps(outputFile, cachedEFile);

//             if (testResult) {
//                 console.log('✅ Linked .e file matches cached .e file.');
//             } else {
//                 console.log('❌ Linked .e file does not match cached .e file.');
//             }
//         }

//         process.exit(testResult ? 0 : 1);

//     } catch (error) {
//         console.error('Test failed:', error);
//         process.exit(1);
//     } finally {
//         // Cleanup Docker container if we started it
//         if (!skipSetup && containerStartedByTest) {
//             try {
//                 console.log('Stopping Docker container...');
//                 dockerController.stopContainer();
//             } catch (err) {
//                 console.error('Error stopping Docker container:', err.message);
//             }
//         }
//     }
// }

// async function runDockerLCC(objectFiles, outputFile, containerName) {
//     try {
//         const outputFileName = path.basename(outputFile);
//         const dockerOutputFile = `/home/${outputFileName}`;
//         // console.log(">>> outputFileName: ", outputFileName);
//         // console.log(">>> dockerOutputFile: ", dockerOutputFile);

//         // Copy .o files to Docker container
//         for (const objFile of objectFiles) {
//             const objFileName = path.basename(objFile);
//             execSyncWithLogging(`docker cp ${objFile} ${containerName}:/home/${objFileName}`, execSyncOptions);
//         }

//         // Run LCC in Docker to link the .o files
//         const objFileNames = objectFiles.map(file => path.basename(file));
//         const linkCommand = `cd /home && /cuh/cuh63/lnx/lcc ${objFileNames.join(' ')} -o ${outputFileName}`;

//         console.log(`Running LCC in Docker to link: ${linkCommand}`);
//         execSyncWithLogging(`docker exec ${containerName} sh -c "${linkCommand}"`, execSyncOptions);

//         // Copy output .e file back from Docker to the cache directory
//         const localDockerEFile = path.join(LINKER_CACHE_DIR, outputFileName);
//         execSyncWithLogging(`docker cp ${containerName}:${dockerOutputFile} ${localDockerEFile}`, execSyncOptions);

//         // Clean up .o and .e files inside Docker
//         for (const objFile of objectFiles) {
//             const objFileName = path.basename(objFile);
//             execSyncWithLogging(`docker exec ${containerName} rm -f /home/${objFileName}`, execSyncOptions);
//         }
//         execSyncWithLogging(`docker exec ${containerName} rm -f ${dockerOutputFile}`, execSyncOptions);

//         return localDockerEFile; // Return the path to the Docker LCC output in the cache directory

//     } catch (error) {
//         console.error('Error running Docker LCC:', error);
//         throw error;
//     }
// }

// function execSyncWithLogging(command, options) {
//     // const startTime = Date.now();
//     try {
//         // console.log(`Executing command: ${command}`);
//         const result = execSync(command, options);
//         // const endTime = Date.now();
//         // console.log(`Command succeeded in ${endTime - startTime}ms`);
//         return result;
//     } catch (error) {
//         // const endTime = Date.now();
//         // console.log(`Command failed in ${endTime - startTime}ms`);
//         // console.log(`Command: ${command}`);
//         // console.log(`Exit code: ${error.status}`);
//         if (error.stdout) {
//             console.log(`stdout:\n'${error.stdout.toString()}'`);
//         }
//         if (error.stderr) {
//             console.log(`stderr:\n'${error.stderr.toString()}'`);
//         }
//         throw error;
//     }
// }

// testLinker();
