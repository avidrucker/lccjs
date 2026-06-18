#!/usr/bin/env node
// linker.js
// LCC.js Linker

const fs = require('fs');
const { LinkerError } = require('../utils/errors');

const { fatalExit, cliErrorExit, maybeExplain } = require('../utils/cliExit');
const { suggestClosest } = require('../utils/suggest');

class Linker {
  constructor() {
    // resetState() is the single source of truth for per-link instance fields;
    // the constructor just delegates, so a field can't be added in one place and
    // forgotten in the other (which would leak state across reused link() runs).
    this.resetState();
    // verboseModeOn is a configuration property (not per-link state) — it must
    // survive resetState() calls so callers can set it once before link().
    this.verboseModeOn = false;
    // silent (also a configuration property) suppresses error()'s console
    // output so the pure seam linkObjectModules() can throw LinkerError without
    // printing. The CLI wrapper path (link/main) leaves it false and keeps the
    // existing output; the seam toggles it locally and restores it.
    this.silent = false;
  }

  // Reset all per-link state so the same Linker instance can be reused across
  // multiple link() calls without state leaking from one run into the next.
  // This is the single definition of the per-link field set.
  resetState() {
    this.machineCode = [];
    // previously: mcaIndex
    this.moduleCurrentAddress = 0;
    // previously: globalSymbols
    this.globalSymbolTable = {};
    // previously: externalRefs11
    this.externalReferenceTable11 = [];
    // previously: externalRefs9
    this.externalReferenceTable9 = [];
    // previously: virtualAddressRefs
    this.virtualAddressTable = [];
    // previously: localRefs
    this.addressAdjustmentTable = [];
    this.start = null;
    this.gotStart = false;
    this.objectModules = [];     // List of object modules to process
    this.inputFiles = [];        // List of input files
    this.outputFileName = null;  // Output file name
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length < 1) {
      cliErrorExit('Usage: node linker.js [-o outputfile.e] <object module 1> <object module 2> ...', 1);
    }

    let i = 0;
    while (i < args.length) {
      if (args[i] === '-o') {
        if (i + 1 >= args.length) {
          cliErrorExit('Missing output file name after -o', 1);
        }
        this.outputFileName = args[i + 1];
        i += 2;
      } else {
        this.inputFiles.push(args[i]);
        i++;
      }
    }

    if (this.inputFiles.length === 0) {
      cliErrorExit('Error: No input object modules specified', 1);
    }

