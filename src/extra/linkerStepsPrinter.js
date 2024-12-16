//
// linkerStepsPrinter.js
//
// A JavaScript linker for LCC .o object files, which shows step-by-step how 
// each machine code word is adjusted into a completed executable program. 
//
// Usage (from command line):
//    node linkerStepsPrinter.js [-o outputfile.e] <obj module 1> <obj module 2> ...
//
// Purpose:
//   The goal is to show exactly how each header entry (S, G, E, e, V, A) is processed,
//   how each machine code word is adjusted (and why), and how the final link.e file
//   is created. This helps learners of LCC assembly see the 4 steps of linking in action.
//
//   The linking stages are conceptually:
//
//   1. Read each .o file, parse header entries, store adjusted addresses in tables, copy machine code to mca.
//   2. Adjust external references (E, e, V).
//   3. Adjust local references (A).
//   4. Write out link.e with all resolved code.
//
//   We also provide thorough commentary before each major step, explaining the formulas used
//   and how references/definitions are labeled in the final "LABEL DEFS & REFS" column.
//
// Author: (Your Name)
//

const fs = require('fs');

// Utilities for printing visual separators
function printSpacerLine() {
  console.log('==================================================');
}
function printThinLine() {
  console.log('--------------------------------------------------');
}

class LinkerStepsPrinter {
  constructor() {
    // The machine code array, mca, with 65536 (0x10000) slots.
    this.mca = new Uint16Array(65536);
    // mcaIndex points to the next free location in mca.
    this.mcaIndex = 0;

    // Keep track of whether we have a start address (S entry).
    this.gotStart = false;
    this.startAddress = 0;
    this.startIsNew = false;  // We'll track if the S entry was newly added in the last module.

    // G (global) entries stored both as a list (for printing) and a map (for quick lookup).
    this.GList = [];   // Each element: { address, label, isNew }
    this.GMap = {};    // label -> address

    // The E, e, V, A tables are arrays of objects:
    // E:  [ { address, label, isNew }, ... ]   (11-bit offset references)
    // e:  [ { address, label, isNew }, ... ]   (9-bit offset references)
    // V:  [ { address, label, isNew }, ... ]   (full 16-bit references)
    // A:  [ { address, moduleStart, isNew }, ... ]  (local references)
    this.ETable = [];
    this.eTable = [];
    this.VTable = [];
    this.ATable = [];

    // We'll keep textual annotations for each location in the MCA. 
    // e.g. mcaAnnotations[addr] = [ "main defined", "sub referenced" ]
    this.mcaAnnotations = Array(65536).fill(null).map(() => []);

    // Keep track of module size boundaries to separate the final MCA print.
    this.fileSizes = [];

    // If we encounter an error, this will be set.
    this.errorFlag = false;

    // Output file name
    this.outputFileName = 'link.e';
  }

  /**
   * link - main driver of the linking process.
   */
  link(inputFiles, outputFile) {
    if (outputFile) {
      this.outputFileName = outputFile;
    }

    console.log(`LinkerStepsPrinter: Linking files -> ${inputFiles.join(', ')}`);

    console.log("\n\nSTEP 1: Parse Object Modules and Build Tables\n");
    console.log(`    * Reading object modules and building tables.
    * For each object module, we parse the header and machine code,
    * store them in the mca, and record definitions/references in our tables.`);

    for (let fileName of inputFiles) {
      this.readObjectModule(fileName);
      if (this.errorFlag) return;

      this.printPostModuleRead(fileName);
      this.afterModulePrintCleanup(); // Clear "**newly added**" flags
    }

    console.log("\n\nSTEP 2: External References Resolution (E, e, V)\n");
    
    console.log(`    * External reference resolution.
    * Explanation: We look up each external reference (E, e, V) in the global definitions (G).
    * If found, we adjust the machine code words accordingly using the formulas:
    *
    *  - E table (11-bit PC-relative): mca[addr] = (mca[addr] & 0xf800) | ((mca[addr] + G - addr - 1) & 0x7ff)
    *  - e table (9-bit PC-relative):  mca[addr] = (mca[addr] & 0xfe00) | ((mca[addr] + G - addr - 1) & 0x1ff)
    *  - V table (full address add):   mca[addr] = mca[addr] + G
    *
    * where G is the global label address from the G table, and "addr" is the location of
    * the external reference in the machine code.`);
     
    this.adjustExternalReferences();
    if (this.errorFlag) return;

    console.log("\n\nSTEP 3: Adjust Local References\n");
    console.log(`    * Each A entry has { address, moduleStart }. We add moduleStart
    * to the word at 'address' in the mca, again showing arithmetic step-by-step.`);

    this.adjustLocalReferences();
    if (this.errorFlag) return;

    console.log('\n=== Final Machine Code Array (mca) After All Adjustments ===');
    this.printMCA();

    console.log("\n\nSTEP 4: Creating the Final Executable (link.e)");
    
    console.log(`
     * Writing out the final "link.e" file.
     * Explanation: We reconstruct a header with
     *   - 'o' signature
     *   - S entry if it exists
     *   - G entries
     *   - the V entries become A entries in the output
     *   - A entries
     *   - 'C' terminator
     * followed by the machine code.`);
    
    this.writeExecutable();
  }

