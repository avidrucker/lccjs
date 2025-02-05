#!/usr/bin/env node

// interpreterplus.js

import fs from "fs";
import path from 'path';
// import ansiEscapes from 'ansi-escapes';
import Interpreter from '../core/interpreter.js';

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function resetProcessStdin() {
  process.stdin.setRawMode(false);
  process.stdin.pause();
  // process.stdout.write(ansiEscapes.cursorShow); // show cursor
  process.stdout.write('\u001B[?25h'); // show cursor
  }

function fatalExit(message, code = 1) {

  resetProcessStdin();

  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

class InterpreterPlus extends Interpreter {
  constructor() {
    super();
    this.keyQueue = []; // For non-blocking input
    this.nonBlockingInput = true; // Default to non-blocking
    this.seed = 0; // Seed for random number generator
    this.instructionsCap = Infinity; // Default to no cap
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
        if (arg.startsWith('-L')) {
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

    // set up input
    if (this.nonBlockingInput) {
      // set up raw mode for non-blocking input
      process.stdin.setRawMode(true);
      process.stdin.setEncoding('utf8');
      process.stdin.resume();

      process.on('exit', () => {
        resetProcessStdin();
      });
  
      // Each "data" event might contain multiple characters if typed quickly
      process.stdin.on('data', (chunk) => {
        for (const char of chunk) {
          if (char === '\u0003') { // Ctrl-C
            resetProcessStdin();
            process.exit(); // Exit the process
          }
          // for the Enter key
          else if (char === '\r' || char === '\n') {
            this.keyQueue.push('\n');
          }

          else {
            // For arrows, ctrl, etc., you'll get escape sequences
            // e.g. '\u001b[A' for arrow-up. For normal keys, char is straightforward.
            this.keyQueue.push(char);
          }
        }
      });
    }

    // run
    try {
      this.startNonBlockingLoop();
    } catch (error) {
      console.error(`Runtime Error: ${error.message}`);
      fatalExit(`Runtime Error: ${error.message}`, 1);
    }
  }

  startNonBlockingLoop() {
    this.running = true;
  
    const runBatch = () => {
      if (!this.running) return;
      for (let i = 0; i < 500; i++) {
        if (!this.running) break;
        this.step();
      }
      setImmediate(runBatch);
    };
  
    runBatch();
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
      case 0: // HALT
        this.running = false;
        // turn off raw mode for non-blocking input
        resetProcessStdin();
        break;
      case 14: // bp breakpoint
        this.executeLccPlusBreakpoint();
        break;
      case 15: // clear
        this.executeClear();
        break;
      case 16: // sleep
        this.executeSleep();
        break;
      case 17: // nbain
        this.executeNonBlockingAsciiInput();
        break
      case 18: // cursor
        this.executeToggleCursor();
        break;
      case 19: // srand
        this.executeSrand();
        break;
      case 20: // millis
        this.executeMillis();
        break;
      case 21: // resetc
        this.executeResetCursor();
        break;
      default:
        // If it's not 15 or 16, call parent's method
        super.executeTRAP();
    }
  }

  executeLccPlusBreakpoint() {
    this.running = false;
    // wait for the user to press any key, then once they have
    // pressed any key, resume execution
    process.stdin.once('data', () => {
      this.running = true;
      this.startNonBlockingLoop();
    });
  }

  executeCase10() {    
    switch(this.eopcode) {
      case 14: // rand
        this.executeRand();
        break;
      default:
        // If it's not 14, call parent's method
        super.executeCase10();
    }
  }

  // We re-add the actual methods:
  executeClear() {
    console.clear();
  }

  executeSleep() {
    const milliseconds = this.r[this.sr];
    // Stop the stepping, resume after setTimeout
    this.running = false;
    setTimeout(() => {
      if (!this.running) {
        this.running = true;
        this.startNonBlockingLoop();
      }
    }, milliseconds);
  }  

  executeNonBlockingAsciiInput() {
    // If the queue has data, pop the oldest key,
    // otherwise return 0 (or -1) to signify "no key"
    if (this.keyQueue.length > 0) {
      const nextKey = this.keyQueue.shift();
      // We'll store the ASCII code in register DR
      this.r[this.dr] = nextKey.charCodeAt(0);
    } else {
      // No key in queue
      this.r[this.dr] = 0; 
    }
  }

  executeToggleCursor() {
    // by default, in the beginning of all programs, the cursor is visible
    // if the passed in register is 0, hide the cursor
    // if the passed in register is non-zero, show the cursor
    if (this.r[this.dr] === 0) {
      process.stdout.write('\u001B[?25l');
      //process.stdout.write(ansiEscapes.cursorHide); // hide cursor
    } else {
      process.stdout.write('\u001B[?25h'); // show cursor
      // process.stdout.write(ansiEscapes.cursorShow); // show cursor
    }
  }

  executeSrand() {
    // seed the random number generator
    // with the value in the passed in source register
    this.seed = this.r[this.sr];
  }

  executeRand() {
    // Linear Congruential Generator (LCG) constants
    const a = 48271;    // Multiplier (commonly used LCG constant)
    const c = 10139;    // Increment (another standard value)
    const m = 0x10000;  // Modulus (2^16 for 16-bit)

    // Update seed using LCG formula
    this.seed = (a * this.seed + c) % m;
    this.seed ^= (this.seed << 13) & 0xFFFF;  // XOR shift right by 7
    this.seed ^= (this.seed >> 17) & 0xFFFF;  // XOR shift left by 9
    this.seed ^= (this.seed << 5) & 0xFFFF; // XOR shift right by 13
    // console.log("new seed: " + this.seed);
    let range;
    if (this.r[this.dr] <= this.r[this.sr1]) {
      range = this.r[this.sr1] - this.r[this.dr] + 1;
      this.r[this.dr] = (this.seed % range) + this.r[this.dr];
    } else {
      range = this.r[this.dr] - this.r[this.sr1] + 1;
      this.r[this.dr] = (this.seed % range) + this.r[this.sr1];
    }
  }

  // returns just the current milliseconds of the system clock
  executeMillis() {
    this.r[this.dr] = Date.now() % 1000;
  }

  executeResetCursor() {
    process.stdout.write('\u001B[H'); // move cursor to home
  }
}

// If run directly
if (require.main === module) {
  const interpPlus = new InterpreterPlus();
  interpPlus.generateStats = false; // default to no stats
  interpPlus.main();
}

module.exports = InterpreterPlus;