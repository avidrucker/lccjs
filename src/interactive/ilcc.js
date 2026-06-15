#!/usr/bin/env node

// ilcc.js — Interactive LCC CLI driver
// Mirrors src/cli/lcc.js but uses IInterpreter instead of Interpreter.
// Calls interpreter.runInteractive(sourceMap) instead of interpreter.run().
//
// Usage:  node ilcc.js <input.a>  [flags]
// Flags:  same as lcc.js, plus:
//   -e   efficient mode — disables snapshot log (forward-only, lower memory)
//   -c   colorblind mode — alternate ANSI color palette
//
// Supported: .a, .bin, .hex (assembled first), .e (loaded directly). No .o linking.
// See also: src/interactive/iinterpreter.js

'use strict';

const path = require('path');
const Assembler = require('../core/assembler');
const IInterpreter = require('./iinterpreter');
const { constructSiblingFileName } = require('../utils/fileArtifacts');

const { fatalExit, cliErrorExit } = require('../utils/cliExit');
const { formatFlagDiagnostics } = require('../utils/flagDiagnostics');

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

    switch (ext) {
      case '.bin':
      case '.hex':
        this.assembleFile();
        break;
      case '.e':
        this.outputFileName = this.inputFileName;
        break;
      default:
        // .a or any other source extension
        this.assembleFile();
        break;
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
    interpreter.debugMode      = !!this.options.debug;
    interpreter.traceMode      = !!this.options.trace;
    if (this.options.instructionCap !== undefined) {
      interpreter.maxSteps = this.options.instructionCap;
    }

    if (this.inputBuffer) {
      interpreter.inputBuffer = this.inputBuffer;
    }

    this.interpreter = interpreter;

    // Load executable (sets initialMem internally)
    interpreter.loadExecutableFile(this.outputFileName);

    // sourceMap: { addressToLine: Map, allLines: string[] } — built by assembler after pass 2.
    // null when the .e was loaded directly (no assembler ran in this session).
    const sourceMap = (this.assembler && this.assembler.sourceMap) ? this.assembler.sourceMap : null;

    // symbolTable: label → address, from the assembler. Lets the a{label} memory
    // command resolve labels to addresses. null when a .e was loaded directly. (#1041)
    interpreter.symbolTable = (this.assembler && this.assembler.symbolTable) ? this.assembler.symbolTable : null;

    if (this.options.noInteractive) {
      // Batch mode (-n): run without the interactive prompt, then flush captured output
      interpreter.run();
      if (interpreter.programOutput) {
        process.stdout.write(interpreter.programOutput);
      }
    } else {
      interpreter.runInteractive(sourceMap);
    }
  }

  parseArguments(args) {
    // Collected during the loop, reported once as non-blocking warnings (#1373).
    const unknownFlags = [];
    const unimplementedFlags = [];
    let i = 0;
    while (i < args.length) {
      const arg = args[i];
      if (arg.startsWith('-')) {
        switch (arg) {
          case '-n':
            this.options.noInteractive = true;
            break;
          case '-m':
            this.options.memDisplay = true;
            break;
          case '-r':
            this.options.regDisplay = true;
            break;
          case '-f':
            // Known but currently no effect (#1371) — report as unimplemented.
            this.options.fullLineDisplay = true;
            unimplementedFlags.push('-f');
            break;
          case '-x':
            this.options.hexOutput = true;
            break;
          case '-t':
            this.options.trace = true;
            break;
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
            if (arg.startsWith('-i')) {
              this.options.instructionCap = parseInt(arg.substr(2), 10);
            } else if (arg.startsWith('-l')) {
              this.options.loadPoint = parseInt(arg.substr(2), 16);
            } else if (arg === '-o') {
              i++;
              if (i < args.length) {
                this.outputFileName = args[i];
              } else {
                cliErrorExit('Missing output file name after -o flag', 1);
              }
            } else {
              // Unknown flag — collect and warn at the end, don't abort (#1373).
              unknownFlags.push(arg);
            }
            break;
        }
      } else {
        this.args.push(arg);
      }
      i++;
    }

    // Report unknown / unimplemented flags as non-blocking warnings (#1373).
    for (const line of formatFlagDiagnostics({ unknown: unknownFlags, unimplemented: unimplementedFlags })) {
      process.stderr.write(line + '\n');
    }
  }

  printHelp() {
    console.log('Usage: ilcc.js <input.a | input.e>  [flags]');
    console.log('Flags:');
    console.log('   -n   batch mode (non-interactive; skip prompt, run to completion)');
    console.log('   -m   print memory display after run');
    console.log('   -r   print register display after run');
    console.log('   -f   full line display');
    console.log('   -x   4-digit hex output');
    console.log('   -t   trace mode (print each instruction before execution)');
    console.log('   -e   efficient mode (forward-only stepping, lower memory)');
    console.log('   -c   colorblind mode (alternate ANSI palette)');
    console.log('   -d   debug mode');
    console.log('   -h   show this help');
    console.log('   -i<N>  instruction cap before automatic halt (default 500000)');
    console.log('   -l<hex>  load point (hex address, e.g. -l0010)');
    console.log('   -o <file>  output executable name');
    console.log('Supported input extensions: .a, .bin, .hex (assembled first), .e (direct)');
  }
}

// Run when invoked directly (not when required by tests)
if (require.main === module) {
  const ilcc = new ILCC();
  ilcc.main();
}

module.exports = ILCC;
