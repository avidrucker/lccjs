#!/usr/bin/env node

// lccplus.js
// This is the "driver" for LCC+ that calls assemblerplus.js and interpreterplus.js

const fs = require('fs');
const path = require('path');
const AssemblerPlus = require('./assemblerplus.js');
const InterpreterPlus = require('./interpreterplus.js');

const { fatalExit, setExplainMode } = require('../utils/cliExit');

class LCCPlus {
    constructor() {
      this.inputFileName = '';
    }
  
    main(args) {
      args = args || process.argv.slice(2);

      let playMode = false;
      let verbose = false;
      let explain = false;
      const positional = [];
      for (const arg of args) {
        if (arg === '--play' || arg === '-p') {
          playMode = true;
        } else if (arg === '-v' || arg === '--verbose') {
          // Forward verbose into the constructed AssemblerPlus/InterpreterPlus
          // below, unlocking the inherited "did you mean?" suggester (#1005).
          verbose = true;
        } else if (arg === '--explain') {
          // Forward --explain into the LCC+ toolchain (#1102), mirroring the
          // verbose seam above. Two render gates must both be flipped:
          //   * the assembler renders its `explain:` block from the instance
          //     `explainModeOn` (formatAssemblerError);
          //   * the interpreter's runtime/file-format funnel renders via the
          //     module-level cliExit gate, flipped by setExplainMode().
          explain = true;
        } else if (!arg.startsWith('-')) {
          positional.push(arg);
        } else {
          console.error(`Unknown flag: ${arg}`);
          fatalExit(`Unknown flag: ${arg}`, 1);
        }
      }

      if (positional.length < 1) {
        console.error('Usage: lccplus.js <input file (.ap or .ep)> [-v|--verbose] [--explain] [--play]');
        fatalExit('No input file specified.', 1);
      }

      // Flip the module-level cliExit gate once for this run so the interpreter's
      // runtime/file-format error funnel renders explanations (#1102).
      setExplainMode(explain);

      this.inputFileName = positional[0];
      const extension = path.extname(this.inputFileName).toLowerCase();

      // Collect extension modules; --play loads src/plus/play.js
      const extensions = playMode ? [require('./play')] : [];

      if (extension === '.ap') {
        // 1) Assemble .ap -> .ep
        const assembler = new AssemblerPlus();
        assembler.verboseModeOn = verbose;
        assembler.explainModeOn = explain;
        for (const ext of extensions) assembler.registerExtension(ext);
        assembler.main([this.inputFileName]);
        const epFile = assembler.outputFileName;

        // 2) Interpret the resulting .ep
        const interpreter = new InterpreterPlus();
        interpreter.generateStats = false;
        interpreter.verboseModeOn = verbose;
        interpreter.explainModeOn = explain;
        // Pass sourceMap from assembler for verbose runtime-error context (#1078)
        interpreter.sourceMap = assembler.sourceMap;
        for (const ext of extensions) interpreter.registerExtension(ext);
        interpreter.main([epFile]);

      } else if (extension === '.ep') {
        const interpreter = new InterpreterPlus();
        interpreter.generateStats = false;
        interpreter.verboseModeOn = verbose;
        interpreter.explainModeOn = explain;
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
