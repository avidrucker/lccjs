#!/usr/bin/env node

// assembler.js
// LCC.js Assembler

/*
 * The Assembler class performs a two-pass assembly process:
 * Pass 1: Parses the source lines, builds the symbol table, and handles labels.
 * Pass 2: Generates machine code based on the symbol table and source lines.
*/

const fs = require('fs');
const path = require('path');
const { generateBSTLSTContent } = require('../utils/genStats.js');
const nameHandler = require('../utils/name.js');

const isTestMode = (typeof global.it === 'function'); // crude check for Jest

function fatalExit(message, code = 1) {
  if (isTestMode) {
    throw new Error(message);
  } else {
    process.exit(code);
  }
}

// Set to false to match original LCC behavior of reporting only a single error at a time
const REPORT_MULTI_ERRORS = false;

class Assembler {
  constructor() {
    /**
     * Symbol table: symbol to address mapping
     */
    this.symbolTable = {}; 

    /**
     * Location counter
     */
    this.locCtr = 0;

    /**
     * Line number
     */
    this.lineNum = 0;

    /**
     * Array of source code lines
     */
    this.sourceLines = []; 

    /**
     * Error flag
     */
    this.errorFlag = false; 

    /**
     * Current pass (1 or 2)
     */
    this.pass = 1; 

    /**
     * Set of labels to detect duplicates
     */
    this.labels = new Set(); 

    /**
     * Collect errors
     */
    this.errors = []; 

    /**
     * Buffer to hold machine code words
     */
    this.outputBuffer = []; 

    /**
     * Input file name
     */
    this.inputFileName = ''; 

    /**
     * Output file name
     */
    this.outputFileName = ''; 

    /**
     * Output file handle
     */
    this.outFile = null; 

    /**
     * This will store information about each line, including the location counter (locCtr), machine code words, and the source code line.
     */
    this.listing = []; 

    /**
     * Load point
     */
    this.loadPoint = 0;

    /**
     * Program size
     */
    this.programSize = 0;

    /**
     * Label specified in .start directive
     */
    this.startLabel = null;     

    /**
     * Resolved address of the start label
     */
    this.startAddress = null;   

    /**
     * Flag to indicate if the code is to be made into a .o object file
     */
    this.isObjectModule = false; 

    /**
     * Set of global labels to be exported
     */
    this.globalLabels = new Set(); 

    /**
     * Set of external labels to be imported
     */
    this.externLabels = new Set(); 

    /**
     * Array to store external references
     */
    this.externalReferences = []; 

    /**
     * Array to store adjustment entries
     */
    this.adjustmentEntries = [];
  }

  /**
   * Adds the given address to the adjustmentEntries array if it is not already included.
   *
   * @param {number} address - The address to be added to the adjustmentEntries array.
   */
  handleAdjustmentEntry(address) {
    if (!this.adjustmentEntries.includes(address)) {
      this.adjustmentEntries.push(address);
    }
  }

  main(args) {
    args = args || process.argv.slice(2);

    //// TODO: change logic here to only give usage message
    ////       if no input files are provided
    // Check if inputFileName is already set
    if (!this.inputFileName) {
      if (args.length !== 1) {
        console.error('Usage: assembler.js <input filename>');
        fatalExit('Usage: assembler.js <input filename>', 1);
      }
      this.inputFileName = args[0];
    }

    // Read the source code from the input file
    try {
      const sourceCode = fs.readFileSync(this.inputFileName, 'utf-8');
      this.sourceLines = sourceCode.split('\n');
    } catch (err) {
      console.error(`Cannot open input file ${this.inputFileName}`); // , err: ${err}
      fatalExit(`Cannot open input file ${this.inputFileName}`, 1); // , err: ${err}
    }

    const extension = path.extname(this.inputFileName).toLowerCase();

    // If the file ends in ".bin", parse it as raw binary instead of doing normal assembly
    if (extension === '.bin') {
      // Note: The original LCC does not print any message for assemnbling a .bin file as
      // of 12/2024. I say this should be here to provide user feedback & good UX
      console.log(`Assembling ${this.inputFileName}`);

      this.parseBinFile();
      // Construct output filename with .e extension
      this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');
      // Now write the output as a .e file
      this.writeOutputFile();
      
    } else if (extension === '.hex') {
      console.log(`Assembling ${this.inputFileName}`);
      this.parseHexFile();
      this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');
      this.writeOutputFile();
    } else if (extension === '.a') {

      // If a .a file, proceed with normal two-pass assembly...
      // Construct the output file name by replacing extension with '.e'
      this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');

      // Perform Pass 1
      console.log('Starting assembly pass 1');
      this.pass = 1;
      this.locCtr = 0;
      this.loadPoint = 0; // TODO: fix this to not be hardcoded, because flags may dictate where in memory the program starts
      this.lineNum = 0;
      this.errorFlag = false;
      this.symbolTable = {};
      this.labels.clear();
      this.errors = [];
      this.performPass();

      if(this.locCtr === 0) {
        console.error('Empty file');
        fatalExit('Empty file', 0); // No instructions or data found in source file
      }

      if (this.errorFlag) {
        // console.error('Errors encountered during Pass 1.');
        // this.errors.forEach(error => console.error(error));
        fatalExit('Errors encountered during Pass 1.', 1);
      }

      // Rewind source lines for Pass 2
      console.log('Starting assembly pass 2');
      this.pass = 2;
      this.locCtr = 0;
      this.lineNum = 0;
      this.performPass();

      // After Pass 2
      if (this.isObjectModule) {
        // Change output extension to .o
        this.outputFileName = this.constructOutputFileName(this.inputFileName, '.o');
      }

      if (this.errorFlag) {
        // console.error('Errors encountered during Pass 2.');
        // Close the output file only if it's open
        if (this.outFile !== null) {
          fs.closeSync(this.outFile);
        }
        fatalExit('Errors encountered during Pass 2.', 1);
      }

      // **Resolve the start label to an address**
      if (this.startLabel !== null) {
        if (this.symbolTable.hasOwnProperty(this.startLabel)) {
          this.startAddress = this.symbolTable[this.startLabel];
        } else {
          // Note: as of 12/2024, LCC does not print any message for this case
          //       and instead ignores undefined .start labels (but it shouldn't)
          //       so this is a custom LCC.js behavior
          this.error(`Undefined label`); // Undefined start label: ${this.startLabel}
          fatalExit(`Undefined label`, 1);
        }
      } else {
        // If no .start directive, default start address is 0
        this.startAddress = 0;
      }

      // **Write the output file after Pass 2**
      this.writeOutputFile();

      // After writing the output file, handle additional outputs
      if (this.isObjectModule) {

        // Get the userName using nameHandler
        try {
          this.userName = nameHandler.createNameFile(this.inputFileName);
        } catch (error) {
          console.error('Error handling name file:', error.message);
          fatalExit('Error handling name file: ' + error.message, 1);
        }

        console.log(`Output file ${this.outputFileName} needs linking`);
      
        // Generate .lst and .bst files
        const lstFileName = this.constructOutputFileName(this.inputFileName, '.lst');
        const bstFileName = this.constructOutputFileName(this.inputFileName, '.bst');

        // Generate content for .lst file
        const lstContent = generateBSTLSTContent({
          isBST: false,
          assembler: this,
          includeSourceCode: true,
          userName: this.userName, 
          inputFileName: this.inputFileName,
          includeComments: false // note: this flag is only for .bin files
        });

        // Generate content for .bst file
        const bstContent = generateBSTLSTContent({
          isBST: true,
          assembler: this,
          includeSourceCode: true,
          userName: this.userName, 
          inputFileName: this.inputFileName,
          includeComments: false // note: this flag is only for .bin files
        });

        // Write the .lst file
        fs.writeFileSync(lstFileName, lstContent, 'utf-8');

        // Write the .bst file
        fs.writeFileSync(bstFileName, bstContent, 'utf-8');

        console.log(`lst file = ${lstFileName}`);
        console.log(`bst file = ${bstFileName}`);
      }

    } else {
      // Note: Treating only .a files as valid assembly files is
      //       a unique LCC.js behavior as of 12/2024 (the official
      //       LCC behavior is to treat all non .bin, .hex, .o, and 
      //       .e files as assembly files)
      if (extension === '.ap') {
        console.error('Error: .ap files are not supported by assembler.js - Did you mean to use assemblerPlus.js?');
        fatalExit('Error: .ap files are not supported by assembler.js - Did you mean to use assemblerPlus.js?', 1);
      }
      console.error('Unsupported file type');
      fatalExit('Unsupported file type', 1);
    }

  }

