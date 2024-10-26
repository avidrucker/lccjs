// assembler.js
// LCC.js Assembler
// Translated from a1.c by Avital Drucker

class Assembler {
    constructor() {
      this.symbolTable = {}; // symbol: address
      this.locCtr = 0; // Location counter
      this.lineNum = 0; // Line number
      this.machineCode = []; // Array to hold machine code words
      this.sourceLines = []; // Array of source code lines
      this.errorFlag = false; // Error flag
      this.pass = 1; // Current pass (1 or 2)
      this.labels = new Set(); // Set of labels to detect duplicates
    }
  
    assemble(sourceCode) {
      // Split source code into lines
      this.sourceLines = sourceCode.split('\n');
      // Perform Pass 1
      this.pass = 1;
      this.locCtr = 0;
      this.lineNum = 0;
      this.errorFlag = false;
      this.symbolTable = {};
      this.machineCode = [];
      this.labels.clear();
      this.performPass();
  
      if (this.errorFlag) {
        console.error('Errors encountered during Pass 1.');
        return null;
      }
  
      // Perform Pass 2
      this.pass = 2;
      this.locCtr = 0;
      this.lineNum = 0;
      this.machineCode = [];
      this.performPass();
  
      if (this.errorFlag) {
        console.error('Errors encountered during Pass 2.');
        return null;
      }
  
      return this.machineCode;
    }
  
    performPass() {
      for (let line of this.sourceLines) {
        this.lineNum++;
        let originalLine = line;
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
  
        // Handle directives and instructions
        if (mnemonic.startsWith('.')) {
          // Directive
          this.handleDirective(mnemonic, operands);
        } else {
          // Instruction
          this.handleInstruction(mnemonic, operands);
        }
      }
    }
  
    tokenizeLine(line) {
      // Split line into tokens considering commas and whitespace
      let tokens = [];
      let currentToken = '';
      let inString = false;
  
      for (let i = 0; i < line.length; i++) {
        let char = line[i];
        if (char === '"' || char === "'") {
          inString = !inString;
          currentToken += char;
        } else if (this.isWhitespace(char) && !inString) {
          if (currentToken !== '') {
            tokens.push(currentToken);
            currentToken = '';
          }
        } else if (char === ',' && !inString) {
          if (currentToken !== '') {
            tokens.push(currentToken);
            currentToken = '';
          }
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
  
    handleDirective(mnemonic, operands) {
      switch (mnemonic.toLowerCase()) {
        case '.zero':
        case '.blkw':
        case '.space':
          if (operands.length !== 1) {
            this.error(`Invalid operand count for ${mnemonic}`);
            return;
          }
          let size = parseInt(operands[0], 10);
          if (isNaN(size) || size < 1) {
            this.error(`Invalid size for ${mnemonic}`);
            return;
          }
          if (this.pass === 2) {
            for (let i = 0; i < size; i++) {
              this.machineCode.push(0);
            }
          }
          this.locCtr += size;
          break;
        case '.word':
        case '.fill':
          if (operands.length !== 1) {
            this.error(`Invalid operand count for ${mnemonic}`);
            return;
          }
          if (this.pass === 2) {
            let value = this.evaluateOperand(operands[0]);
            if (value === null) return;
            if (value > 32767 || value < -32768) {
              this.error('Data does not fit in 16 bits');
              return;
            }
            this.machineCode.push(value & 0xffff);
          }
          this.locCtr += 1;
          break;
        // Handle other directives as needed
        default:
          this.error(`Unknown directive: ${mnemonic}`);
      }
    }
  
    handleInstruction(mnemonic, operands) {
      if (this.pass === 1) {
        this.locCtr += 1;
        return;
      }
  
      let machineWord = null;
      switch (mnemonic.toLowerCase()) {
        case 'add':
          machineWord = this.assembleAdd(operands);
          break;
        case 'ld':
          machineWord = this.assembleLd(operands);
          break;
        case 'st':
          machineWord = this.assembleSt(operands);
          break;
        // Implement other instructions similarly
        case 'lea':
          machineWord = this.assembleLea(operands);
          break;
        case 'halt':
          machineWord = 0xf000;
          break;
        case 'nl':
          machineWord = 0xf001;
          break;
        case 'dout':
          machineWord = this.assembleDout(operands);
          break;
        // Add other trap instructions
        default:
          this.error(`Unknown instruction: ${mnemonic}`);
          return;
      }
  
      if (machineWord !== null) {
        this.machineCode.push(machineWord);
        this.locCtr += 1;
      }
    }
  
    assembleAdd(operands) {
      if (operands.length !== 3) {
        this.error('Invalid operand count for add');
        return null;
      }
      let dr = this.getRegister(operands[0]);
      let sr1 = this.getRegister(operands[1]);
      let sr2orImm5 = operands[2];
  
      if (dr === null || sr1 === null) return null;
  
      let machineWord = 0x1000 | (dr << 9) | (sr1 << 6);
  
      if (this.isRegister(sr2orImm5)) {
        let sr2 = this.getRegister(sr2orImm5);
        if (sr2 === null) return null;
        machineWord |= sr2;
      } else {
        let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15);
        if (imm5 === null) return null;
        machineWord |= 0x20 | (imm5 & 0x1f);
      }
  
      return machineWord;
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
  
      let machineWord = 0x2000 | (dr << 9) | (pcoffset9 & 0x1ff);
      return machineWord;
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
  
      let machineWord = 0x3000 | (sr << 9) | (pcoffset9 & 0x1ff);
      return machineWord;
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
  
      let machineWord = 0xe000 | (dr << 9) | (pcoffset9 & 0x1ff);
      return machineWord;
    }
  
    assembleDout(operands) {
      let sr = 0; // Default to r0
      if (operands.length === 1) {
        sr = this.getRegister(operands[0]);
        if (sr === null) return null;
      }
      let machineWord = 0xf002 | (sr << 9);
      return machineWord;
    }
  
    getRegister(regStr) {
      if (!this.isRegister(regStr)) {
        this.error(`Invalid register: ${regStr}`);
        return null;
      }
      return parseInt(regStr.substr(1), 10);
    }
  
    isRegister(regStr) {
      return /^r[0-7]$/i.test(regStr);
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
      let value = parseInt(operand, 10);
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
      let value = parseInt(valueStr, 10);
      if (isNaN(value) || value < min || value > max) {
        this.error(`Immediate value out of range: ${valueStr}`);
        return null;
      }
      return value;
    }
  
    error(message) {
      console.error(`Error on line ${this.lineNum}: ${message}`);
      this.errorFlag = true;
    }
  }
  
  // Export the Assembler class for use in other modules
  module.exports = Assembler;
  