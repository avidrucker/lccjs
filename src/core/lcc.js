#!/usr/bin/env node

// lcc.js

const fs = require('fs');
const path = require('path');
const Assembler = require('./assembler');
const Interpreter = require('./interpreter');
const Linker = require('./linker');
const nameHandler = require('../utils/name.js');
const { generateBSTLSTContent } = require('../utils/genStats.js');

const newline = process.platform === 'win32' ? '\r\n' : '\n';

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
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

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length === 0) {
      this.printHelp();
      fatalExit('No input file specified. Printing help message.', 0);
    }

    this.parseArguments(args);

    if (this.args.length === 0) {
      console.error('No input file specified.');
      fatalExit('No input file specified.', 1);
    }

    // If multiple inputs were supplied, the "main input file" is the first one
    this.inputFileName = this.args[0];

    try {
      this.userName = nameHandler.createNameFile(this.inputFileName);
    } catch (error) {
      console.error('Error handling name file:', error.message);
      fatalExit('Error handling name file: ' + error.message, 1);
    }

    // TODO: (extra feature) check similarly to see if multiple .a files were 
    // supplied for multi-file assembly.
    // Note: The original LCC does not check to confirm that all supplied files of .o extension
    // const allAreObjectFiles = this.args.every(file => path.extname(file).toLowerCase() === '.o');
    
    // Simply check to see whether the first argument is a .o file
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
   * Link multiple .o files into a single executable
   */
  linkObjectFiles(objectFiles) {
    // If user provided `-o <outfile>` on the command line, we'll have it in this.outputFileName
    // Otherwise default to `link.e` just like original LCC
    let outputFile = this.outputFileName || 'link.e';

    // Create the Linker
    const linker = new Linker();

    // Perform actual linking
    linker.link(objectFiles, outputFile);
    // The Linker class will print "Creating executable file link.e" or whatever name is specified
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
    const parsedPath = path.parse(inputFileName);
    // Remove extension and add '.e'
    return path.format({ ...parsedPath, base: undefined, ext: '.e' });
  }

  printHelp() {
    console.log('Usage: lcc.js <infile>');
    console.log('Optional args: -d -m -r -t -f -x -l<hex loadpt> -o <outfile> -h');
    console.log('   -d:   debug, -m mem display at end, -r: reg display at end');
    console.log('   -f:   full line display, -x: 4 digit hout, -h: help');
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
                console.error('Missing output file name'); // No output file specified after -o
                fatalExit('Missing output file name after -o flag', 1);
              }
            } else {
              console.error(`Unknown option: ${arg}`);
              fatalExit(`Unknown option: ${arg}`, 1);
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
      console.error(`Error assembling ${this.inputFileName}: ${error.message}`);
      fatalExit(`Error assembling ${this.inputFileName}: ${error.message}`, 1);
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
      lstFileName = this.outputFileName.replace(/\.e$/, '.lst');
      bstFileName = this.outputFileName.replace(/\.e$/, '.bst');

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
      console.error(`Error running ${this.outputFileName}: ${error.message}`);
      fatalExit(`Error running ${this.outputFileName}: ${error.message}`, 1);
    }

    if (this.generateStats) {
      // Generate .lst and .bst files using genStats.js
      const lstContent = generateBSTLSTContent({
        isBST: false,
        interpreter: interpreter,
        assembler: includeSourceCode || includeComments ? this.assembler : null,
        userName: this.userName,
        inputFileName: this.inputFileName,
        includeComments: includeComments,
      });

      const bstContent = generateBSTLSTContent({
        isBST: true,
        interpreter: interpreter,
        assembler: includeSourceCode || includeComments ? this.assembler : null,
        userName: this.userName,
        inputFileName: this.inputFileName,
        includeComments: includeComments,
      });

      // Write the .lst and .bst files
      fs.writeFileSync(lstFileName, lstContent);
      fs.writeFileSync(bstFileName, bstContent);
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
