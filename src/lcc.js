#!/usr/bin/env node

// lcc.js
// LCC.js Main Program

const path = require('path');
const Assembler = require('./assembler');
const Interpreter = require('./interpreter');

class LCC {
  constructor() {
    this.inputFileName = '';
    this.outputFileName = '';
    this.options = {};
    this.args = [];
  }

  main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
      this.printHelp();
      process.exit(0);
    }

    this.parseArguments(args);

    if (this.args.length === 0) {
      console.error('No input file specified.');
      process.exit(1);
    }

    this.inputFileName = this.args[0];

    const ext = path.extname(this.inputFileName).toLowerCase();

    switch (ext) {
      case '.hex':
      case '.bin':
      case '.e':
        // Execute and output .lst, .bst files
        this.executeFile();
        break;
      case '.o':
        // Linking is not implemented
        console.error('Linking .o files is not implemented.');
        process.exit(1);
        break;
      case '.a':
      default:
        // Assemble and output .e, .lst, .bst files
        this.assembleFile();
        this.executeFile();
        break;
    }
  }

  constructOutputFileName(inputFileName) {
    const parsedPath = path.parse(inputFileName);
    // Remove extension and add '.e'
    return path.format({ ...parsedPath, base: undefined, ext: '.e' });
  }

  printHelp() {
    console.log('Enter command line arguments or hit Enter to quit\n');
    console.log('Usage: lcc.js <infile>');
    console.log('Optional args: -d -m -r -t -f -x -l<hex loadpt> -o <outfile> -h');
    console.log('   -d:   debug, -m mem display at end, -r: reg display at end');
    console.log('   -f:   full line display, -x: 4 digit hout, -h: help');
    console.log('What lcc.js does depends on the extension in the input file name:');
    console.log('   .hex: execute and output .e, .lst, .bst files');
    console.log('   .bin: execute and output .e, .lst, .bst files');
    console.log('   .e:   execute and output .lst, .bst files');
    console.log('   .o:   link files and output executable file');
    console.log('   .a or other: assemble and output .e or .o, .lst, .bst files');
    console.log('File types:');
    console.log('   .hex: machine code in ascii hex');
    console.log('   .bin: machine code in ascii binary');
    console.log('   .e:   executable');
    console.log('   .o    linkable object module');
    console.log('   .lst: time-stamped listing in hex and output from run');
    console.log('   .bst: time-stamped listing in binary and output from run');
    console.log('   .a or other: assembler code');
    console.log('LCC.js Ver 1.0\n');
    console.log('Hit Enter to finish');
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
          case '-h':
            this.printHelp();
            process.exit(0);
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
                console.error('No output file specified after -o');
                process.exit(1);
              }
            } else {
              console.error(`Unknown option: ${arg}`);
              process.exit(1);
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
  
    // Run the assembler's main function
    assembler.main();
  }  

  executeFile() {
    const interpreter = new Interpreter();

    // Set options in the interpreter
    interpreter.options = this.options;

    // Load the executable file
    interpreter.loadExecutableFile(this.outputFileName);

    // Run the interpreter
    try {
      interpreter.run();

      // Output the interpreter's output
      //// console.log(interpreter.output);

      //// Write lst and bst files
      // ... (rest of the code)
    } catch (error) {
      console.error(`Error running ${this.outputFileName}: ${error.message}`);
      process.exit(1);
    }
  }
}

const lcc = new LCC();
lcc.main();
