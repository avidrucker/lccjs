// linker.js
// LCC.js Linker
// Translated from l.c by Avital Drucker

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
    }
  
    link(objectModules) {
      // objectModules: array of objects, each representing an object module
      for (let module of objectModules) {
        this.processModule(module);
        if (this.errorFlag) {
          console.error('Errors encountered during linking.');
          return null;
        }
      }
  
      // Adjust external references
      this.adjustExternalReferences();
  
      // Adjust local references
      this.adjustLocalReferences();
  
      // Create executable
      return this.createExecutable();
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
      let executable = {
        headers: [],
        code: this.mca.slice(0, this.mcaIndex),
      };
  
      if (this.gotStart) {
        executable.headers.push({
          type: 'S',
          address: this.start,
        });
      }
  
      for (let label in this.GTable) {
        executable.headers.push({
          type: 'G',
          address: this.GTable[label],
          label: label,
        });
      }
  
      // V entries are written as A entries
      for (let ref of this.VTable) {
        executable.headers.push({
          type: 'A',
          address: ref.address,
        });
      }
  
      // Write A entries
      for (let ref of this.ATable) {
        executable.headers.push({
          type: 'A',
          address: ref.address,
        });
      }
  
      return executable;
    }
  
    error(message) {
      console.error(`Linker Error: ${message}`);
      this.errorFlag = true;
    }
  }
  
  // Export the Linker class for use in other modules
  module.exports = Linker;
  