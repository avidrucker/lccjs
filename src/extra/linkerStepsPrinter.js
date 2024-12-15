//
// linkerStepsPrinter.js
// 
// A thoroughly documented and step-by-step printing JavaScript linker
// for LCC .o object files.
//
// Usage (from command line):
//    node linkerStepsPrinter.js [-o outputfile.e] <obj module 1> <obj module 2> ...
//
// Purpose:
//   The purpose of this linker is to print how each header entry (S, G, E, e, V, A) 
//   is processed and how the corresponding machine code array (mca) is adjusted. It 
//   also shows how to write out an LCC-compatible "executable" link.e file with the 
//   final machine code and a reconstructed header.
//
//   The process is broken into four major steps, plus a helpful debug step:
//   1. Read each .o file and collect header entries (with adjusted addresses) into 
//      tables, copy code into mca.
//   2. Adjust external references (E, e, V).
//   3. Adjust local references (A).
//   4. Write out the final "link.e" file with the reconstructed header.
//
//   Along the way, we print thorough details to make the linking process crystal clear.
//

const fs = require('fs');

/**
 * A utility function to print a horizontal spacer line for readability
 */
function printSpacerLine() {
  console.log('==================================================');
}

class LinkerStepsPrinter {
  constructor() {
    // The machine code array, mca, with 65536 (0x10000) slots. 
    // Each slot holds an unsigned 16-bit value. 
    // We'll store instructions/words from all object modules here.
    this.mca = new Uint16Array(65536); 
    
    // mcaIndex is the "pointer" into the mca array, telling us where 
    // the next instruction/word from an object module should be placed.
    this.mcaIndex = 0;

    // We'll keep track of whether we encountered an 'S' entry (start entry).
    this.gotStart = false;  
    this.startAddress = 0;  

    // The G table (globals): stores { label -> address } for globally defined labels.
    this.GTable = {}; 

    // The E/e/V/A tables are arrays that store references and associated information.

    // E table: references to external symbols that require 11-bit PC-relative adjustments
    //   E is used for instructions with an 11-bit offset field (like a BL instruction).
    // Structure: [ { address, label } , ... ]
    this.ETable = [];

    // e table: references to external symbols that require 9-bit PC-relative adjustments
    //   e is used for instructions with a 9-bit offset field.
    // Structure: [ { address, label } , ... ]
    this.eTable = [];

    // V table: references to external symbols that need the entire 16-bit address replaced (like .word)
    // Structure: [ { address, label }, ... ]
    this.VTable = [];

    // A table: local references. For each A entry, we store not only the adjusted address
    // but also the "module start" (the base mcaIndex for that module). 
    // Structure: [ { address, moduleStart }, ... ]
    this.ATable = [];

    // For debugging, we can keep track of how big each module is as we read it
    // so we can separate each module's code visually in the final print-out.
    this.fileSizes = [];
    this.errorFlag = false; // If an error occurs, we set this and stop.

    // If the user wants to specify an output file name, we store it here.
    this.outputFileName = 'link.e';
  }

  /**
   * Main driver of the linking process:
   *  1. Read object modules from disk
   *  2. Process each module's header entries
   *  3. Print out tables (Step 1.5 debug printing)
   *  4. Step 2: Adjust external references
   *  5. Step 3: Adjust local references
   *  6. Print final MCA for debugging
   *  7. Step 4: Create the final "link.e" file
   *
   * @param {string[]} inputFiles    Array of strings: the .o files to read
   * @param {string} [outputFile]    Output file name (defaults to link.e)
   */
  link(inputFiles, outputFile) {
    if (outputFile) {
      this.outputFileName = outputFile;
    }

    console.log(`LinkerStepsPrinter: Linking files -> ${inputFiles.join(', ')}`);

    // Step 1: Read each object module and store header entries and machine code
    for (let fileName of inputFiles) {
      this.readObjectModule(fileName);
      if (this.errorFlag) { 
        return; 
      }

      // After reading in each file, let's do a "Step 1" debug print of current tables and mca
      this.printStep1State(fileName);
    }

    // Step 2: Adjust external references (E, e, V)
    this.adjustExternalReferences();
    if (this.errorFlag) {
      return;
    }

    // Step 3: Adjust local references (A)
    this.adjustLocalReferences();
    if (this.errorFlag) {
      return;
    }

    // For debugging, let's print the final machine code array after all adjustments
    this.printFinalMCA();

    // Step 4: Create link.e (or user-specified output file)
    this.writeExecutable();
  }

