#!/usr/bin/env node

// interpreter.js

const fs = require('fs');
const path = require('path');
const { generateBSTLSTContent } = require('./genStats.js');
const nameHandler = require('./name.js');

const MAX_MEMORY = 65536; // 2^16

class Interpreter {
  constructor() {
    this.mem = new Uint16Array(65536); // Memory (16-bit unsigned integers)
    this.r = new Uint16Array(8);       // Registers r0 to r7 (16-bit signed integers)
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
    this.instructionsExecuted = 0;     // For program statistics
    this.maxStackSize = 0;             // For program statistics
    this.loadPoint = 0;                // For program statistics
    this.spInitial = 0;                // For tracking stack size
    this.memMax = 0;                   // Keep track of the highest memory address used
    this.inputFileName = '';           // Name of the input file
    this.generateStats = false;        // Whether to generate .lst and .bst files
    this.headerLines = [];
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length !== 1) {
      console.error('Usage: node interpreter.js <input filename>');
      process.exit(1);
    }

    const inputFileName = args[0];
    this.inputFileName = inputFileName; // Set inputFileName

    // Get the userName using nameHandler
    try {
      this.userName = nameHandler.createNameFile(this.inputFileName);
    } catch (error) {
      console.error('Error handling name file:', error.message);
      process.exit(1);
    }
    
    // this prints out when called by interpreter.js
    console.log(`Starting interpretation of ${inputFileName}`);

    // Open and read the executable file
    let buffer;
    try {
      buffer = fs.readFileSync(inputFileName);
    } catch (err) {
      console.error(`Cannot open input file ${inputFileName}`);
      process.exit(1);
    }

    // Check file signature
    if (buffer[0] !== 'o'.charCodeAt(0)) {
      console.error(`${inputFileName} is not a valid LCC executable file: missing 'o' signature`);
      process.exit(1);
    }

    // Load the executable into memory
    this.loadExecutableBuffer(buffer);

    // Capture the initial memory state
    this.initialMem = this.mem.slice(); // Makes a copy of the memory array

    // Prepare .lst and .bst file names
    const lstFileName = inputFileName.replace(/\.e$/, '.lst');
    const bstFileName = inputFileName.replace(/\.e$/, '.bst');
    console.log(`lst file = ${lstFileName}`);
    console.log(`bst file = ${bstFileName}`);
    console.log('====================================================== Output');

    // Run the interpreter
    try {
      this.run();
      console.log(); // Ensure cursor moves to the next line
    } catch (error) {
      console.error(`Runtime Error: ${error.message}`);
      process.exit(1);
    }

