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
const { buildReportArtifacts } = require('../utils/reportArtifacts');
const {
  constructSiblingFileName,
  readTextInput,
  writeReportFiles,
} = require('../utils/fileArtifacts');
const { AssemblerError } = require('../utils/errors');
const {
  OPCODE_BR: OP_BR, OPCODE_ADD: OP_ADD, OPCODE_LD: OP_LD, OPCODE_ST: OP_ST,
  OPCODE_BL: OP_BL, OPCODE_AND: OP_AND, OPCODE_LDR: OP_LDR, OPCODE_STR: OP_STR,
  OPCODE_CMP: OP_CMP, OPCODE_NOT: OP_NOT, OPCODE_EXT: OP_EXT, OPCODE_SUB: OP_SUB,
  OPCODE_JMP: OP_JMP, OPCODE_MVI: OP_MVI, OPCODE_LEA: OP_LEA, OPCODE_TRAP: OP_TRAP,
  TRAP_NL, TRAP_DOUT, TRAP_UDOUT, TRAP_HOUT, TRAP_AOUT, TRAP_SOUT,
  TRAP_DIN, TRAP_HIN, TRAP_AIN, TRAP_SIN, TRAP_M, TRAP_R, TRAP_S, TRAP_BP,
  EOP_PUSH, EOP_POP, EOP_SRL, EOP_SRA, EOP_SLL, EOP_ROL, EOP_ROR,
  EOP_MUL, EOP_DIV, EOP_REM, EOP_OR, EOP_XOR, EOP_MVR, EOP_SEXT,
} = require('./constants');

const { fatalExit, cliErrorExit } = require('../utils/cliExit');
const { suggestClosest } = require('../utils/suggest');
const { formatExplanation } = require('../utils/explanations');