  /**
   * Reads an object module from disk and populates the appropriate tables and the MCA (machine code array).
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
    // Check 'o' file signature
    if (buffer[offset] !== 'o'.charCodeAt(0)) {
      this.error(`${fileName} not a linkable file (missing 'o' signature)`);
      return;
    }
    offset++;

    // Read header entries until 'C' or EOF (end of file)
    while (offset < buffer.length) {
      if (offset >= buffer.length) break;
      const entryType = String.fromCharCode(buffer[offset++]);
      if (entryType === 'C') {
        break; // end of header
      }

      switch (entryType) {
        case 'S': {
          if (offset + 1 >= buffer.length) {
            this.error('Invalid S entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;

          if (this.gotStart) {
            this.error('More than one entry point (S entry) encountered');
            return;
          }
          this.gotStart = true;
          this.startAddress = addr + this.mcaIndex;
          this.startIsNew = true; 
          // Note: S doesn't define a label
          break;
        }

        case 'G': {
          if (offset + 1 >= buffer.length) {
            this.error('Invalid G entry (truncated)');
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

          if (this.GMap[label] !== undefined) {
            this.error(`Multiple definitions of global symbol ${label}`);
            return;
          }
          this.GList.push({ address: adjustedAddr, label: label, isNew: true });
          this.GMap[label] = adjustedAddr;

          // Annotate
          this.mcaAnnotations[adjustedAddr].push(`${label} defined **newly added**`);
          break;
        }

        case 'E': {
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
          this.ETable.push({ address: adjustedAddr, label, isNew: true });

          this.mcaAnnotations[adjustedAddr].push(`${label} referenced **newly added**`);
          break;
        }

        case 'e': {
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
          this.eTable.push({ address: adjustedAddr, label, isNew: true });

          this.mcaAnnotations[adjustedAddr].push(`${label} referenced **newly added**`);
          break;
        }

        case 'V': {
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
          this.VTable.push({ address: adjustedAddr, label, isNew: true });

          this.mcaAnnotations[adjustedAddr].push(`${label} referenced **newly added**`);
          break;
        }

        case 'A': {
          if (offset + 1 >= buffer.length) {
            this.error('Invalid A entry (truncated)');
            return;
          }
          const addr = buffer.readUInt16LE(offset);
          offset += 2;
          const adjustedAddr = addr + this.mcaIndex;
          this.ATable.push({ address: adjustedAddr, moduleStart: this.mcaIndex, isNew: true });
          // A references are internal local references, so let's mark the address
          this.mcaAnnotations[adjustedAddr].push(`local reference **newly added**`);
          break;
        }

        default:
          this.error(`Unknown header entry '${entryType}' in file ${fileName}`);
          return;
      }
    }

    // Read code portion until EOF
    let codeWords = 0;
    while (offset + 1 < buffer.length) {
      const word = buffer.readUInt16LE(offset);
      offset += 2;
      this.mca[this.mcaIndex++] = word;
      codeWords++;
    }
    this.fileSizes.push(this.mcaIndex);

    // console.log(`Read ${codeWords} code words from ${fileName}.`);
  }


  /**
   * Print the state of the linker after reading one module.
   */
  printPostModuleRead(fileName) {
    console.log(`\nState after reading module ${fileName}:`);
    printThinLine();

    // Print start address if we have it
    if (this.gotStart) {
      let msg = `Start Address (S): ${this.formatHex(this.startAddress, 4)}`;
      if (this.startIsNew) msg += ` **newly added**`;
      console.log(msg);
    }

    // Print G, E, e, V, A tables
    this.printTable(`G Table (Global definitions) {address, label}`, this.GList, false);
    this.printTable(`E Table (11-bit external references) {address, label}`, this.ETable, false);
    this.printTable(`e Table (9-bit external references) {address, label}`, this.eTable, false);
    this.printTable(`V Table (full 16-bit external references) {address, label}`, this.VTable, false);
    this.printTable(`A Table (local references) {localAddress, moduleStart}`, this.ATable, true);

    printThinLine();
    console.log(`\nCurrent Machine Code Array (mca):`);
    printSpacerLine();
    console.log(`  LOC    MCA    LABEL DEFS & REFS`);
    printThinLine();
    this.printMCA();
  }


