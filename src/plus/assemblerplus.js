// assemblerplus.js

const fs = require('fs');
const path = require('path');
const Assembler = require('../core/assembler.js');

const { fatalExit } = require('../utils/cliExit');
const { OPCODE_EXT: OP_EXT } = require('../core/constants');
const {
  TRAP_CLEAR, TRAP_SLEEP, TRAP_NBAIN, TRAP_CURSOR,
  TRAP_SRAND, TRAP_MILLIS, TRAP_RESETC,
  TRAP_SOUND, TRAP_SOUND_LITERAL_FLAG, TRAP_WHO,
  EOP_RAND,
} = require('./constants');

const SOUND_ALIAS_SLOTS = {
  ding: 0,
  deep: 1,
  bop: 2,
  doink: 3,
  beep: 4,
};

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
    t['sound']  = { encoder: (ops) => this.assembleSound(ops),            operandShape: 'sr' };
    t['ding']   = { encoder: (_ops) => this.assembleSoundAlias('ding'),   operandShape: '(none)' };
    t['deep']   = { encoder: (_ops) => this.assembleSoundAlias('deep'),   operandShape: '(none)' };
    t['bop']    = { encoder: (_ops) => this.assembleSoundAlias('bop'),    operandShape: '(none)' };
    t['doink']  = { encoder: (_ops) => this.assembleSoundAlias('doink'),  operandShape: '(none)' };
    t['beep']   = { encoder: (_ops) => this.assembleSoundAlias('beep'),   operandShape: '(none)' };
    t['who']    = { encoder: (_ops) => this.assembleTrap([], TRAP_WHO),   operandShape: '(none)' };
    t['whodis'] = { encoder: (_ops) => this.assembleTrap([], TRAP_WHO),   operandShape: '(none)' };
  }

  // Register an external extension module's mnemonics into _instructionTable.
  // ext.mnemonics: { [name]: { trapVec, operandShape } } — encoder is auto-generated.
  // ext.getMnemonics(this): for complex encoders that need the assembler instance.
  registerExtension(ext) {
    const entries = typeof ext.getMnemonics === 'function'
      ? ext.getMnemonics(this)
      : (ext.mnemonics || {});
    for (const [name, entry] of Object.entries(entries)) {
      this._instructionTable[name] = entry.trapVec !== undefined
        ? { encoder: (ops) => this.assembleTrap(ops, entry.trapVec), operandShape: entry.operandShape }
        : entry;
    }
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

    // Build sourceMap: address → {lineNumber, sourceLine} for every code-producing line.
    // Used by InterpreterPlus for verbose runtime-error context (#1078).
    this.sourceMap = {
      addressToLine: new Map(),
      allLines: this.sourceLines.slice(),
    };
    for (const entry of this.listing) {
      if (entry.codeWords && entry.codeWords.length > 0) {
        this.sourceMap.addressToLine.set(entry.locCtr, {
          lineNumber: entry.lineNum,
          sourceLine: entry.sourceLine,
        });
      }
    }

    // e.g. handle startLabel, etc. if needed
    if (this.startLabel !== null) {
      if (this.symbolTable.hasOwnProperty(this.startLabel)) {
        this.startAddress = this.symbolTable[this.startLabel];
      } else {
        // Reuse the base-class UNDEFINED_LABEL explanation (#1102) — this plus
        // override mirrors the core .start/undefined-label check.
        this.error(`Undefined label`, null, 'UNDEFINED_LABEL');
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
      // `rand dr, sr` requires two register operands. Reuse the base-class
      // REGISTER explanation (#1102) — a plus-only mnemonic, but the error is the
      // generic "a register operand is required" concept the catalog already teaches.
      this.error('Missing register', null, 'REGISTER');
      return null;
    };
    let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_RAND;
    return macword;
  }

  assembleSound(operands) {
    if (operands.length !== 1) {
      this.error('Missing sound operand');
      return null;
    }
    const operand = operands[0];
    if (this.isRegister(operand)) {
      const sr = this.getRegister(operand);
      return this.assembleTrap([`r${sr}`], TRAP_SOUND);
    }

    const slot = Number(operand);
    if (!Number.isInteger(slot)) {
      this.error('sound operand must be a register or slot number');
      return null;
    }
    return this.assembleSoundLiteral(slot);
  }

  assembleSoundAlias(alias) {
    return this.assembleSoundLiteral(SOUND_ALIAS_SLOTS[alias]);
  }

  assembleSoundLiteral(slot) {
    if (slot < 0 || slot > 4) {
      this.error('sound slot out of range');
      return null;
    }
    return this.assembleTrap([`r${slot}`], TRAP_SOUND) | TRAP_SOUND_LITERAL_FLAG;
  }

  // Extend the core valid-directive pool with .lccplus so the verbose
  // "did you mean?" suggester can offer it on a near-miss (e.g. .lcplus,
  // .lccplu) in a .ap file. Kept out of core Assembler._getValidDirectives()
  // so .lccplus is never suggested for a plain .a source. (#1034)
  _getValidDirectives() {
    return super._getValidDirectives().concat(['.lccplus']);
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
