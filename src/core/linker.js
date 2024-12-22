#!/usr/bin/env node
// linker.js
// LCC.js Linker

const fs = require('fs');

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

class Linker {
  constructor() {
    this.mca = []; // Machine Code Array
    this.mcaIndex = 0;
    this.GTable = {}; // Global symbols: label -> address
    this.ETable = []; // External references with 11-bit addresses
    this.eTable = []; // External references with 9-bit addresses
    this.VTable = []; // External references with full addresses
    this.ATable = []; // Local references
    this.start = null;
    this.gotStart = false;
    this.errorFlag = false;
    this.objectModules = []; // List of object modules to process
    this.inputFiles = []; // List of input files
    this.outputFileName = null; // Output file name
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length < 1) {
      console.error('Usage: node linker.js [-o outputfile.e] <object module 1> <object module 2> ...');
      fatalExit('Usage: node linker.js [-o outputfile.e] <object module 1> <object module 2> ...', 1);
    }

    let i = 0;
    while (i < args.length) {
      if (args[i] === '-o') {
        if (i + 1 >= args.length) {
          console.error('Missing output file name after -o');
          fatalExit('Missing output file name after -o', 1);
        }
        this.outputFileName = args[i + 1];
        i += 2;
      } else {
        this.inputFiles.push(args[i]);
        i++;
      }
    }

    if (this.inputFiles.length === 0) {
      console.error('Error: No input object modules specified');
      fatalExit('Error: No input object modules specified', 1);
    }