  /**
   * Mark newly added table entries as no longer new, so further prints won't show "**newly added**".
   */
  afterModulePrintCleanup() {
    if (this.startIsNew) {
      this.startIsNew = false;
    }
    for (let g of this.GList) {
      if (g.isNew) {
        this.clearNewlyAddedMarkerInAnnotations(g.address);
      }
      g.isNew = false;
    }
    for (let e of this.ETable) {
      if (e.isNew) {
        this.clearNewlyAddedMarkerInAnnotations(e.address);
      }
      e.isNew = false;
    }
    for (let e of this.eTable) {
      if (e.isNew) {
        this.clearNewlyAddedMarkerInAnnotations(e.address);
      }
      e.isNew = false;
    }
    for (let v of this.VTable) {
      if (v.isNew) {
        this.clearNewlyAddedMarkerInAnnotations(v.address);
      }
      v.isNew = false;
    }
    for (let a of this.ATable) {
      if (a.isNew) {
        this.clearNewlyAddedMarkerInAnnotations(a.address);
      }
      a.isNew = false;
    }
  }

  clearNewlyAddedMarkerInAnnotations(addr) {
    const arr = this.mcaAnnotations[addr];
    for (let idx = 0; idx < arr.length; idx++) {
      arr[idx] = arr[idx].replace(' **newly added**','');
    }
  }

  /**
   * Helper function to print table contents (if non-empty).
   * For E/e/V/G, we have { address, label }.
   * For A, we have { address, moduleStart }.
   */
  printTable(title, arr, isATable=false) {
    if (arr.length === 0) {
      return;
    }
    console.log(`\n${title}`);
    for (let entry of arr) {
      if (!isATable) {
        // G/E/e/V Entry Format: "0002 main **newly added**"
        let msg = `${this.formatHex(entry.address,4)} ${entry.label}`;
        if (entry.isNew) {
          msg += ' **newly added**';
        }
        console.log(`  ${msg}`);
      } else {
        // A Entry Format: "000D 0008 **newly added**"
        let msg = `${this.formatHex(entry.address,4)} ${this.formatHex(entry.moduleStart,4)}`;
        if (entry.isNew) {
          msg += ' **newly added**';
        }
        console.log(`  ${msg}`);
      }
    }
  }


