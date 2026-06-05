// assemblerplus.js

const fs = require('fs');
const path = require('path');
const Assembler = require('../core/assembler.js');

const { fatalExit } = require('../utils/cliExit');

// LCC+ extension trap vector addresses — occupy the HIGH end of the 8-bit trap
// space (0xFF down) so core traps can grow upward from 0x0F without collision.
const TRAP_CLEAR  = 0x00F9;
const TRAP_SLEEP  = 0x00FA;
const TRAP_NBAIN  = 0x00FB;
const TRAP_CURSOR = 0x00FC;
const TRAP_SRAND  = 0x00FD;
const TRAP_MILLIS = 0x00FE;
const TRAP_RESETC = 0x00FF;

class AssemblerPlus extends Assembler {
  constructor() {
    super();
    this.isLCCPlusFile = false;  // Will turn true if we encounter .lccplus
    const t = this._instructionTable;
    t['clear']  = { encoder: (ops) => this.assembleTrap(ops, TRAP_CLEAR),  operandShape: '[sr]' };
    t['sleep']  = { encoder: (ops) => this.assembleTrap(ops, TRAP_SLEEP),  operandShape: '[sr]' };
    t['nbain']  = { encoder: (ops) => this.assembleTrap(ops, TRAP_NBAIN),  operandShape: '[sr]' };
    t['cursor'] = { encoder: (ops) => this.assembleTrap(ops, TRAP_CURSOR), operandShape: '[sr]' };
    t['srand']  = { encoder: (ops) => this.assembleTrap(ops, TRAP_SRAND),  operandShape: '[sr]' };
    t['rand']   = { encoder: (ops) => this.assembleRAND(ops),              operandShape: 'dr, sr' };
    t['millis'] = { encoder: (ops) => this.assembleTrap(ops, TRAP_MILLIS), operandShape: '[sr]' };
    t['resetc'] = { encoder: (ops) => this.assembleTrap(ops, TRAP_RESETC), operandShape: '[sr]' };
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
  }

  // assembly+: rand dr, sr1
  // machine code: 1010 dr sr1 0 01110
  assembleRAND(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      return null;
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
      console.error('Missing .lccplus directive. Add ".lccplus" near the top of your .ap source file.');
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