  writeOutputFile(secondIntroHeader = '') {
    // Open the output file for writing
    try {
      this.outFile = fs.openSync(this.outputFileName, 'w');
    } catch (err) {
      console.error(`Cannot open output file ${this.outputFileName}`);
      fatalExit(`Cannot open output file ${this.outputFileName}`, 1);
    }
  
    // Write the initial header 'o' to the output file
    fs.writeSync(this.outFile, 'o');

    // Custom LCC.js behavior as of 12/2024:
    // Write the second intro header if it is provided
    // This enables extensions that need use special header entries
    if(secondIntroHeader !== '') {
      fs.writeSync(this.outFile, secondIntroHeader);
    }
  
    // Collect all header entries
    let headerEntries = [];
  
    // Add 'S' entry if present
    if (this.startLabel !== null && this.startAddress !== null) {
      headerEntries.push({ type: 'S', address: this.startAddress });
    }
  
    // Collect 'G' entries
    for (let label of this.globalLabels) {
      const address = this.symbolTable[label];
      headerEntries.push({ type: 'G', address: address, label: label });
    }
  
    // Collect external references ('E', 'e', 'V')
    for (let ref of this.externalReferences) {
      headerEntries.push({ type: ref.type, address: ref.address, label: ref.label });
    }
  
    // Collect 'A' entries
    for (let address of this.adjustmentEntries) {
      headerEntries.push({ type: 'A', address: address });
    }
  
    // Now sort the header entries by address
    headerEntries.sort((a, b) => a.address - b.address);
  
    // Write the header entries
    for (let entry of headerEntries) {
      switch (entry.type) {
        case 'S': {
          const buffer = Buffer.alloc(3);
          buffer.write('S', 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          fs.writeSync(this.outFile, buffer);
          break;
        }
        case 'G': {
          const buffer = Buffer.alloc(3 + entry.label.length + 1);
          buffer.write('G', 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          buffer.write(entry.label, 3, 'ascii');
          buffer.writeUInt8(0, 3 + entry.label.length);
          fs.writeSync(this.outFile, buffer);
          break;
        }
        case 'E':
        case 'e':
        case 'V': {
          const buffer = Buffer.alloc(3 + entry.label.length + 1);
          buffer.write(entry.type, 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          buffer.write(entry.label, 3, 'ascii');
          buffer.writeUInt8(0, 3 + entry.label.length);
          fs.writeSync(this.outFile, buffer);
          break;
        }
        case 'A': {
          const buffer = Buffer.alloc(3);
          buffer.write('A', 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          fs.writeSync(this.outFile, buffer);
          break;
        }
        default:
          // Should not reach here
          this.error("invalid header entry error");
          break;
      }
    }
  
    // Write the code start marker 'C'
    fs.writeSync(this.outFile, 'C');
  
    // Write machine code words
    const codeBuffer = Buffer.alloc(this.outputBuffer.length * 2);
    for (let i = 0; i < this.outputBuffer.length; i++) {
      codeBuffer.writeUInt16LE(this.outputBuffer[i], i * 2);
    }
    fs.writeSync(this.outFile, codeBuffer);
  
    // Close the output file
    fs.closeSync(this.outFile);
  }  

  constructOutputFileName(inputFileName, extension) {
    const parsedPath = path.parse(inputFileName);
    // Remove extension and add the specified extension
    return path.format({ ...parsedPath, base: undefined, ext: extension });
  }

  // validates that a label either starts at the beginning of a line
  // or is terminated with a colon, or both
  isValidLabelDef(tokens, originalLine) {
    return (tokens[0].endsWith(':') || !this.isWhitespace(originalLine[0]));
  }

  // validates that a label starts with a letter, _, $, or @, and is 
  // (optionally) followed by letters, digits, _, $, or @
  isValidLabel(label) {
    // Example pattern: starts with letter, _, $, @; followed by letters, digits, _, $, @
    return /^[A-Za-z_$@][A-Za-z0-9_$@]*$/.test(label);
  }

  /*
  * performPass currently handles multiple responsibilities:
  * - Reading lines from the source file.
  * - Tokenizing each line.
  * - Handling labels, directives, and instructions.
  * - Updating the location counter.
  */
  performPass() {
    // At the beginning of Pass 1
    if (this.pass === 1) {
      this.loadPoint = this.locCtr;
    }

    if (this.pass === 2) {
      this.outputBuffer = [];
    }

    for (let line of this.sourceLines) {
      this.lineNum++;
      let originalLine = line;
      this.currentLine = originalLine; // Store current line for error reporting
      
      // Create listing entry
      const listingEntry = {
        lineNum: this.lineNum,
        locCtr: this.locCtr,
        sourceLine: originalLine,
        codeWords: [],
        label: null,
        mnemonic: null,
        operands: [],
        comment: ''
      };
      this.currentListingEntry = listingEntry;

      // Extract the comment substring (everything after ';'), if any
      let comment = '';
      let semicolonIndex = line.indexOf(';');
      if (semicolonIndex !== -1) {
        // everything after ';'
        comment = line.substring(semicolonIndex + 1).trim();
      }
      // Store the comment in the listing entry
      listingEntry.comment = comment;
      
      // Remove comments and trim whitespace
      line = line.split(';')[0].trim();
      if (line === '') {
        // Empty line after removing comments
        if (this.pass === 2) {
          this.listing.push(listingEntry);
        }
        continue;
      }

      // Tokenize the line
      let tokens = this.tokenizeLine(line);
      if (tokens.length === 0) {
        if (this.pass === 2) {
          this.listing.push(listingEntry);
        }
        continue;
      }

      let label = null;
      let mnemonic = null;
      let operands = [];

      // console.log("Tokens: ", tokens);

      // Check if line starts with a label
      if (tokens.length > 0 && this.isValidLabelDef(tokens, originalLine)) {
        // Remove the trailing colon from the label if the colon exists
        label = tokens.shift();
        if(label.endsWith(':')) {
          label = label.slice(0, -1); 
        }
        if (!this.isValidLabel(label)) {
          this.error(`Bad label`); // `Invalid label format: ${label}`
        }
        if (this.pass === 1) {
          if (this.labels.has(label)) {
            this.error(`Duplicate label`); // `Duplicate label: ${label}`
          } else {
            this.symbolTable[label] = this.locCtr;
            this.labels.add(label);
          }
        }
      }

      if (tokens.length > 0) {
        mnemonic = tokens.shift().toLowerCase();
      } else {
        if (this.pass === 2) {
          this.listing.push(listingEntry);
        }
        continue; // No mnemonic, skip line
      }

      operands = tokens;

      // Update listingEntry
      listingEntry.label = label;
      listingEntry.mnemonic = mnemonic;
      listingEntry.operands = operands;

      // Handle directives and instructions
      if (mnemonic.startsWith('.')) {
        // Directive
        this.handleDirective(mnemonic, operands);
      } else {
        // Instruction
        this.handleInstruction(mnemonic, operands);
      }

      if (this.locCtr > 65536) {
        this.error('Program too big');
        return;
      }

      // At the end of processing the line
      if (this.pass === 2) {
        this.listing.push(listingEntry);
      }
    }

    // At the end of Pass 2
    if (this.pass === 2) {
      this.programSize = this.locCtr - this.loadPoint;

      //// possible bug/strange lcc behavior:
      //// remove a single empty line from the listing
      //// if it is the last line
      // console.log("last line of file is: '", this.listing[this.listing.length - 1], "'");
      if(this.listing[this.listing.length - 1].sourceLine.trim() === '') {
        this.listing.pop();
      }
    }
  }

  parseHexFile() {
    this.outputBuffer = [];
    this.locCtr = 0;
    this.loadPoint = 0;
    for (let lineNum = 0; lineNum < this.sourceLines.length; lineNum++) {
      this.lineNum++;
      let line = this.sourceLines[lineNum];
      this.currentLine = line; // For error messages

      const listingEntry = {
        lineNum: this.lineNum,
        locCtr: this.locCtr,
        sourceLine: line,
        macWord: '',
        comment: ''
      }

      // Extract the comment substring (everything after ';'), if any
      let comment = '';
      let semicolonIndex = line.indexOf(';');
      if (semicolonIndex !== -1) {
        // everything after ';'
        comment = line.substring(semicolonIndex + 1).trim();
      }
      // Store the comment in the listing entry
      listingEntry.comment = comment;

      // Remove everything after semicolon
      if (line.indexOf(';') !== -1) {
        line = line.substring(0, line.indexOf(';'));
      }
      // Trim and remove all internal spaces
      line = line.trim().replace(/\s+/g, '');
      if (line.length === 0) {
        continue; // empty or comment-only line
      }
  
      // Now we should have a 16-bit hexadecimal string
      // For example: "4B1F"
      if (!/^[0-9A-Fa-f]+$/.test(line)) {
        console.error(`Error: line ${lineNum+1} in .hex file is not purely hexadecimal: "${line}"`);
        fatalExit(`Error: line ${lineNum+1} in .hex file is not purely hexadecimal: "${line}"`, 1);
      }
      if (line.length !== 4) {
        console.error(`Error: line ${lineNum+1} in .hex file does not have exactly 4 nibbles: "${line}"`);
        fatalExit(`Error: line ${lineNum+1} in .hex file does not have exactly 4 nibbles: "${line}"`, 1);
      }
  
      // Convert the binary string to a number
      let wordValue = parseInt(line, 16);
  
      // Push the parsed word into outputBuffer
      this.outputBuffer.push(wordValue & 0xFFFF);
      this.locCtr++;

      // Store the machine word in the listing entry
      listingEntry.macWord = wordValue;

      // Store the listing entry
      this.listing.push(listingEntry);
    }

    // Note: Reporting an empty hex file is custom LCC.js behavior in 12/2024
    //       (this does not match current official LCC behavior)
    if (this.locCtr === 0) {
      console.error('Empty file');
      fatalExit('Empty file', 0); // No instructions or data found in source file
    }
  
    // If you want a "startAddress = 0" by default, do that here
    this.startAddress = 0;     // or your choice
    this.startLabel = null;    // No .start directive in raw hex files
  }

  parseBinFile() {
    this.outputBuffer = [];     // Prepare output buffer
    this.locCtr = 0;
    this.loadPoint = 0; // TODO: fix this to not be hardcoded, because flags may dictate where in memory the program starts
    for (let lineNum = 0; lineNum < this.sourceLines.length; lineNum++) {
      this.lineNum++;
      let line = this.sourceLines[lineNum];
      this.currentLine = line; // For error messages

      const listingEntry = {
        lineNum: this.lineNum,
        locCtr: this.locCtr,
        sourceLine: line,
        macWord: '',
        comment: ''
      }

      // Extract the comment substring (everything after ';'), if any
      let comment = '';
      let semicolonIndex = line.indexOf(';');
      if (semicolonIndex !== -1) {
        // everything after ';'
        comment = line.substring(semicolonIndex + 1).trim();
      }
      // Store the comment in the listing entry
      listingEntry.comment = comment;

      // Remove everything after semicolon
      if (line.indexOf(';') !== -1) {
        line = line.substring(0, line.indexOf(';'));
      }
      // Trim and remove all internal spaces
      line = line.trim().replace(/\s+/g, '');
      if (line.length === 0) {
        continue; // empty or comment-only line
      }
  
      // Now we should have a 16-bit binary string
      // For example: "0010000000000101"
      if (!/^[01]+$/.test(line)) {
        console.error(`Error: line ${lineNum+1} in .bin file is not purely binary: "${line}"`);
        fatalExit(`Error: line ${lineNum+1} in .bin file is not purely binary: "${line}"`, 1);
      }
      if (line.length !== 16) {
        console.error(`Error: line ${lineNum+1} in .bin file does not have exactly 16 bits: "${line}"`);
        fatalExit(`Error: line ${lineNum+1} in .bin file does not have exactly 16 bits: "${line}"`, 1);
      }
  
      // Convert the binary string to a number
      let wordValue = parseInt(line, 2);
  
      // Push the parsed word into outputBuffer
      this.outputBuffer.push(wordValue & 0xFFFF);
      this.locCtr++;

      // Store the machine word in the listing entry
      listingEntry.macWord = wordValue;

      // Store the listing entry
      this.listing.push(listingEntry);
    }

    // Note: The reporting of an empty bin file is custom LCC.js behavior in 12/2024
    //       (it does not currently match official LCC behavior)
    if (this.locCtr === 0) {
      console.error('Empty file');
      fatalExit('Empty file', 0); // No instructions or data found in source file
    }
  
    // If you want a "startAddress = 0" by default, do that here
    this.startAddress = 0;     // or your choice
    this.startLabel = null;    // No .start directive in raw bin files
  } 

  tokenizeLine(line) {
    let tokens = [];
    let currentToken = '';
    let inString = false;
    let stringDelimiter = '';
    let escape = false; // Flag to indicate escape character
  
    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      if (!inString) {
        if (char === '"' || char === "'") {
          inString = true;
          stringDelimiter = char;
          currentToken += char;
        } else if (this.isWhitespace(char)) {
          if (currentToken !== '') {
            tokens.push(currentToken);
            currentToken = '';
          }
        } else if (char === ',' && !inString) {
          if (currentToken !== '') {
            tokens.push(currentToken);
            currentToken = '';
          }
        } else if (char === ':') {
          if (currentToken !== '') {
            currentToken += char;
            tokens.push(currentToken);
            currentToken = '';
          }
          // Ignore colon
        } else {
          currentToken += char;
        }
      } else {
        currentToken += char;
        if (escape) {
          escape = false; // Reset escape flag
          continue;
        }
        if (char === '\\') {
          escape = true; // Next character is escaped
        } else if (char === stringDelimiter) {
          inString = false;
          tokens.push(currentToken);
          currentToken = '';
        }
      }
    }
  
    if (currentToken !== '') {
      tokens.push(currentToken);
    }
  
    return tokens;
  }  

  isWhitespace(char) {
    return /\s/.test(char);
  }

  isStringLiteral(str) {
    return /^"(.*)"$/.test(str) || /^'(.*)'$/.test(str);
  }

  parseString(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '\\') {
        i++; // Move to the next character to check the escape sequence
        if (i >= str.length) {
          this.error(`Missing terminating quote`);
          fatalExit(`Missing terminating quote`, 1);
        }
        switch (str[i]) {
          case 'n':
            result += '\n';
            break;
          case 't':
            result += '\t';
            break;
          case '\\':
            result += '\\';
            break;
          case '"':
            result += '"';
            break;
          case 'r':
            result += '\r';
            break;
          // Add more escape sequences as needed
          default:
            this.error(`Unknown escape sequence: \\${str[i]}`);
            return null;
        }
      } else {
        result += str[i];
      }
    }
    return result;
  }

  handleDirective(mnemonic, operands) {
    mnemonic = mnemonic.toLowerCase();
    switch (mnemonic) {
      case '.start':
        
        if(operands[0] === null || operands[0] === undefined) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        if(!this.isValidLabel(operands[0])) {
          this.error("Bad operand--not a valid label");
          fatalExit("Bad operand--not a valid label", 1);
        }

        this.startLabel = operands[0];
        // Note: startAddress will be resolved after Pass 2 when all symbols are known
        break;
      case '.org':
        this.error("This directive hasn't yet been implemented");
        fatalExit("This directive hasn't yet been implemented", 1);
        break;
      case '.globl':
      case '.global':
        
        if(operands[0] === null || operands[0] === undefined) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        if(!this.isValidLabel(operands[0])) {
          this.error("Bad operand--not a valid label");
          fatalExit("Bad operand--not a valid label", 1);
        }

        this.isObjectModule = true; // Set flag to produce .o file
        let globalLabel = operands[0];
      
        if (this.pass === 1) {
          // Record the address of the global label
          if (!this.symbolTable.hasOwnProperty(globalLabel)) {
            this.symbolTable[globalLabel] = this.locCtr;
          }
          this.globalLabels.add(globalLabel);
        }
        break;
      case '.extern':
        
        if(operands[0] === null || operands[0] === undefined) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        if(!this.isValidLabel(operands[0])) {
          this.error("Bad operand--not a valid label");
          fatalExit("Bad operand--not a valid label", 1);
        }

        this.isObjectModule = true; // Set flag to produce .o file
        let externLabel = operands[0];
        this.externLabels.add(externLabel);
        break;
      case '.blkw':
      case '.space':
      case '.zero':

        if(operands[0] === null || operands[0] === undefined) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        let num = parseInt(operands[0], 10);
        if (isNaN(num)) {
          this.error("Bad number");
          fatalExit("Bad number", 1);
        }

        // Note: in the original LCC (as of 12/2024), the .zero directive arguments
        // are not checked for negativity, so this currently is a custom LCC.js behavior
        if(num < 1 || num > (65536 - this.locCtr)) {
          this.error("Bad number");
          fatalExit("Bad number", 1);
        }

        if (this.pass === 2) {
          for (let i = 0; i < num; i++) {
            this.writeMachineWord(0);
          }
        }
        this.locCtr += num;
        break;
      case '.fill':
      case '.word':
        if(operands[0] === null || operands[0] === undefined) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        if(this.isOperator(operands[0]) && (operands[1] === null || operands[1] === undefined)) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        // if (operands.length !== 1 && operands.length !== 3) {
          //// TODO: inspect to make sure that .word can handle .word x, .word x+1, and .word x + 1
          //// TODO: inspect to make sure that .word can handle .word x+ 1 and .word x +1
          //// TODO: inspect to make sure that .word behaves as expected with .word x + 1 + 1
          //// TODO: inspect to make sure that .word behaves as expected with .word <NOTHING>
          //// TODO: inspect to make sure that .word behaves as expected with .word + or .word -
          // this.error(`Invalid operand count for ${mnemonic}`);
          // return;
        // }

        if (this.pass === 2) {
          let label = operands[0];

          // if not a number castable literal, then operands[0] is a label
          if(!this.isNumLiteral(operands[0]) && operands[1] && operands[2]) {

            // if operands[2] is not a literal value, then it isn't a valid offset
            if(!this.isNumLiteral(operands[2])) {
              this.error(`Bad number`); // : ${operands[2]}
              fatalExit('Bad number', 1);
            }

            label = operands[0] + operands[1] + operands[2];
          }

          if((operands[1] && this.isOperator(operands[1])) && 
          (operands[2] === null || operands[2] === undefined)) {      
            this.error('Missing number');
            fatalExit('Missing number', 1);
          }

          let value = this.evaluateOperand(label, 'V'); // Pass 'V' as usageType
          if (value === null) {
            this.error(`Bad number`); // : ${value}
            fatalExit('Bad number', 1);
          };
      
          // see if operand is label +/- offset
          const parsed = this.parseLabelWithOffset(label);

          if (parsed && this.symbolTable.hasOwnProperty(parsed.label)) {
            // It's a local label with offset, so record an A-entry
            this.handleAdjustmentEntry(this.locCtr);
          }

          if(parsed && (parsed.offset > 65535 || parsed.offset < -32768)) {
            this.error(`Bad number`); // 'Data does not fit in 16 bits' // : ${parsed.offset}
            fatalExit('Bad number', 1); // 'Data does not fit in 16 bits'
          }

          this.writeMachineWord(value & 0xFFFF);
        }
        this.locCtr += 1;
        break;
      case '.stringz':
      case '.asciz':
      case '.string':

        if(operands[0] === null || operands[0] === undefined) {
          this.error("Missing operand");
          fatalExit("Missing operand", 1);
        }

        let strOperand = operands[0];

        if(strOperand && strOperand.length > 0) {
          if(strOperand[0] !== '"') {
            this.error("String constant missing leading quote");
            fatalExit("String constant missing leading quote", 1);
          }
        }

        if (!this.isStringLiteral(strOperand)) {
          this.error(`Missing terminating quote`);
          fatalExit(`Missing terminating quote`, 1);
        }
        // Extract the string without quotes
        let strContent = strOperand.slice(1, -1);
        strContent = this.parseString(strContent);

        if (this.pass === 1) {
          // Update location counter: length of string + 1 for null terminator
          this.locCtr += strContent.length + 1;
        } else if (this.pass === 2) {
          // Write each character's ASCII code to output
          for (let i = 0; i < strContent.length; i++) {
            let asciiValue = strContent.charCodeAt(i);
            this.writeMachineWord(asciiValue);
            this.locCtr += 1; // Increment locCtr after writing each word
          }
          // Write null terminator
          this.writeMachineWord(0);
          this.locCtr += 1; // Increment locCtr for null terminator
        }
        break;
      default:
        this.error(`Invalid operation`); // Invalid directive: ${mnemonic}
        fatalExit(`Invalid operation`, 1);
        break;
    }
  }

  handleInstruction(mnemonic, operands) {
    if (this.pass === 1) {
      this.locCtr += 1;
      return;
    }

    let machineWord = null;
    mnemonic = mnemonic.toLowerCase();
    switch (mnemonic) {
      case 'br':
      case 'bral':
      case 'brz':
      case 'bre':
      case 'brnz':
      case 'brne':
      case 'brn':
      case 'brp':
      case 'brlt':
      case 'brgt':
      case 'brc':
        machineWord = this.assembleBR(mnemonic, operands);
        break;
      case 'add':
        machineWord = this.assembleADD(operands);
        break;
      case 'sub':
        machineWord = this.assembleSUB(operands);
        break;
      case 'cmp':
        machineWord = this.assembleCMP(operands);
        break;
      case 'mov':
      case 'mvi':
      case 'mvr':
        machineWord = this.assembleMOV(mnemonic, operands);
        break;
      case 'push':
        machineWord = this.assemblePUSH(operands);
        break;
      case 'pop':
        machineWord = this.assemblePOP(operands);
        break;
      case 'srl':
        machineWord = this.assembleSRL(operands);
        break;
      case 'sra':
        machineWord = this.assembleSRA(operands);
        break;
      case 'sll':
        machineWord = this.assembleSLL(operands);
        break;
      case 'rol':
        machineWord = this.assembleROL(operands);
        break;
      case 'ror':
        machineWord = this.assembleROR(operands);
        break;
      case 'mul':
        machineWord = this.assembleMUL(operands);
        break;
      case 'div':
        machineWord = this.assembleDIV(operands);
        break;
      case 'rem':
        machineWord = this.assembleREM(operands);
        break;
      case 'or':
        machineWord = this.assembleOR(operands);
        break;
      case 'xor':
        machineWord = this.assembleXOR(operands);
        break;
      // mvr case is handled in the mov function
      case 'sext':
        machineWord = this.assembleSEXT(operands);
        break;
      case 'ld':
        machineWord = this.assembleLD(operands);
        break;
      case 'st':
        machineWord = this.assembleST(operands);
        break;
      case 'call':
      case 'jsr':
      case 'bl':
        machineWord = this.assembleBL(operands);
        break;
      case 'jsrr':
      case 'blr':
        machineWord = this.assembleBLR(operands);
        break;
      case 'and':
        machineWord = this.assembleAND(operands);
        break;
      case 'ldr':
        machineWord = this.assembleLDR(operands);
        break;
      case 'str':
        machineWord = this.assembleSTR(operands);
        break;
      case 'jmp':
        machineWord = this.assembleJMP(operands);
        break;
      case 'ret':
        machineWord = this.assembleRET(operands);
        break;
      case 'not':
        machineWord = this.assembleNOT(operands);
        break;
      case 'lea':
        machineWord = this.assembleLea(operands);
        break;
      case 'cea':
        machineWord = this.assembleCEA(operands);
        break;
      case 'halt':
        machineWord = 0xF000;
        break;
      case 'nl':
        machineWord = 0xF001;
        break;
      case 'dout':
        machineWord = this.assembleTrap(operands, 0x0002);
        break;
      case 'udout':
        machineWord = this.assembleTrap(operands, 0x0003);
        break;
      case 'hout':
        machineWord = this.assembleTrap(operands, 0x0004);
        break;
      case 'aout':
        machineWord = this.assembleTrap(operands, 0x0005);
        break;
      case 'sout':
        machineWord = this.assembleTrap(operands, 0x0006); // Trap vector for sout is 6
        break;
      case 'din':
        machineWord = this.assembleTrap(operands, 0x0007); // Trap vector for din is 7
        break;
      case 'hin':
        machineWord = this.assembleTrap(operands, 0x0008); // Trap vector for hin is 8
        break;
      case 'ain':
        machineWord = this.assembleTrap(operands, 0x0009); // Trap vector for ain is 9
        break;
      case 'sin':
        machineWord = this.assembleTrap(operands, 0x000A); // Trap vector for sin is 10
        break;
      case 'm':
        machineWord = this.assembleTrap(operands, 0x000B); // Trap vector for m is 11
        break;
      case 'r':
        machineWord = this.assembleTrap(operands, 0x000C); // Trap vector for r is 12
        break;
      case 's':
        machineWord = this.assembleTrap(operands, 0x000D); // Trap vector for s is 13
        break;
      case 'bp':
        machineWord = this.assembleTrap(operands, 0x000E); // Trap vector for bp is 14
        break;
      default:
        this.error("Invalid operation"); // this.error(`Invalid mnemonic or directive: ${mnemonic}`);
        return;
    }

    if (machineWord !== null) {
      this.writeMachineWord(machineWord);
      this.locCtr += 1;
    }
  }

  writeMachineWord(word) {
    if (this.pass === 2) {
      this.outputBuffer.push(word & 0xFFFF); // Ensure 16-bit word
      if (this.currentListingEntry) {
        this.currentListingEntry.codeWords.push(word & 0xFFFF);
      }
    }
  }

  assembleCMP(operands) {
    let sr1 = this.getRegister(operands[0]);
    if (sr1 === null) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    };
    let sr2orImm5 = operands[1];
    if (sr2orImm5 === null) return null;
    let macword = 0x8000;

    if(!this.isRegister(sr2orImm5)) {
      // compare with immediate
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, "imm5");  //// TODO: test bounds, see if input is naive or not
      macword = macword | (sr1 << 6) | (imm5 & 0x1F) | 0x0020;
    } else {
      // compare with register
      let sr2 = this.getRegister(sr2orImm5);
      if (sr2 === null) return null;
      macword = macword | (sr1 << 6) | (sr2 & 0x3);
    }
    return macword;
  }

  assembleBR(mnemonic, operands) {
    let codes = {
      'brz': 0,
      'bre': 0,
      'brnz': 1,
      'brne': 1,
      'brn': 2,
      'brp': 3,
      'brlt': 4,
      'brgt': 5,
      'brc': 6,
      'brb': 6,
      'br': 7,
      'bral': 7
    };
    let macword = (codes[mnemonic.toLowerCase()] << 9) & 0xffff;
    let label = operands[0];
    if (label === null || label === undefined) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    }
    if(!this.isNumLiteral(operands[0]) && operands[1] && operands[2]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[2])) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      }

      label = operands[0] + operands[1] + operands[2];
    }

    if((operands[1] && this.isOperator(operands[1])) && 
    (operands[2] === null || operands[2] === undefined)) {      
      this.error('Missing number');
      fatalExit('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e');
    if (address === null) {
      this.error('Bad label'); // TODO: verify this is correct via cross testing w/ LCC
      fatalExit('Bad label', 1);
    };
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range'); // for branch instruction
      return null;
    }
    macword |= (pcoffset9 & 0x01FF);
    return macword;
  }

  assembleADD(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let sr2orImm5 = operands[2];
    if (sr2orImm5 === null || sr2orImm5 === undefined) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    }
    let macword = 0x1000 | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, "imm5");
      if (imm5 === null) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      };
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assembleCEA(operands) {
    let dr = operands[0];
    let imm5op = operands[1];

    return this.assembleADD([dr, 'fp', imm5op]);
  }

  assembleSUB(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    }
    let sr2orImm5 = operands[2];
    let macword = 0xB000 | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, 'imm5');
      if (imm5 === null) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      };
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assemblePUSH(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = 0xA000 | (sr << 9);
    return macword;
  }

  assemblePOP(operands) {
    let dr = this.getRegister(operands[0]);
    if (dr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = (0xA000 | (dr << 9)) | 0x0001;
    return macword;
  }

  assembleDIV(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = 0xa008 | (dr << 9) | (sr1 << 6);
    return macword;
  }

  assembleROL(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = 0xA000 | (sr << 9) | (ct << 5) | 0x0005;
    return macword;
  }

  assembleMUL(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x0007;
    return macword;
  }

  assembleREM(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    }
    let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x0009;
    return macword;
  }

  assembleOR(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    }
    let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x000A;
    return macword;
  }

  assembleXOR(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    }
    let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x000B;
    return macword;
  }

  assembleSEXT(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x000D;
    return macword;
  }

  assembleROR(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = 0xA000 | (sr << 9) | (ct << 5) | 0x0006;
    return macword;
  }

  assembleSRL(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = 0xA000 | (sr << 9) | (ct << 5) | 0x0002;
    return macword;
  }

  assembleSRA(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediate(operands[1], 0, 15); //// TODO: test bounds, see if input is naive or not
    if (ct === null) ct = 1;
    let macword = 0xA000 | (sr << 9) | (ct << 5) | 0x0003;
    return macword;
  }

  assembleSLL(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = 0xA000 | (sr << 9) | (ct << 5) | 0x0004;
    return macword;
  }

  assembleAND(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    };
    let sr2orImm5 = operands[2];
    let macword = 0x5000 | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, 'imm5'); //// TODO: test bounds, see if input is naive or not
      if (imm5 === null || imm5 === undefined) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      };
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assembleLD(operands) {
    let dr = this.getRegister(operands[0]);

    if (dr === null) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    };

    let label = operands[1];

    if (label === null || label === undefined) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    }
    if(!this.isNumLiteral(operands[1]) && operands[2] && operands[3]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[3])) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      }

      label = operands[1] + operands[2] + operands[3];
    }

    if((operands[2] && this.isOperator(operands[2])) && 
    (operands[3] === null || operands[3] === undefined)) {      
      this.error('Missing number');
      fatalExit('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e'); // Pass 'e' as usageType
    if (address === null) {
      this.error('Bad label');
      fatalExit('Bad label', 1);
    };
    
    let isExternal = this.externLabels.has(label);
    let pcoffset9;
  
    if (isExternal) {
      pcoffset9 = 0; // Placeholder offset
      // Do NOT add an 'A' entry here
    } else {
      pcoffset9 = address - this.locCtr - 1;
      if (pcoffset9 < -256 || pcoffset9 > 255) {
        this.error('pcoffset9 out of range for ld');
        return null;
      }
    }
    let macword = 0x2000 | (dr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }  

  assembleST(operands) {
    let sr = this.getRegister(operands[0]);

    if (sr === null) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    };

    let label = operands[1];
    
    if (label === null || label === undefined) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    }
    if(!this.isNumLiteral(operands[1]) && operands[2] && operands[3]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[3])) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      }

      label = operands[1] + operands[2] + operands[3];
    }

    if((operands[2] && this.isOperator(operands[2])) && 
    (operands[3] === null || operands[3] === undefined)) {      
      this.error('Missing number');
      fatalExit('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e'); // Pass 'e' as usageType
    if (address === null) {
      this.error('Bad label');
      fatalExit('Bad label', 1);
    };
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range for st');
      return null;
    }
    let macword = 0x3000 | (sr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleLea(operands) {
    let dr = this.getRegister(operands[0]);

    if (dr === null) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    };

    let label = operands[1];

    if(label === null || label === undefined) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    }

    if(!this.isNumLiteral(operands[1]) && operands[2] && operands[3]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[3])) {
        this.error('Bad number');
        fatalExit('Bad number', 1);
      }

      label = operands[1] + operands[2] + operands[3];
    }

    if((operands[2] && this.isOperator(operands[2])) && 
    (operands[3] === null || operands[3] === undefined)) {      
      this.error('Missing number');
      fatalExit('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e');
    if (address === null) {
      this.error('Bad label');
      fatalExit('Bad label', 1);
    };
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range');
      fatalExit('pcoffset9 out of range', 1);
    }
    let macword = 0xE000 | (dr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleBL(operands) {
    let label = operands[0];

    if(!this.isValidLabel(label)) {
      this.error(`Bad label`); // : ${label}
      fatalExit(`Bad label`, 1); // : ${label}
    }

    let address = this.evaluateOperand(label, 'E'); // Pass 'E' as usageType
    if (address === null) {
      this.error('Bad label');
      fatalExit('Bad label', 1);
    }
    
    let isExternal = this.externLabels.has(label);
    let pcoffset11;
  
    if (isExternal) {
      pcoffset11 = 0; // Placeholder offset
      // Do NOT add an 'A' entry here
    } else {
      pcoffset11 = address - this.locCtr - 1;
      if (pcoffset11 < -1024 || pcoffset11 > 1023) {
        this.error('pcoffset11 out of range'); // TODO: test this in integration tests
        return null;
      }
    }
    let macword = 0x4800 | (pcoffset11 & 0x07FF);
    return macword;
  }  

  assembleBLR(operands) {
    let baser = this.getRegister(operands[0]);
    if (baser === null) {
      this.error('Missing operand');
      fatalExit('Missing operand', 1);
    };
    let offset6 = 0;
    if (operands[1]) {
      offset6 = this.evaluateImmediate(operands[1], -32, 31, "offset6");  //// TODO: test bounds, see if input is naive or not
    }
    let macword = 0x4000 | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleLDR(operands) {
    let dr = this.getRegister(operands[0]);
    let baser = this.getRegister(operands[1]);
    if (dr === null || baser === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let offset6 = this.evaluateImmediate(operands[2], -32, 31, 'offset6');  //// TODO: test bounds, see if input is naive or not
    if (offset6 === null) return null;
    let macword = 0x6000 | (dr << 9) | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleSTR(operands) {
    let sr = this.getRegister(operands[0]);
    let baser = this.getRegister(operands[1]);
    if (sr === null || baser === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let offset6 = this.evaluateImmediate(operands[2], -32, 31, 'offset6');  //// TODO: test bounds, see if input is naive or not
    if (offset6 === null) return null;
    let macword = 0x7000 | (sr << 9) | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleJMP(operands) {
    let baser = this.getRegister(operands[0]);
    if (baser === null) {
      // Note: as of 12/2024, the official LCC behavior here is to segfault
      // so, this is currently "custom" LCC.js behavior
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let offset6 = 0;
    if (operands[1]) {
      offset6 = this.evaluateImmediate(operands[1], -32, 31, "offset6");  //// TODO: test bounds, see if input is naive or not
    }
    let macword = 0xC000 | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleRET(operands) {
    //// TODO: make sure that ret+3 is valid
    //// TODO: make sure that ret+ 3 is valid
    //// TODO; make sure that ret +3 is valid
    //// TODO: make sure that ret + 3 is valid
    let baser = 7; // LR register
    let offset6 = 0;
    if (operands[0]) {
      offset6 = this.evaluateImmediate(operands[0], -32, 31, "offset6"); //// TODO: test bounds, see if input is naive or not
    }
    let macword = 0xC000 | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleNOT(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.error('Missing register');
      fatalExit('Missing register', 1);
    };
    let macword = 0x9000 | (dr << 9) | (sr1 << 6);
    return macword;
  }

  assembleMOV(mnemonic, operands) {
    let dr = this.getRegister(operands[0]);
    if (dr === null) {
      this.error('Missing register');
      fatalExit("Missing register", 1);
    };

    if (mnemonic === 'mov') {
      // Determine if operands[1] is a register or immediate
      if (this.isRegister(operands[1])) {
        // Translate to 'mvr dr, sr'
        let sr = this.getRegister(operands[1]);
        // mvr: opcode 0xA000, eopcode 12
        let macword = 0xA000 | (dr << 9) | (sr << 6) | 0x000C;
        return macword;
      } else {
         //// TODO: test bounds, see if input is naive or not
        // Translate to 'mvi dr, imm9'
        let imm9 = this.evaluateImmediateNaive(operands[1]); // this.evaluateImmediate(operands[1], -256, 255);
        if (imm9 === null) {
          this.error('Missing number');
          fatalExit("Missing number", 1);
        };
        // mvi: opcode 0xD000
        let macword = 0xD000 | (dr << 9) | (imm9 & 0x1FF);
        return macword;
      }
    } else if (mnemonic === 'mvi') {
       //// TODO: test bounds, see if input is naive or not
      // mvi dr, imm9
      let imm9 =  this.evaluateImmediate(operands[1], -256, 255, "mvi immediate"); // this.evaluateImmediate(operands[1], -256, 255);
      if (imm9 === null) {
        this.error('Missing number');
        fatalExit("Missing number", 1);
      };
      let macword = 0xD000 | (dr << 9) | (imm9 & 0x1FF);
      return macword;
    } else if (mnemonic === 'mvr') {
      // mvr dr, sr1
      let sr1 = this.getRegister(operands[1]);
      if (sr1 === null) {
        this.error('Missing register');
        fatalExit("Missing register", 1);
      };
      // Ensure eopcode 12 is set
      let macword = 0xA000 | (dr << 9) | (sr1 << 6) | 0x000C;
      return macword;
    } else {
      this.error(`Invalid mnemonic: ${mnemonic}`);
      return null;
    }
  }

  assembleTrap(operands, trapVector) {
    let sr = 0; // Default to r0
    if (operands[0]) {
      sr = this.getRegister(operands[0]);
      if (sr === null) {
        this.error('Bad register');
        fatalExit("Bad register", 1);
      };
    } 
    let macword = 0xF000 | (sr << 9) | (trapVector & 0xFF);
    return macword;
  }


  getRegister(regStr) {

    if(regStr === null || regStr === undefined) {
      return null;
    }

    if (!this.isRegister(regStr)) {
      this.error('Bad register'); // this.error(`Invalid register: ${regStr}`);
      fatalExit("Bad register", 1);
    }
    if (regStr === "fp") {
      regStr = "r5";
    } else if (regStr === "sp") {
      regStr = "r6";
    } else if (regStr === "lr") {
      regStr = "r7";
    }

    return parseInt(regStr.substr(1), 10);
  }

  isCharLiteral(str) {
    const match = /^'(?:\\.|[^\\])'$/.test(str);
    return match;
  }

  parseCharLiteral(str) {
    // Remove the single quotes
    let charContent = str.slice(1, -1);

    if (charContent.length === 1) {
      // Simple character
      return charContent.charCodeAt(0);
    } else if (charContent.startsWith('\\')) {
      // Escape sequence
      switch (charContent) {
        case '\\n':
          return '\n'.charCodeAt(0);
        case '\\t':
          return '\t'.charCodeAt(0);
        case '\\r':
          return '\r'.charCodeAt(0);
        case '\\\\':
          return '\\'.charCodeAt(0);
        case "\\'":
          return "'".charCodeAt(0);
        case '\\"':
          return '"'.charCodeAt(0);
        default:
          this.error(`Invalid escape sequence: ${charContent}`);
          return null;
      }
    } else {
      this.error(`Invalid character literal: '${charContent}'`);
      return null;
    }
  }

  isRegister(regStr) {
    return /^(r[0-7]|fp|sp|lr)$/i.test(regStr);
  }

  isOperator(op) {
    return op === '+' || op === '-';
  }

  parseLabelWithOffset(operand) {
    // This regex matches:
    //   1) A label: starting with letter, '_', '$', '@', followed by letters, digits, '_', '$', '@'
    //   2) An optional offset: a plus or minus sign, optional spaces, then digits
    //
    // Examples matched:
    //   "myVar"          -> label = "myVar", offset = null
    //   "myVar+2"        -> label = "myVar", offset = 2
    //   "myVar - 3"      -> label = "myVar", offset = -3
    //   "x+10"           -> label = "x", offset = 10
    //   "label- 5"       -> label = "label", offset = -5
    const labelOffsetPattern = /^([A-Za-z_$@][A-Za-z0-9_$@]*)\s*([+\-]\s*\d+)?$/;
    
    let match = operand.match(labelOffsetPattern);
    if (!match) {
      return null; // Not a label with optional offset
    }
  
    let label = match[1];
    let offsetStr = match[2]; // something like "+2" or "- 3"
    
    let offset = 0;
    if (offsetStr) {
      // Remove spaces and parse the number
      offsetStr = offsetStr.replace(/\s+/g, '');
      offset = parseInt(offsetStr, 10); // parse "+2" or "-3"
      if (isNaN(offset)) {
        // Should never happen if regex matched, but just in case:
        return null;
      }
    }
  
    return { label, offset };
  }

  parseNumber(valueStr) {
    let value;

    if(valueStr === null || valueStr === undefined) {
      return null;
    }

    // Handle character literals
    if (this.isCharLiteral(valueStr)) {
      value = this.parseCharLiteral(valueStr);
      if (value === null) {
        return NaN; // Signal an error
      }
    } else if (valueStr.startsWith('0x') || valueStr.startsWith('0X')) {
      value = parseInt(valueStr, 16);
      // note: the LCC doesn't currently support negative hex numbers
      // } else if (valueStr.startsWith('-0x') || valueStr.startsWith('-0X')) {
      //   value = -parseInt(valueStr.substr(3), 16);
    } else {
      value = parseInt(valueStr, 10);
    }
    return value;
  }

  // TODO: investigate here for detection of undefined labels
  handleExternalReference(label, usageType) {
    // Check if we've already created an entry for this label and usage type
    if (!this.externalReferences.some(ref => ref.label === label && ref.type === usageType)) {
      this.externalReferences.push({
        label: label,
        type: usageType,
        address: this.locCtr // Store the current location counter
      });
    }
  }

            // TODO: implement operand type checking {valid: ["num", "char", "label"]}
  /**
   * Evaluates an operand and returns its corresponding value.
   * The operand can be a pure number, a label with an optional offset, or a plain label.
   * Additionally, the operand can be a location marker indicated with the '*' character.
   * 
   * @param {string} operand - The operand to evaluate.
   * @param {string} usageType - The context in which the operand is used (e.g., for external references).
   * @returns {number|null} - The evaluated value of the operand, or null if the operand is undefined.
   */
  evaluateOperand(operand, usageType) {
    // First, try to parse as a pure number
    let value = this.parseNumber(operand);
    if (!isNaN(value)) {
      return value;
    }
  
    // If not a pure number, check if it's a label with optional offset
    let parsed = this.parseLabelWithOffset(operand);
    if (parsed !== null) {
      // It's a label and possibly an offset
      const { label, offset } = parsed;
  
      if (this.symbolTable.hasOwnProperty(label)) {
        // Local label known
        return this.symbolTable[label] + offset;
      } else if (this.externLabels.has(label)) {
        // External label: create external reference if needed and return placeholder (0 + offset)
        this.handleExternalReference(label, usageType);
        return 0 + offset;
      } else {
        this.error(`Undefined label`); // this.error(`Undefined label: ${label}`);
        return null;
      }
  
    } else {
      // If we get here, it's neither a pure number nor a label-with-offset.
      // Maybe it's just a plain label that we haven't seen? Check that scenario:
      if (this.symbolTable.hasOwnProperty(operand)) {
        return this.symbolTable[operand];
      } else if (this.externLabels.has(operand)) {
        // External symbol, return 0 placeholder
        this.handleExternalReference(operand, usageType);
        return 0;
      } else {
        // check for * (current location counter)
        if(operand[0] === '*') {
          if(operand[1] === '+' || operand[1] === '-') {
            let offset = this.parseNumber(operand.slice(1));
            if(isNaN(offset)) {
              this.error(`Bad number`);
              return null;
            }
            return this.locCtr + offset;
          } else {
            return this.locCtr;
          }
        } else {
          // inspect to see if it was an invalid number
          // inspect to see if it was an invalid label
          if(operand[0] === '0' && operand[1] === 'x' && !this.isValidHexNumber(operand)) {
            this.error(`Bad number`);
            fatalExit("Bad number", 1);
          } else if (!this.isValidLabel(operand)) {
            this.error(`Bad label`);
            fatalExit("Bad label", 1);
          } else {
            this.error(`Unspecified label error for: ${operand}`); // this.error(`Undefined label: ${operand}`);
            fatalExit(`Unspecified label error for: ${operand}`, 1);
          }
        }
      }
    }
  }  

  isValidHexNumber(str) {
    return /^0x[0-9A-Fa-f]+$/.test(str);
  }

  // returns true if operand is either a char (which has an ascii value) 
  // or a number (i.e. neither a string nor a label)
  isNumLiteral(operand) {
    return this.isCharLiteral(operand) || !isNaN(operand) || this.isValidHexNumber(operand);
  }

  evaluateImmediate(valueStr, min, max, type='') {
    let value = this.parseNumber(valueStr);

    if (isNaN(value)) {
      this.error(`Bad number`);
      fatalExit("Bad number", 1);
    }

    if (value < min || value > max) {
      // this.error(`Immediate value out of range: ${valueStr}`);
      this.error(`${type} out of range`);
      return null;
    }
    return value;
  }

  // function which simply returns the value if it is a number.
  // capped at 16 bits. Some instructions do not check for out of bounds numbers.
  evaluateImmediateNaive(valueStr) {
    if(valueStr === null || valueStr === undefined) {
      return null;
    }
    let value = this.parseNumber(valueStr);
    if (isNaN(value)) {
      this.error(`Bad number`); // `Not a valid number: ${valueStr}`
      fatalExit("Bad number", 1);
    }
    return value & 0xFFFF;
  }

  error(message) {
    const errorMsg = `Error on line ${this.lineNum} of ${this.inputFileName}:\n    ${this.currentLine}\n${message}`;
    console.error(errorMsg);
    this.errors.push(errorMsg);
    this.errorFlag = true;

    // If we're not reporting multiple errors, exit immediately
    // Note: This matches the behavior in the original LCC of reporting only 1 error at a time
    if(!REPORT_MULTI_ERRORS) {
      fatalExit(message, 1);
    }
  }
}

module.exports = Assembler;

// Instantiate and run the assembler if this script is run directly
if (require.main === module) {
  const assembler = new Assembler();
  assembler.main();
}

