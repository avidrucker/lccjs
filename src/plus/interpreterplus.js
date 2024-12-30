#!/usr/bin/env node

// interpreterplus.js

const fs = require('fs');
const path = require('path');
const Interpreter = require('../core/interpreter.js');

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

class InterpreterPlus extends Interpreter {
  constructor() {
    super();
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length < 1) {
      console.error('Usage: node interpreterplus.js <input filename> [options]');
      fatalExit('Usage: node interpreterplus.js <input filename> [options]', 1);
    }

    // parse args, same as parent
    let i = 0;
    while (i < args.length) {
      let arg = args[i];
      if (arg.startsWith('-')) {
        // same logic for -nostats, etc.
        if (arg === '-nostats') {
          this.generateStats = false;
        } else if (arg.startsWith('-L')) {
          // load point logic
          let loadPointStr = arg.substring(2);
          if (!loadPointStr) {
            i++;
            if (i >= args.length) {
              console.error('Error: -L option requires a value');
              fatalExit('Error: -L option requires a value', 1);
            }
            loadPointStr = args[i];
          }
          this.loadPoint = parseInt(loadPointStr, 16);
          if (isNaN(this.loadPoint)) {
            console.error(`Invalid load point value: ${loadPointStr}`);
            fatalExit(`Invalid load point value: ${loadPointStr}`, 1);
          }
        } else {
          console.error(`Bad command line switch: ${arg}`);
          fatalExit(`Bad command line switch: ${arg}`, 1);
        }
      } else {
        if (!this.inputFileName) {
          this.inputFileName = arg;
        } else {
          console.error(`Unexpected argument: ${arg}`);
          fatalExit(`Unexpected argument: ${arg}`, 1);
        }
      }
      i++;
    }

    if (!this.inputFileName) {
      console.error('No input file specified.');
      fatalExit('No input file specified.', 1);
    }

    // Only allow .ep files
    const extension = path.extname(this.inputFileName).toLowerCase();
    if (extension !== '.ep') {
      console.error('Unsupported file type for LCC+ (expected .ep)');
      fatalExit('Unsupported file type', 1);
    }

    console.log(`Starting interpretation of ${this.inputFileName} (LCC+)`);

    let buffer;
    try {
      buffer = fs.readFileSync(this.inputFileName);
    } catch (err) {
      console.error(`Cannot open input file ${this.inputFileName}`);
      fatalExit(`Cannot open input file ${this.inputFileName}`, 1);
    }

    // check that first two chars are 'o' and 'p'
    if (buffer[0] !== 'o'.charCodeAt(0) || buffer[1] !== 'p'.charCodeAt(0)) {
      console.error(`${this.inputFileName} is not in LCC+ format (missing 'op')`);
      fatalExit('Not an LCC+ .ep file', 1);
    }

    // We don't skip the 'o' and 'p' bytes
    let offset = 0;
    const realBuffer = buffer.slice(offset);

    // Now let parent's loadExecutableBuffer handle from that point on
    this.loadExecutableBuffer(realBuffer, 'p');

    this.initialMem = this.mem.slice(); // copy memory

    // run
    try {
      this.run();
      if (this.generateStats) console.log();
    } catch (error) {
      console.error(`Runtime Error: ${error.message}`);
      fatalExit(`Runtime Error: ${error.message}`, 1);
    }
  }

  // extracts header entries and loads machine code into memory
  loadExecutableBuffer(buffer, secondIntroHeader = '') {
    let offset = 0;

    // Read file signature
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      this.error('Invalid file signature: missing "o"');
      return;
    }

    if (secondIntroHeader !== '' && buffer[offset++] !== 'p'.charCodeAt(0)) {
      this.error('Invalid file signature: missing "p"');
      return;
    }

    // Do not store the 'o' or 'p' signatures in headerLines

    let startAddress = 0; // Default start address

    // Read header entries until 'C' is encountered
    while (offset < buffer.length) {
      const entryChar = String.fromCharCode(buffer[offset++]);
      console.log("entryChar: ", entryChar);

      if (entryChar === 'C') {
        // Start of code
        // Do not store 'C' in headerLines
        break;
      } else if (entryChar === 'S') {
        // Start address entry: read two bytes as little endian
        if (offset + 1 >= buffer.length) {
          this.error('Incomplete start address in header');
          return;
        }
        startAddress = buffer.readUInt16LE(offset);
        offset += 2;
        this.headerLines.push(`S ${startAddress.toString(16).padStart(4, '0')}`);
      } else if (entryChar === 'G') {
        // Skip 'G' entry: Read address and label
        if (offset + 1 >= buffer.length) {
          this.error('Incomplete G entry in header');
          return;
        }
        const address = buffer.readUInt16LE(offset);
        offset += 2;
        let label = '';
        while (offset < buffer.length) {
          const charCode = buffer[offset++];
          if (charCode === 0) break;
          label += String.fromCharCode(charCode);
        }
        this.headerLines.push(`G ${address.toString(16).padStart(4, '0')} ${label}`);
      } else if (entryChar === 'A') {
        // Skip 'A' entry: Read address
        if (offset + 1 >= buffer.length) {
          this.error('Incomplete A entry in header');
          return;
        }
        const address = buffer.readUInt16LE(offset);
        offset += 2;
        this.headerLines.push(`A ${address.toString(16).padStart(4, '0')}`);
      } else {
        // Skip unknown entries or handle as needed
        this.error(`Unknown header entry: '${entryChar}'`);
        return;
      }
    }

    // Read machine code into memory starting at this.loadPoint
    let memIndex = this.loadPoint; // Start loading at loadPoint
    while (offset + 1 < buffer.length) {
      const instruction = buffer.readUInt16LE(offset);
      offset += 2;
      this.mem[memIndex++] = instruction;
    }

    this.memMax = memIndex - 1; // Last memory address used

    // for debugging purposes
    // console.log(`All instructions: ${this.loadPoint.toString(16).padStart(4, '0')} - ${this.memMax.toString(16).padStart(4, '0')}`);
    // for (let i = this.loadPoint; i <= this.memMax; i++) {
    //   console.log(`${i.toString(16).padStart(4, '0')}: ${this.mem[i].toString(16).padStart(4, '0')}`);
    // }

    // Set PC to loadPoint + startAddress
    this.pc = (this.loadPoint + startAddress) & 0xFFFF;
  }

  // Next we must override executeTRAP to handle the 'clear' and 'sleep' trap vectors
  executeTRAP() {
    switch (this.trapvec) {
      // Keep parent's existing trap handling
      // but we add back the ones we removed from parent:
      case 15: // clear
        this.executeClear();
        break;
      case 16: // sleep
        this.executeSleep();
        break;
      default:
        // If it's not 15 or 16, call parent's method
        super.executeTRAP();
    }
  }

  // We re-add the actual methods:
  executeClear() {
    console.clear();
  }

  executeSleep() {
    const milliseconds = this.r[this.sr];
    const start = Date.now();
    while (Date.now() - start < milliseconds) {
      // busy-wait
    }
  }
}

// If run directly
if (require.main === module) {
  const interpPlus = new InterpreterPlus();
  interpPlus.generateStats = false; // default to no stats
  interpPlus.main();
}

module.exports = InterpreterPlus;