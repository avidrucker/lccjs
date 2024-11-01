// assembler.test.js

// How to Use:
// - Default usage (uses demoA.a): node assembler.test.js
// - Test a specific file: node assembler.test.js demos/demoB.a

// Prerequisites:
// - Ensure xxd is installed (most Unix-like systems have it by default)
// - Ensure lcc is in your system path
// - Requires assembler.js to be functional

const Assembler = require('../src/assembler');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

function compareHexDumps(file1, file2) {
  try {
    // Check file sizes first
    const stat1 = fs.statSync(file1);
    const stat2 = fs.statSync(file2);
    
    if (stat1.size > 1024 * 1024 || stat2.size > 1024 * 1024) {
      throw new Error('File size exceeds 1MB limit - possible infinite loop in assembly output');
    }

    // Generate hex dumps using xxd
    const hexDump1 = execSync(`xxd -p ${file1}`).toString().trim();
    const hexDump2 = execSync(`xxd -p ${file2}`).toString().trim();

    // Compare hex dumps
    if (hexDump1 === hexDump2) {
      console.log('✅ Hex dumps are identical. Test PASSED.');
      return true;
    } else {
      console.log('❌ Hex dumps differ. Test FAILED.');
      
      // Find and log the differences
      const diff1 = hexDump1.split('');
      const diff2 = hexDump2.split('');
      
      console.log('Differences found:');
      for (let i = 0; i < Math.min(diff1.length, diff2.length); i++) {
        if (diff1[i] !== diff2[i]) {
          console.log(`Position ${i}: ${diff1[i]} !== ${diff2[i]}`);
        }
      }
      
      if (diff1.length !== diff2.length) {
        console.log(`Length mismatch: File 1 length = ${diff1.length}, File 2 length = ${diff2.length}`);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error comparing hex dumps:', error);
    return false;
  }
}

function cleanup(files) {
  files.forEach(file => {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (err) {
        console.warn(`Failed to clean up ${file}:`, err);
      }
    }
  });
}

function runDockerLCC(inputFile, containerName) {
  try {
    // Get absolute path of the input file
    const absoluteInputPath = path.resolve(inputFile);
    const inputDir = path.dirname(absoluteInputPath);
    const inputFileName = path.basename(inputFile, '.a');
    const lccInputFile = path.join(inputDir, `${inputFileName}1.a`);
    const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);
    const lccDockerOutputFile = `/home/${inputFileName}1.e`;

    // Enhanced debugging logs
    console.log('Input file details:');
    console.log('Absolute input path:', absoluteInputPath);
    console.log('Input directory:', inputDir);
    console.log('Input filename:', inputFileName);
    console.log('LCC input file:', lccInputFile);
    console.log('LCC output file:', lccOutputFile);
    console.log('LCC Docker output file:', lccDockerOutputFile);

    // Copy the input file
    fs.copyFileSync(inputFile, lccInputFile);

    // Create the name.nnn file with specified contents
    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J');

    // Copy files to Docker container
    console.log('Copying input file and name file to Docker container...');
    execSync(`docker cp ${lccInputFile} ${containerName}:/home/`, { stdio: 'inherit' });
    execSync(`docker cp ${nameFile} ${containerName}:/home/`, { stdio: 'inherit' });

    // Verify files were copied to Docker
    console.log('Verifying files in Docker container:');
    execSync(`docker exec ${containerName} ls -l /home/`, { stdio: 'inherit' });

    // Compile in Docker with better error handling
    console.log('Running LCC compilation in Docker...');
    const lccPaths = [
      // '/usr/local/bin/lcc',
      // '/usr/bin/lcc',
      // 'lcc',
      '/cuh/cuh63/lnx/lcc',
    ];

    let compilationSuccessful = false;
    let compilationError = '';
    
    for (const lccPath of lccPaths) {
      try {
        console.log(`\nTrying LCC path: ${lccPath}`);
        // Change working directory to /home and use relative paths
        const compileCommand = `cd /home && ${lccPath} ${inputFileName}1.a`;
        console.log('Executing command:', compileCommand);
        
        execSync(`docker exec ${containerName} sh -c "${compileCommand}"`, {
          stdio: 'inherit'
        });
        
        // Verify the output file exists in Docker
        try {
          execSync(`docker exec ${containerName} ls -l ${lccDockerOutputFile}`, {
            stdio: 'inherit'
          });
          console.log('Output file successfully generated in Docker');
          compilationSuccessful = true;
          break;
        } catch (verifyError) {
          console.log('Output file not found after compilation');
          compilationError = `Output file verification failed: ${verifyError.message}`;
        }
      } catch (err) {
        console.log(`Failed with LCC path ${lccPath}:`, err.message);
        compilationError = err.message;
      }
    }

    if (!compilationSuccessful) {
      throw new Error(`No working LCC command found. Last error: ${compilationError}`);
    }

    // Copy output from Docker back to local filesystem
    console.log('\nCopying output file from Docker...');
    execSync(`docker cp ${containerName}:${lccDockerOutputFile} ${lccOutputFile}`, {
      stdio: 'inherit'
    });

    // Verify the local output file exists
    if (!fs.existsSync(lccOutputFile)) {
      throw new Error(`Failed to copy output file from Docker. ${lccOutputFile} does not exist.`);
    }
    console.log('Successfully copied output file from Docker');

    return lccOutputFile;
  } catch (error) {
    console.error('Comprehensive LCC execution failure:', error);
    throw error;
  }
}

function testAssembler() {
  // Default to demoA.a if no argument is provided
  const inputFile = process.argv[2] || path.join(__dirname, '../demos/demoA.a');
  const containerName = process.argv[3] || 'mycontainer';
  
  // Derive filenames
  const inputFileName = path.basename(inputFile, '.a');
  const inputDir = path.dirname(inputFile);
  
  // Paths for files
  const assemblerOutput = path.join(inputDir, `${inputFileName}.e`);
  
  try {
    // Run assembler.js
    const assembler = new Assembler();
    assembler.main([inputFile]);
    
    // Run LCC in Docker
    const lccOutput = runDockerLCC(inputFile, containerName);
    
    // Compare hex dumps
    const testResult = compareHexDumps(assemblerOutput, lccOutput);
    
    // Exit with appropriate status code
    process.exit(testResult ? 0 : 1);
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testAssembler();