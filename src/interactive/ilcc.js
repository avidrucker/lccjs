#!/usr/bin/env node

// ilcc.js — Interactive LCC CLI driver
// Mirrors src/core/lcc.js but uses IInterpreter instead of Interpreter.
// Calls interpreter.runInteractive(sourceMap) instead of interpreter.run().
//
// Usage:  node ilcc.js <input.a>  [flags]
// Flags:  same as lcc.js, plus:
//   -e   efficient mode — disables snapshot log (forward-only, lower memory)
//   -c   colorblind mode — alternate ANSI color palette
//
// Only .a and .e files are supported (no .o linking, no .bin/.hex).
// See also: src/interactive/iinterpreter.js

'use strict';

const path = require('path');
const Assembler = require('../core/assembler');
const IInterpreter = require('./iinterpreter');
const { constructSiblingFileName } = require('../utils/fileArtifacts');

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

function cliErrorExit(message, code = 1) {
  console.error(message);
  fatalExit(message, code);
}

class ILCC {
  constructor() {
    this.inputFileName = '';
    this.outputFileName = '';
    this.options = {};
    this.args = [];
    this.assembler = null;
    this.interpreter = null;
    this.inputBuffer = '';
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length === 0) {
      this.printHelp();
      fatalExit('No input file specified.', 0);
    }

    this.parseArguments(args);

    if (this.args.length === 0) {
      cliErrorExit('No input file specified.', 1);
    }

    this.inputFileName = this.args[0];
    const ext = path.extname(this.inputFileName).toLowerCase();

    if (ext === '.e') {
      // Direct execution of a pre-assembled executable
      this.outputFileName = this.inputFileName;
    } else {
      // Assemble .a (or any other source extension) first
      this.assembleFile();
    }

    this.runInteractiveFile();
  }

  assembleFile() {
    const assembler = new Assembler();
    assembler.inputFileName = this.inputFileName;
    assembler.outputFileName = this.outputFileName ||
      constructSiblingFileName(this.inputFileName, '.e');
    this.outputFileName = assembler.outputFileName;
    this.assembler = assembler;

    try {
      assembler.main([this.inputFileName]);
    } catch (error) {
      cliErrorExit(`Error assembling ${this.inputFileName}: ${error.message}`, 1);
    }
  }

  runInteractiveFile() {
    const interpreter = new IInterpreter();
    interpreter.options = this.options;
    interpreter.efficientMode  = !!this.options.efficientMode;
    interpreter.colorblindMode = !!this.options.colorblindMode;

    if (this.inputBuffer) {
      interpreter.inputBuffer = this.inputBuffer;
    }

    this.interpreter = interpreter;

    // Load executable (sets initialMem internally)
    interpreter.loadExecutableFile(this.outputFileName);

    // sourceMap: PC → {sourceLine, lineNumber} — null until OB-043 (#95) is resolved
    const sourceMap = null; // @todo #95 will wire assembler listing → sourceMap

    // Enter the interactive prompt loop
    interpreter.runInteractive(sourceMap);
  }

  parseArguments(args) {
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      if (arg.startsWith('-')) {
        switch (arg) {
          case '-e':
            this.options.efficientMode = true;
            break;
          case '-c':
            this.options.colorblindMode = true;
            break;
          case '-d':
            this.options.debug = true;
            break;
          case '-h':
            this.printHelp();
            fatalExit('Printing help message after -h flag used.', 0);
            break;
          default:
            if (arg.startsWith('-l')) {
              this.options.loadPoint = parseInt(arg.substr(2), 16);
            } else if (arg === '-o') {
              i++;
              if (i < args.length) {
                this.outputFileName = args[i];
              } else {
                cliErrorExit('Missing output file name after -o flag', 1);
              }
            } else {
              cliErrorExit(`Unknown option: ${arg}`, 1);
            }
            break;
        }
      } else {
        this.args.push(arg);
      }
      i++;
    }
  }

  printHelp() {
    console.log('Usage: ilcc.js <input.a | input.e>  [flags]');
    console.log('Flags:');
    console.log('   -e   efficient mode (forward-only stepping, lower memory)');
    console.log('   -c   colorblind mode (alternate ANSI palette)');
    console.log('   -d   debug mode');
    console.log('   -h   show this help');
    console.log('   -l<hex>  load point (hex address, e.g. -l0010)');
    console.log('   -o <file>  output executable name');
    console.log('Supported input extensions: .a (assembled first), .e (direct)');
  }
}

// Run when invoked directly (not when required by tests)
if (require.main === module) {
  const ilcc = new ILCC();
  ilcc.main();
}

module.exports = ILCC;