    this.link(this.inputFiles, this.outputFileName);
  }

  // Method to read object modules from files
  readObjectModule(filename) {
    const buffer = fs.readFileSync(filename);
    let offset = 0;

    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      this.error(`${filename} not a linkable file`);
      return;
    }

    let module = {
      headers: [],
      code: [],
    };

    // Process headers
    while (offset < buffer.length) {
      const entryType = String.fromCharCode(buffer[offset++]);

      if (entryType === 'C') {
        // End of header, start of code
        break;
      }

      switch (entryType) {
        case 'S': {
          if (offset + 1 >= buffer.length) {
            this.error('Invalid S entry');
            return;
          }
          const address = buffer.readUInt16LE(offset);
          offset += 2;
          module.headers.push({ type: 'S', address });
          break;
        }
        case 'G':
        case 'E':
        case 'e':
        case 'V': {
          if (offset + 1 >= buffer.length) {
            // Incomplete entry
            this.error(`Invalid ${entryType} entry`);
            return;
          }
          const address = buffer.readUInt16LE(offset);
          offset += 2;
          let label = '';
          while (offset < buffer.length) {
            const charCode = buffer[offset++];
            if (charCode === 0) break; // Null terminator
            label += String.fromCharCode(charCode);
          }
          module.headers.push({ type: entryType, address, label });
          break;
        }
        case 'A': {
          if (offset + 1 >= buffer.length) {
            this.error('Invalid A entry');
            return;
          }
          const address = buffer.readUInt16LE(offset);
          offset += 2;
          module.headers.push({ type: 'A', address });
          break;
        }
        default:
          this.error(`Unknown header entry ${entryType} in file ${filename}`);
          return;
      }
    }

    // Read code
    while (offset + 1 < buffer.length) {
      const word = buffer.readUInt16LE(offset);
      offset += 2;
      module.code.push(word);
    }

    // Store the module for processing
    this.objectModules.push(module);
  }

  link(filenames, outputFileName) {
    this.inputFiles = filenames; // Save input files
    this.outputFileName = outputFileName || 'link.e'; // Save output filename
    
    // Read all object modules
    for (let filename of filenames) {
      this.readObjectModule(filename);
      if (this.errorFlag) {
        // If invalid file or read error encountered, stop immediately
        return null;
      }
      console.log(`Linking ${filename}`);
    }

    // Process each module
    for (let module of this.objectModules) {
      this.processModule(module);
      if (this.errorFlag) {
        return null;
      }
    }

    // Adjust external references
    this.adjustExternalReferences();
    if (this.errorFlag) return;

    // Adjust local references
    this.adjustLocalReferences();
    if (this.errorFlag) return;

    // Create executable
    console.log(`Creating executable file ${this.outputFileName}`);
    this.createExecutable();
  }

  processModule(module) {
    // Process headers
    let headers = module.headers;
    let code = module.code;

    for (let header of headers) {
      switch (header.type) {
        case 'S':
          if (this.gotStart) {
            this.error('Multiple entry points');
            return;
          }
          this.start = header.address + this.mcaIndex;
          this.gotStart = true;
          break;
        case 'G':
          if (this.GTable.hasOwnProperty(header.label)) {
            this.error(`Multiple definitions of global symbol ${header.label}`);
            return;
          }
          this.GTable[header.label] = header.address + this.mcaIndex;
          break;
        case 'E':
          this.ETable.push({
            address: header.address + this.mcaIndex,
            label: header.label,
          });
          break;
        case 'e':
          this.eTable.push({
            address: header.address + this.mcaIndex,
            label: header.label,
          });
          break;
        case 'V':
          this.VTable.push({
            address: header.address + this.mcaIndex,
            label: header.label,
          });
          break;
        case 'A':
          this.ATable.push({
            address: header.address + this.mcaIndex,
            moduleStart: this.mcaIndex,
          });
          break;
        default:
          this.error(`Invalid header entry: ${header.type}`);
          return;
      }
    }

    // Append code to mca
    for (let word of code) {
      this.mca[this.mcaIndex++] = word;
    }
  }

  adjustExternalReferences() {
    // Adjust ETable (11-bit addresses)
    for (let ref of this.ETable) {
      if (!this.GTable.hasOwnProperty(ref.label)) {
        this.error(`${ref.label} is an undefined external reference`);
        return;
      }
      let Gaddr = this.GTable[ref.label];
      let offset = ((this.mca[ref.address] + Gaddr - ref.address - 1) & 0x7ff);
      this.mca[ref.address] = (this.mca[ref.address] & 0xf800) | offset;
    }

    // Adjust eTable (9-bit addresses)
    for (let ref of this.eTable) {
      if (!this.GTable.hasOwnProperty(ref.label)) {
        this.error(`${ref.label} is an undefined external reference`);
        return;
      }
      let Gaddr = this.GTable[ref.label];
      let offset = ((this.mca[ref.address] + Gaddr - ref.address - 1) & 0x1ff);
      this.mca[ref.address] = (this.mca[ref.address] & 0xfe00) | offset;
    }

    // Adjust VTable (full addresses)
    for (let ref of this.VTable) {
      if (!this.GTable.hasOwnProperty(ref.label)) {
        this.error(`${ref.label} is an undefined external reference`);
        return;
      }
      let Gaddr = this.GTable[ref.label];
      this.mca[ref.address] += Gaddr;
    }
  }

  adjustLocalReferences() {
    for (let ref of this.ATable) {
      this.mca[ref.address] += ref.moduleStart;
    }
  }

  createExecutable() {
    // Write executable file
    let outfileName = this.outputFileName;

    // Write executable file
    const outFile = fs.openSync(outfileName, 'w');

    // Write file signature
    fs.writeSync(outFile, 'o');

    // Write 'S' entry if we have a start address
    if (this.gotStart) {
      const buffer = Buffer.alloc(3);
      buffer.write('S', 0, 'ascii');
      buffer.writeUInt16LE(this.start, 1);
      fs.writeSync(outFile, buffer);
    }

    // Write 'G' entries
    for (let label in this.GTable) {
      const address = this.GTable[label];
      const buffer = Buffer.alloc(3 + label.length + 1);
      buffer.write('G', 0, 'ascii');
      buffer.writeUInt16LE(address, 1);
      buffer.write(label, 3, 'ascii');
      buffer.writeUInt8(0, 3 + label.length); // Null terminator
      fs.writeSync(outFile, buffer);
    }

    // Write 'A' entries for VTable entries
    for (let ref of this.VTable) {
      const buffer = Buffer.alloc(3);
      buffer.write('A', 0, 'ascii');
      buffer.writeUInt16LE(ref.address, 1);
      fs.writeSync(outFile, buffer);
    }

    // Write 'A' entries
    for (let ref of this.ATable) {
      const buffer = Buffer.alloc(3);
      buffer.write('A', 0, 'ascii');
      buffer.writeUInt16LE(ref.address, 1);
      fs.writeSync(outFile, buffer);
    }

    // Terminate header
    fs.writeSync(outFile, 'C');

    // Write machine code
    const codeBuffer = Buffer.alloc(this.mca.length * 2);
    for (let i = 0; i < this.mca.length; i++) {
      codeBuffer.writeUInt16LE(this.mca[i], i * 2);
    }
    fs.writeSync(outFile, codeBuffer);

    fs.closeSync(outFile);
  }

  error(message) {
    console.error(`${message}`); // linker error
    this.errorFlag = true;
  }
}

if (require.main === module) {
  const linker = new Linker();
  linker.main();
}

module.exports = Linker;