    // Generate .lst and .bst files if required
    if (this.generateStats) {
      const lstContent = generateBSTLSTContent({
        isBST: false,
        interpreter: this,
        assembler: null,
        userName: this.userName,
        inputFileName: this.inputFileName,
      });

      const bstContent = generateBSTLSTContent({
        isBST: true,
        interpreter: this,
        assembler: null,
        userName: this.userName,
        inputFileName: this.inputFileName,
      });

      // Write the .lst and .bst files
      fs.writeFileSync(lstFileName, lstContent);
      fs.writeFileSync(bstFileName, bstContent);
    }
  }

  constructBSTLSTFileName(inputFileName, isBST) {
    const parsedPath = path.parse(inputFileName);
    // Remove extension and add '.bst'
    return path.format({ ...parsedPath, base: undefined, ext: isBST ? '.bst' : '.lst' });
  }

  generateBSTLSTContent(isBST) {
    let content = '';

    // Compute the maximum label length
    let maxLabelLength = 0;
    this.assembler.listing.forEach(entry => {
      if (entry.label) {
        maxLabelLength = Math.max(maxLabelLength, entry.label.length);
      }
    });

    // If no labels, default indent for code is 4 spaces
    let codeIndent = maxLabelLength > 0 ? maxLabelLength + 2 : 4;

    // Header
    content += `LCC.js Assemble/Link/Interpret/Debug Ver 0.1  ${new Date().toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}\n`;
    content += `${this.userName}\n\n`;

    content += 'Header\n';
    content += 'o\n'
    
    if(this.headerLines && this.headerLines.length > 0) {
      for(let i = 0; i < this.headerLines.length; i++) {
        content += `${this.headerLines[i]}\n`;
      }
    }

    content +='C\n\n';

    content += 'Loc          Code                   Source Code\n';

    if (this.assembler.errorFlag) {
      // Output errors
      this.assembler.errors.forEach(error => {
        content += `${error}\n`;
      });
    } else {

      // Output listing
      this.assembler.listing.forEach(entry => {
        let locCtr = entry.locCtr;

        const labelStr = entry.label ? entry.label + ':' : '';
        const mnemonicAndOperands = entry.mnemonic ? entry.mnemonic + ' ' + entry.operands.join(', ') : '';
        // Prepare the sourceStr
        const sourceStr = (labelStr + ' ' + mnemonicAndOperands).trim();

        entry.codeWords.forEach((word, index) => {

          const locStr = locCtr.toString(16).padStart(4, '0');
          const wordStr = isBST ?
            word.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim() :
            word.toString(16).padStart(4, '0');
          const codeStr = wordStr.padEnd(23);

          if (index === 0) {
            // For the first word, include the source code
            // Prepare the label part, padded to codeIndent
            let labelPart = '';
            if (entry.label) {
              labelPart = entry.label + ':';
              labelPart = labelPart.padEnd(codeIndent);
            } else {
              labelPart = ' '.repeat(codeIndent);
            }

            const lineStr = `${locStr}  ${codeStr}${labelPart}${mnemonicAndOperands}\n`;
            content += lineStr;
          } else {
            // For subsequent words, no label or source code
            content += `${locStr}  ${codeStr}\n`;
          }

          locCtr++; // Increment location counter for each word
        });

        // Insert a blank line after the 'halt' instruction
        if (entry.mnemonic && entry.mnemonic.toLowerCase() === 'halt') {
          content += '\n';
        }
      });

    }

    // Output section
    content += '====================================================== Output\n';
    content += `${this.interpreter.output}\n`;

    // Program statistics
    content += '========================================== Program statistics\n';

    // Prepare the statistics
    const stats = [
      { label: 'Input file name', value: this.inputFileName },
      { label: 'Instructions executed', value: `${this.interpreter.instructionsExecuted.toString(16)} (hex)    ${this.interpreter.instructionsExecuted} (dec)` },
      { label: 'Program size', value: `${this.assembler.programSize.toString(16)} (hex)    ${this.assembler.programSize} (dec)` },
      { label: 'Max stack size', value: `${this.interpreter.maxStackSize.toString(16)} (hex)    ${this.interpreter.maxStackSize} (dec)` },
      { label: 'Load point', value: `${this.assembler.loadPoint.toString(16)} (hex)    ${this.assembler.loadPoint} (dec)` }
    ];

    const maxStatLabelLength = Math.max(...stats.map(s => s.label.length));

    stats.forEach(stat => {
      const label = stat.label.padEnd(maxStatLabelLength + 4); // Add 4 spaces for padding
      content += `${label}=   ${stat.value}\n`;
    });


    return content;
  }

  // for use in lcc.js
  // makes sure that the file is a valid executable file by checking 
  // for the "o" file signature and "C" header termination character
  loadExecutableFile(fileName) {
    let buffer;
    try {
      buffer = fs.readFileSync(fileName);
    } catch (err) {
      console.error(`Cannot open input file ${fileName}`);
      process.exit(1);
    }

    // Check file signature: look for "o" followed by "C" anywhere in the buffer
    let foundO = false;
    let foundC = false;

    for (let offset = 0; offset < buffer.length; offset++) {
      const char = String.fromCharCode(buffer[offset]);

      // Look for the starting "o"
      if (!foundO && char === 'o') {
        foundO = true;
      } 
      // Once "o" is found, look for the "C" as the end of the header
      else if (foundO && char === 'C') {
        foundC = true;
        break;
      }
    }

    // If either "o" or "C" was not found in the expected order, throw an error
    if (!foundO || !foundC) {
      console.error(`${fileName} is not a valid LCC executable file`);
      process.exit(1);
    }

    // this prints out when called by lcc.js
    console.log(`Starting interpretation of ${fileName}`);

    // Load the executable into memory
    this.loadExecutableBuffer(buffer);
  }

  // extracts header entries and loads machine code into memory
  loadExecutableBuffer(buffer) {
    let offset = 0;
  
    // Read file signature
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      this.error('Invalid file signature: missing "o"');
      return;
    }

    // Do not store the 'o' signature in headerLines
  
    let startAddress = 0; // Default start address
    let headerEndFound = false;
  
    // Read header entries until 'C' is encountered
    while (offset < buffer.length) {
      const entryChar = String.fromCharCode(buffer[offset++]);
  
      if (entryChar === 'C') {
        // Start of code
        headerEndFound = true;
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
  
    // Read machine code into memory starting at address 0
    let memIndex = 0;
    while (offset + 1 < buffer.length) {
      const instruction = buffer.readUInt16LE(offset);
      offset += 2;
      this.mem[memIndex++] = instruction;
    }

    this.memMax = memIndex - 1; // Last memory address used

    // Set PC to start address
    this.pc = startAddress;
    this.loadPoint = startAddress; // Store the load point for stats
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
        this.executeCMP();
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

    // Check if the instruction limit has been reached
    // Note: This is a safety feature to prevent infinite loops
    // 2nd Note: This matches exactly the # of instructions 
    // permitted to run by from the lcc before entering the debugger
    if (this.instructionsExecuted >= 500000) {
      console.error("Possible infinite loop");
      this.running = false;
      return; // Exit the step method early
    }

    // Track max stack size
    let sp = this.r[6];
    let stackSize = sp === 0 ? 0 : MAX_MEMORY - sp;
    if (stackSize > this.maxStackSize) {
      this.maxStackSize = stackSize;
    }
  }

  executeCMP() {
    if (this.bit5 === 0) {
      // Register mode
      const result = (this.r[this.sr1] - this.r[this.sr2]) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.r[this.sr2]);
    } else {
      // Immediate mode
      const result = (this.r[this.sr1] - this.imm5) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.imm5);
    }
  }

  executeBR() {
    let conditionMet = false;
    switch (this.code) {
      case 0: // brz/bre
        conditionMet = this.z === 1;
        break;
      case 1: // brnz/brne
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
      case 6: // brc/brb
        conditionMet = this.c === 1;
        break;
      case 7: // br/bral
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

  executeST() {
    const address = (this.pc + this.pcoffset9) & 0xFFFF;
    this.mem[address] = this.r[this.sr];
    if (address > this.memMax) this.memMax = address;
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
      this.writeOutput(char);
      address = (address + 1) & 0xFFFF;
      charCode = this.mem[address];
    }
  }

  readLineFromStdin() {
    if (this.inputBuffer && this.inputBuffer.length > 0) {
      // Use the inputBuffer to simulate user input
      const newlineIndex = this.inputBuffer.indexOf('\n');
      let inputLine = '';
      if (newlineIndex !== -1) {
        inputLine = this.inputBuffer.slice(0, newlineIndex);
        this.inputBuffer = this.inputBuffer.slice(newlineIndex + 1);
      } else {
        inputLine = this.inputBuffer;
        this.inputBuffer = '';
      }
      // Echo the simulated input back to output and stdout
      ///// this.writeOutput(inputLine + '\n');
      this.writeOutput(inputLine);
      return { inputLine, isSimulated: true };
    } else {
      // Original code for reading from stdin
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
      return { inputLine: input, isSimulated: false };
    }
  }

  readCharFromStdin() {
    if (this.inputBuffer && this.inputBuffer.length > 0) {
      let ainChar = this.inputBuffer.charAt(0);
      this.inputBuffer = this.inputBuffer.slice(1);
      // Echo the simulated input back to output and stdout
      this.writeOutput(ainChar + "\n");
      return { char: ainChar, isSimulated: true };
    } else {
      // Read one character from stdin
      let ainBuffer = Buffer.alloc(1);
      let fd = process.stdin.fd;
      let ainBytesRead = 0;
  
      // Keep trying to read until we get a character
      while (ainBytesRead === 0) {
        try {
          ainBytesRead = fs.readSync(fd, ainBuffer, 0, 1, null);
        } catch (err) {
          if (err.code === 'EAGAIN') {
            continue;
          } else {
            throw err;
          }
        }
      }
  
      // If we got here, we successfully read a character
      let ainChar = ainBuffer.toString('utf8');
      return { char: ainChar, isSimulated: false };
    }
  }  

  executeSIN() {
    let address = this.r[this.sr];
    let { inputLine: input, isSimulated } = this.readLineFromStdin();
  
    for (let i = 0; i < input.length; i++) {
      this.mem[address] = input.charCodeAt(i);
      address = (address + 1) & 0xFFFF;
    }
    // Null-terminate the string
    this.mem[address] = 0;

    // add newline here if input is simulated
    if (isSimulated) {
      this.writeOutput("\n");
    }
  }  

  executeM() {
    for (let addr = 0; addr <= this.memMax; addr++) {
      const content = this.mem[addr];
      const line = `${addr.toString(16).padStart(4, '0')}: ${content.toString(16).padStart(4, '0')}`;
      this.writeOutput(line + '\n');
    }
  }

  executeR() {
    const pcStr = this.pc.toString(16).padStart(4, '0');
    const irStr = this.ir.toString(16).padStart(4, '0');
    const nzcvStr = `${this.n}${this.z}${this.c}${this.v}`.padStart(4, '0');
    let output = `pc = ${pcStr}  ir = ${irStr}  NZCV = ${nzcvStr}\n`;
    // First line: r0 to r3
    for (let i = 0; i <= 3; i++) {
        const regStr = this.r[i].toString(16).padStart(4, '0');
        output += `r${i} = ${regStr}  `;
    }
    output += '\n';
    // Second line: r4, fp, sp, lr
    const r4Str = this.r[4].toString(16).padStart(4, '0');
    const fpStr = this.r[5].toString(16).padStart(4, '0');
    const spStr = this.r[6].toString(16).padStart(4, '0');
    const lrStr = this.r[7].toString(16).padStart(4, '0');
    output += `r4 = ${r4Str}  fp = ${fpStr}  sp = ${spStr}  lr = ${lrStr}  \n`;
    this.writeOutput(output);
  }

  executeS() {
    let sp = this.r[6];
    let fp = this.r[5];
  
    if (sp === this.spInitial) {
      this.writeOutput('Stack empty');
      return;
    } else {
      this.writeOutput("Stack:\n");
  
      for (let addr = sp; addr < MAX_MEMORY; addr++) {
        let value = this.mem[addr];
        let addrStr = addr.toString(16).padStart(4, '0');
        let valueStr = value.toString(16).padStart(4, '0');
        let line = `${addrStr}: ${valueStr}`;
        if (addr === fp) {
          line += ' <--- fp';
        }
        this.writeOutput(line + '\n');
      }
      // Add a newline at the end to match the sample output
      this.writeOutput('\n');
    }
  }
  
  writeOutput(message) {
    process.stdout.write(message);
    this.output += message;
  }

  executeTRAP() {
    switch (this.trapvec) {
      case 0: // HALT
        this.running = false;
        break;
      case 1: // NL
        this.writeOutput('\n');
        break;
      case 2:// DOUT
        let value = this.r[this.sr];
        // Convert unsigned 16-bit to signed 16-bit
        if (value & 0x8000) {
            value -= 0x10000;
        }
        const doutStr = `${value}`;
        this.writeOutput(doutStr);
        break;
      case 3: // UDOUT
        // print as unsigned decimal
        const udoutStr = `${this.r[this.sr] & 0xFFFF}`;
        this.writeOutput(udoutStr);
        break;
      case 4: // HOUT
        // print as hexadecimal
        const houtStr = this.r[this.sr].toString(16).toLowerCase();
        this.writeOutput(houtStr);
        break;
      case 5: // AOUT
        // print as ASCII character
        const aoutChar = String.fromCharCode(this.r[this.sr] & 0xFF);
        this.writeOutput(aoutChar);
        break;
      case 6: // SOUT
        // print string at address
        this.executeSOUT();
        break;
      case 7: // DIN
        while (true) {
          let { inputLine: dinInput, isSimulated } = this.readLineFromStdin();
      
          if (dinInput.trim() === '') {
            continue;
          }
      
          let dinValue = parseInt(dinInput, 10);
          if (isNaN(dinValue)) {
            const errorMsg = 'Invalid dec constant. Re-enter:\n';
            this.writeOutput(errorMsg);
            continue;
          } else {
            this.r[this.dr] = dinValue & 0xFFFF;
            // No need to echo input here; already handled in readLineFromStdin()
            //// unless input is simulated
            if (isSimulated) {
              this.writeOutput("\n");
            }
            break;
          }
        }
        break;      
      case 8: // HIN
        while (true) {
          let { inputLine: hinInput, isSimulated } = this.readLineFromStdin();
      
          if (hinInput.trim() === '') {
            continue;
          }
      
          let hinValue = parseInt(hinInput, 16);
          if (isNaN(hinValue)) {
            const errorMsg = 'Invalid hex constant. Re-enter:\n';
            this.writeOutput(errorMsg);
            continue;
          } else {
            this.r[this.dr] = hinValue & 0xFFFF;
            // No need to echo input here; already handled in readLineFromStdin()
            //// unless input is simulated
            if (isSimulated) {
              this.writeOutput("\n");
            }
            break;
          }
        }
        break;            
      case 9: // AIN
        let { char: ainChar, isSimulated } = this.readCharFromStdin();
        this.r[this.dr] = ainChar.charCodeAt(0);
        // No need to echo input here; already handled in readCharFromStdin()
        break;
      case 10: // SIN
        // read a line of input from the user
        this.executeSIN();
        break;
      case 11: // m
        this.executeM();
        break;
      case 12: // r
        this.executeR();
        break;
      case 13: // s
        this.executeS();
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
  interpreter.generateStats = true; // Set to generate .lst and .bst files
  interpreter.main();
}

module.exports = Interpreter;