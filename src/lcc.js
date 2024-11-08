#!/usr/bin/env node

// lcc.js

const fs = require('fs');
const path = require('path');
const Assembler = require('./assembler');
const Interpreter = require('./interpreter');
const nameHandler = require('./name.js');
const { generateBSTLSTContent } = require('./genStats.js');

class LCC {
  constructor() {
    this.inputFileName = '';
    this.outputFileName = '';
    this.options = {};
    this.args = [];
    this.assembler = null;
    this.interpreter = null;
    this.userName = 'LASTNAME, FIRSTNAME'; // Update with your name
  }

  main(args) {
    args = args || process.argv.slice(2);

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

    try {
      this.userName = nameHandler.createNameFile(this.inputFileName);
    } catch (error) {
      console.error('Error handling name file:', error.message);
      process.exit(1);
    }

    const ext = path.extname(this.inputFileName).toLowerCase();

    switch (ext) {
      case '.hex':
      case '.bin':
      case '.e':
        // Execute and output .lst, .bst files
        this.outputFileName = this.inputFileName;
        this.executeFile(false); // includeSourceCode = false
        break;
      case '.o':
        // Linking is not yet implemented
        console.error('Linking .o files is not yet implemented.');
        process.exit(1);
        break;
      case '.a':
      default:
        // Assemble and output .e, .lst, .bst files
        this.assembleFile();
        this.executeFile(true); // includeSourceCode = true
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
    console.log('   .hex: execute and output .lst, .bst files');
    console.log('   .bin: execute and output .lst, .bst files');
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
    console.log('LCC.js Ver 6.3\n');
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

    // Store the assembler instance
    this.assembler = assembler;

    // Run the assembler's main function
    assembler.main([this.inputFileName]);
  }

  executeFile(includeSourceCode) {
    const interpreter = new Interpreter();

    // Set options in the interpreter
    interpreter.options = this.options;

    // Store the interpreter instance
    this.interpreter = interpreter;

    // Load the executable file
    interpreter.loadExecutableFile(this.outputFileName);

    // Run the interpreter
    try {
      interpreter.run();
      console.log(); // Ensure cursor moves to the next line
    } catch (error) {
      console.error(`Error running ${this.outputFileName}: ${error.message}`);
      process.exit(1);
    }

    // After execution, generate .lst and .bst files
    const lstFileName = this.outputFileName.replace(/\.e$/, '.lst');
    const bstFileName = this.outputFileName.replace(/\.e$/, '.bst');

    console.log(`lst file = ${lstFileName}`);
    console.log(`bst file = ${bstFileName}`);
    console.log('====================================================== Output');

    // Generate .lst and .bst files using genStats.js
    const lstContent = generateBSTLSTContent({
      isBST: false,
      interpreter: interpreter,
      assembler: includeSourceCode ? this.assembler : null,
      includeSourceCode: includeSourceCode,
      userName: interpreter.userName,
      inputFileName: this.inputFileName,
    });

    const bstContent = generateBSTLSTContent({
      isBST: true,
      interpreter: interpreter,
      assembler: includeSourceCode ? this.assembler : null,
      includeSourceCode: includeSourceCode,
      userName: interpreter.userName,
      inputFileName: this.inputFileName,
    });

    // Write the .lst and .bst files
    fs.writeFileSync(lstFileName, lstContent);
    fs.writeFileSync(bstFileName, bstContent);
  }
}

module.exports = LCC;

if (require.main === module) {
  const lcc = new LCC();
  lcc.main();
}
