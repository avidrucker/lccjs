// name.js
// LCC.js Namer

// This program's code is triggered by LCC.js to run when 
// a name.nnn file is not detected in the current folder
// and LCC.js has been executed.
// Once a name.nnn file exists, then LCC.js can read
// the name inside directly to use for its .bst and .lst
// file outputs.

// Upon running LCC.js, if no name.nnn file is found in
// the target file's current directory, this program asks
// the user for their name in the format 
// "LastName, FirstName MiddleInitial"

const fs = require('fs');
const path = require('path');

const prompt = "Enter familyname, firstname middleinitial (if any)\n";

function readLineFromStdin() {
  let input = '';
  let buffer = Buffer.alloc(1);
  let fd = process.stdin.fd;

  while (true) {
    try {
      let bytesRead = fs.readSync(fd, buffer, 0, 1, null);
      if (bytesRead === 0) {
        // EOF
        break;
      }
      let char = buffer.toString('utf8');
      if (char === '\n' || char === '\r') {
        // Stop reading input on newline or carriage return
        break;
      }
      input += char;
    } catch (err) {
      if (err.code === 'EAGAIN') {
        // Resource temporarily unavailable, wait a bit and retry
        continue;
      } else {
        throw err;
      }
    }
  }
  return input;
}

function createNameFile(inputPath) {
  // Get the directory of the input file
  const dir = path.dirname(inputPath);
  const nameFile = path.join(dir, 'name.nnn');

  // Check if name.nnn already exists
  if (fs.existsSync(nameFile)) {
    return fs.readFileSync(nameFile, 'utf8').trim();
  }

  // If not, prompt for name
  process.stdout.write(prompt);
  const name = readLineFromStdin();

  //// The lcc does not validate that names are properly formatted
  // Validate name format
  // const nameParts = name.split(',').map(part => part.trim());
  // if (nameParts.length !== 2) {
  //   console.error('Invalid name format. Please use: LastName, FirstName MiddleInitial');
  //   process.exit(1);
  // }

  // Write to name.nnn file
  fs.writeFileSync(nameFile, name + "\n");
  return name;
}

module.exports = { createNameFile };