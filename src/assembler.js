#!/usr/bin/env node

// assembler.js
// LCC.js Assembler
// Adjusted to handle file input/output similar to a1.c

const fs = require('fs');
const path = require('path');

class Assembler {
  constructor() {
    this.symbolTable = {}; // symbol: address
    this.locCtr = 0; // Location counter
    this.lineNum = 0; // Line number
    this.sourceLines = []; // Array of source code lines
    this.errorFlag = false; // Error flag
    this.pass = 1; // Current pass (1 or 2)
    this.labels = new Set(); // Set of labels to detect duplicates
    this.errors = []; // Collect errors
    this.outputBuffer = []; // Buffer to hold machine code words
    this.inputFileName = ''; // Input file name
    this.outputFileName = ''; // Output file name
    this.outFile = null; // Output file handle
    this.listing = []; // This will store information about each line, including the location counter (locCtr), machine code words, and the source code line.
    this.loadPoint = 0;
    this.programSize = 0;
  }

  main(args) {
    args = args || process.argv.slice(2);

    // Check if inputFileName is already set
    if (!this.inputFileName) {
      if (args.length !== 1) {
        console.error('Usage: assembler.js <input filename>');
        process.exit(1);
      }
      this.inputFileName = args[0];
    }

    // Read the source code from the input file
    try {
      const sourceCode = fs.readFileSync(this.inputFileName, 'utf-8');
      this.sourceLines = sourceCode.split('\n');
    } catch (err) {
      console.error(`Cannot open input file ${this.inputFileName}`);
      process.exit(1);
    }

    // Construct the output file name by replacing extension with '.e'
    this.outputFileName = this.constructOutputFileName(this.inputFileName);

    // Open the output file for writing in binary mode
    try {
      this.outFile = fs.openSync(this.outputFileName, 'w');
    } catch (err) {
      console.error(`Cannot open output file ${this.outputFileName}`);
      process.exit(1);
    }

    // Write the initial header 'oC' to the output file
    fs.writeSync(this.outFile, 'oC');

    // Perform Pass 1
    console.log('Starting assembly pass 1');
    this.pass = 1;
    this.locCtr = 0;
    this.lineNum = 0;
    this.errorFlag = false;
    this.symbolTable = {};
    this.labels.clear();
    this.errors = [];
    this.performPass();

    if (this.errorFlag) {
      // console.error('Errors encountered during Pass 1.');
      // this.errors.forEach(error => console.error(error));
      process.exit(1);
    }

    // Rewind source lines for Pass 2
    console.log('Starting assembly pass 2');
    this.pass = 2;
    this.locCtr = 0;
    this.lineNum = 0;
    this.performPass();

    if (this.errorFlag) {
      // console.error('Errors encountered during Pass 2.');
      // this.errors.forEach(error => console.error(error));
      fs.closeSync(this.outFile);
      process.exit(1);
    }

    // Close the output file
    fs.closeSync(this.outFile);
    // console.log('Pass 2 completed');
  }

  constructOutputFileName(inputFileName) {
    const parsedPath = path.parse(inputFileName);
    // Remove extension and add '.e'
    return path.format({ ...parsedPath, base: undefined, ext: '.e' });
  }

  performPass() {
    // At the beginning of Pass 1
    if (this.pass === 1) {
      this.loadPoint = this.locCtr;
    }

    for (let line of this.sourceLines) {
      this.lineNum++;
      let originalLine = line;
      this.currentLine = originalLine; // Store current line for error reporting
      // Remove comments and trim whitespace
      line = line.split(';')[0].trim();
      if (line === '') continue;

      // Tokenize the line
      let tokens = this.tokenizeLine(line);
      if (tokens.length === 0) continue;

      let label = null;
      let mnemonic = null;
      let operands = [];

      // Check if line starts with a label
      if (!this.isWhitespace(originalLine[0])) {
        label = tokens.shift();
        if (this.pass === 1) {
          if (this.labels.has(label)) {
            this.error(`Duplicate label: ${label}`);
          } else {
            this.symbolTable[label] = this.locCtr;
            this.labels.add(label);
          }
        }
      }

      if (tokens.length > 0) {
        mnemonic = tokens.shift().toLowerCase();
      } else {
        continue; // No mnemonic, skip line
      }

      operands = tokens;

      // Create listing entry
      const listingEntry = {
        lineNum: this.lineNum,
        locCtr: this.locCtr,
        sourceLine: originalLine,
        codeWords: [],
        label: label,
        mnemonic: mnemonic,
        operands: operands
      };
      this.currentListingEntry = listingEntry;

      // Handle directives and instructions
      if (mnemonic.startsWith('.')) {
        // Directive
        this.handleDirective(mnemonic, operands);
      } else {
        // Instruction
        this.handleInstruction(mnemonic, operands);
      }

      if (this.locCtr > 65536) {
        this.error('Program too big');
        return;
      }

      // At the end of processing the line
      if (this.pass === 2) {
        this.listing.push(listingEntry);
      }
    }

    // At the end of Pass 2
    if (this.pass === 2) {
      this.programSize = this.locCtr - this.loadPoint;
    }
  }

