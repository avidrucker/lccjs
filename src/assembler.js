// assembler.js
// LCC.js Assembler

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
    this.errors = []; // Collect errors
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
    this.errors = [];
    this.performPass();

    if (this.errorFlag) {
      console.error('Errors encountered during Pass 1.');
      this.errors.forEach(error => console.error(error));
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
      this.errors.forEach(error => console.error(error));
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

      if (this.locCtr > 65536) {
        this.error('Program too big');
        return;
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

  handleDirective(mnemonic, operands) {
    switch (mnemonic.toLowerCase()) {
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
            this.machineCode.push(0);
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
          if (value > 32767 || value < -32768) {
            this.error('Data does not fit in 16 bits');
            return;
          }
          this.machineCode.push(value & 0xFFFF);
        }
        this.locCtr += 1;
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
    switch (mnemonic.toLowerCase()) {
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
      case 'ld':
        machineWord = this.assembleLd(operands);
        break;
      case 'st':
        machineWord = this.assembleSt(operands);
        break;
      case 'bl':
        machineWord = this.assembleBL(operands);
        break;
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
      case 'halt':
        machineWord = 0xF000;
        break;
      case 'nl':
        machineWord = 0xF001;
        break;
      case 'dout':
        machineWord = this.assembleDout(operands);
        break;
      default:
        this.error(`Invalid mnemonic or directive: ${mnemonic}`);
        return;
    }

    if (machineWord !== null) {
      this.machineCode.push(machineWord);
      this.locCtr += 1;
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

  assembleDout(operands) {
    let sr = 0; // Default to r0
    if (operands.length === 1) {
      sr = this.getRegister(operands[0]);
      if (sr === null) return null;
    } else if (operands.length > 1) {
      this.error('Invalid operand count for dout');
      return null;
    }
    let macword = 0xF002 | (sr << 9);
    return macword;
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
    const errorMsg = `Error on line ${this.lineNum}: ${message}`;
    console.error(errorMsg);
    this.errors.push(errorMsg);
    this.errorFlag = true;
  }
}

module.exports = Assembler;
