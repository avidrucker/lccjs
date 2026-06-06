#!/usr/bin/env node

// lccplus.js
// This is the "driver" for LCC+ that calls assemblerplus.js and interpreterplus.js

const fs = require('fs');
const path = require('path');
const AssemblerPlus = require('./assemblerplus.js');
const InterpreterPlus = require('./interpreterplus.js');

const { fatalExit } = require('../utils/cliExit');

class LCCPlus {
    constructor() {
      this.inputFileName = '';
    }
  
    main(args) {
      args = args || process.argv.slice(2);

      let playMode = false;
      const positional = [];
      for (const arg of args) {
        if (arg === '--play' || arg === '-p') {
          playMode = true;
        } else if (!arg.startsWith('-')) {
          positional.push(arg);
        } else {
          console.error(`Unknown flag: ${arg}`);
          fatalExit(`Unknown flag: ${arg}`, 1);
        }
      }

      if (positional.length < 1) {
        console.error('Usage: lccplus.js <input file (.ap or .ep)> [--play]');
        fatalExit('No input file specified.', 1);
      }

      this.inputFileName = positional[0];
      const extension = path.extname(this.inputFileName).toLowerCase();

      // Collect extension modules; --play loads src/plus/play.js
      const extensions = playMode ? [require('./play')] : [];

      if (extension === '.ap') {
        // 1) Assemble .ap -> .ep
        const assembler = new AssemblerPlus();
        for (const ext of extensions) assembler.registerExtension(ext);
        assembler.main([this.inputFileName]);
        const epFile = assembler.outputFileName;

        // 2) Interpret the resulting .ep
        const interpreter = new InterpreterPlus();
        interpreter.generateStats = false;
        for (const ext of extensions) interpreter.registerExtension(ext);
        interpreter.main([epFile]);

      } else if (extension === '.ep') {
        const interpreter = new InterpreterPlus();
        interpreter.generateStats = false;
        for (const ext of extensions) interpreter.registerExtension(ext);
        interpreter.main([this.inputFileName]);

      } else {
        console.error('Unsupported file type for lccplus (expected .ap or .ep)');
        fatalExit('Unsupported file type for lccplus (expected .ap or .ep)', 1);
      }
    }
  }

// If run directly:
if (require.main === module) {
  const driver = new LCCPlus();
  driver.main();
}

module.exports = LCCPlus;
