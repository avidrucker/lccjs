#!/usr/bin/env node

// lcc.js
// LCC.js Main Program
// LCC stands for Low Cost Computer

const fs = require('fs');
const path = require('path');
const Assembler = require('./assembler');
const Interpreter = require('./interpreter');
const nameHandler = require('./name.js');

class LCC {
  constructor() {
    this.inputFileName = '';
    this.outputFileName = '';
    this.options = {};
    this.args = [];
    this.userName = 'LASTNAME, FIRSTNAME'; //// Update with your name
    this.assembler = null;
    this.interpreter = null;
    this.userName = '';
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
        this.executeFile();
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
    console.log('LCC.js Ver 0.1\n');
    //// console.log('Hit Enter to finish');
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

  executeFile() {
    const interpreter = new Interpreter();

    // Set options in the interpreter
    interpreter.options = this.options;

    // Store the interpreter instance
    this.interpreter = interpreter;

    // Load the executable file
    interpreter.loadExecutableFile(this.outputFileName);

    // Run the interpreter
    try {
      const bstFileName = this.constructBSTFileName(this.inputFileName);
      console.log(`bst file = ${bstFileName}`);
      console.log("====================================================== Output");

      interpreter.run();

      process.stdout.write("\n");

      // Generate the BST content
      const bstContent = this.generateBSTContent();
      // Write the BST file
      fs.writeFileSync(bstFileName, bstContent);
    } catch (error) {
      console.error(`Error running ${this.outputFileName}: ${error.message}`);
      process.exit(1);
    }
  }

  constructBSTFileName(inputFileName) {
    const parsedPath = path.parse(inputFileName);
    // Remove extension and add '.bst'
    return path.format({ ...parsedPath, base: undefined, ext: '.bst' });
  }

  generateBSTContent() {
    let content = '';

    // Compute the maximum label length
    let maxLabelLength = 0;
    this.assembler.listing.forEach(entry => {
      if (entry.label) {
        maxLabelLength = Math.max(maxLabelLength, entry.label.length);
      }
    });

    // If no labels, default indent for code is 4 spaces
    let codeIndent = maxLabelLength > 0 ? maxLabelLength + 2 : 4;

    // Header
    content += `LCC.js Assemble/Link/Interpret/Debug Ver 0.1  ${new Date().toLocaleString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}\n`;
    content += `${this.userName}\n\n`;

    content += 'Header\n';
    content += 'o\nC\n\n';

    content += 'Loc          Code                   Source Code\n';

    if (this.assembler.errorFlag) {
      // Output errors
      this.assembler.errors.forEach(error => {
        content += `${error}\n`;
      });
    } else {

      // Output listing
      this.assembler.listing.forEach(entry => {
        let locCtr = entry.locCtr;

        const labelStr = entry.label ? entry.label + ':' : '';
        const mnemonicAndOperands = entry.mnemonic ? entry.mnemonic + ' ' + entry.operands.join(', ') : '';
        // Prepare the sourceStr
        const sourceStr = (labelStr + ' ' + mnemonicAndOperands).trim();

        entry.codeWords.forEach((word, index) => {
          const locStr = locCtr.toString(16).padStart(4, '0');
          const wordStr = word.toString(2).padStart(16, '0').replace(/(.{4})/g, '$1 ').trim();
          const codeStr = wordStr.padEnd(23);

          if (index === 0) {
            // For the first word, include the source code
            // Prepare the label part, padded to codeIndent
            let labelPart = '';
            if (entry.label) {
              labelPart = entry.label + ':';
              labelPart = labelPart.padEnd(codeIndent);
            } else {
              labelPart = ' '.repeat(codeIndent);
            }

            const lineStr = `${locStr}  ${codeStr}${labelPart}${mnemonicAndOperands}\n`;
            content += lineStr;
          } else {
            // For subsequent words, no label or source code
            content += `${locStr}  ${codeStr}\n`;
          }

          locCtr++; // Increment location counter for each word
        });

        // Insert a blank line after the 'halt' instruction
        if (entry.mnemonic && entry.mnemonic.toLowerCase() === 'halt') {
          content += '\n';
        }
      });

    }

    // Output section
    content += '====================================================== Output\n';
    content += `${this.interpreter.output}\n`;

    // Program statistics
    content += '========================================== Program statistics\n';

    // Prepare the statistics
    const stats = [
      { label: 'Input file name', value: this.inputFileName },
      { label: 'Instructions executed', value: `${this.interpreter.instructionsExecuted.toString(16)} (hex)    ${this.interpreter.instructionsExecuted} (dec)` },
      { label: 'Program size', value: `${this.assembler.programSize.toString(16)} (hex)    ${this.assembler.programSize} (dec)` },
      { label: 'Max stack size', value: `${this.interpreter.maxStackSize.toString(16)} (hex)    ${this.interpreter.maxStackSize} (dec)` },
      { label: 'Load point', value: `${this.assembler.loadPoint.toString(16)} (hex)    ${this.assembler.loadPoint} (dec)` }
    ];

    const maxStatLabelLength = Math.max(...stats.map(s => s.label.length));

    stats.forEach(stat => {
      const label = stat.label.padEnd(maxStatLabelLength + 4); // Add 4 spaces for padding
      content += `${label}=   ${stat.value}\n`;
    });


    return content;
  }
}

module.exports = LCC;

if (require.main === module) {
  const lcc = new LCC();
  lcc.main();
}