  /**
   * Step 2: Adjust external references.
   * For each E/e/V entry, we look up the global label's address in GMap
   * and apply the appropriate formula to mca.
   */
  adjustExternalReferences() {
    // E (11-bit) references
    for (let ref of this.ETable) {
      const { address, label } = ref;
      if (this.GMap[label] === undefined) {
        this.error(`Undefined external reference (E) for label '${label}'`);
        return;
      }
      const globalAddr = this.GMap[label];
      
      // For 11-bit references, bits 0..10 of the instruction is the offset.
      let preAdjustmentWord = this.mca[address];
      let oldOffset = preAdjustmentWord & 0x07ff;  // the old 11-bit offset in the instruction
      
      // We'll replicate the "show your work" style approach:
      console.log(`\nAdjusting address ${this.formatHex(address,4)} (11-bit reference to '${label}')`);
      console.log(`  word pre-adjustment: ${this.formatHex(preAdjustmentWord,4)}`);

      console.log(`  offset = global address + (old offset - 1)`);
      console.log(`  offset = ${this.formatHex(globalAddr,4)} + (${this.formatHex(oldOffset,4)} - 0001)`);

      let offset = globalAddr + (oldOffset - 1);
      console.log(`  offset = ${this.formatHex(offset & 0x07ff,4)}`);

      // Now form the adjusted word by re-injecting offset into the low 11 bits
      let newVal = (preAdjustmentWord & 0xf800) | ((offset) & 0x07ff);

      console.log(`  adjusted word = word pre-adjustment + offset (in 11 bits)`);
      console.log(`  adjusted word = ${this.formatHex(preAdjustmentWord,4)} + ${this.formatHex(offset & 0x07ff,4)}`);
      console.log(`  adjusted word = ${this.formatHex(newVal,4)}`);

      this.mca[address] = newVal;
    }

    // e (9-bit) references
    for (let ref of this.eTable) {
      const { address, label } = ref;
      if (this.GMap[label] === undefined) {
        this.error(`Undefined external reference (e) for label '${label}'`);
        return;
      }
      const globalAddr = this.GMap[label];

      let preAdjustmentWord = this.mca[address];
      let oldOffset = preAdjustmentWord & 0x01ff; // old 9-bit offset

      console.log(`\nAdjusting address ${this.formatHex(address,4)} (9-bit reference to '${label}')`);
      console.log(`  word pre-adjustment: ${this.formatHex(preAdjustmentWord,4)}`);

      console.log(`  offset = global address + (old offset - 1)`);
      console.log(`  offset = ${this.formatHex(globalAddr,4)} + (${this.formatHex(oldOffset,4)} - 0001)`);

      let offset = globalAddr + (oldOffset - 1);
      console.log(`  offset = ${this.formatHex(offset & 0x01ff,4)}`);

      let newVal = (preAdjustmentWord & 0xfe00) | (offset & 0x01ff);

      console.log(`  adjusted word = word pre-adjustment + offset (in 9 bits)`);
      console.log(`  adjusted word = ${this.formatHex(preAdjustmentWord,4)} + ${this.formatHex(offset & 0x01ff,4)}`);
      console.log(`  adjusted word = ${this.formatHex(newVal,4)}`);

      this.mca[address] = newVal;
    }

    // V references (full 16-bit)
    for (let ref of this.VTable) {
      const { address, label } = ref;
      if (this.GMap[label] === undefined) {
        this.error(`Undefined external reference (V) for label '${label}'`);
        return;
      }
      const globalAddr = this.GMap[label];

      let preAdjustmentWord = this.mca[address];

      console.log(`\nAdjusting address ${this.formatHex(address,4)} (full 16-bit reference to '${label}')`);
      console.log(`  word pre-adjustment: ${this.formatHex(preAdjustmentWord,4)}`);
      console.log(`  adjusted word = word pre-adjustment + global address`);
      console.log(`  adjusted word = ${this.formatHex(preAdjustmentWord,4)} + ${this.formatHex(globalAddr,4)}`);

      let newVal = preAdjustmentWord + globalAddr;

      console.log(`  adjusted word = ${this.formatHex(newVal,4)}`);

      this.mca[address] = newVal;
    }
  }


  /**
   * Step 3: Adjust local references (A). For each A entry:
   *   word post-adjustment = word pre-adjustment + moduleStart.
   * "Show your work" line-by-line.
   */
  adjustLocalReferences() {
    for (let ref of this.ATable) {
      const { address, moduleStart } = ref;
      let preAdjustmentWord = this.mca[address];

      console.log(`\nAdjusting address ${this.formatHex(address,4)} (local reference)`);
      console.log(`  word pre-adjustment: ${this.formatHex(preAdjustmentWord,4)}`);
      console.log(`  adjusted word = word pre-adjustment + module start`);
      console.log(`  adjusted word = ${this.formatHex(preAdjustmentWord,4)} + ${this.formatHex(moduleStart,4)}`);

      let newVal = preAdjustmentWord + moduleStart;
      console.log(`  adjusted word = ${this.formatHex(newVal,4)}`);

      this.mca[address] = newVal;
    }
  }


