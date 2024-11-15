// linker.js
// LCC.js Linker

const fs = require('fs');

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
  }

  // Method to read object modules from files
  readObjectModule(filename) {
    const buffer = fs.readFileSync(filename);
    let offset = 0;

    // Check file signature
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      this.error(`File ${filename} is not a valid object file`);
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

  link(filenames) {
    // Read all object modules
    for (let filename of filenames) {
      this.readObjectModule(filename);
      if (this.errorFlag) {
        console.error('Errors encountered during linking: reading object module.');
        return null;
      }
    }

    // Process each module
    for (let module of this.objectModules) {
      this.processModule(module);
      if (this.errorFlag) {
        console.error('Errors encountered during linking: processing module');
        return null;
      }
    }

    // Adjust external references
    this.adjustExternalReferences();

    // Adjust local references
    this.adjustLocalReferences();

    // Create executable
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
        this.error(`Undefined external reference: ${ref.label}`);
        return;
      }
      let Gaddr = this.GTable[ref.label];
      let offset = ((this.mca[ref.address] + Gaddr - ref.address - 1) & 0x7ff);
      this.mca[ref.address] = (this.mca[ref.address] & 0xf800) | offset;
    }

    // Adjust eTable (9-bit addresses)
    for (let ref of this.eTable) {
      if (!this.GTable.hasOwnProperty(ref.label)) {
        this.error(`Undefined external reference: ${ref.label}`);
        return;
      }
      let Gaddr = this.GTable[ref.label];
      let offset = ((this.mca[ref.address] + Gaddr - ref.address - 1) & 0x1ff);
      this.mca[ref.address] = (this.mca[ref.address] & 0xfe00) | offset;
    }

    // Adjust VTable (full addresses)
    for (let ref of this.VTable) {
      if (!this.GTable.hasOwnProperty(ref.label)) {
        this.error(`Undefined external reference: ${ref.label}`);
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
    const outfileName = 'link.e';
    const outFile = fs.openSync(outfileName, 'w');

    // Write file signature
    fs.writeSync(outFile, 'o');

    console.log(`Creating executable file ${outfileName}`);

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
    console.log("TEMP: finished writing executable file");
  }

  error(message) {
    console.error(`Linker Error: ${message}`);
    this.errorFlag = true;
  }
}

if (require.main === module) {
  // Collect command-line arguments
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node linker.js <object module 1> <object module 2> ...');
    process.exit(1);
  }

  const linker = new Linker();
  linker.link(args);
}

module.exports = Linker;
  