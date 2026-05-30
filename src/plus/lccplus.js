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
  
      if (args.length < 1) {
        console.error('Usage: lccplus.js <input file (.ap or .ep)>');
        fatalExit('No input file specified.', 1);
      }
  
      // The first argument is the file to assemble or run
      this.inputFileName = args[0];
      const extension = path.extname(this.inputFileName).toLowerCase();
  
      if (extension === '.ap') {
        // 1) Assemble .ap -> .ep
        const assembler = new AssemblerPlus();
        // Use main([file]) as the single path for inputFileName; assembler.main()
        // sets this.inputFileName from args[0] when the property is not pre-set.
        assembler.main([this.inputFileName]);
        const epFile = assembler.outputFileName;
  
        // 2) Interpret the resulting .ep
        const interpreter = new InterpreterPlus();
        interpreter.generateStats = false; // no .lst or .bst
        // pass [epFile] so interpreter sees the .ep file
        interpreter.main([epFile]); 
  
      } else if (extension === '.ep') {
        // Just interpret the .ep file
        const interpreter = new InterpreterPlus();
        interpreter.generateStats = false; 
        // pass [this.inputFileName] so interpreter sees the .ep
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