/**
 * Set to false to match original LCC behavior of reporting only
 * a single error at a time.
 *
 * NOTE: this is an ASSEMBLER-ONLY switch. The linker has no equivalent —
 * `Linker.error()` always throws on the first error (unconditional fail-fast).
 * Flipping this to `true` would make the assembler collect-and-continue while
 * the linker keeps aborting, diverging the two halves from each other AND from
 * the oracle's one-error-at-a-time reporting. See docs/project-gotchas.md §9.
 *  */
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
     * When true, error() includes the source line in the diagnostic.
     * Set via the -v/--verbose CLI flag.
     */
    this.verboseModeOn = false;

    /**
     * When true, error() appends a student-friendly `explain:` block for any
     * diagnostic that carries an explainKey (#1096). Set via the --explain CLI
     * flag. Independent of verbose; the two compose.
     */
    this.explainModeOn = false;

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
     * defaultLoadPoint: the internal default for loadPoint (always 0; all reset
     *   sites use this so there is a single place to change it if ever needed).
     * loadPoint: tracks the current assembly-time locCtr start (normally 0;
     *   set to locCtr at pass-1 start; used in programSize = locCtr - loadPoint).
     * listingLoadPoint: the -l<hex> CLI value (display-only); added to locCtr
     *   when rendering listing addresses so they match the intended memory layout.
     *   Does NOT affect encoded machine code or the .e file.
     */
    this.defaultLoadPoint = 0;
    this.loadPoint = this.defaultLoadPoint;
    this.listingLoadPoint = 0;

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

    /**
     * Whether reusable assembly paths should throw typed errors instead of exiting
     */
    this.throwOnAssemblyError = false;

    /**
     * sourceMap: { addressToLine: Map<number, {lineNumber, sourceLine}>, allLines: string[] }
     * Built after pass 2 for .a files; null for .bin/.hex/object modules.
     */
    this.sourceMap = null;

    this._instructionTable = this._buildCoreTable();
  }

  _buildCoreTable() {
    return {
      // BR family — mnemonic passed through for condition-code lookup
      'br':    { encoder: (ops) => this.assembleBR('br',   ops), operandShape: 'label' },
      'bral':  { encoder: (ops) => this.assembleBR('bral', ops), operandShape: 'label' },
      'brz':   { encoder: (ops) => this.assembleBR('brz',  ops), operandShape: 'label' },
      'bre':   { encoder: (ops) => this.assembleBR('bre',  ops), operandShape: 'label' },
      'brnz':  { encoder: (ops) => this.assembleBR('brnz', ops), operandShape: 'label' },
      'brne':  { encoder: (ops) => this.assembleBR('brne', ops), operandShape: 'label' },
      'brn':   { encoder: (ops) => this.assembleBR('brn',  ops), operandShape: 'label' },
      'brp':   { encoder: (ops) => this.assembleBR('brp',  ops), operandShape: 'label' },
      'brlt':  { encoder: (ops) => this.assembleBR('brlt', ops), operandShape: 'label' },
      'brgt':  { encoder: (ops) => this.assembleBR('brgt', ops), operandShape: 'label' },
      'brc':   { encoder: (ops) => this.assembleBR('brc',  ops), operandShape: 'label' },
      'brb':   { encoder: (ops) => this.assembleBR('brb',  ops), operandShape: 'label' },
      // MOV family — mnemonic passed through for dispatch
      'mov':   { encoder: (ops) => this.assembleMOV('mov', ops), operandShape: 'dr, sr|imm9' },
      'mvi':   { encoder: (ops) => this.assembleMOV('mvi', ops), operandShape: 'dr, imm9' },
      'mvr':   { encoder: (ops) => this.assembleMOV('mvr', ops), operandShape: 'dr, sr' },
      // Arithmetic / logic
      'add':   { encoder: (ops) => this.assembleADD(ops),  operandShape: 'dr, sr1, sr2|imm5' },
      'sub':   { encoder: (ops) => this.assembleSUB(ops),  operandShape: 'dr, sr1, sr2|imm5' },
      'cmp':   { encoder: (ops) => this.assembleCMP(ops),  operandShape: 'sr1, sr2|imm5' },
      'and':   { encoder: (ops) => this.assembleAND(ops),  operandShape: 'dr, sr1, sr2|imm5' },
      'not':   { encoder: (ops) => this.assembleNOT(ops),  operandShape: 'dr, sr' },
      'or':    { encoder: (ops) => this.assembleOR(ops),   operandShape: 'dr, sr' },
      'xor':   { encoder: (ops) => this.assembleXOR(ops),  operandShape: 'dr, sr' },
      'sext':  { encoder: (ops) => this.assembleSEXT(ops), operandShape: 'dr, sr' },
      'mul':   { encoder: (ops) => this.assembleMUL(ops),  operandShape: 'dr, sr' },
      'div':   { encoder: (ops) => this.assembleDIV(ops),  operandShape: 'dr, sr' },
      'rem':   { encoder: (ops) => this.assembleREM(ops),  operandShape: 'dr, sr' },
      // Shifts / rotates
      'srl':   { encoder: (ops) => this.assembleSRL(ops),  operandShape: 'sr[, ct]' },
      'sra':   { encoder: (ops) => this.assembleSRA(ops),  operandShape: 'sr[, ct]' },
      'sll':   { encoder: (ops) => this.assembleSLL(ops),  operandShape: 'sr[, ct]' },
      'rol':   { encoder: (ops) => this.assembleROL(ops),  operandShape: 'sr[, ct]' },
      'ror':   { encoder: (ops) => this.assembleROR(ops),  operandShape: 'sr[, ct]' },
      // Stack
      'push':  { encoder: (ops) => this.assemblePUSH(ops), operandShape: 'sr' },
      'pop':   { encoder: (ops) => this.assemblePOP(ops),  operandShape: 'dr' },
      // Memory
      'ld':    { encoder: (ops) => this.assembleLD(ops),   operandShape: 'dr, label' },
      'st':    { encoder: (ops) => this.assembleST(ops),   operandShape: 'sr, label' },
      'ldr':   { encoder: (ops) => this.assembleLDR(ops),  operandShape: 'dr, baser, offset6' },
      'str':   { encoder: (ops) => this.assembleSTR(ops),  operandShape: 'sr, baser, offset6' },
      'lea':   { encoder: (ops) => this.assembleLea(ops),  operandShape: 'dr, label' },
      'cea':   { encoder: (ops) => this.assembleCEA(ops),  operandShape: 'dr, imm5' },
      // Control flow
      'call':  { encoder: (ops) => this.assembleBL(ops),   operandShape: 'label' },
      'jsr':   { encoder: (ops) => this.assembleBL(ops),   operandShape: 'label' },
      'bl':    { encoder: (ops) => this.assembleBL(ops),   operandShape: 'label' },
      'jsrr':  { encoder: (ops) => this.assembleBLR(ops),  operandShape: 'baser[, offset6]' },
      'blr':   { encoder: (ops) => this.assembleBLR(ops),  operandShape: 'baser[, offset6]' },
      'jmp':   { encoder: (ops) => this.assembleJMP(ops),  operandShape: 'baser[, offset6]' },
      'ret':   { encoder: (ops) => this.assembleRET(ops),  operandShape: '[offset6]' },
      // No-operand traps (constant machine word)
      'halt':  { encoder: (_ops) => OP_TRAP,             operandShape: '(none)' },
      'nl':    { encoder: (_ops) => OP_TRAP | TRAP_NL,   operandShape: '(none)' },
      // Register-bearing traps
      'dout':  { encoder: (ops) => this.assembleTrap(ops, TRAP_DOUT),  operandShape: '[sr]' },
      'udout': { encoder: (ops) => this.assembleTrap(ops, TRAP_UDOUT), operandShape: '[sr]' },
      'hout':  { encoder: (ops) => this.assembleTrap(ops, TRAP_HOUT),  operandShape: '[sr]' },
      'aout':  { encoder: (ops) => this.assembleTrap(ops, TRAP_AOUT),  operandShape: '[sr]' },
      'sout':  { encoder: (ops) => this.assembleTrap(ops, TRAP_SOUT),  operandShape: '[sr]' },
      'din':   { encoder: (ops) => this.assembleTrap(ops, TRAP_DIN),   operandShape: '[sr]' },
      'hin':   { encoder: (ops) => this.assembleTrap(ops, TRAP_HIN),   operandShape: '[sr]' },
      'ain':   { encoder: (ops) => this.assembleTrap(ops, TRAP_AIN),   operandShape: '[sr]' },
      'sin':   { encoder: (ops) => this.assembleTrap(ops, TRAP_SIN),   operandShape: '[sr]' },
      'm':     { encoder: (ops) => this.assembleTrap(ops, TRAP_M),     operandShape: '[sr]' },
      'r':     { encoder: (ops) => this.assembleTrap(ops, TRAP_R),     operandShape: '[sr]' },
      's':     { encoder: (ops) => this.assembleTrap(ops, TRAP_S),     operandShape: '[sr]' },
      'bp':    { encoder: (ops) => this.assembleTrap(ops, TRAP_BP),    operandShape: '(none)' },
    };
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

  // Reset all per-run assembler state so the core logic can be reused
  // without depending on a fresh class instance or any filesystem setup.
  resetAssemblyState() {
    this.symbolTable = {};
    this.locCtr = 0;
    this.lineNum = 0;
    this.sourceLines = [];
    this.errorFlag = false;
    this.pass = 1;
    this.labels = new Set();
    this.errors = [];
    this.outputBuffer = [];
    this.outFile = null;
    this.listing = [];
    this.loadPoint = this.defaultLoadPoint;
    // listingLoadPoint is a per-run display offset (the -l<hex> value). It is
    // cleared here so a reused instance does not leak a prior run's -l into a
    // later assembly; callers (CLI/in-memory) re-supply it via the
    // assembleSource() listingLoadPoint option. (#1238)
    this.listingLoadPoint = 0;
    // Caller-provided display/identity config (set by lcc.js before main()):
    // verbose/explain flags and the resolved userName. Like listingLoadPoint,
    // these are per-run inputs, not derived state — cleared here so a reused
    // instance does not leak a prior run's value, and re-applied per-call via
    // the assembleSource() options below (default off / null). main() threads
    // the CLI-wired values through those options so they survive this reset.
    // (#1277, identical shape to the #1238 listingLoadPoint fix)
    this.verboseModeOn = false;
    this.explainModeOn = false;
    this.userName = null;
    this.programSize = 0;
    this.startLabel = null;
    this.startAddress = null;
    this.isObjectModule = false;
    this.globalLabels = new Set();
    this.externLabels = new Set();
    this.externalReferences = [];
    this.adjustmentEntries = [];
    this.throwOnAssemblyError = false;
    this.sourceMap = null;
  }

  createAssemblyError(message, exitCode = 1) {
    const error = new AssemblerError(message);
    error.exitCode = exitCode;
    return error;
  }

  /**
   * Validates the raw source line length before any comment stripping or tokenization.
   * The 300-character limit counts the raw line including comments — confirmed correct
   * by the #244 oracle probe (docs/research/line-length-limit.md): OG LCC has no
   * length diagnostic and instead silently splits lines past its 298-char buffer,
   * parsing the overflow as bogus source. This explicit cap is an intentional,
   * fail-fast deviation (docs/parity_deviations.md BY DESIGN #7), not a port of an
   * oracle limit; keeping 300 over the oracle's 298 is deliberate.
   *
   * @param {string} line - The raw source line.
   */
  validateLineLength(line) {
    if (line.length > 300) {
      this.abortAssembly('Line exceeds maximum length of 300 characters', 1);
    }
  }

  abortAssembly(message, code = 1) {
    if (this.throwOnAssemblyError) {
      throw this.createAssemblyError(message, code);
    }

    fatalExit(message, code);
  }

  // Capture the current in-memory assembly state in a structured result so
  // callers can consume assembled output without depending on instance mutation.
  createAssemblyResult({ buildReports = false, userName, includeComments = false, now } = {}) {
    let reports = { lst: null, bst: null };

    if (buildReports) {
      if (!userName) {
        throw this.createAssemblyError('userName is required when buildReports is true', 1);
      }

      const { lstContent, bstContent } = this.buildReportArtifacts(userName, includeComments, now);
      reports = {
        lst: lstContent,
        bst: bstContent,
      };
    }

    return {
      inputFileName: this.inputFileName,
      outputFileName: this.outputFileName,
      isObjectModule: this.isObjectModule,
      startAddress: this.startAddress,
      loadPoint: this.loadPoint,
      symbolTable: { ...this.symbolTable },
      listing: this.listing.map(entry => ({ ...entry })),
      outputBuffer: this.outputBuffer.slice(),
      outputBytes: this.toOutputBuffer(),
      reports,
      sourceMap: this.sourceMap,
    };
  }

  assembleSource(sourceCode, options = {}) {
    const {
      inputFileName = this.inputFileName,
      outputFileName = this.outputFileName,
      listingLoadPoint = 0,
      verboseModeOn = false,
      explainModeOn = false,
      throwOnAssemblyError = true,
      buildReports = false,
      userName,
      includeComments = false,
      now,
    } = options;

    this.resetAssemblyState();
    this.inputFileName = inputFileName;
    this.outputFileName = outputFileName;
    // Re-apply the display-only -l offset after the reset. Defaults to 0 (no
    // offset) so an omitted option means "this run has no -l", never an
    // inherited value from a prior assembly on the same instance. (#1238)
    this.listingLoadPoint = listingLoadPoint;
    // Re-apply the caller-provided display/identity config after the reset, for
    // the same reason as listingLoadPoint: an omitted option means "this run has
    // none", never a value inherited from a prior assembly on the same instance.
    // userName must survive because main()'s object-module report consumes
    // this.userName after assembleSource() returns. (#1277)
    this.verboseModeOn = verboseModeOn;
    this.explainModeOn = explainModeOn;
    this.userName = userName ?? null;
    this.sourceLines = sourceCode.split('\n');
    this.throwOnAssemblyError = throwOnAssemblyError;

    try {
      const extension = path.extname(this.inputFileName).toLowerCase();

      // If the file ends in ".bin", parse it as raw binary instead of doing normal assembly.
      // This keeps the core parsing path reusable while preserving the existing CLI behavior.
      if (extension === '.bin') {
        this.parseBinFile();
        // Note: The original LCC does not print any message for .bin files (as of 12/2024).
        console.log(`Loading ${this.inputFileName} (no assembly pass) — ${this.outputBuffer.length} word(s)`);
        // Construct output filename with .e extension.
        this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');
        return;
      }

      // If the file ends in ".hex", parse it as raw hexadecimal instead of doing normal assembly.
      if (extension === '.hex') {
        this.parseHexFile();
        // Note: The original LCC does not print any message for .hex files (as of 12/2024).
        console.log(`Loading ${this.inputFileName} (no assembly pass) — ${this.outputBuffer.length} word(s)`);
        this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');
        return;
      }

      // Note: Treating only .a files as valid assembly files is
      //       a unique LCC.js behavior as of 12/2024. The official
      //       LCC behavior is to treat all non .bin, .hex, .o, and
      //       .e files as assembly files.
      if (extension !== '.a') {
        if (extension === '.ap') {
          this.abortAssembly('Error: .ap files are not supported by assembler.js - Did you mean to use assemblerPlus.js?', 1);
        }
        // custom lcc.js behavior: print an error and exit if the
        // file extension is not recognized as a supported type
        // (currently only .a, .bin, and .hex are supported)
        this.abortAssembly('Unsupported file type', 1);
      }

      // If a .a file, proceed with the normal two-pass assembly flow.
      // Construct the default output file name by replacing the extension with '.e'.
      this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');

      // Perform Pass 1.
      console.log('Starting assembly pass 1');
      this.pass = 1;
      this.performPass();

      if (this.locCtr === 0) {
        this.abortAssembly('Empty file', 0);
      }

      if (this.errorFlag) {
        this.abortAssembly('Errors encountered during Pass 1.', 1);
      }

      // Rewind source lines for Pass 2.
      console.log('Starting assembly pass 2');
      this.pass = 2;
      this.locCtr = 0;
      this.lineNum = 0;
      this.performPass();

      // Build sourceMap: address → {lineNumber, sourceLine} for every code-producing line.
      // Used by IInterpreter.displayCodeSnippet() to show source context around the current PC.
      this.sourceMap = {
        addressToLine: new Map(),
        allLines: this.sourceLines.slice(),
      };
      for (const entry of this.listing) {
        if (entry.codeWords && entry.codeWords.length > 0) {
          this.sourceMap.addressToLine.set(entry.locCtr, {
            lineNumber: entry.lineNum,
            sourceLine: entry.sourceLine,
          });
        }
      }

      // After Pass 2, object modules switch from .e output to .o output.
      if (this.isObjectModule) {
        this.outputFileName = this.constructOutputFileName(this.inputFileName, '.o');
      }

      if (this.errorFlag) {
        // Close the output file only if it was opened earlier in the run.
        if (this.outFile !== null) {
          fs.closeSync(this.outFile);
        }
        this.abortAssembly('Errors encountered during Pass 2.', 1);
      }

      // Resolve the start label to an address before serializing the output file.
      if (this.startLabel !== null) {
        if (this.symbolTable.hasOwnProperty(this.startLabel)) {
          this.startAddress = this.symbolTable[this.startLabel];
        } else {
          // Note: as of 12/2024, LCC does not print any message for this case
          // and instead ignores undefined .start labels, but LCC.js treats it as an error.
          this.failAssembly('Undefined label', 1, null, 'UNDEFINED_LABEL');
        }
      } else {
        // If no .start directive is present, default the start address to 0.
        this.startAddress = 0;
      }

      return this.createAssemblyResult({
        buildReports,
        userName,
        includeComments,
        now,
      });
    } finally {
      this.throwOnAssemblyError = false;
    }
  }

  // Build the listing/statistics file contents without writing them to disk.
  // This lets tests and future wrappers verify output in memory.
  buildReportArtifacts(userName, includeComments = false, now) {
    return buildReportArtifacts({
      assembler: this,
      userName,
      inputFileName: this.inputFileName,
      includeComments,
      now,
    });
  }

  buildOutputFileChunks(secondIntroHeader = '') {
    const chunks = [Buffer.from('o', 'ascii')];

    // Custom LCC.js behavior as of 12/2024:
    // Write the second intro header if it is provided.
    // This enables extensions that need special header entries.
    if (secondIntroHeader !== '') {
      chunks.push(Buffer.from(secondIntroHeader, 'ascii'));
    }

    // Collect all header entries before serializing them so they can be sorted
    // and returned either to the file-writing path or an in-memory caller.
    let headerEntries = [];

    // Add 'S' entry if present.
    if (this.startLabel !== null && this.startAddress !== null) {
      headerEntries.push({ type: 'S', address: this.startAddress });
    }

    // Collect 'G' entries.
    for (let label of this.globalLabels) {
      const address = this.symbolTable[label];
      headerEntries.push({ type: 'G', address: address, label: label });
    }

    // Collect external references ('E', 'e', 'V').
    for (let ref of this.externalReferences) {
      headerEntries.push({ type: ref.type, address: ref.address, label: ref.label });
    }

    // Collect 'A' entries.
    for (let address of this.adjustmentEntries) {
      headerEntries.push({ type: 'A', address: address });
    }

    // Sort header entries by address so the serialized output matches the existing file format.
    headerEntries.sort((a, b) => a.address - b.address);

    // Serialize the header entries into byte chunks.
    for (let entry of headerEntries) {
      switch (entry.type) {
        case 'S': {
          const buffer = Buffer.alloc(3);
          buffer.write('S', 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          chunks.push(buffer);
          break;
        }
        case 'G':
        case 'E':
        case 'e':
        case 'V': {
          const buffer = Buffer.alloc(3 + entry.label.length + 1);
          buffer.write(entry.type, 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          buffer.write(entry.label, 3, 'ascii');
          buffer.writeUInt8(0, 3 + entry.label.length);
          chunks.push(buffer);
          break;
        }
        case 'A': {
          const buffer = Buffer.alloc(3);
          buffer.write('A', 0, 'ascii');
          buffer.writeUInt16LE(entry.address, 1);
          chunks.push(buffer);
          break;
        }
        default:
          // Should not reach here.
          this.error('invalid header entry error');
          break;
      }
    }

    // Write the code start marker 'C'.
    chunks.push(Buffer.from('C', 'ascii'));

    // Write machine code words.
    const codeBuffer = Buffer.alloc(this.outputBuffer.length * 2);
    for (let i = 0; i < this.outputBuffer.length; i++) {
      codeBuffer.writeUInt16LE(this.outputBuffer[i], i * 2);
    }
    chunks.push(codeBuffer);

    return chunks;
  }

  toOutputBuffer(secondIntroHeader = '') {
    return Buffer.concat(this.buildOutputFileChunks(secondIntroHeader));
  }

  main(args) {
    args = args || process.argv.slice(2);

    // Check if inputFileName is already set (e.g., set by lcc.js before calling main())
    if (!this.inputFileName) {
      if (args.length === 0) {
        // No args: print usage to stdout and exit 0 (help, not error)
        console.log('Usage: assembler.js <input filename>');
        fatalExit('Usage: assembler.js <input filename>', 0);
      } else if (args.length !== 1) {
        // Wrong number of args: print error to stderr and exit 1
        cliErrorExit('Usage: assembler.js <input filename>', 1);
      }
      this.inputFileName = args[0];
    }

    // Read the source code from the input file
    let sourceCode;
    try {
      sourceCode = readTextInput(this.inputFileName);
    } catch (err) {
      cliErrorExit(`Cannot open input file ${this.inputFileName}`, 1); // , err: ${err}
    }

    this.assembleSource(sourceCode, {
      inputFileName: this.inputFileName,
      outputFileName: this.outputFileName,
      // Thread the CLI-wired -l<hex> value (set on the instance by lcc.js before
      // main()) through as a per-call option so resetAssemblyState() inside
      // assembleSource() does not wipe it. (#1238)
      listingLoadPoint: this.listingLoadPoint,
      // Same for the -v/--explain flags and the resolved userName: lcc.js sets
      // them on the instance before main(); thread them through so the internal
      // reset re-applies rather than wipes them. (#1277)
      verboseModeOn: this.verboseModeOn,
      explainModeOn: this.explainModeOn,
      userName: this.userName,
      throwOnAssemblyError: false,
    });

    // Write the assembled output file after the in-memory assembly pass completes.
    this.writeOutputFile();

    // After writing the output file, handle the additional object-module artifacts.
    if (this.isObjectModule) {
      console.log(`Output file ${this.outputFileName} needs linking`);

      // Generate .lst and .bst files.
      const { lstContent, bstContent } = this.buildReportArtifacts(this.userName);

      // Write the .lst and .bst files.
      const { lstFileName, bstFileName } = writeReportFiles(this.inputFileName, lstContent, bstContent);

      console.log(`lst file = ${lstFileName}`);
      console.log(`bst file = ${bstFileName}`);
    }

  }

  writeOutputFile(secondIntroHeader = '') {
    // Open the output file for writing
    try {
      this.outFile = fs.openSync(this.outputFileName, 'w');
    } catch (err) {
      cliErrorExit(`Cannot open output file ${this.outputFileName}`, 1);
    }
  
    // Reuse the same serialized chunks that the in-memory API exposes.
    for (const chunk of this.buildOutputFileChunks(secondIntroHeader)) {
      fs.writeSync(this.outFile, chunk);
    }
  
    // Close the output file
    fs.closeSync(this.outFile);
  }  

  constructOutputFileName(inputFileName, extension) {
    return constructSiblingFileName(inputFileName, extension);
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
    // At the beginning of Pass 1 capture where in locCtr-space code starts.
    // locCtr is always 0 here (reset before pass 1) so this equals defaultLoadPoint
    // (also 0).  Kept separate so programSize = locCtr - loadPoint is correct for
    // programs that begin at a non-zero locCtr via .org.
    if (this.pass === 1) {
      this.loadPoint = this.defaultLoadPoint;
    }

    if (this.pass === 2) {
      this.outputBuffer = [];
    }

    for (let line of this.sourceLines) {
      this.lineNum++;
      let originalLine = line;
      this.currentLine = originalLine; // Store current line for error reporting
      this.validateLineLength(originalLine);
      
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
          this.error('Bad label', null, 'BAD_LABEL'); // `Invalid label format: ${label}`
        }
        if (this.pass === 1) {
          if (this.labels.has(label)) {
            this.error('Duplicate label', null, 'DUPLICATE_LABEL'); // `Duplicate label: ${label}`
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
        this.error('Program too big', null, 'PROGRAM_TOO_BIG');
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
    this.loadPoint = this.defaultLoadPoint;
    for (let lineNum = 0; lineNum < this.sourceLines.length; lineNum++) {
      this.lineNum++;
      let line = this.sourceLines[lineNum];
      this.currentLine = line; // For error messages
      this.validateLineLength(line);

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
        this.abortAssembly(`Error: line ${lineNum+1} in .hex file is not purely hexadecimal: "${line}"`, 1);
      }
      if (line.length !== 4) {
        this.abortAssembly(`Error: line ${lineNum+1} in .hex file does not have exactly 4 nibbles: "${line}"`, 1);
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
      this.abortAssembly('Empty file', 0); // No instructions or data found in source file
    }
  
    // If you want a "startAddress = 0" by default, do that here
    this.startAddress = 0;     // or your choice
    this.startLabel = null;    // No .start directive in raw hex files
  }

  parseBinFile() {
    this.outputBuffer = [];     // Prepare output buffer
    this.locCtr = 0;
    this.loadPoint = this.defaultLoadPoint;
    for (let lineNum = 0; lineNum < this.sourceLines.length; lineNum++) {
      this.lineNum++;
      let line = this.sourceLines[lineNum];
      this.currentLine = line; // For error messages
      this.validateLineLength(line);

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
        this.abortAssembly(`Error: line ${lineNum+1} in .bin file is not purely binary: "${line}"`, 1);
      }
      if (line.length !== 16) {
        this.abortAssembly(`Error: line ${lineNum+1} in .bin file does not have exactly 16 bits: "${line}"`, 1);
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
      this.abortAssembly('Empty file', 0); // No instructions or data found in source file
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
          this.failAssembly(`Missing terminating quote`, 1);
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

  _getValidDirectives() {
    return [
      '.start', '.org', '.orig', '.globl', '.global',
      '.extern', '.blkw', '.space', '.zero',
      '.fill', '.word', '.stringz', '.asciz', '.string',
    ];
  }

  handleDirective(mnemonic, operands) {
    mnemonic = mnemonic.toLowerCase();
    switch (mnemonic) {
      case '.start':
        
        if(operands[0] === null || operands[0] === undefined) {
          this.failAssembly("Missing operand", 1);
        }

        if(!this.isValidLabel(operands[0])) {
          this.failAssembly("Bad operand--not a valid label", 1, null, 'BAD_OPERAND_LABEL');
        }

        this.startLabel = operands[0];
        // Note: startAddress will be resolved after Pass 2 when all symbols are known
        break;
      case '.org':
      case '.orig':

        if (operands[0] === null || operands[0] === undefined) {
          this.failAssembly('Missing operand', 1);
        }

        const orgAddress = this.parseNumber(operands[0]);
        if (isNaN(orgAddress)) {
          // Custom LCC.js behavior: keep the .org-specific error wording rather
          // than the shorter oracle message ("Bad number") for non-numeric args.
          this.failAssembly('Invalid number for .org directive', 1, null, 'ORG_DIRECTIVE');
        }

        if (orgAddress < 0 || orgAddress > 0xFFFF) {
          this.failAssembly('Bad number', 1);
        }

        if (orgAddress < this.locCtr) {
          this.failAssembly('Backward address on .org', 1, null, 'ORG_DIRECTIVE');
        }

        if (this.pass === 2) {
          while (this.locCtr < orgAddress) {
            this.writeMachineWord(0);
            this.locCtr += 1;
          }
        } else {
          this.locCtr = orgAddress;
        }
        break;
      case '.globl':
      case '.global':
        
        if(operands[0] === null || operands[0] === undefined) {
          this.failAssembly("Missing operand", 1);
        }

        if(!this.isValidLabel(operands[0])) {
          this.failAssembly("Bad operand--not a valid label", 1, null, 'BAD_OPERAND_LABEL');
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
          this.failAssembly("Missing operand", 1);
        }

        if(!this.isValidLabel(operands[0])) {
          this.failAssembly("Bad operand--not a valid label", 1, null, 'BAD_OPERAND_LABEL');
        }

        this.isObjectModule = true; // Set flag to produce .o file
        let externLabel = operands[0];
        this.externLabels.add(externLabel);
        break;
      case '.blkw':
      case '.space':
      case '.zero':

        if(operands[0] === null || operands[0] === undefined) {
          this.failAssembly("Missing operand", 1);
        }

        let num = parseInt(operands[0], 10);
        if (isNaN(num)) {
          this.failAssembly("Bad number", 1);
        }

        // Note: in the original LCC (as of 12/2024), the .zero directive arguments
        // are not checked for negativity, so this currently is a custom LCC.js behavior
        if(num < 1 || num > (65536 - this.locCtr)) {
          this.failAssembly("Bad number", 1);
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
          this.failAssembly("Missing operand", 1);
        }

        if(this.isOperator(operands[0]) && (operands[1] === null || operands[1] === undefined)) {
          this.failAssembly("Missing operand", 1);
        }

        // Accepted .word operand forms (tokenizer splits on whitespace/comma,
        // not on +/- so unspaced label+offset is a single token):
        //   .word N          literal number
        //   .word label      label address
        //   .word label+N    one token (parseLabelWithOffset extracts offset)
        //   .word label + N  three tokens (3-operand block below joins them)
        //   .word +          → Missing operand (caught above at line 1087)
        //   .word label +N   two tokens: only label is evaluated; +N is ignored (known gap)
        if (this.pass === 2) {
          let label = operands[0];

          // if not a number castable literal, then operands[0] is a label
          if(!this.isNumLiteral(operands[0]) && operands[1] && operands[2]) {

            // if operands[2] is not a literal value, then it isn't a valid offset
            if(!this.isNumLiteral(operands[2])) {
              this.failAssembly(`Bad number`, 1); // : ${operands[2]}
            }

            label = operands[0] + operands[1] + operands[2];
          }

          if((operands[1] && this.isOperator(operands[1])) && 
          (operands[2] === null || operands[2] === undefined)) {      
            this.failAssembly('Missing number', 1);
          }

          let value = this.evaluateOperand(label, 'V'); // Pass 'V' as usageType
          if (value === null) {
            this.failAssembly(`Bad number`, 1); // : ${value}
          };
      
          // see if operand is label +/- offset
          const parsed = this.parseLabelWithOffset(label);

          if (parsed && this.symbolTable.hasOwnProperty(parsed.label)) {
            // It's a local label with offset, so record an A-entry
            this.handleAdjustmentEntry(this.locCtr);
          }

          if(parsed && (parsed.offset > 65535 || parsed.offset < -32768)) {
            this.failAssembly(`Bad number`, 1); // 'Data does not fit in 16 bits' // : ${parsed.offset}
          }

          this.writeMachineWord(value & 0xFFFF);
        }
        this.locCtr += 1;
        break;
      case '.stringz':
      case '.asciz':
      case '.string':

        if(operands[0] === null || operands[0] === undefined) {
          this.failAssembly("Missing operand", 1);
        }

        let strOperand = operands[0];

        if(strOperand && strOperand.length > 0) {
          if(strOperand[0] !== '"') {
            this.failAssembly("String constant missing leading quote", 1);
          }
        }

        if (!this.isStringLiteral(strOperand)) {
          this.failAssembly(`Missing terminating quote`, 1);
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
      default: {
        let msg = 'Invalid operation';
        if (this.verboseModeOn) {
          const suggestion = suggestClosest(mnemonic, this._getValidDirectives());
          if (suggestion) msg += `. Did you mean '${suggestion}'?`;
        }
        this.failAssembly(msg, 1, null, 'INVALID_OPERATION');
        break;
      }
    }
  }

  handleInstruction(mnemonic, operands) {
    if (this.pass === 1) {
      this.locCtr += 1;
      return;
    }

    const desc = this._instructionTable[mnemonic.toLowerCase()];
    if (!desc) {
      let msg = 'Invalid operation';
      if (this.verboseModeOn) {
        const suggestion = suggestClosest(mnemonic, Object.keys(this._instructionTable));
        if (suggestion) msg += `. Did you mean '${suggestion}'?`;
      }
      this.error(msg, null, 'INVALID_OPERATION');
      return;
    }
    const machineWord = desc.encoder(operands);
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
      this.failAssembly('Missing operand', 1);
    };
    let sr2orImm5 = operands[1];
    if (sr2orImm5 === null) return null;
    let macword = OP_CMP;

    if(!this.isRegister(sr2orImm5)) {
      // compare with immediate
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, "imm5", 'IMM5_RANGE');
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
      this.failAssembly('Missing operand', 1);
    }
    if (this.isNumLiteral(operands[0])) {
      this.failAssembly('Bad label', 1, null, 'BAD_LABEL');
    }
    if(!this.isNumLiteral(operands[0]) && operands[1] && operands[2]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[2])) {
        this.failAssembly('Bad number', 1);
      }

      label = operands[0] + operands[1] + operands[2];
    }

    if((operands[1] && this.isOperator(operands[1])) && 
    (operands[2] === null || operands[2] === undefined)) {      
      this.failAssembly('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e');
    if (address === null) {
      // Dead in single-error mode: evaluateOperand already throws 'Undefined label'
      // before returning null. Kept as guard for any future multi-error-mode path.
      this.failAssembly('Undefined label', 1, null, 'UNDEFINED_LABEL');
    };
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range', null, 'PCOFFSET9_RANGE'); // for branch instruction
      return null;
    }
    macword |= (pcoffset9 & 0x01FF);
    return macword;
  }

  assembleADD(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let sr2orImm5 = operands[2];
    if (sr2orImm5 === null || sr2orImm5 === undefined) {
      this.failAssembly('Missing operand', 1);
    }
    let macword = OP_ADD | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, "imm5", 'IMM5_RANGE');
      if (imm5 === null) {
        this.failAssembly('Bad number', 1);
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
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    }
    let sr2orImm5 = operands[2];
    let macword = OP_SUB | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, 'imm5', 'IMM5_RANGE');
      if (imm5 === null) {
        this.failAssembly('Bad number', 1);
      };
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assemblePUSH(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let macword = OP_EXT | (sr << 9) | EOP_PUSH;
    return macword;
  }

  assemblePOP(operands) {
    let dr = this.getRegister(operands[0]);
    if (dr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let macword = OP_EXT | (dr << 9) | EOP_POP;
    return macword;
  }

  assembleDIV(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let macword = OP_EXT | EOP_DIV | (dr << 9) | (sr1 << 6);
    return macword;
  }

  assembleROL(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = OP_EXT | (sr << 9) | ((ct & 0xF) << 5) | EOP_ROL;
    return macword;
  }

  assembleMUL(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_MUL;
    return macword;
  }

  assembleREM(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    }
    let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_REM;
    return macword;
  }

  assembleOR(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    }
    let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_OR;
    return macword;
  }

  assembleXOR(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    }
    let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_XOR;
    return macword;
  }

  assembleSEXT(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_SEXT;
    return macword;
  }

  assembleROR(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = OP_EXT | (sr << 9) | ((ct & 0xF) << 5) | EOP_ROR;
    return macword;
  }

  assembleSRL(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = OP_EXT | (sr << 9) | ((ct & 0xF) << 5) | EOP_SRL;
    return macword;
  }

  assembleSRA(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = OP_EXT | (sr << 9) | ((ct & 0xF) << 5) | EOP_SRA;
    return macword;
  }

  assembleSLL(operands) {
    let sr = this.getRegister(operands[0]);
    if (sr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let ct = null;
    if (operands[1]) ct = this.evaluateImmediateNaive(operands[1]);
    if (ct === null) ct = 1;
    let macword = OP_EXT | (sr << 9) | ((ct & 0xF) << 5) | EOP_SLL;
    return macword;
  }

  assembleAND(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing operand', 1);
    };
    let sr2orImm5 = operands[2];
    let macword = OP_AND | (dr << 9) | (sr1 << 6);
    if (this.isRegister(sr2orImm5)) {
      let sr2 = this.getRegister(sr2orImm5);
      macword |= sr2;
    } else {
      let imm5 = this.evaluateImmediate(sr2orImm5, -16, 15, 'imm5', 'IMM5_RANGE');
      if (imm5 === null || imm5 === undefined) {
        this.failAssembly('Bad number', 1);
      };
      macword |= 0x0020 | (imm5 & 0x1F);
    }
    return macword;
  }

  assembleLD(operands) {
    let dr = this.getRegister(operands[0]);

    if (dr === null) {
      this.failAssembly('Missing operand', 1);
    };

    let label = operands[1];

    if (label === null || label === undefined) {
      this.failAssembly('Missing operand', 1);
    }
    if(!this.isNumLiteral(operands[1]) && operands[2] && operands[3]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[3])) {
        this.failAssembly('Bad number', 1);
      }

      label = operands[1] + operands[2] + operands[3];
    }

    if((operands[2] && this.isOperator(operands[2])) && 
    (operands[3] === null || operands[3] === undefined)) {      
      this.failAssembly('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e'); // Pass 'e' as usageType
    if (address === null) {
      this.failAssembly('Bad label', 1, null, 'BAD_LABEL');
    };
    
    let isExternal = this.externLabels.has(label);
    let pcoffset9;
  
    if (isExternal) {
      pcoffset9 = 0; // Placeholder offset
      // Do NOT add an 'A' entry here
    } else {
      pcoffset9 = address - this.locCtr - 1;
      if (pcoffset9 < -256 || pcoffset9 > 255) {
        this.error('pcoffset9 out of range for ld', null, 'PCOFFSET9_RANGE');
        return null;
      }
    }
    let macword = OP_LD | (dr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }  

  assembleST(operands) {
    let sr = this.getRegister(operands[0]);

    if (sr === null) {
      this.failAssembly('Missing operand', 1);
    };

    let label = operands[1];
    
    if (label === null || label === undefined) {
      this.failAssembly('Missing operand', 1);
    }
    if(!this.isNumLiteral(operands[1]) && operands[2] && operands[3]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[3])) {
        this.failAssembly('Bad number', 1);
      }

      label = operands[1] + operands[2] + operands[3];
    }

    if((operands[2] && this.isOperator(operands[2])) && 
    (operands[3] === null || operands[3] === undefined)) {      
      this.failAssembly('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e'); // Pass 'e' as usageType
    if (address === null) {
      this.failAssembly('Bad label', 1, null, 'BAD_LABEL');
    };
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.error('pcoffset9 out of range for st', null, 'PCOFFSET9_RANGE');
      return null;
    }
    let macword = OP_ST | (sr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleLea(operands) {
    let dr = this.getRegister(operands[0]);

    if (dr === null) {
      this.failAssembly('Missing operand', 1);
    };

    let label = operands[1];

    if(label === null || label === undefined) {
      this.failAssembly('Missing operand', 1);
    }

    if(!this.isNumLiteral(operands[1]) && operands[2] && operands[3]) {

      // if operands[2] is not a literal value, then it isn't a valid offset
      if(!this.isNumLiteral(operands[3])) {
        this.failAssembly('Bad number', 1);
      }

      label = operands[1] + operands[2] + operands[3];
    }

    if((operands[2] && this.isOperator(operands[2])) && 
    (operands[3] === null || operands[3] === undefined)) {      
      this.failAssembly('Missing number', 1);
    }

    let address = this.evaluateOperand(label, 'e');
    if (address === null) {
      this.failAssembly('Bad label', 1, null, 'BAD_LABEL');
    };
    let pcoffset9 = address - this.locCtr - 1;
    if (pcoffset9 < -256 || pcoffset9 > 255) {
      this.failAssembly('pcoffset9 out of range', 1, null, 'PCOFFSET9_RANGE');
    }
    let macword = OP_LEA | (dr << 9) | (pcoffset9 & 0x1FF);
    return macword;
  }

  assembleBL(operands) {
    let label = operands[0];

    if(!this.isValidLabel(label)) {
      this.failAssembly('Bad label', 1, null, 'BAD_LABEL'); // : ${label}
    }

    let address = this.evaluateOperand(label, 'E'); // Pass 'E' as usageType
    if (address === null) {
      this.failAssembly('Bad label', 1, null, 'BAD_LABEL');
    }
    
    let isExternal = this.externLabels.has(label);
    let pcoffset11;
  
    if (isExternal) {
      pcoffset11 = 0; // Placeholder offset
      // Do NOT add an 'A' entry here
    } else {
      pcoffset11 = address - this.locCtr - 1;
      if (pcoffset11 < -1024 || pcoffset11 > 1023) {
        this.error('pcoffset11 out of range', null, 'PCOFFSET11_RANGE');
        return null;
      }
    }
    let macword = 0x4800 | (pcoffset11 & 0x07FF);
    return macword;
  }  

  assembleBLR(operands) {
    let baser = this.getRegister(operands[0]);
    if (baser === null) {
      this.failAssembly('Missing operand', 1);
    };
    let offset6 = 0;
    if (operands[1]) {
      offset6 = this.evaluateImmediate(operands[1], -32, 31, "offset6");
    }
    let macword = OP_BL | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleLDR(operands) {
    let dr = this.getRegister(operands[0]);
    let baser = this.getRegister(operands[1]);
    if (dr === null || baser === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let offset6 = this.evaluateImmediate(operands[2], -32, 31, 'offset6');
    if (offset6 === null) return null;
    let macword = OP_LDR | (dr << 9) | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleSTR(operands) {
    let sr = this.getRegister(operands[0]);
    let baser = this.getRegister(operands[1]);
    if (sr === null || baser === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let offset6 = this.evaluateImmediate(operands[2], -32, 31, 'offset6');
    if (offset6 === null) return null;
    let macword = OP_STR | (sr << 9) | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleJMP(operands) {
    let baser = this.getRegister(operands[0]);
    if (baser === null) {
      // Oracle (cuh63 6.3) says "Missing operand" for 'jmp' with no register.
      // Earlier notes said oracle segfaults here; oracle testing confirms it prints
      // "Missing operand". Our behavior now matches.
      this.failAssembly('Missing operand', 1);
    };
    let offset6 = 0;
    if (operands[1]) {
      offset6 = this.evaluateImmediate(operands[1], -32, 31, "offset6");
    }
    let macword = OP_JMP | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleRET(operands) {
    let baser = 7; // LR register
    let offset6 = 0;
    if (operands[0]) {
      offset6 = this.evaluateImmediate(operands[0], -32, 31, "offset6");
    }
    let macword = OP_JMP | (baser << 6) | (offset6 & 0x3F);
    return macword;
  }

  assembleNOT(operands) {
    let dr = this.getRegister(operands[0]);
    let sr1 = this.getRegister(operands[1]);
    if (dr === null || sr1 === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };
    let macword = OP_NOT | (dr << 9) | (sr1 << 6);
    return macword;
  }

  assembleMOV(mnemonic, operands) {
    let dr = this.getRegister(operands[0]);
    if (dr === null) {
      this.failAssembly('Missing register', 1, null, 'REGISTER');
    };

    if (mnemonic === 'mov') {
      // Determine if operands[1] is a register or immediate
      if (this.isRegister(operands[1])) {
        // Translate to 'mvr dr, sr'
        let sr = this.getRegister(operands[1]);
        // mvr: opcode 0xA000, eopcode 12
        let macword = OP_EXT | (dr << 9) | (sr << 6) | EOP_MVR;
        return macword;
      } else {
        // Translate to 'mvi dr, imm9' — same range (-256..255) and machine code as mvi.
        // Charlie confirmed: mov dr, imm9 is a pseudo-instruction for mvi dr, imm9.
        // The oracle's rejection of negatives is a known oracle bug (OB-001).
        let imm9 = this.evaluateImmediate(operands[1], -256, 255, "mov immediate value", 'IMM9_RANGE');
        if (imm9 === null) {
          this.failAssembly('Missing number', 1);
        };
        // mvi: opcode 0xD000
        let macword = OP_MVI | (dr << 9) | (imm9 & 0x1FF);
        return macword;
      }
    } else if (mnemonic === 'mvi') {

      // mvi dr, imm9
      let imm9 =  this.evaluateImmediate(operands[1], -256, 255, "mvi immediate", 'IMM9_RANGE'); // this.evaluateImmediate(operands[1], -256, 255);
      if (imm9 === null) {
        this.failAssembly('Missing number', 1);
      };
      let macword = OP_MVI | (dr << 9) | (imm9 & 0x1FF);
      return macword;
    } else if (mnemonic === 'mvr') {
      // mvr dr, sr1
      let sr1 = this.getRegister(operands[1]);
      if (sr1 === null) {
        this.failAssembly('Missing register', 1, null, 'REGISTER');
      };
      // Ensure eopcode 12 is set
      let macword = OP_EXT | (dr << 9) | (sr1 << 6) | EOP_MVR;
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
        this.failAssembly('Bad register', 1, null, 'REGISTER');
      };
    } 
    let macword = OP_TRAP | (sr << 9) | (trapVector & 0xFF);
    return macword;
  }


  getRegister(regStr) {

    if(regStr === null || regStr === undefined) {
      return null;
    }

    if (!this.isRegister(regStr)) {
      let msg = 'Bad register';
      if (this.verboseModeOn) {
        const suggestion = suggestClosest(regStr, ['r0','r1','r2','r3','r4','r5','r6','r7','fp','sp','lr']);
        if (suggestion) msg += `. Did you mean '${suggestion}'?`;
      }
      this.failAssembly(msg, 1,
        { found: this.determineOperandType(regStr), expected: 'register' }, 'REGISTER');
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

  handleExternalReference(label, usageType) {
    // Records an external label reference for the linker to resolve.
    // Callers guard with `externLabels.has(label)` before calling here, so
    // `label` is always a declared .extern symbol at this point.
    //
    // Undefined-label detection for non-extern operands is handled in
    // evaluateOperand (throws 'Undefined label').
    // Undefined external symbols (used but never defined in any linked module)
    // is a linker-level concern, not detectable here.
    if (!this.externalReferences.some(ref => ref.label === label && ref.type === usageType)) {
      this.externalReferences.push({
        label: label,
        type: usageType,
        address: this.locCtr // Store the current location counter
      });
    }
  }

  /**
   * Classifies the raw syntactic type of an operand token WITHOUT evaluating it.
   * This is the foundation for per-mnemonic type-validation schemas.
   *
   * Returned types:
   *   'char'  – character literal, e.g. 'a' or '\n'
   *   'num'   – numeric literal (decimal or hex), e.g. 42 or 0x2a or -3
   *   'star'  – current-PC marker, * or *+N / *-N
   *   'label' – symbolic label reference, possibly with offset (e.g. foo, foo+3)
   *
   * Future: callers may pass an `allowedTypes` array (e.g. ['num', 'char', 'label'])
   * built from a per-mnemonic schema; evaluateOperand would call this method and
   * throw a typed error on mismatch. This requires oracle research to determine
   * which operand type mismatches the LCC rejects. See core-behavior-matrix.md
   * → "Operand type checking" for the current Research status.
   *
   * @param {string} operand - The raw operand token (not yet evaluated).
   * @returns {'char' | 'num' | 'star' | 'label'}
   */
  determineOperandType(operand) {
    if (this.isCharLiteral(operand)) return 'char';
    if (operand.length > 0 && operand[0] === '*') return 'star';
    const n = this.parseNumber(operand);
    if (n !== null && !isNaN(n)) return 'num';
    return 'label';
  }

  /**
   * Evaluates an operand and returns its corresponding value.
   * The operand can be a pure number, a label with an optional offset, or a plain label.
   * Additionally, the operand can be a location marker indicated with the '*' character.
   *
   * Currently accepts any syntactic form (num, char, label, star) for any mnemonic.
   * Use determineOperandType() before calling here to inspect the raw form when
   * per-mnemonic type schemas are eventually enforced.
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
        let msg = 'Undefined label';
        if (this.verboseModeOn && this.pass === 2) {
          const suggestion = suggestClosest(label, Object.keys(this.symbolTable));
          if (suggestion) msg += `. Did you mean '${suggestion}'?`;
        }
        this.error(msg, null, 'UNDEFINED_LABEL');
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
            this.failAssembly(`Bad number`, 1);
          } else if (!this.isValidLabel(operand)) {
            this.failAssembly(`Bad label`, 1);
          } else {
            this.failAssembly(`Unspecified label error for: ${operand}`, 1); // this.error(`Undefined label: ${operand}`);
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

  evaluateImmediate(valueStr, min, max, type='', explainKey=null) {
    let value = this.parseNumber(valueStr);

    if (isNaN(value)) {
      this.failAssembly(`Bad number`, 1,
        { found: this.determineOperandType(valueStr), expected: 'num' });
    }

    if (value < min || value > max) {
      // this.error(`Immediate value out of range: ${valueStr}`);
      this.error(`${type} out of range`, null, explainKey);
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
      this.failAssembly('Bad number', 1,
        { found: this.determineOperandType(valueStr), expected: 'num' });
    }
    return value & 0xFFFF;
  }

  failAssembly(message, code = 1, verboseContext = null, explainKey = null) {
    this.error(message, verboseContext, explainKey);

    if (REPORT_MULTI_ERRORS) {
      this.abortAssembly(message, code);
    }
  }

  // `explainKey` (optional) selects a --explain catalog entry appended after the
  // diagnostic when explain mode is on. It is added last, so it composes with —
  // and never replaces — a verbose suggestClosest "Did you mean?" suffix already
  // baked into `message`. When explain mode is off (or the key is null) the
  // returned string is byte-for-byte the pre-#1096 format.
  formatAssemblerError(message, verboseContext = null, explainKey = null) {
    const explainBlock = this.explainModeOn ? formatExplanation(explainKey) : null;
    const explainClause = explainBlock ? `\n${explainBlock}` : '';
    if (this.verboseModeOn) {
      const typeClause = verboseContext
        ? `\nfound: ${verboseContext.found}, expected: ${verboseContext.expected}`
        : '';
      return `[assembler] Error on line ${this.lineNum} of ${this.inputFileName}:\n    ${this.currentLine}\n${message}${typeClause}${explainClause}`;
    }
    return `Error on line ${this.lineNum} of ${this.inputFileName}:\n${this.currentLine}\n${message}${explainClause}`;
  }

  error(message, verboseContext = null, explainKey = null) {
    const errorMsg = this.formatAssemblerError(message, verboseContext, explainKey);
    console.error(errorMsg);
    this.errors.push(errorMsg);
    this.errorFlag = true;

    // If we're not reporting multiple errors, exit immediately
    // Note: This matches the behavior in the original LCC of reporting only 1 error at a time
    if(!REPORT_MULTI_ERRORS) {
      this.abortAssembly(message, 1);
    }
  }
}

module.exports = Assembler;

// Instantiate and run the assembler if this script is run directly
if (require.main === module) {
  const assembler = new Assembler();
  assembler.main();
}
