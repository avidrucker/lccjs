#!/usr/bin/env node

// lcc.js

const path = require('path');
const Assembler = require('./assembler');
const Interpreter = require('./interpreter');
const Linker = require('./linker');
const ILCC = require('../interactive/ilcc');
const { LinkerError } = require('../utils/errors');
const nameHandler = require('../utils/name.js');
const { buildReportArtifacts } = require('../utils/reportArtifacts');
const { constructSiblingFileName, writeReportFiles } = require('../utils/fileArtifacts');

const newline = process.platform === 'win32' ? '\r\n' : '\n';

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

function cliWrappedErrorExit(prefix, error, code = 1) {
  console.error(prefix, error.message);
  fatalExit(`${prefix} ${error.message}`, code);
}

class LCC {
  constructor() {
    this.inputFileName = '';
    this.outputFileName = '';
    this.options = {};
    this.args = [];
    this.assembler = null;
    this.interpreter = null;
    this.inputBuffer = '';
    this.generateStats = true;
  }

  resolveUserName(inputFileName = this.inputFileName) {
    try {
      return nameHandler.createNameFile(inputFileName);
    } catch (error) {
      cliWrappedErrorExit('Error handling name file:', error, 1);
    }
  }

  buildReportArtifacts(includeSourceCode, includeComments, now) {
    const userName = this.resolveUserName();

    return buildReportArtifacts({
      interpreter: this.interpreter,
      assembler: includeSourceCode || includeComments ? this.assembler : null,
      userName,
      inputFileName: this.inputFileName,
      includeComments: includeComments,
      now,
    });
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length === 0) {
      this.printHelp();
      fatalExit('No input file specified. Printing help message.', 0);
    }

    this.parseArguments(args);

    if (this.args.length === 0) {
      cliErrorExit('No input file specified.', 1);
    }

    // If multiple inputs were supplied, the "main input file" is the first one
    this.inputFileName = this.args[0];

    // -i flag: delegate entirely to the interactive debugger (ILCC).
    // Supported: .a (assemble then debug) and .e (debug directly).
    // .bin/.hex deferred to proposals #99/#100.
    if (this.options.interactive) {
      this.runInteractiveMode();
      return;
    }

    // Dispatch strategy: if the first arg is a .o file, link all args as object modules.
    // Otherwise, process only the first arg as a source/executable/binary file.
    // Multiple .a files: only args[0] is assembled; remaining .a args are silently ignored.
    // This matches the most-common OG LCC usage (single source file → single .e).
    // See core-behavior-matrix.md → "Multi-file .a input" for documented divergence.
    const firstArgIsObjectFile = path.extname(this.args[0]).toLowerCase() === '.o';