  /**
   * Print the entire machine code array up to mcaIndex. Break modules with thin lines.
   * Show a third column for label definitions & references.
   */
  printMCA() {
    let moduleBoundaryIdx = 0;
    let fileSizesIndex = 0;
    if (this.fileSizes.length > 0) {
      moduleBoundaryIdx = this.fileSizes[fileSizesIndex++];
    }

    for (let i = 0; i < this.mcaIndex; i++) {
      if (i === moduleBoundaryIdx && i !== 0) {
        // Reached the boundary of a previous module
        printThinLine();
        if (fileSizesIndex < this.fileSizes.length) {
          moduleBoundaryIdx = this.fileSizes[fileSizesIndex++];
        }
      }

      let locStr = this.formatHex(i, 4);
      let mcaStr = this.formatHex(this.mca[i], 4);

      let labelInfo = this.mcaAnnotations[i];
      let labelStr = (labelInfo.length > 0) ? labelInfo.join(', ') : '';
      console.log(`| ${locStr} : ${mcaStr} | ${labelStr}`);
    }
    printSpacerLine();
  }


  /**
   * Step 4: Write out the final "link.e" file with the reconstructed header + code.
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

    printThinLine();
    console.log("\no");

    // Write out the file signature
    fs.writeSync(outFd, 'o');

    // S entry if present
    if (this.gotStart) {
      console.log(`S  ${this.formatHex(this.startAddress,4)}`);
      const bufferS = Buffer.alloc(3);
      bufferS.write('S', 0);
      bufferS.writeUInt16LE(this.startAddress, 1);
      fs.writeSync(outFd, bufferS);
    }

    // G entries
    for (let g of this.GList) {
      let addr = g.address;
      console.log(`G  ${this.formatHex(addr,4)}  ${g.label}`);
      const bufferG = Buffer.alloc(3 + g.label.length + 1);
      bufferG.write('G', 0);
      bufferG.writeUInt16LE(addr, 1);
      bufferG.write(g.label, 3);
      bufferG.writeUInt8(0, 3 + g.label.length);
      fs.writeSync(outFd, bufferG);
    }

    // V entries become A entries in the final output
    for (let v of this.VTable) {
      console.log(`A  ${this.formatHex(v.address,4)}  (was V)`);
      const bufferA = Buffer.alloc(3);
      bufferA.write('A', 0);
      bufferA.writeUInt16LE(v.address, 1);
      fs.writeSync(outFd, bufferA);
    }

    // A entries
    for (let a of this.ATable) {
      console.log(`A  ${this.formatHex(a.address,4)}`);
      const bufferA = Buffer.alloc(3);
      bufferA.write('A', 0);
      bufferA.writeUInt16LE(a.address, 1);
      fs.writeSync(outFd, bufferA);
    }

    // Header terminator
    console.log("C\n");
    fs.writeSync(outFd, 'C');

    // Write code
    const codeBuffer = Buffer.alloc(this.mcaIndex * 2);
    let printString = "";
    for (let i = 0; i < this.mcaIndex; i++) {
      codeBuffer.writeUInt16LE(this.mca[i], i*2);
      printString += this.formatHex(this.mca[i],4);
      if (i < this.mcaIndex - 1) {
        printString += " ";
      }
      if( (i + 1) % 8 === 0 ) {
        printString += "\n";
      }
    }
    fs.writeSync(outFd, codeBuffer);
    console.log(printString + "\n");

    fs.closeSync(outFd);
    // Could print a final success message if desired
  }


  /**
   * Utility: set errorFlag and print error message.
   */
  error(message) {
    console.error(`Linker Error: ${message}`);
    this.errorFlag = true;
  }

  /**
   * Utility: Format a number as uppercase hex of a certain width (e.g. 16-bit => 4 chars).
   */
  formatHex(num, width) {
    return num.toString(16).toUpperCase().padStart(width, '0');
  }
}


// If invoked directly from Node, run the linker
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
