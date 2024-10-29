#!/usr/bin/env node

// interpreter.js
// Adjusted LCC.js Interpreter to match i1.c and run a1test.e

const fs = require('fs');

class Interpreter {
  constructor() {
    this.mem = new Uint16Array(65536); // Memory (16-bit unsigned integers)
    this.r = new Uint16Array(8);        // Registers r0 to r7 (16-bit signed integers)
    this.pc = 0;                       // Program Counter
    this.ir = 0;                       // Instruction Register
    this.n = 0;                        // Negative flag
    this.z = 0;                        // Zero flag
    this.c = 0;                        // Carry flag
    this.v = 0;                        // Overflow flag
    this.running = true;
    this.output = '';                  // Output string
    this.inputBuffer = '';             // Input buffer for SIN (if needed)
    this.options = {};                 // Options from lcc.js
    this.instructionsExecuted = 0;     // for making BST/LST files
    this.maxStackSize = 0;             // for making BST/LST files
    this.spInitial = 0;                // for making BST/LST files
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length !== 1) {
      console.error('Usage: interpreter.js <input filename>');
      process.exit(1);
    }

    const inputFileName = args[0];

    // Display program name, input file name, and current time
    const currentTime = new Date().toString();
    console.log(`LASTNAME, FIRSTNAME     interpreter.js ${inputFileName}     ${currentTime}`);

    // Open and read the executable file
    let buffer;
    try {
      buffer = fs.readFileSync(inputFileName);
    } catch (err) {
      console.error(`Cannot open input file ${inputFileName}`);
      process.exit(1);
    }

    // Check file signature
    if (buffer[0] !== 'o'.charCodeAt(0) || buffer[1] !== 'C'.charCodeAt(0)) {
      console.error(`${inputFileName} is not a valid LCC executable file`);
      process.exit(1);
    }

    // Load the executable into memory
    this.loadExecutableBuffer(buffer.slice(2));

