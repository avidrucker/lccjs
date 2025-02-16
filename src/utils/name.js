// name.js
// LCC.js Namer

// This program's purpose is to check for a name.nnn file.
// If it exists, it reads the name from the file to use.
// If name.nnn does not exist, this program prompts the 
// user for their name, creates the name.nnn file, and
// saves the name inside of it.
// This program asks t he user for their name in the 
// format "LastName, FirstName MiddleInitial"

const fs = require('fs');
const path = require('path');

const newline = process.platform === 'win32' ? '\r\n' : '\n';
const prompt = `Enter familyname, firstname middleinitial (if any)${newline}`;

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
      
      // If it's a carriage return, check for a following newline
      if (char === '\r') {
        // Windows line ending. We should consume the next character if it is '\n'
        let nextBytes = fs.readSync(fd, buffer, 0, 1, null);
        if (nextBytes > 0) {
          let nextChar = buffer.toString('utf8', 0, 1);
          if (nextChar === '\n') {
            // console.log("Next char is newline");
          }
        }
        break;
      }

      // If it's a newline, just break
      if (char === '\n') {
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

  // Note: The lcc does not validate that names are properly formatted,
  // but it should make sure that the name is not empty.
  if(name.trim() === '') {
    console.error('Name cannot be empty');
    process.exit(1);
  }

  // Write to name.nnn file with \n if on linux/mac or \r\n if on windows
  fs.writeFileSync(nameFile, name + newline, { encoding: 'utf8' });
  return name;
}

module.exports = { createNameFile };