    this.link(this.inputFiles, this.outputFileName);
  }

  parseObjectModuleBuffer(buffer, filename = '<buffer>') {
    let offset = 0;

    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      throw new LinkerError(`${filename} not a linkable file`, { explainKey: 'NOT_LINKABLE' });
    }

    const module = {
      headers: [],
      code: [],
    };

    // A linkable module must contain a `C` code marker separating the header
    // section from the code section. Without it the oracle rejects the input as
    // "not a linkable module"; an empty code section *after* `C` is fine (both
    // tools accept it). Track whether the marker was seen so a header-only
    // module is rejected to match the oracle. #1422.
    let sawCodeMarker = false;

    // Process headers
    while (offset < buffer.length) {
      const entryType = String.fromCharCode(buffer[offset++]);

      if (entryType === 'C') {
        sawCodeMarker = true;
        break;
      }

      switch (entryType) {
        case 'S': {
          if (offset + 1 >= buffer.length) {
            throw new LinkerError('Invalid S entry', { explainKey: 'BAD_OBJECT_HEADER' });
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
            throw new LinkerError(`Invalid ${entryType} entry`, { explainKey: 'BAD_OBJECT_HEADER' });
          }
          const address = buffer.readUInt16LE(offset);
          offset += 2;
          let label = '';
          let labelTerminated = false;
          while (offset < buffer.length) {
            const charCode = buffer[offset++];
            if (charCode === 0) { labelTerminated = true; break; }
            label += String.fromCharCode(charCode);
          }
          // The label must end with a NUL terminator. If the buffer runs out first the
          // module is malformed: accepting the partial label silently was a real divergence
          // (the oracle segfaults reading past the buffer on this exact input — see #1384),
          // so reject it gracefully like the sibling address-field guards above.
          if (!labelTerminated) {
            throw new LinkerError(`Unterminated label in ${entryType} entry`, { explainKey: 'BAD_OBJECT_HEADER' });
          }
          module.headers.push({ type: entryType, address, label });
          break;
        }
        case 'A': {
          if (offset + 1 >= buffer.length) {
            throw new LinkerError('Invalid A entry', { explainKey: 'BAD_OBJECT_HEADER' });
          }
          const address = buffer.readUInt16LE(offset);
          offset += 2;
          module.headers.push({ type: 'A', address });
          break;
        }
        default:
          throw new LinkerError(`Unknown header entry ${entryType} in file ${filename}`, { explainKey: 'BAD_OBJECT_HEADER' });
      }
    }

    if (!sawCodeMarker) {
      throw new LinkerError(`${filename} is not a linkable module`, { explainKey: 'BAD_OBJECT_HEADER' });
    }

    while (offset + 1 < buffer.length) {
      const word = buffer.readUInt16LE(offset);
      offset += 2;
      module.code.push(word);
    }

    return module;
  }

  // Method to read object modules from files
  readObjectModule(filename) {
    const buffer = fs.readFileSync(filename);
    try {
      const module = this.parseObjectModuleBuffer(buffer, filename);
      this.objectModules.push(module);
    } catch (error) {
      if (error instanceof LinkerError) {
        this.error(error.message, error.explainKey); // log (with any explain key) then re-throw
      }
      throw error;
    }
  }

  link(filenames, outputFileName) {
    this.resetState();
    this.inputFiles = filenames; // Save input files
    // The oracle `lcc` binary defaults to `link.e` in the CWD; the oracle standalone
    // `linker` binary defaults to `linktest.e` in the CWD. Both use CWD, not the
    // directory of the first .o file (placing output next to the input would diverge
    // from oracle behavior).
    // LCC.js invoked via `lcc.js` always receives an explicit outputFileName, so
    // this fallback only applies to standalone `linker.js` invocations — where it
    // should say 'linktest.e' to match the oracle standalone linker.
    // See core-behavior-matrix.md § "Linker output location and default name".
    this.outputFileName = outputFileName || 'linktest.e'; // Standalone fallback matches oracle standalone linker

    // Read all object modules
    for (let filename of filenames) {
      this.readObjectModule(filename);
      console.log(`Linking ${filename}`);
    }

    // Process each module
    for (let module of this.objectModules) {
      this.processModule(module);
    }

    // Adjust external references
    this.adjustExternalReferences();

    // Adjust local references
    this.adjustLocalReferences();

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
            this.error('Multiple entry points', 'MULTIPLE_ENTRY');
          }
          this.start = header.address + this.moduleCurrentAddress;
          this.gotStart = true;
          break;
        case 'G':
          if (this.globalSymbolTable.hasOwnProperty(header.label)) {
            this.error(`More than one global declaration for ${header.label}`, 'MULTIPLE_GLOBAL');
          }
          this.globalSymbolTable[header.label] = header.address + this.moduleCurrentAddress;
          break;
        case 'E':
          this.externalReferenceTable11.push({
            address: header.address + this.moduleCurrentAddress,
            label: header.label,
          });
          break;
        case 'e':
          this.externalReferenceTable9.push({
            address: header.address + this.moduleCurrentAddress,
            label: header.label,
          });
          break;
        case 'V':
          this.virtualAddressTable.push({
            address: header.address + this.moduleCurrentAddress,
            label: header.label,
          });
          break;
        case 'A':
          this.addressAdjustmentTable.push({
            address: header.address + this.moduleCurrentAddress,
            moduleStart: this.moduleCurrentAddress,
          });
          break;
        default:
          this.error(`Invalid header entry: ${header.type}`);
      }
    }

    // Append code to machineCode
    for (let word of code) {
      this.machineCode[this.moduleCurrentAddress++] = word;
    }
  }

  _undefinedExternalRefMsg(label) {
    let msg = `${label} is an undefined external reference`;
    if (this.verboseModeOn) {
      const suggestion = suggestClosest(label, Object.keys(this.globalSymbolTable));
      if (suggestion) msg += `. Did you mean '${suggestion}'?`;
    }
    return msg;
  }

  adjustExternalReferences() {
    // Adjust externalReferenceTable11 (11-bit addresses)
    for (let ref of this.externalReferenceTable11) {
      if (!this.globalSymbolTable.hasOwnProperty(ref.label)) {
        this.error(this._undefinedExternalRefMsg(ref.label), 'UNDEFINED_EXTERN');
      }
      let Gaddr = this.globalSymbolTable[ref.label];
      let offset = ((this.machineCode[ref.address] + Gaddr - ref.address - 1) & 0x7ff);
      this.machineCode[ref.address] = (this.machineCode[ref.address] & 0xf800) | offset;
    }

    // Adjust externalReferenceTable9 (9-bit addresses)
    for (let ref of this.externalReferenceTable9) {
      if (!this.globalSymbolTable.hasOwnProperty(ref.label)) {
        this.error(this._undefinedExternalRefMsg(ref.label), 'UNDEFINED_EXTERN');
      }
      let Gaddr = this.globalSymbolTable[ref.label];
      let offset = ((this.machineCode[ref.address] + Gaddr - ref.address - 1) & 0x1ff);
      this.machineCode[ref.address] = (this.machineCode[ref.address] & 0xfe00) | offset;
    }

    // Adjust virtualAddressTable (full addresses)
    for (let ref of this.virtualAddressTable) {
      if (!this.globalSymbolTable.hasOwnProperty(ref.label)) {
        this.error(this._undefinedExternalRefMsg(ref.label), 'UNDEFINED_EXTERN');
      }
      let Gaddr = this.globalSymbolTable[ref.label];
      this.machineCode[ref.address] += Gaddr;
    }
  }

  adjustLocalReferences() {
    for (let ref of this.addressAdjustmentTable) {
      this.machineCode[ref.address] += ref.moduleStart;
    }
  }

  // Pure in-memory seam (#1224 design → #1274): link an array of object-module
  // Buffers into a single executable image, returning data and throwing typed
  // LinkerError — no console output, no fs, no process.exit. Mirrors
  // assembler.assembleSource / interpreter.executeBuffer. The CLI wrapper
  // (link/main) owns file reads, progress logs, output writes, and exit codes.
  // `options.fileNames` (optional, parallel to `buffers`) supplies filenames for
  // parse-error context only. Composes the existing parseObjectModuleBuffer seam.
  linkObjectModules(buffers, options = {}) {
    const { fileNames = [] } = options;
    this.resetState();
    const previousSilent = this.silent;
    this.silent = true; // suppress error()'s console output; the seam only throws
    try {
      buffers.forEach((buffer, i) => {
        this.objectModules.push(
          this.parseObjectModuleBuffer(buffer, fileNames[i] || '<buffer>')
        );
      });
      for (let module of this.objectModules) {
        this.processModule(module);
      }
      this.adjustExternalReferences();
      this.adjustLocalReferences();
      return this.createLinkResult({ outputBytes: this.buildExecutableBuffer() });
    } finally {
      this.silent = previousSilent;
    }
  }

  // Result builder for the pure seam, mirroring assembler.createAssemblyResult
  // ({ outputBytes, ... }) and interpreter.createExecutionResult. Returns an
  // object (not a bare Buffer) so fields can be added later without breaking
  // callers — the same reasoning the assembler/interpreter seams already follow.
  createLinkResult({ outputBytes }) {
    return { outputBytes };
  }

  // Build the .e executable image as an in-memory Buffer (pure: no fs, no
  // console). Byte layout is the linker output format: 'o' signature, optional
  // 'S' start entry, 'G' global entries, 'A' address entries, 'C' header
  // terminator, then little-endian machine-code words. The single source of
  // truth for the output bytes: createExecutable() (CLI wrapper) writes this to
  // disk; linkObjectModules() (pure seam) returns it as result.outputBytes.
  buildExecutableBuffer() {
    const parts = [];

    // File signature
    parts.push(Buffer.from('o', 'ascii'));

    // 'S' entry if we have a start address
    if (this.gotStart) {
      const buffer = Buffer.alloc(3);
      buffer.write('S', 0, 'ascii');
      buffer.writeUInt16LE(this.start, 1);
      parts.push(buffer);
    }

    // 'G' entries
    for (let label in this.globalSymbolTable) {
      const address = this.globalSymbolTable[label];
      const buffer = Buffer.alloc(3 + label.length + 1);
      buffer.write('G', 0, 'ascii');
      buffer.writeUInt16LE(address, 1);
      buffer.write(label, 3, 'ascii');
      buffer.writeUInt8(0, 3 + label.length); // Null terminator
      parts.push(buffer);
    }

    // 'A' entries for virtualAddressTable entries
    for (let ref of this.virtualAddressTable) {
      const buffer = Buffer.alloc(3);
      buffer.write('A', 0, 'ascii');
      buffer.writeUInt16LE(ref.address, 1);
      parts.push(buffer);
    }

    // 'A' entries
    for (let ref of this.addressAdjustmentTable) {
      const buffer = Buffer.alloc(3);
      buffer.write('A', 0, 'ascii');
      buffer.writeUInt16LE(ref.address, 1);
      parts.push(buffer);
    }

    // Terminate header
    parts.push(Buffer.from('C', 'ascii'));

    // Machine code
    const codeBuffer = Buffer.alloc(this.machineCode.length * 2);
    for (let i = 0; i < this.machineCode.length; i++) {
      codeBuffer.writeUInt16LE(this.machineCode[i], i * 2);
    }
    parts.push(codeBuffer);

    return Buffer.concat(parts);
  }

  createExecutable() {
    // CLI wrapper path: write the (pure) executable image to disk. Uses the
    // same fs.openSync/writeSync/closeSync calls as before — only the byte
    // production moved into buildExecutableBuffer(), so output is unchanged.
    const outFile = fs.openSync(this.outputFileName, 'w');
    fs.writeSync(outFile, this.buildExecutableBuffer());
    fs.closeSync(outFile);
  }

  // `explainKey` (optional, #1098) selects a --explain catalog entry printed
  // after the error line when explain mode is on; default output is unchanged.
  error(message, explainKey = null) {
    // The pure seam sets `silent` so it can throw without writing to the
    // console; the CLI wrapper leaves it false and keeps the existing output.
    if (!this.silent) {
      const prefix = this.verboseModeOn ? '[linker] ' : '';
      console.error(`${prefix}${message}`);
      maybeExplain(explainKey);
    }
    throw new LinkerError(message);
  }
}

if (require.main === module) {
  const linker = new Linker();
  linker.main();
}

module.exports = Linker;
