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

function runDockerLCC(inputFile, containerName) {
  try {
    // Get absolute path of the input file
    const absoluteInputPath = path.resolve(inputFile);
    const inputDir = path.dirname(absoluteInputPath);
    const inputFileName = path.basename(inputFile, '.a');
    const lccInputFile = path.join(inputDir, `${inputFileName}1.a`);
    const lccOutputFile = path.join(inputDir, `${inputFileName}1.e`);

    // Enhanced debugging logs
    console.log('Input file details:');
    console.log('Absolute input path:', absoluteInputPath);
    console.log('Input directory:', inputDir);
    console.log('Input filename:', inputFileName);
    console.log('LCC input file:', lccInputFile);
    console.log('LCC output file:', lccOutputFile);

    // Copy the input file
    fs.copyFileSync(inputFile, lccInputFile);

    // Create the name.nnn file with specified contents
    const nameFile = path.join(inputDir, 'name.nnn');
    fs.writeFileSync(nameFile, 'Billy, Bob J');

    // Copy files to Docker container
    console.log('Copying input file and name file to Docker container...');
    execSync(`docker cp ${lccInputFile} ${containerName}:/home/`, { stdio: 'inherit' });
    execSync(`docker cp ${nameFile} ${containerName}:/home/`, { stdio: 'inherit' });

    // Debugging: Check LCC installation and PATH
    console.log('Checking LCC installation...');
    
    // Preferred LCC paths in order of precedence
    const lccPaths = [
      '/usr/local/bin/lcc',
      '/usr/bin/lcc',
      'lcc',  // system PATH
      '/cuh/cuh63/lnx/lcc',  // Explicitly specified preferred path
    ];

    let lccPath = null;
    let lccError = null;

    // More robust LCC path checking and execution
    for (const potentialPath of lccPaths) {
      try {
        // Verify path and executable status
        const checkCommand = `docker exec ${containerName} sh -c "ls -l '${potentialPath}' && [ -x '${potentialPath}' ] && echo 'Executable found' || echo 'Not executable'"`; 
        const pathCheck = execSync(checkCommand, { stdio: 'pipe' }).toString().trim();
        console.log('Path check result:', pathCheck);

        // Try multiple command variations
        const commandVariations = [
          // `${potentialPath} ./home/${path.basename(lccInputFile)}`,
          // `"${potentialPath} ./home/${path.basename(lccInputFile)}"`,
          // `"${potentialPath}" "./home/${path.basename(lccInputFile)}"`,
          // `${potentialPath} "./home/${path.basename(lccInputFile)}"`,
          `sh -c ${potentialPath} ./home/${path.basename(lccInputFile)}`
        ];

        for (const variation of commandVariations) {
          console.log('Trying command variation:', variation);
          try {
            execSync(`docker exec ${containerName} sh -c ${variation}`, 
              { stdio: 'inherit' });
            
            lccPath = potentialPath;
            return lccOutputFile;
          } catch (variantError) {
            console.log(`Variant failed: ${variation}`, variantError.message);
          }
        }
      } catch (err) {
        console.log(`Failed to use LCC at ${potentialPath}:`, err.message);
      }
    }

    throw new Error('No working LCC command found');
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