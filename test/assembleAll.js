#!/usr/bin/env node

// assembleAll.js
// Usage: node assembleAll.js ./path/to/directory/

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function assembleFile(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`Assembling file: ${filePath}`);

    const assemblerProcess = spawn('node', ['./src/assembler.js', filePath], {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: process.env,
    });

    assemblerProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`Successfully assembled ${filePath}`);
        resolve();
      } else {
        console.error(`Failed to assemble ${filePath} with exit code ${code}`);
        reject(new Error(`Failed to assemble ${filePath} with exit code ${code}`));
      }
    });

    assemblerProcess.on('error', (err) => {
      console.error(`Error assembling file ${filePath}: ${err.message}`);
      reject(err);
    });
  });
}

async function assembleAll(directory) {
  try {
    // Resolve the absolute path of the directory
    const dirPath = path.resolve(directory);

    // Check if the directory exists
    if (!fs.existsSync(dirPath)) {
      console.error(`Directory ${dirPath} does not exist.`);
      process.exit(1);
    }

    // Read all files in the directory
    const files = fs.readdirSync(dirPath);

    // Filter out .a files
    const assemblyFiles = files.filter((file) => path.extname(file).toLowerCase() === '.a');

    if (assemblyFiles.length === 0) {
      console.log(`No .a files found in directory ${dirPath}.`);
      return;
    }

    console.log(`Found ${assemblyFiles.length} .a files in directory ${dirPath}.`);

    // Assemble each file sequentially
    for (const file of assemblyFiles) {
      const filePath = path.join(dirPath, file);
      try {
        await assembleFile(filePath);
      } catch (err) {
        console.error(`Error assembling ${file}: ${err.message}`);
        // Continue with the next file
      }
    }

    console.log('All assembly files have been processed.');
  } catch (err) {
    console.error(`Error assembling files: ${err.message}`);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.error('Usage: node assembleAll.js <directory>');
    process.exit(1);
  }

  const directory = args[0];

  assembleAll(directory);
}

module.exports = assembleAll;