    if (firstArgIsObjectFile) {
      // We have a linking scenario: one or more files (assumed to be .o files)
      this.linkObjectFiles(this.args);
    } else {
      // The default code path: assemble or execute depending on extension
      this.handleSingleFile(this.inputFileName);
    }
  }

  /**
   * Delegate to ILCC for interactive stepping-debugger mode (-i flag).
   * Forwards -e (efficient), -c (colorblind), -d (debug), -l<hex>, -o flags.
   * ilcc.js stays as a thin standalone wrapper; this method is the canonical
   * path reached via `lcc -i`.
   */
  runInteractiveMode() {
    const ilcc = new ILCC();

    // Forward relevant options
    ilcc.options.efficientMode  = !!this.options.efficientMode;
    ilcc.options.colorblindMode = !!this.options.colorblindMode;
    ilcc.options.debug          = !!this.options.debug;
    if (this.options.loadPoint !== undefined) {
      ilcc.options.loadPoint = this.options.loadPoint;
    }
    if (this.outputFileName) {
      ilcc.outputFileName = this.outputFileName;
    }

    // Forward inputBuffer (used in tests to simulate stdin)
    if (this.inputBuffer) {
      ilcc.inputBuffer = this.inputBuffer;
    }

    // Run ILCC with the input file (already parsed into this.inputFileName)
    ilcc.main([this.inputFileName]);

    // Expose ilcc internals so callers (tests) can inspect state
    this.ilcc = ilcc;
  }

  /**
   * Link multiple .o files into a single executable
   */
  linkObjectFiles(objectFiles) {
    // If user provided `-o <outfile>` on the command line, we'll have it in this.outputFileName
    // Otherwise default to `link.e` in the CWD — matches oracle behavior.
    // If Charlie later prefers the output next to the first .o file, use:
    //   path.join(path.dirname(objectFiles[0]), 'link.e')
    let outputFile = this.outputFileName || 'link.e';

    // Create the Linker
    const linker = new Linker();

    // Perform actual linking; LinkerError is caught here to preserve OG LCC's
    // exit-0-on-linker-error behavior — the error message was already logged by
    // Linker.error() before the throw.
    try {
      linker.link(objectFiles, outputFile);
    } catch (error) {
      if (error instanceof LinkerError) {
        return; // already logged; match OG LCC exit-0 behavior
      }
      throw error;
    }
  }

  /**
   * If the input file is not .o, handle it as .hex, .bin, .e, or .a
   */
  handleSingleFile(infile) {
    const ext = path.extname(infile).toLowerCase();
    switch (ext) {
      case '.hex':
      case '.bin':
        this.assembleFile();
        this.executeFile(false, true); 
        break;
      case '.e':
        this.outputFileName = infile;
        this.executeFile(false);
        break;
      case '.o':
        // to match feature parity with original LCC, we attempt to link the single .o file
        this.assembleFile();
        break;
      default:
        // Likely an assembly source (e.g. .a or anything else)
        this.assembleFile();
        if(!this.assembler.isObjectModule) {
          this.executeFile(true);
        }
        break;
    }
  }

  constructOutputFileName(inputFileName) {
    return constructSiblingFileName(inputFileName, '.e');
  }

  printHelp() {
    console.log('Usage: lcc.js <infile>');
    console.log('Optional args: -d -m -r -t -f -x -i -e -c -l<hex loadpt> -o <outfile> -h');
    console.log('   -d:   debug, -m mem display at end, -r: reg display at end');
    console.log('   -f:   full line display, -x: 4 digit hout, -h: help');
    console.log('   -i:   interactive stepping debugger mode (.a and .e files only)');
    console.log('   -e:   efficient mode (with -i: forward-only stepping, lower memory)');
    console.log('   -c:   colorblind mode (with -i: alternate ANSI palette)');
    console.log('What lcc.js does depends on the extension in the input file name:');
    console.log('   .hex: execute and output .lst, .bst files');
    console.log('   .bin: execute and output .lst, .bst files');
    console.log('   .e:   execute and output .lst, .bst files');
    console.log('   .o:   link files and output executable file');
    console.log('   .a or other: assemble and output .e or .o, .lst, .bst files');
    console.log('         if a .e file is created, it will also be executed');
    console.log('File types:');
    console.log('   .hex: machine code in ascii hex');
    console.log('   .bin: machine code in ascii binary');
    console.log('   .e:   executable');
    console.log('   .o    linkable object module');
    console.log('   .lst: time-stamped listing in hex and output from run');
    console.log('   .bst: time-stamped listing in binary and output from run');
    console.log('   .a or other: assembler code');
    console.log(`lcc.js Ver 0.1${newline}`);
  }

  parseArguments(args) {
    let i = 0;
    while (i < args.length) {
      let arg = args[i];
      if (arg.startsWith('-')) {
        // Option
        switch (arg) {
          case '-d':
            this.options.debug = true;
            break;
          case '-m':
            this.options.memDisplay = true;
            break;
          case '-r':
            this.options.regDisplay = true;
            break;
          case '-f':
            this.options.fullLineDisplay = true;
            break;
          case '-x':
            this.options.hexOutput = true;
            break;
          case '-t':
            this.options.trace = true;
            break;
          case '-i':
            this.options.interactive = true;
            break;
          case '-e':
            this.options.efficientMode = true;
            break;
          case '-c':
            this.options.colorblindMode = true;
            break;
          case '-nostats':
            this.options.noStats = true;
            break;
          case '-h':
            this.printHelp();
            fatalExit('Printing help message after -h flag used.', 0);
          default:
            if (arg.startsWith('-l')) {
              // Load point
              this.options.loadPoint = parseInt(arg.substr(2), 16);
            } else if (arg === '-o') {
              // Output file name
              i++;
              if (i < args.length) {
                this.outputFileName = args[i];
              } else {
                // individual linking output should occur, but the final
                // link.e file should not be created in this scenario
                cliErrorExit('Missing output file name after -o flag', 1);
              }
            } else {
              cliErrorExit(`Unknown option: ${arg}`, 1);
            }
            break;
        }
      } else {
        // Non-option argument
        this.args.push(arg);
      }
      i++;
    }
  }

  assembleFile() {
    const assembler = new Assembler();

    // Wire -l<hex> load point through to assembler (OB-020b).
    // listingLoadPoint is a display-only offset added to each locCtr when
    // rendering .lst/.bst addresses.  The .e binary content is unchanged.
    if (this.options.loadPoint) {
      assembler.listingLoadPoint = this.options.loadPoint;
    }

    // Set input and output file names
    assembler.inputFileName = this.inputFileName;
    assembler.outputFileName = this.outputFileName || this.constructOutputFileName(this.inputFileName);

    // Update this.outputFileName to match assembler's output
    this.outputFileName = assembler.outputFileName;

    // Store the assembler instance
    this.assembler = assembler;

    try {
      // Run the assembler's main function
      assembler.main([this.inputFileName]);
    } catch (error) {
      cliWrappedErrorExit(`Error assembling ${this.inputFileName}:`, error, 1);
    }

  }

  // Executes the output file
  // includeSourceCode: boolean, includeComments: boolean
  // includeSourceCode: whether to include source code in the .lst and .bst files (true when assembling and interpretting .a files)
  // includeComments: whether to include comments in the .lst and .bst files (this option is set to true just for .bin files currently)
  executeFile(includeSourceCode, includeComments) {
    const interpreter = new Interpreter();

    // Set options in the interpreter
    interpreter.options = this.options;
    interpreter.debugMode = !!this.options.debug;
    interpreter.allowRuntimeDebugging = true;

    // Pass inputBuffer to interpreter
    if (this.inputBuffer) {
      interpreter.inputBuffer = this.inputBuffer;
    }

    // Store the interpreter instance
    this.interpreter = interpreter;

    // Load the executable file
    interpreter.loadExecutableFile(this.outputFileName);

    let lstFileName;
    let bstFileName;

    if (this.generateStats) {
      // After execution, generate .lst and .bst files
      lstFileName = constructSiblingFileName(this.outputFileName, '.lst');
      bstFileName = constructSiblingFileName(this.outputFileName, '.bst');

      console.log(`lst file = ${lstFileName}`);
      console.log(`bst file = ${bstFileName}`);
      console.log('====================================================== Output');
    }

    // Run the interpreter
    try {
      interpreter.run();
      if (this.generateStats) {
        console.log(); // Ensure cursor moves to the next line
      }
    } catch (error) {
      cliWrappedErrorExit(`Error running ${this.outputFileName}:`, error, 1);
    } finally {
      interpreter.allowRuntimeDebugging = false;
    }

    if (this.generateStats) {
      // Generate .lst and .bst files using genStats.js only when the wrapper
      // is actually going to write those report artifacts.
      const { lstContent, bstContent } = this.buildReportArtifacts(includeSourceCode, includeComments);

      // Write the .lst and .bst files
      writeReportFiles(this.outputFileName, lstContent, bstContent);
    } else {
      // console.clear();
    }
  }
}

module.exports = LCC;

if (require.main === module) {
  const lcc = new LCC();
  lcc.main();
}