  /**
   * Reads a single .o file. For each module:
   *  - Check signature ('o')
   *  - Read all header entries until 'C'
   *  - For each header entry, store adjusted addresses & label in the appropriate table
   *  - After the header, read the machine code words and store them in `this.mca`
   *  - Keep track of the file size in words to help with debug printing
   *
   * @param {string} fileName 
   */
  readObjectModule(fileName) {
    let buffer;
    try {
      buffer = fs.readFileSync(fileName);
    } catch (err) {
      this.error(`Cannot open ${fileName}`);
      return;
    }

    let offset = 0;

    // Check file signature
    if (buffer[offset] !== 'o'.charCodeAt(0)) {
      this.error(`${fileName} not a linkable file (missing 'o' signature)`);
      return;
    }
    offset++;

    // Now read the header entries until we see 'C' or run out of file
    while (offset < buffer.length) {
      if (offset >= buffer.length) break; // no more data
      const entryType = String.fromCharCode(buffer[offset++]);
      if (entryType === 'C') {
        // End of header, start of code
        break;
      }

      switch (entryType) {
        case 'S': {
          // S entry: Start address
          if (offset + 1 >= buffer.length) {
            this.error('Invalid S entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;

          // If gotStart was already set, it's an error
          if (this.gotStart) {
            this.error('More than one entry point (S entry) encountered');
            return;
          }
          this.gotStart = true;
          // Adjust the address by the current mcaIndex (i.e., module base)
          this.startAddress = addr + this.mcaIndex;
          break;
        }

        case 'G': {
          // G entry: globally defined label
          if (offset + 1 >= buffer.length) {
            this.error('Invalid G entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;
          // Read the null-terminated label
          let label = '';
          while (offset < buffer.length) {
            const c = buffer[offset++];
            if (c === 0) break; 
            label += String.fromCharCode(c);
          }
          // Adjust address
          const adjustedAddr = addr + this.mcaIndex;
          // Check for multiple definitions
          if (this.GTable[label] !== undefined) {
            this.error(`Multiple definitions of global symbol ${label}`);
            return;
          }
          this.GTable[label] = adjustedAddr;
          break;
        }

        case 'E': {
          // E entry: External reference with 11-bit address field
          if (offset + 1 >= buffer.length) {
            this.error('Invalid E entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;
          let label = '';
          while (offset < buffer.length) {
            const c = buffer[offset++];
            if (c === 0) break;
            label += String.fromCharCode(c);
          }
          const adjustedAddr = addr + this.mcaIndex;
          this.ETable.push({ address: adjustedAddr, label });
          break;
        }

        case 'e': {
          // e entry: External reference with 9-bit address field
          if (offset + 1 >= buffer.length) {
            this.error('Invalid e entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;
          let label = '';
          while (offset < buffer.length) {
            const c = buffer[offset++];
            if (c === 0) break;
            label += String.fromCharCode(c);
          }
          const adjustedAddr = addr + this.mcaIndex;
          this.eTable.push({ address: adjustedAddr, label });
          break;
        }

        case 'V': {
          // V entry: External reference that requires full 16-bit address
          if (offset + 1 >= buffer.length) {
            this.error('Invalid V entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;
          let label = '';
          while (offset < buffer.length) {
            const c = buffer[offset++];
            if (c === 0) break;
            label += String.fromCharCode(c);
          }
          const adjustedAddr = addr + this.mcaIndex;
          this.VTable.push({ address: adjustedAddr, label });
          break;
        }

        case 'A': {
          // A entry: local reference
          if (offset + 1 >= buffer.length) {
            this.error('Invalid A entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;
          const adjustedAddr = addr + this.mcaIndex;
          this.ATable.push({ address: adjustedAddr, moduleStart: this.mcaIndex });
          break;
        }

        default:
          this.error(`Unknown header entry '${entryType}' in file ${fileName}`);
          return;
      }
    }

    // Now read the code portion until EOF
    let codeWords = 0;
    while (offset + 1 < buffer.length) {
      const word = buffer.readUInt16LE(offset);
      offset += 2;
      this.mca[this.mcaIndex++] = word;
      codeWords++;
    }

    // For debugging, store the final mcaIndex for this module
    this.fileSizes.push(this.mcaIndex);
    console.log(`Read ${codeWords} code words from ${fileName}.`);
  }

  /**
   * Print the state of the linker after reading in a single module (Step 1 printing).
   *
   * @param {string} fileName 
   */
  printStep1State(fileName) {
    printSpacerLine();
    console.log(`Finished reading module: ${fileName}`);
    printSpacerLine();

    console.log('\n-- Step 1 State (Tables after reading this module) --');

    // Print the 'S' entry if we have it so far
    if (this.gotStart) {
      console.log(`Start Address (S): 0x${this.startAddress.toString(16).padStart(4, '0')}`);
    } else {
      console.log(`No start address encountered yet (no S entry).`);
    }

    // G Table
    this.printTable('G Table (Global definitions)', this.GTable);

    // E Table
    console.log('\nE Table (11-bit external references)');
    if (this.ETable.length === 0) {
      console.log('(none)');
    } else {
      for (let i = 0; i < this.ETable.length; i++) {
        const ref = this.ETable[i];
        console.log(`  E[${i}] -> address=0x${ref.address.toString(16).padStart(4, '0')} label="${ref.label}"`);
      }
    }

    // e Table
    console.log('\ne Table (9-bit external references)');
    if (this.eTable.length === 0) {
      console.log('(none)');
    } else {
      for (let i = 0; i < this.eTable.length; i++) {
        const ref = this.eTable[i];
        console.log(`  e[${i}] -> address=0x${ref.address.toString(16).padStart(4, '0')} label="${ref.label}"`);
      }
    }

    // V Table
    console.log('\nV Table (full 16-bit external references)');
    if (this.VTable.length === 0) {
      console.log('(none)');
    } else {
      for (let i = 0; i < this.VTable.length; i++) {
        const ref = this.VTable[i];
        console.log(`  V[${i}] -> address=0x${ref.address.toString(16).padStart(4, '0')} label="${ref.label}"`);
      }
    }

    // A Table
    console.log('\nA Table (local references)');
    if (this.ATable.length === 0) {
      console.log('(none)');
    } else {
      for (let i = 0; i < this.ATable.length; i++) {
        const ref = this.ATable[i];
        console.log(`  A[${i}] -> address=0x${ref.address.toString(16).padStart(4, '0')} moduleStart=0x${ref.moduleStart.toString(16).padStart(4, '0')}`);
      }
    }

    // Print the partial MCA for debugging (only from the last file boundary).
    this.printMCA();
  }

  /**
   * Print a key-value table (label->address or similar).
   * 
   * @param {string} title 
   * @param {object} table  Format: { label: address }
   */
  printTable(title, table) {
    console.log(`\n${title}`);
    const keys = Object.keys(table);
    if (keys.length === 0) {
      console.log('(none)');
      return;
    }
    for (let label of keys) {
      let address = table[label];
      console.log(`  label="${label}" -> 0x${address.toString(16).padStart(4, '0')}`);
    }
  }

  /**
   * Print the current machine code array for debugging.
   * We use the fileSizes array to break up the printing for each module’s boundary.
   */
  printMCA() {
    console.log('\nCurrent Machine Code Array (mca):');
    console.log('  LOC   MCA');
    printSpacerLine();

    let moduleBoundaryIdx = 0;
    let fileSizesIndex = 0;
    if (this.fileSizes.length > 0) {
      moduleBoundaryIdx = this.fileSizes[fileSizesIndex++];
    }

    for (let i = 0; i < this.mcaIndex; i++) {
      if (i === moduleBoundaryIdx && i !== 0) {
        // reached the end of a module
        printSpacerLine();
        if (fileSizesIndex < this.fileSizes.length) {
          moduleBoundaryIdx = this.fileSizes[fileSizesIndex++];
        }
      }
      console.log(`| 0x${i.toString(16).padStart(4, '0')} : 0x${this.mca[i].toString(16).padStart(4, '0')} |`);
    }
    printSpacerLine();
  }

  /**
   * Step 2: Adjust external references. 
   * For each entry in ETable, eTable, and VTable, we search for the matching global label
   * in GTable. If found, we adjust the machine code accordingly.
   */
  adjustExternalReferences() {
    // E table: 11-bit references
    for (let i = 0; i < this.ETable.length; i++) {
      let ref = this.ETable[i];
      let label = ref.label;
      if (this.GTable[label] === undefined) {
        this.error(`Undefined external reference (E) for label '${label}'`);
        return;
      }
      let globalAddr = this.GTable[label];

      // Explanation: For 11-bit references, the instruction's lower 11 bits is the offset.
      // The linking step is:
      //     mca[ref.address] = (mca[ref.address] & 0xf800) |
      //                        ((mca[ref.address] + globalAddr - ref.address - 1) & 0x7ff);
      let original = this.mca[ref.address];
      let offset = (original + globalAddr - ref.address - 1) & 0x07ff;
      let newVal = (original & 0xf800) | offset;

      console.log(`\nStep 2 (E): Adjusting 0x${ref.address.toString(16).padStart(4, '0')} (label='${label}')`);
      console.log(`  Original instruction: 0x${original.toString(16).padStart(4, '0')}`);
      console.log(`  11-bit offset: + 0x${offset.toString(16).padStart(3, '0')}`);
      console.log(`  New instruction: 0x${newVal.toString(16).padStart(4, '0')}`);

      this.mca[ref.address] = newVal;
    }

    // e table: 9-bit references
    for (let i = 0; i < this.eTable.length; i++) {
      let ref = this.eTable[i];
      let label = ref.label;
      if (this.GTable[label] === undefined) {
        this.error(`Undefined external reference (e) for label '${label}'`);
        return;
      }
      let globalAddr = this.GTable[label];

      // Explanation: For 9-bit references, the instruction's lower 9 bits is the offset.
      //     mca[ref.address] = (mca[ref.address] & 0xfe00) |
      //                        ((mca[ref.address] + globalAddr - ref.address - 1) & 0x01ff);
      let original = this.mca[ref.address];
      let offset = (original + globalAddr - ref.address - 1) & 0x01ff;
      let newVal = (original & 0xfe00) | offset;

      console.log(`\nStep 2 (e): Adjusting 0x${ref.address.toString(16).padStart(4, '0')} (label='${label}')`);
      console.log(`  Original instruction: 0x${original.toString(16).padStart(4, '0')}`);
      console.log(`  9-bit offset: + 0x${offset.toString(16).padStart(3, '0')}`);
      console.log(`  New instruction: 0x${newVal.toString(16).padStart(4, '0')}`);

      this.mca[ref.address] = newVal;
    }

    // V table: full 16-bit addresses (like .word references)
    for (let i = 0; i < this.VTable.length; i++) {
      let ref = this.VTable[i];
      let label = ref.label;
      if (this.GTable[label] === undefined) {
        this.error(`Undefined external reference (V) for label '${label}'`);
        return;
      }
      let globalAddr = this.GTable[label];

      let original = this.mca[ref.address];
      let newVal = original + globalAddr;

      console.log(`\nStep 2 (V): Adjusting 0x${ref.address.toString(16).padStart(4, '0')} (label='${label}')`);
      console.log(`  Original word: 0x${original.toString(16).padStart(4, '0')}`);
      console.log(`  Full address addition: + 0x${globalAddr.toString(16).padStart(4, '0')}`);
      console.log(`  New word: 0x${newVal.toString(16).padStart(4, '0')}`);

      this.mca[ref.address] = newVal;
    }
  }

  /**
   * Step 3: Adjust local references (A).
   * For each A entry, we add the module's base address to the existing content of the machine code word.
   */
  adjustLocalReferences() {
    console.log('\n-- Step 3: Adjusting local references (A) --');

    for (let i = 0; i < this.ATable.length; i++) {
      let ref = this.ATable[i];
      let original = this.mca[ref.address];
      let newVal = original + ref.moduleStart;

      console.log(`Adjusting local reference at 0x${ref.address.toString(16).padStart(4, '0')}:`);
      console.log(`  Original word: 0x${original.toString(16).padStart(4, '0')}`);
      console.log(`  + moduleStart(0x${ref.moduleStart.toString(16).padStart(4, '0')}) = 0x${newVal.toString(16).padStart(4, '0')}`);

      this.mca[ref.address] = newVal;
    }
  }

  /**
   * Print the final MCA after steps 2 and 3 for debugging.
   */
  printFinalMCA() {
    console.log('\n-- Final MCA after all adjustments --');
    this.printMCA();
  }

  /**
   * Step 4: Write out the final "link.e" file. This includes:
   *   - a single 'o' signature
   *   - if we got an S entry, write 'S' plus the address
   *   - for each G entry, write 'G' entries
   *   - for each V entry, we write them as 'A' entries in the output file (since external references are resolved)
   *   - for each A entry, we write 'A' entries
   *   - a 'C' terminator
   *   - all machine code words (the final code)
   */
  writeExecutable() {
    const outFileName = this.outputFileName;
    let outFd;
    try {
      outFd = fs.openSync(outFileName, 'w');
    } catch (err) {
      this.error(`Cannot open output file ${outFileName}`);
      return;
    }

    console.log('\n-- Step 4: Writing out the final link.e file --');
    console.log(`Creating executable file ${outFileName}`);

    // Write out file signature
    fs.writeSync(outFd, 'o');
    console.log("Wrote file signature 'o'");

    // Write out S entry if applicable
    if (this.gotStart) {
      console.log(`S  0x${this.startAddress.toString(16).padStart(4, '0')}`);
      const bufferS = Buffer.alloc(3);
      bufferS.write('S', 0);
      bufferS.writeUInt16LE(this.startAddress, 1);
      fs.writeSync(outFd, bufferS);
    }

    // Write out G entries
    for (const label of Object.keys(this.GTable)) {
      let addr = this.GTable[label];
      console.log(`G  0x${addr.toString(16).padStart(4, '0')}  ${label}`);
      const bufferG = Buffer.alloc(3 + label.length + 1);
      bufferG.write('G', 0);
      bufferG.writeUInt16LE(addr, 1);
      bufferG.write(label, 3);
      bufferG.writeUInt8(0, 3 + label.length);
      fs.writeSync(outFd, bufferG);
    }

    // Write out V entries as A entries
    for (let i = 0; i < this.VTable.length; i++) {
      let ref = this.VTable[i];
      console.log(`A  0x${ref.address.toString(16).padStart(4, '0')}  (was V)`);
      const bufferA = Buffer.alloc(3);
      bufferA.write('A', 0);
      bufferA.writeUInt16LE(ref.address, 1);
      fs.writeSync(outFd, bufferA);
    }

    // Write out A entries
    for (let i = 0; i < this.ATable.length; i++) {
      let ref = this.ATable[i];
      console.log(`A  0x${ref.address.toString(16).padStart(4, '0')}`);
      const bufferA = Buffer.alloc(3);
      bufferA.write('A', 0);
      bufferA.writeUInt16LE(ref.address, 1);
      fs.writeSync(outFd, bufferA);
    }

    // Terminate header
    console.log("C");
    fs.writeSync(outFd, 'C');

    // Write out the final machine code
    const codeBuffer = Buffer.alloc(this.mcaIndex * 2);
    for (let i = 0; i < this.mcaIndex; i++) {
      codeBuffer.writeUInt16LE(this.mca[i], i * 2);
    }
    fs.writeSync(outFd, codeBuffer);

    fs.closeSync(outFd);
    console.log(`\nSuccessfully wrote final executable to ${outFileName}`);
  }

  /**
   * Utility function: sets errorFlag and prints out a message
   * @param {string} message 
   */
  error(message) {
    console.error(`Linker Error: ${message}`);
    this.errorFlag = true;
  }
}


// Entry point if this script is called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node linkerStepsPrinter.js [-o outputfile.e] <object module 1> <object module 2> ...');
    process.exit(1);
  }

  let outputFileName = null;
  const inputFiles = [];
  let i = 0;
  while (i < args.length) {
    if (args[i] === '-o') {
      if (i + 1 >= args.length) {
        console.error('Missing output file name after -o');
        process.exit(1);
      }
      outputFileName = args[i + 1];
      i += 2;
    } else {
      inputFiles.push(args[i]);
      i++;
    }
  }

  if (inputFiles.length === 0) {
    console.error('Error: No input object modules specified');
    process.exit(1);
  }

  const linker = new LinkerStepsPrinter();
  linker.link(inputFiles, outputFileName);
}

module.exports = LinkerStepsPrinter;
