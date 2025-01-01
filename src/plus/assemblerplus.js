// assemblerplus.js

const fs = require('fs');
const path = require('path');
const Assembler = require('../core/assembler.js');

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

class AssemblerPlus extends Assembler {
  constructor() {
    super();
    this.isLCCPlusFile = false;  // Will turn true if we encounter .lccplus
  }

  main(args) {
    args = args || process.argv.slice(2);
    if (!this.inputFileName) {
      if (args.length !== 1) {
        console.error('Usage: assemblerplus.js <input filename>');
        fatalExit('Usage: assemblerplus.js <input filename>', 1);
      }
      this.inputFileName = args[0];
    }

    // Read the source
    let sourceCode;
    try {
      sourceCode = fs.readFileSync(this.inputFileName, 'utf-8');
      this.sourceLines = sourceCode.split('\n');
    } catch (err) {
      console.error(`Cannot open input file ${this.inputFileName}`);
      fatalExit(`Cannot open input file ${this.inputFileName}`, 1);
    }

    const extension = path.extname(this.inputFileName).toLowerCase();

    // Only allow .ap files
    if (extension !== '.ap') {
      console.error('Unsupported file type (LCC+ only handles .ap files)');
      fatalExit('Unsupported file type (LCC+ only handles .ap files)', 1);
    }

    // If .ap file, proceed:
    // We override so that the final extension is .ep
    this.outputFileName = this.constructOutputFileName(this.inputFileName, '.ep');

    // Now do the standard 2-pass logic from parent
    console.log('Starting LCC+ assembly pass 1');
    this.pass = 1;
    this.locCtr = 0;
    this.lineNum = 0;
    this.errorFlag = false;
    this.performPass();
    if (this.locCtr === 0) {
      console.error('Empty file');
      fatalExit('Empty file', 0);
    }
    if (this.errorFlag) {
      fatalExit('Errors encountered during Pass 1', 1);
    }

    console.log('Starting LCC+ assembly pass 2');
    this.pass = 2;
    this.locCtr = 0;
    this.lineNum = 0;
    this.performPass();
    if (this.errorFlag) {
      fatalExit('Errors encountered during Pass 2', 1);
    }

    // e.g. handle startLabel, etc. if needed
    if (this.startLabel !== null) {
      if (this.symbolTable.hasOwnProperty(this.startLabel)) {
        this.startAddress = this.symbolTable[this.startLabel];
      } else {
        this.error(`Undefined label`);
        fatalExit(`Undefined label`, 1);
      }
    } else {
      this.startAddress = 0;
    }

    // Finally write the .ep file
    this.writeOutputFile();
    console.log(`Output file = ${this.outputFileName}`);
  }

  // convenience function for writing a machine word and incrementing locCtr
  writeAndInc(macword) {
    if (macword !== null) {
      this.writeMachineWord(macword);
      this.locCtr += 1;
    }
  }

  handleInstruction(mnemonic, operands) {
    if (this.pass === 1) {
      this.locCtr += 1;
      return;
    }
    let machineWord = null;
  
    switch (mnemonic) {
      case 'clear':
        machineWord = this.assembleTrap(operands, 0x000F);
        // Here, WE do the writing/incrementing for "clear"
        this.writeAndInc(machineWord);
        break;
      case 'sleep':
        machineWord = this.assembleTrap(operands, 0x0010);
        this.writeAndInc(machineWord);
        break;
      case 'nbain':
        machineWord = this.assembleTrap(operands, 0x0011);
        this.writeAndInc(machineWord);
        break;
      case 'cursor':
        machineWord = this.assembleTrap(operands, 0x0012);
        this.writeAndInc(machineWord);
        break;
      case 'srand':
        machineWord = this.assembleTrap(operands, 0x0013);
        this.writeAndInc(machineWord);
        break;
      case 'rand':
        machineWord = this.assembleRAND(operands);
        this.writeAndInc(machineWord);
        break;
      case 'millis':
        machineWord = this.assembleTrap(operands, 0x0014);
        this.writeAndInc(machineWord);
        break;
      case 'resetc':
        machineWord = this.assembleTrap(operands, 0x0015);
        this.writeAndInc(machineWord);
        break;
      default:
        // Here we let the parent handle the assembling, writing, and incrementing
        super.handleInstruction(mnemonic, operands);
    }
  }

  // assembly+: rand dr, sr1
  // machine code: 1010 dr sr1 0 01110
  assembleRAND(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x000E;
    return macword;
  }

  // Override or extend handleDirective to add .lccplus
  handleDirective(mnemonic, operands) {
    const lowerMnemonic = mnemonic.toLowerCase();

    if (lowerMnemonic === '.lccplus') {
      // If we see `.lccplus`, set a flag so we know to produce
      // a "p" header entry later.
      this.isLCCPlusFile = true;
      return;
    }
    // Else, fall back to the existing handleDirective
    super.handleDirective(mnemonic, operands);
  }

  // Override writeOutputFile to insert the "p" header entry 
  writeOutputFile() {
    if (this.isLCCPlusFile) {
      super.writeOutputFile('p');
    } else {
      console.error('Missing .lccplus directive');
      fatalExit('Missing .lccplus directive', 1);
    }
  }

}

module.exports = AssemblerPlus;

// Instantiate and run the assembler if this script is run directly
if (require.main === module) {
  const assemblerplus = new AssemblerPlus();
  assemblerplus.main();
}