  tokenizeLine(line) {
    let tokens = [];
    let currentToken = '';
    let inString = false;
    let stringDelimiter = '';

    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringDelimiter = char;
        currentToken += char;
      } else if (char === stringDelimiter && inString) {
        inString = false;
        currentToken += char;
        tokens.push(currentToken);
        currentToken = '';
      } else if (inString) {
        currentToken += char;
      } else if (this.isWhitespace(char)) {
        if (currentToken !== '') {
          tokens.push(currentToken);
          currentToken = '';
        }
      } else if (char === ',' && !inString) {
        if (currentToken !== '') {
          tokens.push(currentToken);
          currentToken = '';
        }
      } else if (char === ':') {
        if (currentToken !== '') {
          tokens.push(currentToken);
          currentToken = '';
        }
        // Ignore colon
      } else {
        currentToken += char;
      }
    }

    if (currentToken !== '') {
      tokens.push(currentToken);
    }

    return tokens;
  }

  isWhitespace(char) {
    return /\s/.test(char);
  }

  isStringLiteral(str) {
    return /^"(.*)"$/.test(str) || /^'(.*)'$/.test(str);
  }

  handleDirective(mnemonic, operands) {
    mnemonic = mnemonic.toLowerCase();
    switch (mnemonic) {
      case '.zero':
        if (operands.length !== 1) {
          this.error(`Invalid operand count for ${mnemonic}`);
          return;
        }
        let num = parseInt(operands[0], 10);
        if (isNaN(num) || num < 1 || num > (65536 - this.locCtr)) {
          this.error(`Invalid operand for ${mnemonic}`);
          return;
        }
        if (this.pass === 2) {
          for (let i = 0; i < num; i++) {
            this.writeMachineWord(0);
          }
        }
        this.locCtr += num;
        break;
      case '.word':
        if (operands.length !== 1) {
          this.error(`Invalid operand count for ${mnemonic}`);
          return;
        }
        if (this.pass === 2) {
          let value = this.evaluateOperand(operands[0]);
          if (value === null) return;
          if (value > 65535 || value < -32768) {
            this.error('Data does not fit in 16 bits');
            return;
          }
          this.writeMachineWord(value & 0xFFFF);
        }
        this.locCtr += 1;
        break;
      case '.string':
        if (operands.length !== 1) {
          this.error(`Invalid operand count for ${mnemonic}`);
          return;
        }
        let strOperand = operands[0];
        if (!this.isStringLiteral(strOperand)) {
          this.error(`Invalid string literal: ${strOperand}`);
          return;
        }
        // Extract the string without quotes
        let strContent = strOperand.slice(1, -1);

        if (this.pass === 1) {
          // Update location counter: length of string + 1 for null terminator
          this.locCtr += strContent.length + 1;
        } else if (this.pass === 2) {
          // Write each character's ASCII code to output
          for (let i = 0; i < strContent.length; i++) {
            let asciiValue = strContent.charCodeAt(i);
            this.writeMachineWord(asciiValue);
            this.locCtr += 1; // Increment locCtr after writing each word
          }
          // Write null terminator
          this.writeMachineWord(0);
          this.locCtr += 1; // Increment locCtr for null terminator
        }
        break;
      default:
        this.error(`Invalid directive: ${mnemonic}`);
        break;
    }
  }

  handleInstruction(mnemonic, operands) {
    if (this.pass === 1) {
      this.locCtr += 1;
      return;
    }

    let machineWord = null;
    mnemonic = mnemonic.toLowerCase();
    switch (mnemonic) {
      case 'br':
      case 'brz':
      case 'brnz':
      case 'brn':
      case 'brp':
      case 'brlt':
      case 'brgt':
      case 'brc':
        machineWord = this.assembleBR(mnemonic, operands);
        break;
      case 'add':
        machineWord = this.assembleAdd(operands);
        break;
      case 'mov':
      case 'mvi':
      case 'mvr':
        machineWord = this.assembleMOV(mnemonic, operands);
        break;
      case 'push':
        machineWord = this.assemblePUSH(operands);
        break;
      case 'pop':
        machineWord = this.assemblePOP(operands);
        break;
      case 'ld':
        machineWord = this.assembleLd(operands);
        break;
      case 'st':
        machineWord = this.assembleSt(operands);
        break;
      case 'call':
      case 'jsr':
      case 'bl':
        machineWord = this.assembleBL(operands);
        break;
      case 'jsrr':
      case 'blr':
        machineWord = this.assembleBLR(operands);
        break;
      case 'and':
        machineWord = this.assembleAnd(operands);
        break;
      case 'ldr':
        machineWord = this.assembleLDR(operands);
        break;
      case 'str':
        machineWord = this.assembleSTR(operands);
        break;
      case 'jmp':
        machineWord = this.assembleJMP(operands);
        break;
      case 'ret':
        machineWord = this.assembleRET(operands);
        break;
      case 'not':
        machineWord = this.assembleNOT(operands);
        break;
      case 'lea':
        machineWord = this.assembleLea(operands);
        break;
      case 'cea':
        console.log("CEA is not supported yet");
      // machineWord = this.assembleCEA(operands);
      // break;
      case 'halt':
        machineWord = 0xF000;
        break;
      case 'nl':
        machineWord = 0xF001;
        break;
      case 'dout':
        machineWord = this.assembleTrap(operands, 0x0002);
        break;
      case 'udout':
        machineWord = this.assembleTrap(operands, 0x0003);
        break;
      case 'hout':
        machineWord = this.assembleTrap(operands, 0x0004);
        break;
      case 'aout':
        machineWord = this.assembleTrap(operands, 0x0005);
        break;
      case 'sout':
        machineWord = this.assembleTrap(operands, 0x0006); // Trap vector for sout is 6
        break;
      case 'din':
        machineWord = this.assembleTrap(operands, 0x0007); // Trap vector for din is 7
        break;
      case 'hin':
        machineWord = this.assembleTrap(operands, 0x0008); // Trap vector for hin is 8
        break;
      case 'ain':
        machineWord = this.assembleTrap(operands, 0x0009); // Trap vector for ain is 9
        break;
      case 'sin':
        machineWord = this.assembleTrap(operands, 0x000A); // Trap vector for sin is 10
        break;
      default:
        this.error(`Invalid mnemonic or directive: ${mnemonic}`);
        return;
    }

    if (machineWord !== null) {
      this.writeMachineWord(machineWord);
      this.locCtr += 1;
    }
  }

  writeMachineWord(word) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(word, 0);
    fs.writeSync(this.outFile, buffer);

    if (this.pass === 2 && this.currentListingEntry) {
      this.currentListingEntry.codeWords.push(word);
    }
  }

  assembleBR(mnemonic, operands) {
    if (operands.length !== 1) {
      this.error(`Invalid operand count for ${mnemonic}`);
      return null;
    }
    let codes = {
      'br': 0x0E00,
      'brz': 0x0000,
      'brnz': 0x0200,
      'brn': 0x0400,
      'brp': 0x0600,
      'brlt': 0x0800,
      'brgt': 0x0A00,
      'brc': 0x0C00,
    };
    let macword = codes[mnemonic.toLowerCase()];
    let address = this.getSymbolAddress(operands[0]);
    if (address === null) return null;
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range for branch');
      return null;
    }
    macword |= (pcoffset9 & 0x01FF);
    return macword;
  }

  assembleAdd(operands) {
    if (operands.length !== 3) {
      this.error('Invalid operand count for add');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) return null;
    let sr2orImm5 = operands[2];
    let macword = 0x1000 | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      if (sr2 === null) return null;
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15);
      if (imm5 === null) return null;
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assemblePUSH(operands) {
    if (operands.length !== 1) {
      this.error('Invalid operand count for push');
      return null;
    }
    let sr = this.getRegister(operands[0]);
    if (sr === null) return null;
    let macword = 0xA000 | (sr << 9);
    return macword;
  }

  assemblePOP(operands) {
    if (operands.length !== 1) {
      this.error('Invalid operand count for pop');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    if (dr === null) return null;
    let macword = (0xA000 | (dr << 9)) & 0x0001;
    return macword;
  }

  assembleAnd(operands) {
    if (operands.length !== 3) {
      this.error('Invalid operand count for and');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) return null;
    let sr2orImm5 = operands[2];
    let macword = 0x5000 | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      if (sr2 === null) return null;
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15);
      if (imm5 === null) return null;
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assembleLd(operands) {
    if (operands.length !== 2) {
      this.error('Invalid operand count for ld');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    let label = operands[1];
    if (dr === null) return null;
    let address = this.getSymbolAddress(label);
    if (address === null) return null;
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range for ld');
      return null;
    }
    let macword = 0x2000 | (dr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleSt(operands) {
    if (operands.length !== 2) {
      this.error('Invalid operand count for st');
      return null;
    }
    let sr = this.getRegister(operands[0]);
    let label = operands[1];
    if (sr === null) return null;
    let address = this.getSymbolAddress(label);
    if (address === null) return null;
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range for st');
      return null;
    }
    let macword = 0x3000 | (sr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleLea(operands) {
    if (operands.length !== 2) {
      this.error('Invalid operand count for lea');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    let label = operands[1];
    if (dr === null) return null;
    let address = this.getSymbolAddress(label);
    if (address === null) return null;
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range for lea');
      return null;
    }
    let macword = 0xE000 | (dr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleBL(operands) {
    if (operands.length !== 1) {
      this.error('Invalid operand count for bl');
      return null;
    }
    let address = this.getSymbolAddress(operands[0]);
    if (address === null) return null;
    let pcoffset11 = address - this.locCtr - 1;
    if (pcoffset11 < -1024 || pcoffset11 > 1023) {
      this.error('pcoffset11 out of range for bl');
      return null;
    }
    let macword = 0x4800 | (pcoffset11 & 0x07FF);
    return macword;
  }

  assembleBLR(operands) {
    if (operands.length < 1 || operands.length > 2) {
      this.error('Invalid operand count for blr');
      return null;
    }
    let baser = this.getRegister(operands[0]);
    if (baser === null) return null;
    let offset6 = 0;
    if (operands.length === 2) {
      offset6 = this.evaluateImmediate(operands[1], -32, 31);
      if (offset6 === null) return null;
    }
    let macword = 0x4000 | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleLDR(operands) {
    if (operands.length !== 3) {
      this.error('Invalid operand count for ldr');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    let baser = this.getRegister(operands[1]);
    if (dr === null || baser === null) return null;
    let offset6 = this.evaluateImmediate(operands[2], -32, 31);
    if (offset6 === null) return null;
    let macword = 0x6000 | (dr << 9) | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleSTR(operands) {
    if (operands.length !== 3) {
      this.error('Invalid operand count for str');
      return null;
    }
    let sr = this.getRegister(operands[0]);
    let baser = this.getRegister(operands[1]);
    if (sr === null || baser === null) return null;
    let offset6 = this.evaluateImmediate(operands[2], -32, 31);
    if (offset6 === null) return null;
    let macword = 0x7000 | (sr << 9) | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleJMP(operands) {
    if (operands.length < 1 || operands.length > 2) {
      this.error('Invalid operand count for jmp');
      return null;
    }
    let baser = this.getRegister(operands[0]);
    if (baser === null) return null;
    let offset6 = 0;
    if (operands.length === 2) {
      offset6 = this.evaluateImmediate(operands[1], -32, 31);
      if (offset6 === null) return null;
    }
    let macword = 0xC000 | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleRET(operands) {
    if (operands.length > 1) {
      this.error('Invalid operand count for ret');
      return null;
    }
    let baser = 7; // LR register
    let offset6 = 0;
    if (operands.length === 1) {
      offset6 = this.evaluateImmediate(operands[0], -32, 31);
      if (offset6 === null) return null;
    }
    let macword = 0xC000 | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleNOT(operands) {
    if (operands.length !== 2) {
      this.error('Invalid operand count for not');
      return null;
    }
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) return null;
    let macword = 0x9000 | (dr << 9) | (sr1 << 6);
    return macword;
  }

  assembleMOV(mnemonic, operands) {
    if (operands.length !== 2) {
      this.error(`Invalid operand count for ${mnemonic}`);
      return null;
    }

    let dr = this.getRegister(operands[0]);
    if (dr === null) return null;

    if (mnemonic === 'mov') {
      // Determine if operands[1] is a register or immediate
      if (this.isRegister(operands[1])) {
        // Translate to 'mvr dr, sr'
        let sr = this.getRegister(operands[1]);
        if (sr === null) return null;
        // mvr: opcode 0xA000, eopcode 12
        let macword = 0xA000 | (dr << 9) | (sr << 6) | 0x000C;
        return macword;
      } else {
        // Translate to 'mvi dr, imm9'
        let imm9 = this.evaluateImmediate(operands[1], -256, 255);
        if (imm9 === null) return null;
        // mvi: opcode 0xD000
        let macword = 0xD000 | (dr << 9) | (imm9 & 0x1FF);
        return macword;
      }
    } else if (mnemonic === 'mvi') {
      // mvi dr, imm9
      let imm9 = this.evaluateImmediate(operands[1], -256, 255);
      if (imm9 === null) return null;
      let macword = 0xD000 | (dr << 9) | (imm9 & 0x1FF);
      return macword;
    } else if (mnemonic === 'mvr') {
      // mvr dr, sr
      let sr = this.getRegister(operands[1]);
      if (sr === null) return null;
      // Ensure eopcode 12 is set
      let macword = 0xA000 | (dr << 9) | (sr << 6) | 0x000C;
      return macword;
    } else {
      this.error(`Invalid mnemonic: ${mnemonic}`);
      return null;
    }
  }

  assembleTrap(operands, trapVector) {
    let sr = 0; // Default to r0
    if (operands.length === 1) {
      sr = this.getRegister(operands[0]);
      if (sr === null) return null;
    } else if (operands.length > 1) {
      this.error('Invalid operand count for trap instruction');
      return null;
    }
    let macword = 0xF000 | (sr << 9) | (trapVector & 0xFF);
    return macword;
  }


  getRegister(regStr) {
    if (!this.isRegister(regStr)) {
      this.error(`Invalid register: ${regStr}`);
      return null;
    }
    if (regStr === "fp") {
      regStr = "r5";
    } else if (regStr === "sp") {
      regStr = "r6";
    } else if (regStr === "lr") {
      regStr = "r7";
    }

    return parseInt(regStr.substr(1), 10);
  }

  isCharLiteral(str) {
    return /^'(?:\\.|[^\\])'$/.test(str);
  }

  parseCharLiteral(str) {
    // Remove the single quotes
    let charContent = str.slice(1, -1);

    if (charContent.length === 1) {
      // Simple character
      return charContent.charCodeAt(0);
    } else if (charContent.startsWith('\\')) {
      // Escape sequence
      switch (charContent) {
        case '\\n':
          return '\n'.charCodeAt(0);
        case '\\t':
          return '\t'.charCodeAt(0);
        case '\\r':
          return '\r'.charCodeAt(0);
        case '\\\\':
          return '\\'.charCodeAt(0);
        case "\\'":
          return "'".charCodeAt(0);
        case '\\"':
          return '"'.charCodeAt(0);
        default:
          this.error(`Invalid escape sequence: ${charContent}`);
          return null;
      }
    } else {
      this.error(`Invalid character literal: '${charContent}'`);
      return null;
    }
  }

  isRegister(regStr) {
    return /^(r[0-7]|fp|sp|lr)$/i.test(regStr);
  }

  parseNumber(valueStr) {
    let value;

    // Handle character literals
    if (this.isCharLiteral(valueStr)) {
      value = this.parseCharLiteral(valueStr);
      if (value === null) {
        return NaN; // Signal an error
      }
    } else if (valueStr.startsWith('0x') || valueStr.startsWith('0X')) {
      value = parseInt(valueStr, 16);
      // note: the LCC doesn't currently support negative hex numbers
      // } else if (valueStr.startsWith('-0x') || valueStr.startsWith('-0X')) {
      //   value = -parseInt(valueStr.substr(3), 16);
    } else {
      value = parseInt(valueStr, 10);
    }
    return value;
  }

  getSymbolAddress(label) {
    if (this.symbolTable.hasOwnProperty(label)) {
      return this.symbolTable[label];
    } else {
      this.error(`Undefined symbol: ${label}`);
      return null;
    }
  }

  evaluateOperand(operand) {
    let value = this.parseNumber(operand);
    if (!isNaN(value)) {
      return value;
    } else if (this.symbolTable.hasOwnProperty(operand)) {
      return this.symbolTable[operand];
    } else {
      this.error(`Undefined operand: ${operand}`);
      return null;
    }
  }

  evaluateImmediate(valueStr, min, max) {
    let value = this.parseNumber(valueStr);
    if (isNaN(value) || value < min || value > max) {
      this.error(`Immediate value out of range: ${valueStr}`);
      return null;
    }
    return value;
  }

  error(message) {
    const errorMsg = `Error on line ${this.lineNum} of ${this.inputFileName}:\n    ${this.currentLine}\n${message}`;
    console.error(errorMsg);
    this.errors.push(errorMsg);
    this.errorFlag = true;
  }
}

module.exports = Assembler;

// Instantiate and run the assembler if this script is run directly
if (require.main === module) {
  const assembler = new Assembler();
  assembler.main();
}