    // Run the interpreter
    try {
      this.run();
    } catch (error) {
      console.error(`Runtime Error: ${error.message}`);
      process.exit(1);
    }
  }

  // added for lcc.js
  loadExecutableFile(fileName) {
    let buffer;
    try {
      buffer = fs.readFileSync(fileName);
    } catch (err) {
      console.error(`Cannot open input file ${fileName}`);
      process.exit(1);
    }

    // Check file signature
    if (buffer[0] !== 'o'.charCodeAt(0) || buffer[1] !== 'C'.charCodeAt(0)) {
      console.error(`${fileName} is not a valid LCC executable file`);
      process.exit(1);
    }

    console.log(`Starting interpretation of ${fileName}`);

    // Load the executable into memory
    this.loadExecutableBuffer(buffer.slice(2));
  }

  loadExecutableBuffer(buffer) {
    let offset = 0;
    // Read machine code into memory
    let memIndex = 0;
    while (offset < buffer.length) {
      const instruction = buffer.readUInt16LE(offset);
      offset += 2;
      this.mem[memIndex++] = instruction;
    }

    // Set PC to start address (assuming start at 0)
    this.pc = 0;
  }

  run() {
    this.spInitial = this.r[6]; // Assuming r6 is the stack pointer

    while (this.running) {
      this.step();
    }
  }

  step() {
    // Fetch instruction
    this.ir = this.mem[this.pc++];
    // Decode instruction
    this.opcode = (this.ir >> 12) & 0xF; // Opcode (bits 15-12)
    this.code = this.dr = this.sr = (this.ir >> 9) & 0x7; // dr/sr (bits 11-9)
    this.sr1 = this.baser = (this.ir >> 6) & 0x7; // sr1/baser (bits 8-6)
    this.sr2 = this.ir & 0x7; // sr2 (bits 2-0)
    this.bit5 = (this.ir >> 5) & 0x1; // bit 5
    this.bit11 = (this.ir >> 11) & 0x1; // bit 11
    this.imm5 = this.signExtend(this.ir & 0x1F, 5); // imm5 (bits 4-0)
    this.pcoffset9 = this.signExtend(this.ir & 0x1FF, 9); // pcoffset9 (bits 8-0)
    this.imm9 = this.pcoffset9;
    this.pcoffset11 = this.signExtend(this.ir & 0x7FF, 11); // pcoffset11 (bits 10-0)
    this.offset6 = this.signExtend(this.ir & 0x3F, 6); // offset6 (bits 5-0)
    this.eopcode = this.ir & 0x1F; // eopcode (bits 4-0)
    this.trapvec = this.ir & 0xFF; // trap vector (bits 7-0)

    // Execute instruction
    switch (this.opcode) {
      case 0: // BR
        this.executeBR();
        break;
      case 1: // ADD
        this.executeADD();
        break;
      case 2: // LD
        this.executeLD();
        break;
      case 3: // ST
        this.executeST();
        break;
      case 4: // BL or BLR
        this.executeBLorBLR();
        break;
      case 5: // AND
        this.executeAND();
        break;
      case 6: // LDR
        this.executeLDR();
        break;
      case 7: // STR
        this.executeSTR();
        break;
      case 8: // CMP
        console.log("compare not yet implemented");
        break;
      case 9: // NOT
        this.executeNOT();
        break;
      case 10: // PUSH, POP, SRL, SRA, SLL, ROL, ROR, MUL, DIV, REM, OR, XOR, MVR, SEXT
        this.executeCase10();
        break;
      case 11: // SUB
        this.executeSUB();
        break;
      case 12: // JMP/RET
        this.executeJMP();
        break;
      case 13: // MVI
        this.executeMVI();
        break;
      case 14: // LEA
        this.executeLEA();
        break;
      case 15: // TRAP
        this.executeTRAP();
        break;
      default:
        this.error(`Unknown opcode: ${this.opcode}`);
        this.running = false;
    }

    this.instructionsExecuted++;

    // Track max stack size
    let sp = this.r[6];
    let stackSize = this.spInitial - sp;
    if (stackSize > this.maxStackSize) {
      this.maxStackSize = stackSize;
    }
  }

  executeBR() {
    let conditionMet = false;
    switch (this.code) {
      case 0: // brz
        conditionMet = this.z === 1;
        break;
      case 1: // brnz
        conditionMet = this.z === 0;
        break;
      case 2: // brn
        conditionMet = this.n === 1;
        break;
      case 3: // brp
        conditionMet = this.n === this.z;
        break;
      case 4: // brlt
        conditionMet = this.n !== this.v;
        break;
      case 5: // brgt
        conditionMet = this.n === this.v && this.z === 0;
        break;
      case 6: // brc
        conditionMet = this.c === 1;
        break;
      case 7: // br (always)
        conditionMet = true;
        break;
    }
    if (conditionMet) {
      this.pc = (this.pc + this.pcoffset9) & 0xFFFF;
    }
  }

  executeCase10() {
    // ct is a 4-bit shift count field (if omitted at the assembly level, it defaults to 1). 
    const ct = (this.ir >> 5) & 0xF;

    switch (this.eopcode) {
      case 0: // PUSH // mem[--sp] = sr 
        // decrement stack pointer and store value
        this.r[6] = (this.r[6] - 1) & 0xFFFF;
        // save source register to memory at address pointed at by stack pointer
        this.mem[this.r[6]] = this.r[this.sr];
        break;
      case 1: // POP // dr = mem[sp++];
        // load value from memory at address pointed at by stack pointer to destination
        this.r[this.dr] = this.mem[this.r[6]];
        // increment stack pointer (to deallocate stack memory)
        this.r[6] = (this.r[6] + 1) & 0xFFFF;
        break;
      case 2: // SRL ////
        this.r[this.sr] = this.r[this.sr] >> ct;
        this.setNZ(this.r[this.sr]);
        break;
      case 3: // SRA ////
        this.r[this.sr] = this.r[this.sr] >> ct;
        this.setNZ(this.r[this.sr]);
        break;
      case 4: // SLL ////
        this.r[this.sr] = this.r[this.sr] << ct;
        this.setNZ(this.r[this.sr]);
        break;
      case 5: // ROL ////
        this.r[this.sr] = (this.r[this.sr] << ct) | (this.r[this.sr] >> (16 - ct));
        this.setNZ(this.r[this.sr]);
        break;
      case 6: // ROR ////
        this.r[this.sr] = (this.r[this.sr] >> ct) | (this.r[this.sr] << (16 - ct));
        this.setNZ(this.r[this.sr]);
        break;
      case 7: // MUL ////
        this.r[this.dr] = (this.r[this.dr] * this.r[this.sr1]) & 0xFFFF;
        this.setNZ(this.r[this.dr]);
        break;
      case 8: // DIV ////
        if (this.r[this.sr] === 0) {
          this.error('Division by zero');
        }
        this.r[this.dr] = (this.r[this.dr] / this.r[this.sr1]) & 0xFFFF;
        this.setNZ(this.r[this.dr]);
        break;
      case 9: // REM ////
        if (this.r[this.sr2] === 0) {
          this.error('Division by zero');
        }
        this.r[this.dr] = (this.r[this.dr] % this.r[this.sr1]) & 0xFFFF;
        this.setNZ(this.r[this.dr]);
        break;
      case 10: // OR ////
        this.r[this.dr] = this.r[this.dr] | this.r[this.sr1];
        this.setNZ(this.r[this.dr]);
        break;
      case 11: // XOR ////
        this.r[this.dr] = this.r[this.dr] ^ this.r[this.sr1];
        this.setNZ(this.r[this.dr]);
        break;
      case 12: // MVR
        this.r[this.dr] = this.r[this.sr1];
        break;
      case 13: // SEXT ////
        this.r[this.dr] = this.signExtend(this.r[this.sr1], 16);
        this.setNZ(this.r[this.dr]);
        break;
    }
  }

  executeADD() {
    if (this.bit5 === 0) {
      // Register mode
      const result = (this.r[this.sr1] + this.r[this.sr2]) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.r[this.sr2]);
      this.r[this.dr] = result;
    } else {
      // Immediate mode
      const result = (this.r[this.sr1] + this.imm5) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.imm5);
      this.r[this.dr] = result;
    }
  }

  executeSUB() {
    if (this.bit5 === 0) {
      // Register mode
      const result = (this.r[this.sr1] - this.r[this.sr2]) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.r[this.sr2]);
      this.r[this.dr] = result;
    } else {
      // Immediate mode
      const result = (this.r[this.sr1] - this.imm5) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.imm5);
      this.r[this.dr] = result;
    }
  }

  executeAND() {
    if (this.bit5 !== 0) {
      this.r[this.dr] = this.r[this.sr1] & this.imm5;
    } else {
      this.r[this.dr] = this.r[this.sr1] & this.r[this.sr2];
    }
    this.setNZ(this.r[this.dr]);
  }

  executeNOT() {
    this.r[this.dr] = (~this.r[this.sr1]) & 0xFFFF;
    this.setNZ(this.r[this.dr]);
  }

  executeLD() {
    const address = (this.pc + this.pcoffset9) & 0xFFFF;
    this.r[this.dr] = this.mem[address];
    this.setNZ(this.r[this.dr]);
  }

  ////
  executeST() {
    const address = (this.pc + this.pcoffset9) & 0xFFFF;
    this.mem[address] = this.r[this.sr];
  }

  executeMVI() {
    this.r[this.dr] = this.imm9;
    this.setNZ(this.r[this.dr]);
  }

  executeLEA() {
    this.r[this.dr] = (this.pc + this.pcoffset9) & 0xFFFF;
  }

  ////
  executeLDR() {
    const address = (this.r[this.baser] + this.offset6) & 0xFFFF;
    this.r[this.dr] = this.mem[address];
    this.setNZ(this.r[this.dr]);
  }

  ////
  executeSTR() {
    const address = (this.r[this.baser] + this.offset6) & 0xFFFF;
    this.mem[address] = this.r[this.sr];
  }

  ////
  executeJMP() {
    this.pc = (this.r[this.baser] + this.offset6) & 0xFFFF;
  }

  executeBLorBLR() {
    if (this.bit11 !== 0) {
      // BL (Branch and Link)
      this.r[7] = this.pc;
      this.pc = (this.pc + this.pcoffset11) & 0xFFFF;
    } else {
      // BLR (Branch and Link Register)
      this.r[7] = this.pc;
      this.pc = (this.r[this.baser] + this.offset6) & 0xFFFF;
    }
  }

  executeSOUT() {
    let address = this.r[this.sr];
    let charCode = this.mem[address];
    while (charCode !== 0) {
      const char = String.fromCharCode(charCode);
      process.stdout.write(char);
      this.output += char;
      address = (address + 1) & 0xFFFF;
      charCode = this.mem[address];
    }
  }

  readLineFromStdin() {
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
    //// console.log("input is: ", input);
    return input;
  }
  

  executeSIN() {
    let address = this.r[this.sr];
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

    // Echo the input back to buffer output
    this.output += input + "\n";

    for (let i = 0; i < input.length; i++) {
      this.mem[address] = input.charCodeAt(i);
      address = (address + 1) & 0xFFFF;
    }
    // Null-terminate the string
    this.mem[address] = 0;
  }

  executeTRAP() {
    switch (this.trapvec) {
      case 0: // HALT
        this.running = false;
        break;
      case 1: // NL
        process.stdout.write('\n');
        this.output += '\n';
        break;
      case 2:// DOUT
        let value = this.r[this.sr];
        // Convert unsigned 16-bit to signed 16-bit
        if (value & 0x8000) {
            value -= 0x10000;
        }
        const doutStr = `${value}`;
        process.stdout.write(doutStr);
        this.output += doutStr;
        break;
      case 3: // UDOUT
        // print as unsigned decimal
        const udoutStr = `${this.r[this.sr] & 0xFFFF}`;
        process.stdout.write(udoutStr);
        this.output += udoutStr;
        break;
      case 4: // HOUT
        // print as hexadecimal
        const houtStr = this.r[this.sr].toString(16).toLowerCase();
        process.stdout.write(houtStr);
        this.output += houtStr;
        break;
      case 5: // AOUT
        // print as ASCII character
        const aoutChar = String.fromCharCode(this.r[this.sr] & 0xFF);
        process.stdout.write(aoutChar);
        this.output += aoutChar;
        break;
      case 6: // SOUT
        // print string at address
        this.executeSOUT();
        break;
      case 7: // DIN
        // read in a signed decimal number from keyboard into dr
        let dinInput = this.readLineFromStdin();
        let dinValue = parseInt(dinInput, 10);
        if (isNaN(dinValue)) {
          this.error('Invalid decimal input');
        } else {
          this.r[this.dr] = dinValue & 0xFFFF;
        }
        break;
      case 8: // HIN
        // Read hex number from keyboard into dr
        let hinInput = this.readLineFromStdin();
        let hinValue = parseInt(hinInput, 16);
        //// console.log("hinValue is: ", hinValue);
        if (isNaN(hinValue)) {
          this.error('Invalid hexadecimal input');
        } else {
          //// console.log("hinValue & 0xFFFF is: ", hinValue & 0xFFFF);
          this.r[this.dr] = hinValue & 0xFFFF;
          //// console.log("r[dr] is: ", this.r[this.dr]);
        }
        break;
      case 9: // AIN
        // read in a single ASCII character from keyboard into dr
        let ainBuffer = Buffer.alloc(1);
        let fd = process.stdin.fd;
        let ainBytesRead = 0;
        
        // Keep trying to read until we get a character
        while (ainBytesRead === 0) {
          try {
            ainBytesRead = fs.readSync(fd, ainBuffer, 0, 1, null);
          } catch (err) {
            if (err.code === 'EAGAIN') {
              // If resource is temporarily unavailable, just continue trying
              continue;
            } else {
              // For any other error, throw it
              throw err;
            }
          }
        }
        
        // If we got here, we successfully read a character
        let ainChar = ainBuffer.toString('utf8');
        this.r[this.dr] = ainChar.charCodeAt(0);
        
        // Echo the character back to the output
        this.output += ainChar;

        // Clear the input buffer by reading until newline or carriage return
        let clearBuffer = Buffer.alloc(1);
        while (true) {
          try {
            let bytesRead = fs.readSync(fd, clearBuffer, 0, 1, null);
            if (bytesRead === 0) break; // EOF
            let char = clearBuffer.toString('utf8');
            if (char === '\n' || char === '\r') {
              this.output += '\n'; // Add newline to output
              break;
            }
          } catch (err) {
            if (err.code === 'EAGAIN') {
              continue;
            } else {
              throw err;
            }
          }
        }
        break;
      case 10: // SIN
        // read a line of input from the user
        this.executeSIN();
        break;
      default:
        this.error(`Unknown TRAP vector: ${this.trapvec}`);
        this.running = false;
    }
  }

  setNZ(value) {
    value = value & 0xFFFF; // Ensure 16-bit value
    this.n = (value & 0x8000) ? 1 : 0;
    this.z = (value === 0) ? 1 : 0;
  }

  setCV(sum, x, y) {
    // Carry flag
    this.c = ((x + y) & 0x10000) ? 1 : 0;
    // Overflow flag
    const sx = (x & 0x8000) >> 15;
    const sy = (y & 0x8000) >> 15;
    const ss = (sum & 0x8000) >> 15;
    this.v = (sx === sy && sx !== ss) ? 1 : 0;
  }

  signExtend(value, bitCount) {
    if ((value >> (bitCount - 1)) & 1) {
      value |= (~0 << bitCount);
    }
    return value & 0xFFFF;
  }

  error(message) {
    console.error(`Interpreter Error: ${message}`);
    this.running = false;
  }
}

// Instantiate and run the interpreter if this script is run directly
if (require.main === module) {
  const interpreter = new Interpreter();
  interpreter.main();
}

module.exports = Interpreter;