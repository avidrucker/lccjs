#!/usr/bin/env node

// interpreter.js

const fs = require('fs');
const path = require('path');
const { buildReportArtifacts } = require('../utils/reportArtifacts');
const { InvalidExecutableFormatError, InterpreterRuntimeError, InputPauseSignal } = require('../utils/errors');
const {
  constructSiblingFileName,
  readBinaryInput,
  writeReportFiles,
} = require('../utils/fileArtifacts');
const { h4 } = require('./debug/format');
const { diffRegisters } = require('./debug/stateDelta');
const {
  EOP_PUSH, EOP_POP, EOP_SRL, EOP_SRA, EOP_SLL, EOP_ROL, EOP_ROR,
  EOP_MUL, EOP_DIV, EOP_REM, EOP_OR, EOP_XOR, EOP_MVR, EOP_SEXT,
} = require('./constants');

const newline = (typeof process !== 'undefined' && process.platform === 'win32') ? '\r\n' : '\n';

const MAX_MEMORY = 65536; // 2^16

// Oracle LCC treats field selectors 0..15 for `sext` as named field modes,
// not as raw bit-width values. Selectors larger than 0x0f still behave like
// raw masks (for example 0x001f sign-extends a 5-bit field).
const SEXT_PARITY_TABLE = [
  [0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000, 0x0000],
  [0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff, 0x0000, 0xffff],
  [0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff, 0x0000, 0xfffd, 0x0002, 0xffff],
  [0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfffe, 0xffff],
  [0x0000, 0x0000, 0xfffb, 0xfffb, 0x0004, 0x0004, 0xffff, 0xffff, 0x0000, 0x0000, 0xfffb, 0xfffb, 0x0004, 0x0004, 0xffff, 0xffff, 0x0000, 0x0000, 0xfffb, 0xfffb, 0x0004, 0x0004, 0xffff, 0xffff, 0x0000, 0x0000, 0xfffb, 0xfffb, 0x0004, 0x0004, 0xffff, 0xffff],
  [0x0000, 0xfffb, 0xfffa, 0xfffb, 0x0004, 0xffff, 0xfffe, 0xffff, 0x0000, 0xfffb, 0xfffa, 0xfffb, 0x0004, 0xffff, 0xfffe, 0xffff, 0x0000, 0xfffb, 0xfffa, 0xfffb, 0x0004, 0xffff, 0xfffe, 0xffff, 0x0000, 0xfffb, 0xfffa, 0xfffb, 0x0004, 0xffff, 0xfffe, 0xffff],
  [0x0000, 0xfff9, 0xfffb, 0xfffb, 0x0004, 0xfffd, 0xffff, 0xffff, 0x0000, 0xfff9, 0xfffb, 0xfffb, 0x0004, 0xfffd, 0xffff, 0xffff, 0x0000, 0xfff9, 0xfffb, 0xfffb, 0x0004, 0xfffd, 0xffff, 0xffff, 0x0000, 0xfff9, 0xfffb, 0xfffb, 0x0004, 0xfffd, 0xffff, 0xffff],
  [0x0000, 0x0001, 0x0002, 0x0003, 0xfffc, 0xfffd, 0xfffe, 0xffff, 0x0000, 0x0001, 0x0002, 0x0003, 0xfffc, 0xfffd, 0xfffe, 0xffff, 0x0000, 0x0001, 0x0002, 0x0003, 0xfffc, 0xfffd, 0xfffe, 0xffff, 0x0000, 0x0001, 0x0002, 0x0003, 0xfffc, 0xfffd, 0xfffe, 0xffff],
  [0x0000, 0x0000, 0x0000, 0x0000, 0xfff7, 0xfff7, 0xfff7, 0xfff7, 0x0008, 0x0008, 0x0008, 0x0008, 0xffff, 0xffff, 0xffff, 0xffff, 0x0000, 0x0000, 0x0000, 0x0000, 0xfff7, 0xfff7, 0xfff7, 0xfff7, 0x0008, 0x0008, 0x0008, 0x0008, 0xffff, 0xffff, 0xffff, 0xffff],
  [0x0000, 0xfff7, 0x0000, 0xfff7, 0xfff6, 0xfff7, 0xfff6, 0xfff7, 0x0008, 0xffff, 0x0008, 0xffff, 0xfffe, 0xffff, 0xfffe, 0xffff, 0x0000, 0xfff7, 0x0000, 0xfff7, 0xfff6, 0xfff7, 0xfff6, 0xfff7, 0x0008, 0xffff, 0x0008, 0xffff, 0xfffe, 0xffff, 0xfffe, 0xffff],
  [0x0000, 0xfff5, 0x0002, 0xfff7, 0xfff5, 0xfff5, 0xfff7, 0xfff7, 0x0008, 0xfffd, 0x000a, 0xffff, 0xfffd, 0xfffd, 0xffff, 0xffff, 0x0000, 0xfff5, 0x0002, 0xfff7, 0xfff5, 0xfff5, 0xfff7, 0xfff7, 0x0008, 0xfffd, 0x000a, 0xffff, 0xfffd, 0xfffd, 0xffff, 0xffff],
  [0x0000, 0x0001, 0xfff6, 0xfff7, 0xfff4, 0xfff5, 0xfff6, 0xfff7, 0x0008, 0x0009, 0xfffe, 0xffff, 0xfffc, 0xfffd, 0xfffe, 0xffff, 0x0000, 0x0001, 0xfff6, 0xfff7, 0xfff4, 0xfff5, 0xfff6, 0xfff7, 0x0008, 0x0009, 0xfffe, 0xffff, 0xfffc, 0xfffd, 0xfffe, 0xffff],
  [0x0000, 0x0000, 0xfff3, 0xfff3, 0xfff7, 0xfff7, 0xfff7, 0xfff7, 0x0008, 0x0008, 0xfffb, 0xfffb, 0xffff, 0xffff, 0xffff, 0xffff, 0x0000, 0x0000, 0xfff3, 0xfff3, 0xfff7, 0xfff7, 0xfff7, 0xfff7, 0x0008, 0x0008, 0xfffb, 0xfffb, 0xffff, 0xffff, 0xffff, 0xffff],
  [0x0000, 0xfff3, 0xfff2, 0xfff3, 0xfff6, 0xfff7, 0xfff6, 0xfff7, 0x0008, 0xfffb, 0xfffa, 0xfffb, 0xfffe, 0xffff, 0xfffe, 0xffff, 0x0000, 0xfff3, 0xfff2, 0xfff3, 0xfff6, 0xfff7, 0xfff6, 0xfff7, 0x0008, 0xfffb, 0xfffa, 0xfffb, 0xfffe, 0xffff, 0xfffe, 0xffff],
  [0x0000, 0xfff1, 0xfff3, 0xfff3, 0xfff5, 0xfff5, 0xfff7, 0xfff7, 0x0008, 0xfff9, 0xfffb, 0xfffb, 0xfffd, 0xfffd, 0xffff, 0xffff, 0x0000, 0xfff1, 0xfff3, 0xfff3, 0xfff5, 0xfff5, 0xfff7, 0xfff7, 0x0008, 0xfff9, 0xfffb, 0xfffb, 0xfffd, 0xfffd, 0xffff, 0xffff],
  [0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0xfff8, 0xfff9, 0xfffa, 0xfffb, 0xfffc, 0xfffd, 0xfffe, 0xffff, 0x0000, 0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0007, 0xfff8, 0xfff9, 0xfffa, 0xfffb, 0xfffc, 0xfffd, 0xfffe, 0xffff],
];

const { isTestMode, fatalExit, cliErrorExit } = require('../utils/cliExit');

class Interpreter {
  // NOTE: grouping these ~50 flat fields into cohesive sub-objects (cpu/io/diag/opts/acct) was
  // scoped as #255 but closed as over-scoped (~225m, cross-cutting — see the #388 contract at
  // docs/research/interpreter-state-grouping-contract.md). Re-strategy is tracked by #1352.
  constructor(options = {}) {
    /**
     * Memory (16-bit unsigned integers)
     */
    this.mem = new Uint16Array(65536);

    /**
     * Registers r0 to r7 (16-bit signed integers)
     */
    this.r = new Uint16Array(8);

    /**
     * Program Counter
     */
    this.pc = 0;

    /**
     * Instruction Register
     */
    this.ir = 0;

    /**
     * Negative flag
     */
    this.n = 0;

    /**
     * Zero flag
     */
    this.z = 0;

    /**
     * Carry flag
     */
    this.c = 0;

    /**
     * Overflow flag
     */
    this.v = 0;

    /**
     * Whether the interpreter is currently running
     */
    this.running = true;

    /**
     * Output string
     */
    this.output = '';

    /**
     * Output callback — routes user-visible program output.
     * Browser consumers pass {write: m => (domBuffer += m)} to capture output
     * without monkey-patching process.stdout.
     */
    this._write = options.write ?? (m => (typeof process !== 'undefined' && process.stdout) ? process.stdout.write(m) : undefined);

    /**
     * Echo simulated (inputBuffer) input back to stdout, mirroring a terminal
     * session where typed characters appear on screen (2024 behavior, relied on
     * by the oracle/e2e corpus). Default ON. The test-runner (#1328) sets this
     * false so a non-TTY autograder run captures only the program's own output,
     * not its echoed input. Real-stdin reads (fs.readSync) never echo regardless.
     */
    this.echoInput = options.echoInput !== false;

    /**
     * Input buffer for SIN (if needed)
     */
    this.inputBuffer = '';

    /**
     * When true, readLineFromStdin/readCharFromStdin throw InputPauseSignal
     * instead of blocking on fs.readSync when inputBuffer is exhausted.
     */
    this._pauseOnInput = false;

    /**
     * Options from lcc.js
     */
    this.options = {};

    /**
     * For program statistics
     */
    this.instructionsExecuted = 0;

    /**
     * For program statistics
     */
    this.maxStackSize = 0;

    /**
     * Default load point is 0
     */
    this.loadPoint = 0;

    /**
     * For tracking stack size
     */
    this.spInitial = 0;

    /**
     * Keep track of the highest memory address used
     */
    this.memMax = 0;

    /**
     * Name of the input file
     */
    this.inputFileName = '';

    /**
     * Whether to generate .lst and .bst files
     */
    this.generateStats = false;

    /**
     * Header entries extracted from the executable
     */
    this.headerLines = [];

    /**
     * Debug mode flag
     */
    this.debugMode = false;

    /**
     * Flag to track jump/branch instruction executions
     */
    this.hasJumped = false;

    /**
     * Whether infinite-loop detection is allowed to enter symbolic debugger mode
     */
    this.allowRuntimeDebugging = false;

    /**
     * When true, the unified step-cap check in run() is skipped entirely.
     * Useful for long-running .ap programs where the cap would produce a
     * spurious "Possible infinite loop" error.
     */
    this.disableInfiniteLoopDetection = false;

    /**
     * When true, emit a trace line (address + source text) before each
     * instruction and a diff line (changed registers/flags/pc) after it.
     * Controlled by the -t CLI flag.  Parallel to debugMode but non-interactive.
     */
    this.traceMode = false;

    /**
     * When true, runtime errors include PC, opcode, and register state.
     * Set via the -v/--verbose CLI flag.
     */
    this.verboseModeOn = false;

    /**
     * PC-to-source-line map produced by the assembler after pass 2.
     * Shape: { addressToLine: Map<addr, {lineNumber, sourceLine}>, allLines: string[] }
     * Only populated by lcc.js when -t is used and an assembler ran first.
     */
    this.sourceMap = null;

    /**
     * Active breakpoint address (null = no breakpoint).
     * Set by the 'b {addr}' debugger command; cleared on hit or 'b' (no arg).
     */
    this.debugBreakpoint = null;
  }

  // Reset all per-run execution state so the interpreter core can be reused
  // without depending on filesystem-backed entrypoints.
  resetExecutionState() {
    this.mem = new Uint16Array(65536); // Memory (16-bit unsigned integers)
    this.r = new Uint16Array(8);       // Registers r0 to r7 (16-bit signed integers)
    this.pc = 0;                       // Program Counter
    this.ir = 0;                       // Instruction Register
    this.n = 0;                        // Negative flag
    this.z = 0;                        // Zero flag
    this.c = 0;                        // Carry flag
    this.v = 0;                        // Overflow flag
    this.running = true;
    this.output = '';                  // Output string
    this.maxStepsReached = false;      // Set true when maxSteps cap is hit
    this.instructionsExecuted = 0;     // For program statistics
    this.maxStackSize = 0;             // For program statistics
    this.spInitial = 0;                // For tracking stack size
    this.memMax = 0;                   // Keep track of the highest memory address used
    this.headerLines = [];
    this.hasJumped = false;            // Flag to track jump/branch instruction executions
    this.initialMem = null;
    this.allowRuntimeDebugging = false;
  }

  // Capture the current in-memory execution state in a structured result so
  // callers can inspect runtime behavior without depending on mutable instance fields.
  createExecutionResult({ buildReports = false, userName, inputFileName = this.inputFileName, now } = {}) {
    let reports = { lst: null, bst: null };

    if (buildReports) {
      if (!userName) {
        throw new InterpreterRuntimeError('userName is required when buildReports is true');
      }

      const { lstContent, bstContent } = this.buildReportArtifacts(userName, inputFileName, now);
      reports = {
        lst: lstContent,
        bst: bstContent,
      };
    }

    return {
      inputFileName,
      output: this.output,
      maxStepsReached: this.maxStepsReached,
      mem: this.mem.slice(),
      registers: this.r.slice(),
      pc: this.pc,
      instructionsExecuted: this.instructionsExecuted,
      maxStackSize: this.maxStackSize,
      loadPoint: this.loadPoint,
      memMax: this.memMax,
      headerLines: [...this.headerLines],
      reports,
    };
  }

  // Only a real CLI run should ever enter the interactive symbolic debugger.
  // Pure API callers and in-process tests must fail/continue without blocking.
  canEnterInteractiveDebugger() {
    return this.allowRuntimeDebugging && process.stdin.isTTY && !isTestMode;
  }

  // Execute an in-memory executable buffer without requiring sibling files on disk.
  executeBuffer(buffer, options = {}) {
    const {
      inputFileName = this.inputFileName,
      loadPoint = this.loadPoint,
      allowDebugOnInfiniteLoop = false,
      inputBuffer = this.inputBuffer,
      runtimeOptions = this.options,
      buildReports = false,
      userName,
      now,
      pauseOnInput = false,
      maxSteps = 0,
    } = options;

    this.inputFileName = inputFileName;
    this.loadPoint = loadPoint;
    this.inputBuffer = inputBuffer;
    this.options = runtimeOptions;
    this._pauseOnInput = pauseOnInput;
    this._resumeArgs = { buildReports, userName, now };
    this.maxSteps = maxSteps;

    this.resetExecutionState();
    this.allowRuntimeDebugging = allowDebugOnInfiniteLoop;

    // Check file signature
    if (buffer[0] !== 'o'.charCodeAt(0)) {
      throw new InvalidExecutableFormatError(`${this.inputFileName} is not in lcc format`, { explainKey: 'NOT_LCC_FORMAT' });
    }

    // Load the executable into memory
    this.loadExecutableBuffer(buffer);

    // Capture the initial memory state
    this.initialMem = this.mem.slice(); // Makes a copy of the memory array

    // Run the interpreter
    try {
      try {
        this.run();
        // Post-run displays (oracle parity: -m and -r flags)
        if (runtimeOptions.memDisplay) {
          this.writeOutput('\n---------------------------------------------- Memory display\n');
          for (let addr = this.loadPoint; addr <= this.memMax; addr++) {
            const word = this.mem[addr];
            this.writeOutput(`${addr.toString(16).padStart(4, '0')}: ${word.toString(16).padStart(4, '0')}\n`);
          }
          this.writeOutput('--------------------------------------- End of memory display\n');
        }
        if (runtimeOptions.regDisplay) {
          const nzcv = `${this.n}${this.z}${this.c}${this.v}`;
          this.writeOutput('\n-------------------------------------------- Register display\n');
          this.writeOutput(`pc = ${h4(this.pc)}  ir = ${h4(this.ir)}  NZCV = ${nzcv}\n`);
          this.writeOutput(`r0 = ${h4(this.r[0])}  r1 = ${h4(this.r[1])}  r2 = ${h4(this.r[2])}  r3 = ${h4(this.r[3])}  \n`);
          this.writeOutput(`r4 = ${h4(this.r[4])}  fp = ${h4(this.r[5])}  sp = ${h4(this.r[6])}  lr = ${h4(this.r[7])}  \n`);
          this.writeOutput('------------------------------------- End of register display\n');
        }
      } finally {
        this.allowRuntimeDebugging = false;
      }
    } catch (e) {
      if (e instanceof InputPauseSignal) {
        return { status: 'waiting-for-input', trapType: e.trapType };
      }
      throw e;
    }

    return this.createExecutionResult({
      buildReports,
      userName,
      inputFileName: this.inputFileName,
      now,
    });
  }

  // Resume execution after a pauseOnInput suspension.
  // Appends moreInput to inputBuffer and continues the run loop from
  // the current PC (the TRAP instruction that caused the pause).
  resume(moreInput = '') {
    if (moreInput) {
      this.inputBuffer = (this.inputBuffer || '') + moreInput;
    }
    const { buildReports, userName, now } = this._resumeArgs || {};
    try {
      try {
        this.run();
      } finally {
        this.allowRuntimeDebugging = false;
      }
    } catch (e) {
      if (e instanceof InputPauseSignal) {
        return { status: 'waiting-for-input', trapType: e.trapType };
      }
      throw e;
    }
    return this.createExecutionResult({ buildReports, userName, now });
  }

  // Build the listing/statistics file contents without writing them to disk.
  // This lets tests and higher-level wrappers verify output in memory.
  buildReportArtifacts(userName, inputFileName = this.inputFileName, now) {
    return buildReportArtifacts({
      interpreter: this,
      userName,
      inputFileName,
      now,
    });
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length < 1) {
      cliErrorExit('Usage: node interpreter.js <input filename> [options]', 1);
    }

    // Parse arguments
    let i = 0;
    while (i < args.length) {
      let arg = args[i];
      if (arg.startsWith('-')) {
        // Option

        if (arg === '-nostats') {
          this.generateStats = false;
        } else if (arg === '-d') {
          this.debugMode = true;
        } else if (arg.startsWith('-L')) {
          // Load point option
          let loadPointStr = arg.substring(2);
          if (loadPointStr === '') {
            // Load point value is in the next argument
            i++;
            if (i >= args.length) {
              cliErrorExit('Error: -L option requires a value', 1);
            }
            loadPointStr = args[i];
          }
          // Parse load point value (hexadecimal)
          this.loadPoint = parseInt(loadPointStr, 16);
          if (isNaN(this.loadPoint)) {
            cliErrorExit(`Invalid load point value: ${loadPointStr}`, 1);
          }
        } else if (arg === '--max-steps') {
          i++;
          if (i >= args.length) {
            cliErrorExit('Error: --max-steps requires a value', 1);
          }
          const n = parseInt(args[i], 10);
          if (isNaN(n)) {
            cliErrorExit(`Invalid --max-steps value: ${args[i]}`, 1);
          }
          this.maxSteps = n;
        } else {
          cliErrorExit(`Bad command line switch: ${arg}`, 1); // `Unknown option: ${arg}`
        }
      } else {
        // Assume it's the input file name
        if (!this.inputFileName) {
          this.inputFileName = arg;
          const extension = path.extname(this.inputFileName).toLowerCase();
          // Note: This is custom behavior in interpreter.js (not the official LCC)
          //       to check specifically for .e files, since the LCC interpreter is
          //       accessed by default when running .e files, or when assembling and
          //       running .a files all at once.
          if (extension !== '.e') {
            cliErrorExit('Unsupported file type for interpreter.js (expected .e)', 1);
          }
        } else {
          cliErrorExit(`Unexpected argument: ${arg}`, 1);
        }
      }
      i++;
    }

    if (!this.inputFileName) {
      cliErrorExit('No input file specified.', 1);
    }

    // this prints out when called by interpreter.js
    console.log(`Starting interpretation of ${this.inputFileName}`);

    // Open and read the executable file
    let buffer;
    try {
      buffer = readBinaryInput(this.inputFileName);
    } catch (err) {
      cliErrorExit(`Cannot open input file ${this.inputFileName}`, 1); // , err: ${err}
    }

    // Check file signature before printing any report filenames so direct CLI behavior
    // stays aligned with the pre-refactor interpreter flow.
    if (buffer[0] !== 'o'.charCodeAt(0)) {
      // `${this.inputFileName} is not a valid LCC executable file: missing 'o' signature`
      cliErrorExit(`${this.inputFileName} is not in lcc format`, 1);
    }

    // Prepare .lst and .bst file names
    const lstFileName = this.constructBSTLSTFileName(this.inputFileName, false);
    const bstFileName = this.constructBSTLSTFileName(this.inputFileName, true);
    console.log(`lst file = ${lstFileName}`);
    console.log(`bst file = ${bstFileName}`);
    console.log('====================================================== Output');

    // Run the interpreter
    try {
      this.executeBuffer(buffer, {
        inputFileName: this.inputFileName,
        loadPoint: this.loadPoint,
        allowDebugOnInfiniteLoop: true,
        maxSteps: this.maxSteps,
      });
      if (this.generateStats) {
        console.log(); // Ensure cursor moves to the next line
      }
    } catch (error) {
      if (error.message === `${this.inputFileName} is not in lcc format`) {
        // `${this.inputFileName} is not a valid LCC executable file: missing 'o' signature`
        cliErrorExit(`${this.inputFileName} is not in lcc format`, 1);
      }
      cliErrorExit(`Runtime Error: ${error.message}`, 1);
    }

    // Generate .lst and .bst files if required
    if (this.generateStats) {
      // userName is pre-resolved by the caller (e.g. lcc.js) and set via this.userName.
      const { lstContent, bstContent } = this.buildReportArtifacts(this.userName, this.inputFileName);

      // Write the .lst and .bst files
      writeReportFiles(this.inputFileName, lstContent, bstContent);
    }
  }

  constructBSTLSTFileName(inputFileName, isBST) {
    return constructSiblingFileName(inputFileName, isBST ? '.bst' : '.lst');
  }

  // for use in lcc.js
  // makes sure that the file is a valid executable file by checking 
  // for the "o" file signature and "C" header termination character
  loadExecutableFile(fileName) {
    let buffer;
    try {
      buffer = readBinaryInput(fileName);
    } catch (err) {
      cliErrorExit(`Cannot open input file ${fileName}`, 1);
    }

    // Check file signature: look for "o" followed by "C" anywhere in the buffer
    let foundO = false;
    let foundC = false;

    for (let offset = 0; offset < buffer.length; offset++) {
      const char = String.fromCharCode(buffer[offset]);

      // Look for the starting "o"
      if (!foundO && char === 'o') {
        foundO = true;
      }
      // Once "o" is found, look for the "C" as the end of the header
      else if (foundO && char === 'C') {
        foundC = true;
        break;
      }
    }

    // If either "o" or "C" was not found in the expected order, throw an error.
    // Carry the NOT_LCC_FORMAT explain key so `--explain` surfaces the "what
    // makes a file runnable" guidance here (the wording is unchanged; #1247/#1245).
    if (!foundO || !foundC) {
      cliErrorExit(`${fileName} is not a valid LCC executable file`, 1, 'NOT_LCC_FORMAT');
    }

    // this prints out when called by lcc.js
    console.log(`Starting interpretation of ${fileName}`);

    // Load the executable into memory
    try {
      this.loadExecutableBuffer(buffer);
    } catch (error) {
      // Forward any explain key the typed error carries (e.g. BAD_EXE_HEADER on a
      // truncated/corrupt header) so `--explain` renders the block here (#1247/#1245).
      cliErrorExit(error.message, 1, error && error.explainKey);
    }

    this.initialMem = this.mem.slice(); // Makes a copy of the memory array
  }

  // extracts header entries and loads machine code into memory
  loadExecutableBuffer(buffer) {
    let offset = 0;

    // Read file signature
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      this.raiseRuntimeError(new InvalidExecutableFormatError('Invalid file signature: missing "o"', { explainKey: 'NOT_LCC_FORMAT' }));
    }

    // Do not store the 'o' signature in headerLines

    let startAddress = 0; // Default start address

    // Read header entries until 'C' is encountered
    while (offset < buffer.length) {
      const entryChar = String.fromCharCode(buffer[offset++]);

      if (entryChar === 'C') {
        // Start of code
        // Do not store 'C' in headerLines
        break;
      } else if (entryChar === 'S') {
        // Start address entry: read two bytes as little endian
        if (offset + 1 >= buffer.length) {
          this.raiseRuntimeError(new InvalidExecutableFormatError('Incomplete start address in header', { explainKey: 'BAD_EXE_HEADER' }));
        }
        startAddress = buffer.readUInt16LE(offset);
        offset += 2;
        this.headerLines.push(`S ${startAddress.toString(16).padStart(4, '0')}`);
      } else if (entryChar === 'G') {
        // Skip 'G' entry: Read address and label
        if (offset + 1 >= buffer.length) {
          this.raiseRuntimeError(new InvalidExecutableFormatError('Incomplete G entry in header', { explainKey: 'BAD_EXE_HEADER' }));
        }
        const address = buffer.readUInt16LE(offset);
        offset += 2;
        let label = '';
        while (offset < buffer.length) {
          const charCode = buffer[offset++];
          if (charCode === 0) break;
          label += String.fromCharCode(charCode);
        }
        this.headerLines.push(`G ${address.toString(16).padStart(4, '0')} ${label}`);
      } else if (entryChar === 'A') {
        // Skip 'A' entry: Read address
        if (offset + 1 >= buffer.length) {
          this.raiseRuntimeError(new InvalidExecutableFormatError('Incomplete A entry in header', { explainKey: 'BAD_EXE_HEADER' }));
        }
        const address = buffer.readUInt16LE(offset);
        offset += 2;
        this.headerLines.push(`A ${address.toString(16).padStart(4, '0')}`);
      } else {
        // Skip unknown entries or handle as needed
        this.raiseRuntimeError(new InvalidExecutableFormatError(`Unknown header entry: '${entryChar}'`, { explainKey: 'BAD_EXE_HEADER' }));
      }
    }

    // Read machine code into memory starting at this.loadPoint
    let memIndex = this.loadPoint; // Start loading at loadPoint
    while (offset + 1 < buffer.length) {
      const instruction = buffer.readUInt16LE(offset);
      offset += 2;
      this.mem[memIndex++] = instruction;
    }

    this.memMax = memIndex - 1; // Last memory address used

    // Set PC to loadPoint + startAddress
    this.pc = (this.loadPoint + startAddress) & 0xFFFF;
  }

  run() {
    this.spInitial = this.r[6];

    const DEFAULT_CAP = 500000;
    let limit;
    if (this.disableInfiniteLoopDetection) {
      limit = 0;
    } else if (this.maxSteps === Infinity || this.maxSteps === -1) {
      limit = 0;
    } else if (this.maxSteps > 0) {
      limit = this.maxSteps;
    } else {
      limit = DEFAULT_CAP;
    }

    let steps = 0;
    while (this.running) {
      if (!this.debugMode && limit > 0 && ++steps > limit) {
        this.maxStepsReached = true;
        if (this.canEnterInteractiveDebugger()) {
          console.error("Possible infinite loop");
          this.debugMode = true;
        } else {
          this.running = false;
          break;
        }
      }
      this.step();
    }
  }

  /**
   * Pure instruction decode: maps a 16-bit instruction word to its field
   * breakdown. Reads only `ir` (and the pure `signExtend` helper) and writes
   * nothing to `this`, so it is deterministic and unit-testable in isolation
   * (e.g. `decode(0x1283)` yields the field set for `add r1, r2, r3`). step()
   * publishes the result onto the instance the execute* handlers read from.
   */
  decode(ir) {
    const reg9 = (ir >> 9) & 0x7;  // dr / sr / code (bits 11-9)
    const reg6 = (ir >> 6) & 0x7;  // sr1 / baser (bits 8-6)
    const pcoffset9 = this.signExtend(ir & 0x1FF, 9); // bits 8-0
    return {
      opcode: (ir >> 12) & 0xF,        // bits 15-12
      code: reg9, dr: reg9, sr: reg9,  // bits 11-9 (three aliases)
      sr1: reg6, baser: reg6,          // bits 8-6 (two aliases)
      sr2: ir & 0x7,                   // bits 2-0
      bit5: (ir >> 5) & 0x1,
      bit11: (ir >> 11) & 0x1,
      imm5: this.signExtend(ir & 0x1F, 5),   // bits 4-0, sign-extended
      pcoffset9,
      imm9: pcoffset9,                 // alias of pcoffset9
      pcoffset11: this.signExtend(ir & 0x7FF, 11), // bits 10-0, sign-extended
      offset6: this.signExtend(ir & 0x3F, 6),      // bits 5-0, sign-extended
      eopcode: ir & 0x1F,              // bits 4-0
      trapvec: ir & 0xFF,              // bits 7-0
    };
  }

  // @todo #252:45m/DEV decomplect: lift traceMode source-emit + the post-execute register/flag diff printer (diffRegisters) out of this execution core into an observer that step() calls (step returns a delta). Blocked by #251. See #246 H1b
  step() {
    // Fetch instruction
    this.ir = this.mem[this.pc++];
    // Decode the instruction word into a plain value (pure — writes nothing to
    // `this`), then publish those fields onto the instance the handlers read.
    Object.assign(this, this.decode(this.ir));

    if (this.traceMode) {
      // Emit "  addr:   source text" before executing the instruction.
      // this.pc already points past the fetched word (pc - 1 = instruction address).
      const addr = this.pc - 1;
      const entry = this.sourceMap && this.sourceMap.addressToLine.get(addr);
      const sourceLine = entry ? entry.sourceLine : '(unknown)';
      process.stdout.write(`${addr.toString(16).padStart(3, ' ')}:   ${sourceLine}\n`);
    }

    // Breakpoint check: if a breakpoint is set and current PC matches, re-enter
    // the interactive debugger (even if debugMode was disabled by 'g').
    if (this.debugBreakpoint !== null && (this.pc - 1) === this.debugBreakpoint) {
      this.debugMode = true;
    }

    if (this.debugMode) {
      // debugMode is safe in tests: readLineFromStdin() reads from inputBuffer
      // when set, so tests can drive the debugger by pre-loading inputBuffer
      // with commands (e.g. 'q\n' to quit immediately).
      this.debug();
    }

    const prevRegs = this.r.slice(); // saves r0–r7
    const prevPC = this.pc; // saves the previous PC value

    // Execute instruction
    switch (this.opcode) {
      case 0: // BR
        this.executeBR();
        break;
      case 1: // ADD
        this.executeADD();
        break;
      case 2: // LD
        this.executeLD();
        break;
      case 3: // ST
        this.executeST();
        break;
      case 4: // BL or BLR
        this.executeBLorBLR();
        break;
      case 5: // AND
        this.executeAND();
        break;
      case 6: // LDR
        this.executeLDR();
        break;
      case 7: // STR
        this.executeSTR();
        break;
      case 8: // CMP
        this.executeCMP();
        break;
      case 9: // NOT
        this.executeNOT();
        break;
      case 10: // PUSH, POP, SRL, SRA, SLL, ROL, ROR, MUL, DIV, REM, OR, XOR, MVR, SEXT
        this.executeCase10();
        break;
      case 11: // SUB
        this.executeSUB();
        break;
      case 12: // JMP/RET
        this.executeJMP();
        break;
      case 13: // MVI
        this.executeMVI();
        break;
      case 14: // LEA
        this.executeLEA();
        break;
      case 15: // TRAP
        this.executeTRAP();
        break;
      default:
        // Unreachable: opcode is (ir >> 12) & 0xF, and all 16 values (0-15) have a
        // case above. Kept as a defensive guard; the reachable UNKNOWN_OPCODE path
        // is the extended-opcode default in executeCase10() (#1245 decision A).
        this.raiseRuntimeError(new InterpreterRuntimeError(`Unknown opcode: ${this.opcode}`, { explainKey: 'UNKNOWN_OPCODE' }));
    }

    // if any registers changed or flags were set, print them out
    // traceMode uses the same diff format as debugMode but writes to stdout only
    // (not to this.output, which is reserved for program I/O in the .lst reports)
    if ((this.debugMode || this.traceMode) && this.running) {
      let regsOrFlagsOutput = '';

      for (const { i, oldVal, newVal } of diffRegisters(prevRegs, this.r)) {
        const hexOld = oldVal.toString(16).padStart(1, '0');
        const hexNew = newVal.toString(16).padStart(1, '0');
        regsOrFlagsOutput += `     <r${i} = ${hexOld}/${hexNew}>`;
      }

      const [n, z, c, v] = [this.n, this.z, this.c, this.v];

      if (this.flagsSet) {
        if (regsOrFlagsOutput.trim() !== '') {
          regsOrFlagsOutput += ' '; // a 1 space inbetween regs and flags
        } else {
          regsOrFlagsOutput += '     '; // add 5 spaces to pad flags
        }
        regsOrFlagsOutput += `<NZCV = ${n}${z}${c}${v}>`;
        this.flagsSet = false; // Reset the flag set
      }

      if (this.hasJumped) {
        if (regsOrFlagsOutput.trim() === '') {
          regsOrFlagsOutput += '     '; // add 5 spaces to pad flags
        }
        regsOrFlagsOutput += `<pc = ${prevPC.toString(16)}/${this.pc.toString(16)}>`;
        this.hasJumped = false; // Reset the jump flag
      }

      if (regsOrFlagsOutput.trim() !== '') {
        if (this.debugMode) {
          this.writeDebugOutput(regsOrFlagsOutput);
        } else {
          // traceMode: stdout only — don't accumulate in this.output
          process.stdout.write(regsOrFlagsOutput + '\n');
        }
      }

    }

    this.instructionsExecuted++;

    // Track max stack size
    let sp = this.r[6];
    let stackSize = sp === 0 ? 0 : MAX_MEMORY - sp;
    if (stackSize > this.maxStackSize) {
      this.maxStackSize = stackSize;
    }
  }

  // convert source hex to matching mnemonic
  hexToMnemonic(hex) {
    const mnemonics = {
      0x0000: 'BR',
      0x1000: 'ADD',
      0x2000: 'LD',
      0x3000: 'ST',
      0x4000: 'BL',
      0x5000: 'AND',
      0x6000: 'LDR',
      0x7000: 'STR',
      0x8000: 'CMP',
      0x9000: 'NOT',
      0xA000: 'CASE10',
      0xB000: 'SUB',
      0xC000: 'JMP/RET',
      0xD000: 'MVI',
      0xE000: 'LEA',
      0xF000: 'TRAP'
    };
    let mnemonic = mnemonics[hex & 0xF000] || `Unknown(${hex.toString(16)})`;
    if (mnemonic === 'CASE10') {
      // Handle the extended opcode separately
      const extendedMnemonics = {
        0x0: 'PUSH',
        0x1: 'POP',
        0x2: 'SRL',
        0x3: 'SRA',
        0x4: 'SLL',
        0x5: 'ROL',
        0x6: 'ROR',
        0x7: 'MUL',
        0x8: 'DIV',
        0x9: 'REM',
        0xA: 'OR',
        0xB: 'XOR',
        0xC: 'MVR',
        0xD: 'SEXT'
      };
      mnemonic = extendedMnemonics[hex & 0x001F] || `Unknown(${hex.toString(16)})`;
    }
    
    if(mnemonic === 'TRAP') {
      const trapMnemonics = {
        0x00: 'HALT',
        0x01: 'NL',
        0x02: 'DOUT',
        0x03: 'UDOUT',
        0x04: 'HOUT',
        0x05: 'AOUT',
        0x06: 'SOUT',
        0x07: 'DIN',
        0x08: 'HIN',
        0x09: 'AIN',
        0x0A: 'SIN',
        0x0B: 'M',
        0x0C: 'R',
        0x0D: 'S',
        0x0E: 'BP',
      }
      mnemonic = trapMnemonics[hex & 0x000F] || `Unknown(${hex.toString(16)})`;
    }

    if(mnemonic === 'BR') {
      const brMnemonics = {
        0x00: 'BRZ',
        0x01: 'BRNZ',
        0x02: 'BRN',
        0x03: 'BRP',
        0x04: 'BRLT',
        0x05: 'BRGT',
        0x06: 'BRC',
        0x07: 'BR'
      };
      mnemonic = brMnemonics[this.code] || `Unknown(${hex.toString(16)})`;
    }
    
    return mnemonic;
  }

  formatDebugState(line, source) {
    return `${line.toString(16).padStart(3, ' ')}: ${source.toString(16).padStart(4, '0')}`;
  }

  // Interactive debug interface — state, commands, and loop semantics:
  //   - State format: source text (from sourceMap) instead of hex machine word
  //   - Commands: Enter=step, q=quit, g=continue, r=regs, m/m addr [n]=memory,
  //               i=next-instr, h=help, s=stack
  //   - Loop: non-step commands repeat the prompt; only Enter or an unrecognized
  //     input advances execution
  debug() {
    const addr = this.pc - 1;
    const mnemonic = this.hexToMnemonic(this.ir);

    // Breakpoint banner: printed once when execution stops at the breakpoint address.
    if (addr === this.debugBreakpoint) {
      this.writeDebugOutput('Breakpoint at');
      const bpEntry = this.sourceMap && this.sourceMap.addressToLine.get(addr);
      const bpText  = bpEntry ? bpEntry.sourceLine : this.mem[addr].toString(16).padStart(4, '0');
      this.writeDebugOutput(`    ${bpText}`);
      this.debugBreakpoint = null; // clear breakpoint after first hit
    }

    while (true) {
      process.stdout.write(`${mnemonic.toLowerCase()}>>> `);
      const { inputLine } = this.readLineFromStdin();
      const input  = inputLine.trim();
      const cmd    = input.toLowerCase();

      // ── step (empty Enter) ─────────────────────────────────────────────
      if (cmd === '') {
        this._debugShowState(addr);
        return; // execute the instruction
      }

      // ── quit ───────────────────────────────────────────────────────────
      if (cmd === 'q') {
        this.running = false;
        return;
      }

      // ── continue to end without further debug prompts ──────────────────
      if (cmd === 'g') {
        this.debugMode = false;
        return; // execute instruction; loop won't call debug() again
      }

      // ── breakpoint: b {addr} = set; b = cancel ────────────────────────
      if (cmd === 'b') {
        this.debugBreakpoint = null;
        continue;
      }
      const bMatch = cmd.match(/^b\s+([0-9a-f]+)$/);
      if (bMatch) {
        this.debugBreakpoint = parseInt(bMatch[1], 16);
        continue;
      }

      // ── display registers ──────────────────────────────────────────────
      if (cmd === 'r') {
        this._debugShowRegs();
        continue;
      }

      // ── display memory (m, m addr, m addr n) ──────────────────────────
      if (cmd === 'm') {
        this._debugShowAllMem();
        continue;
      }
      const mMatch = cmd.match(/^m\s+([0-9a-f]+)(?:\s+(\d+))?$/);
      if (mMatch) {
        const memAddr = parseInt(mMatch[1], 16);
        const count   = mMatch[2] ? parseInt(mMatch[2]) : 1;
        this._debugShowMem(memAddr, count);
        continue;
      }

      // ── display next instruction source text (no exec) ─────────────────
      if (cmd === 'i') {
        const entry = this.sourceMap && this.sourceMap.addressToLine.get(addr);
        const text  = entry ? entry.sourceLine : this.mem[addr].toString(16).padStart(4, '0');
        this.writeDebugOutput(`    ${text}`);
        continue;
      }

      // ── help ───────────────────────────────────────────────────────────
      if (cmd === 'h') {
        this.writeDebugOutput('hit Enter key              run step-count instructions');
        this.writeDebugOutput('integer n                  set step count to n, run');
        this.writeDebugOutput('b <label|addr> or b        set brkpt at <label|addr> or cancel brkpt');
        this.writeDebugOutput('c <regname|lab|addr> val   set <reg|loc at label|loc at addr> to val');
        this.writeDebugOutput('g                          set step count to infinity, run');
        this.writeDebugOutput('h                          help screen');
        this.writeDebugOutput('i                          display next instruction');
        this.writeDebugOutput('m                          display all memory');
        this.writeDebugOutput('m <label|label n>          display <one word|n words> at label|');
        this.writeDebugOutput('m <addr|<addr n>           display <one word|n words> at addr');
        this.writeDebugOutput('q                          quit');
        this.writeDebugOutput('r                          display all regs');
        continue;
      }

      // ── display stack (s) ──────────────────────────────────────────────
      if (cmd === 's') {
        const sp = this.r[6] & 0xFFFF;
        if (sp === 0) {
          this.writeDebugOutput('Stack empty');
        } else {
          this.writeDebugOutput('Stack:');
          for (let a = 0xFFFF; a >= sp; a--) {
            this.writeDebugOutput(`${a.toString(16).padStart(4, '0')}: ${this.mem[a].toString(16).padStart(4, '0')}`);
          }
        }
        continue;
      }

      // ── step with state (unrecognized input, for backward compat) ───────
      this._debugShowState(addr);
      return;
    }
  }

  // Show the current instruction in oracle debug format:
  //   "{addr padded 2}:     {source text}"
  // Falls back to hex machine word if no sourceMap or PC not in map.
  _debugShowState(addr) {
    const entry = this.sourceMap && this.sourceMap.addressToLine.get(addr);
    const text  = entry ? entry.sourceLine : this.mem[addr].toString(16).padStart(4, '0');
    this.writeDebugOutput(`${addr.toString(16).padStart(2, ' ')}:     ${text}`);
  }

  // Display all registers in oracle format.
  _debugShowRegs() {
    const nzcv = `${this.n}${this.z}${this.c}${this.v}`;
    this.writeDebugOutput(`pc = ${h4(this.pc)}  ir = ${h4(this.ir)}  NZCV = ${nzcv}`);
    this.writeDebugOutput(`r0 = ${h4(this.r[0])}  r1 = ${h4(this.r[1])}  r2 = ${h4(this.r[2])}  r3 = ${h4(this.r[3])}  `);
    this.writeDebugOutput(`r4 = ${h4(this.r[4])}  fp = ${h4(this.r[5])}  sp = ${h4(this.r[6])}  lr = ${h4(this.r[7])}  `);
  }

  // Display all used memory words in oracle format.
  _debugShowAllMem() {
    const base = this.loadPoint || 0;
    for (let a = base; a <= this.memMax; a++) {
      this.writeDebugOutput(`${a.toString(16).padStart(4, '0')}: ${this.mem[a].toString(16).padStart(4, '0')}`);
    }
  }

  // Display `count` memory words starting at `addr`.
  _debugShowMem(addr, count) {
    for (let i = 0; i < count; i++) {
      const a = (addr + i) & 0xFFFF;
      this.writeDebugOutput(`${a.toString(16).padStart(4, '0')}: ${this.mem[a].toString(16).padStart(4, '0')}`);
    }
  }

  // cmp    1000  000  sr1 000 sr2   nzcv sr1 - sr2 (set flags) 
  // cmp    1000  000  sr1 1  imm5   nzcv sr1 - imm5 (set flags) 
  executeCMP() {
    if (this.bit5 === 0) {
        // Register mode
        const x = this.toSigned16(this.r[this.sr1]);
        const y = this.toSigned16(this.r[this.sr2]);
        const negY = -y;
        const sum = x + negY;
        const result = sum & 0xFFFF;
        this.setNZ(result);
        this.setCV(sum, x, negY);
    } else {
        // Immediate mode
        const x = this.toSigned16(this.r[this.sr1]);
        const y = this.toSigned16(this.imm5);
        const negY = -y;
        const sum = x + negY;
        const result = sum & 0xFFFF;
        this.setNZ(result);
        this.setCV(sum, x, negY);
    }
  }

  executeBR() {
    let conditionMet = false;
    switch (this.code) {
      case 0: // brz/bre
        conditionMet = this.z === 1;
        break;
      case 1: // brnz/brne
        conditionMet = this.z === 0;
        break;
      case 2: // brn
        conditionMet = this.n === 1;
        break;
      case 3: // brp
        conditionMet = this.n === this.z;
        break;
      case 4: // brlt
        conditionMet = this.n !== this.v;
        break;
      case 5: // brgt
        conditionMet = this.n === this.v && this.z === 0;
        break;
      case 6: // brc/brb
        conditionMet = this.c === 1;
        break;
      case 7: // br/bral
        conditionMet = true;
        break;
    }
    if (conditionMet) {
      this.pc = (this.pc + this.pcoffset9) & 0xFFFF;
    }
    this.hasJumped = conditionMet; // Set flag to indicate a jump/branch was executed
  }

  executeCase10() {
    // ct is a 4-bit shift count field (if omitted at the assembly level, it defaults to 1). 
    const ct = (this.ir >> 5) & 0xF;

    switch (this.eopcode) {
      case EOP_PUSH: // PUSH // mem[--sp] = sr
        // decrement stack pointer and store value
        this.r[6] = (this.r[6] - 1) & 0xFFFF;
        // save source register to memory at address pointed at by stack pointer
        this.storeMem(this.r[6], this.r[this.sr]);
        break;
      case EOP_POP: // POP // dr = mem[sp++];
        // load value from memory at address pointed at by stack pointer to destination
        this.r[this.dr] = this.mem[this.r[6]];
        // increment stack pointer (to deallocate stack memory)
        this.r[6] = (this.r[6] + 1) & 0xFFFF;
        break;
      /*
      The shift instructions move the contents of the source register either 
      left or right, depending on the specific instruction. The first operand 
      in a shift assembly language instruction specifies the register to be 
      shifted, while the second operand indicates the shift count, which is 
      the number of positions to shift. The shift count must be a value 
      between 0 and 15, and if it is not provided, it defaults to 1.

      The SRL (shift right logical) instruction shifts bits to the right, 
      inserting a 0 on the left to ensure the sign bit becomes 0, regardless 
      of its previous state. The SRA (shift right arithmetic) instruction 
      also shifts bits to the right but preserves the sign bit by copying it 
      into the leftmost position. The SLL (shift left logical) instruction 
      shifts bits to the left, inserting a 0 on the right. For all shift 
      instructions, the c flag is set to the last bit shifted out of the 
      register, and the n and z flags are updated to reflect the state of 
      the register after the shift. For instance, the instruction srl r1, 1
       shifts the contents of r1 one position to the right, inserting a 0 on 
       the left.
      */
      // ct=0 corner: ct-1 becomes -1; JS evaluates >> -1 as >> 31.
      // This is safe because this.r[this.sr] is a Uint16Array element (0–65535),
      // so bit 31 is always 0 → c=0, which is the correct carry for a zero-shift.
      // The value-shift operations (>>>0, >>0, <<0) are all no-ops. No guard needed.
      case EOP_SRL: // SRL
        this.c = (this.r[this.sr] >> (ct - 1)) & 1; // Store the last bit shifted out
        this.r[this.sr] = (this.r[this.sr] >>> ct); // Unsigned right shift (injects 0's from the left)
        this.setNZ(this.r[this.sr]); // Update flags
        break;
      case EOP_SRA: // SRA
        this.c = (this.r[this.sr] >> (ct - 1)) & 1; // Store the last bit shifted out
        const signBit = (this.r[this.sr] & 0x8000) ? 0xFFFF << (16 - ct) : 0; // Extend sign bit
        this.r[this.sr] = (this.r[this.sr] >> ct) | signBit; // Shift right with sign extension
        this.setNZ(this.r[this.sr]); // Update flags
        break;
      case EOP_SLL: // SLL
        this.c = (this.r[this.sr] >> (16 - ct)) & 1; // Store the last bit shifted out
        this.r[this.sr] = (this.r[this.sr] << ct) & 0xFFFF; // Logical shift left (mask to 16 bits)
        this.setNZ(this.r[this.sr]); // Update flags
        break;
      case EOP_ROL: // ROL
        this.c = (this.r[this.sr] >> (16 - ct)) & 1;
        this.r[this.sr] = (this.r[this.sr] << ct) | (this.r[this.sr] >> (16 - ct));
        this.setNZ(this.r[this.sr]);
        break;
      case EOP_ROR: // ROR
        this.c = (this.r[this.sr] >> (ct - 1)) & 1;
        this.r[this.sr] = (this.r[this.sr] >> ct) | (this.r[this.sr] << (16 - ct));
        this.setNZ(this.r[this.sr]);
        break;
      case EOP_MUL: // MUL
        this.r[this.dr] = (this.r[this.dr] * this.r[this.sr1]) & 0xFFFF;
        this.setNZ(this.r[this.dr]);
        break;
      case EOP_DIV: // DIV
        if (this.r[this.sr1] === 0) {
          this.raiseRuntimeError(new InterpreterRuntimeError('Floating point exception', { explainKey: 'DIV_BY_ZERO' }));
        }
        // Signed 16-bit division, truncating toward zero (C semantics; oracle parity #1237).
        // Registers are Uint16Array, so operate on the signed view then mask back.
        this.r[this.dr] = Math.trunc(this.toSigned16(this.r[this.dr]) / this.toSigned16(this.r[this.sr1])) & 0xFFFF;
        this.setNZ(this.r[this.dr]);
        break;
      case EOP_REM: // REM
        if (this.r[this.sr1] === 0) {
          this.raiseRuntimeError(new InterpreterRuntimeError('Floating point exception', { explainKey: 'DIV_BY_ZERO' }));
        }
        // Signed 16-bit remainder; result takes the sign of the dividend (C semantics; oracle parity #1237).
        this.r[this.dr] = (this.toSigned16(this.r[this.dr]) % this.toSigned16(this.r[this.sr1])) & 0xFFFF;
        this.setNZ(this.r[this.dr]);
        break;
      case EOP_OR: // OR
        this.r[this.dr] = this.r[this.dr] | this.r[this.sr1];
        this.setNZ(this.r[this.dr]);
        break;
      case EOP_XOR: // XOR
        this.r[this.dr] = this.r[this.dr] ^ this.r[this.sr1];
        this.setNZ(this.r[this.dr]);
        break;
      case EOP_MVR: // MVR
        this.r[this.dr] = this.r[this.sr1];
        break;
      case EOP_SEXT: // SEXT
        this.r[this.dr] = this.executeSEXT(this.r[this.dr], this.r[this.sr1]);
        this.setNZ(this.r[this.dr]);
        break;
      default:
        // Oracle (cuh63 6.3): silently exits (undefined behavior) for unknown eocodes.
        // LCC.js intentionally throws to surface invalid binaries rather than silently ignoring.
        this.raiseRuntimeError(new InterpreterRuntimeError(`Unknown extended opcode: ${this.eopcode}`, { explainKey: 'UNKNOWN_OPCODE' }));
    }
  }

  executeADD() {
    if (this.bit5 === 0) {
      // Register mode
      const result = (this.r[this.sr1] + this.r[this.sr2]) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.r[this.sr2]);
      this.r[this.dr] = result;
    } else {
      // Immediate mode
      const result = (this.r[this.sr1] + this.imm5) & 0xFFFF;
      this.setNZ(result);
      this.setCV(result, this.r[this.sr1], this.imm5);
      this.r[this.dr] = result;
    }
  }

  executeSUB() {
    if (this.bit5 === 0) {
        // Register mode
        const x = this.toSigned16(this.r[this.sr1]);
        const y = this.toSigned16(this.r[this.sr2]);
        const negY = -y;
        const sum = x + negY;
        const result = sum & 0xFFFF;
        this.setNZ(result);
        this.setCV(sum, x, negY);
        this.r[this.dr] = result;
    } else {
        // Immediate mode
        const x = this.toSigned16(this.r[this.sr1]);
        const y = this.toSigned16(this.imm5);
        const negY = -y;
        const sum = x + negY;
        const result = sum & 0xFFFF;
        this.setNZ(result);
        this.setCV(sum, x, negY);
        this.r[this.dr] = result;
    }
  }

  executeAND() {
    if (this.bit5 !== 0) {
      this.r[this.dr] = this.r[this.sr1] & this.imm5;
    } else {
      this.r[this.dr] = this.r[this.sr1] & this.r[this.sr2];
    }
    this.setNZ(this.r[this.dr]);
  }

  executeNOT() {
    this.r[this.dr] = (~this.r[this.sr1]) & 0xFFFF;
    this.setNZ(this.r[this.dr]);
  }

  executeLD() {
    const address = (this.pc + this.pcoffset9) & 0xFFFF;
    this.r[this.dr] = this.mem[address];
  }

  // storeMem(address, value) — the single choke point for every *runtime* memory
  // store (ST/STR/PUSH and memory-writing traps). Subclasses observe stores here
  // to record an undo-log / trace without re-scanning memory: the interactive
  // debugger overrides this to capture address+old value so backward stepping can
  // undo writes anywhere in the 64K space, including the stack above memMax
  // (#1085; the store-observer #252 asks for). Load-time writes go direct to
  // this.mem and are deliberately NOT routed here.
  storeMem(address, value) {
    this.mem[address] = value;
  }

  executeST() {
    const address = (this.pc + this.pcoffset9) & 0xFFFF;
    this.storeMem(address, this.r[this.sr]);
    if (address > this.memMax) this.memMax = address;
  }

  executeMVI() {
    this.r[this.dr] = this.imm9;
  }

  executeLEA() {
    this.r[this.dr] = (this.pc + this.pcoffset9) & 0xFFFF;
  }

  executeLDR() {
    const address = (this.r[this.baser] + this.offset6) & 0xFFFF;
    this.r[this.dr] = this.mem[address];
  }

  executeSTR() {
    const address = (this.r[this.baser] + this.offset6) & 0xFFFF;
    this.storeMem(address, this.r[this.sr]);
  }

  executeJMP() {
    this.pc = (this.r[this.baser] + this.offset6) & 0xFFFF;
    this.hasJumped = true; // Set flag to indicate a jump was executed
  }

  executeBLorBLR() {
    if (this.bit11 !== 0) {
      // BL (Branch and Link)
      this.r[7] = this.pc;
      this.pc = (this.pc + this.pcoffset11) & 0xFFFF;
    } else {
      // BLR (Branch and Link Register)
      this.r[7] = this.pc;
      this.pc = (this.r[this.baser] + this.offset6) & 0xFFFF;
    }
    this.hasJumped = true; // Set flag to indicate a jump was executed
  }

  executeSOUT() {
    let address = this.r[this.sr];
    let charCode = this.mem[address];
    while (charCode !== 0) {
      const char = String.fromCharCode(charCode);
      this.writeOutput(char);
      address = (address + 1) & 0xFFFF;
      charCode = this.mem[address];
    }
  }

  readLineFromStdin() {
    if (this.inputBuffer && this.inputBuffer.length > 0) {
      // Use the inputBuffer to simulate user input
      this.inputBuffer = this.inputBuffer.replace(/\r\n/g, '\n');
      const newlineIndex = this.inputBuffer.indexOf('\n');
      let inputLine = '';
      if (newlineIndex !== -1) {
        inputLine = this.inputBuffer.slice(0, newlineIndex);
        this.inputBuffer = newlineIndex > 0
          ? this.inputBuffer.slice(newlineIndex)
          : this.inputBuffer.slice(newlineIndex + 1);
      } else {
        inputLine = this.inputBuffer;
        this.inputBuffer = '';
      }
      // Echo the simulated input back to output and stdout (gated by echoInput;
      // the test-runner disables it so an autograder captures only the program's
      // own output, not its echoed input, #1328).
      ///// this.writeOutput(inputLine + '\n');
      if (this.echoInput) this.writeOutput(inputLine);
      return { inputLine, isSimulated: true };
    } else if (this._pauseOnInput) {
      // Back up PC so the TRAP instruction re-executes after resume().
      this.pc--;
      const trapType = { 7: 'din', 8: 'hin', 10: 'sin' }[this.trapvec] ?? 'din';
      throw new InputPauseSignal(trapType);
    } else {
      // Original code for reading from stdin
      let input = '';
      let buffer = Buffer.alloc(1);
      let fd = process.stdin.fd;

      while (true) {
        try {
          let bytesRead = fs.readSync(fd, buffer, 0, 1, null);
          if (bytesRead === 0) {
            return { inputLine: '', isSimulated: false, isEOF: true };
          }
          let char = buffer.toString('utf8');
          
          // If it's a UNIX newline, put it back for ain to read (OG LCC parity).
          if (char === '\n') {
            this.inputBuffer = '\n' + (this.inputBuffer || '');
            break;
          }

          // If it's '\r', check whether the next char is '\n'.
          if (char === '\r') {
            const nextBytes = fs.readSync(fd, buffer, 0, 1, null);
            if (nextBytes > 0) {
              const nextChar = buffer.toString('utf8', 0, nextBytes);
              // If nextChar is not '\n', we treat this '\r' as a line terminator
              // and the nextChar is actually the start of the next line.
              if (nextChar !== '\n') {
                input += nextChar; // Or handle it differently if you prefer
              }
            }
            break;
          }

          input += char;
        } catch (err) {
          if (err.code === 'EAGAIN') {
            // Resource temporarily unavailable, wait a bit and retry
            continue;
          } else {
            throw err;
          }
        }
      }
      input = input.replace(/\r$/, '');
      return { inputLine: input, isSimulated: false };
    }
  }

  readCharFromStdin() {
    if (this.inputBuffer && this.inputBuffer.length > 0) {
      let ainChar = this.inputBuffer.charAt(0);
      this.inputBuffer = this.inputBuffer.slice(1);
      // Echo the simulated input back to output and stdout (gated by echoInput, #1328)
      if (this.echoInput) this.writeOutput(ainChar + newline);
      return { char: ainChar, isSimulated: true };
    } else if (this._pauseOnInput) {
      this.pc--;
      throw new InputPauseSignal('ain');
    } else {
      // Read one character from stdin
      let ainBuffer = Buffer.alloc(1);
      let fd = process.stdin.fd;
      let ainBytesRead = 0;

      // Keep trying to read until we get a character
      while (ainBytesRead === 0) {
        try {
          ainBytesRead = fs.readSync(fd, ainBuffer, 0, 1, null);
          if (ainBytesRead === 0) {
            return { char: '', isSimulated: false, isEOF: true };
          }
        } catch (err) {
          if (err.code === 'EAGAIN') {
            continue;
          } else {
            throw err;
          }
        }
      }

      // If we got here, we successfully read a character
      let ainChar = ainBuffer.toString('utf8');
      return { char: ainChar, isSimulated: false };
    }
  }

  executeSIN() {
    // Skip a leading '\n' left by the previous line-read trap for ain parity.
    // The debug prompt also uses readLineFromStdin and intentionally sends '\n'
    // as an empty-Enter step command, so this skip must live here rather than
    // in readLineFromStdin itself.
    if (this.inputBuffer && this.inputBuffer.startsWith('\n')) {
      this.inputBuffer = this.inputBuffer.slice(1);
    }
    let address = this.r[this.sr];
    // Destructure isEOF so we can throw consistently with din/hin/ain.
    let { inputLine: input, isSimulated, isEOF } = this.readLineFromStdin();

    if (isEOF) {
      this.raiseRuntimeError(new InterpreterRuntimeError('sin: unexpected EOF on stdin', { explainKey: 'EOF_ON_STDIN' }));
    }

    for (let i = 0; i < input.length; i++) {
      this.storeMem(address, input.charCodeAt(i));
      address = (address + 1) & 0xFFFF;
    }
    // Null-terminate the string
    this.storeMem(address, 0);

    // add newline here if input is simulated (the echoed "Enter"); gated by
    // echoInput so the test-runner's autograder captures only program output (#1328)
    if (isSimulated) {
      if (this.echoInput) this.writeOutput(newline);
    } else //// else, add input to the output buffer w/ newline delimeter
    {
      this.output += input + newline;
    }
  }

  executeM() {
    for (let addr = 0; addr <= this.memMax; addr++) {
      const content = this.mem[addr];
      const line = `${addr.toString(16).padStart(4, '0')}: ${content.toString(16).padStart(4, '0')}`;
      this.writeOutput(line + newline);
    }
  }

  executeR() {
    const pcStr = this.pc.toString(16).padStart(4, '0');
    const irValue = this.mem[(this.pc) & 0xFFFF];
    const irStr = irValue.toString(16).padStart(4, '0');
    const nzcvStr = `${this.n}${this.z}${this.c}${this.v}`.padStart(4, '0');
    let output = `pc = ${pcStr}  ir = ${irStr}  NZCV = ${nzcvStr}${newline}`;
    // First line: r0 to r3
    for (let i = 0; i <= 3; i++) {
      const regStr = this.r[i].toString(16).padStart(4, '0');
      output += `r${i} = ${regStr}  `;
    }
    output += newline;
    // Second line: r4, fp, sp, lr
    const r4Str = this.r[4].toString(16).padStart(4, '0');
    const fpStr = this.r[5].toString(16).padStart(4, '0');
    const spStr = this.r[6].toString(16).padStart(4, '0');
    const lrStr = this.r[7].toString(16).padStart(4, '0');
    output += `r4 = ${r4Str}  fp = ${fpStr}  sp = ${spStr}  lr = ${lrStr}  ${newline}`;
    this.writeOutput(output);
  }

  executeS() {
    let sp = this.r[6];
    let fp = this.r[5];

    if (sp === this.spInitial) {
      this.writeOutput(`Stack empty${newline}`);
      return;
    } else {
      this.writeOutput(`Stack:${newline}`);

      for (let addr = sp; addr < MAX_MEMORY; addr++) {
        let value = this.mem[addr];
        let addrStr = addr.toString(16).padStart(4, '0');
        let valueStr = value.toString(16).padStart(4, '0');
        let line = `${addrStr}: ${valueStr}`;
        if (addr === fp) {
          line += ' <--- fp';
        }
        this.writeOutput(line + newline);
      }
    }
  }

  handleSoftwareBreakpoint() {
    const breakpointMessage = `software breakpoint${newline}`;

    if (!this.allowRuntimeDebugging) {
      this.raiseRuntimeError(new InterpreterRuntimeError('software breakpoint'));
      return;
    }

    this.writeOutput(breakpointMessage);

    if (this.canEnterInteractiveDebugger()) {
      this.debugMode = true;
    }
  }


  // This function writes output to stdout,
  // and it also adds a newline at the end.
  // It is used for writing debug output that should
  // be followed by a newline, as in the case of
  // debug messages, error messages, etc.
  writeDebugOutput(message) {
    process.stdout.write(message + "\n");
    this.output += message;
  }

  // This function writes output to stdout,
  // but it does not add a newline at the end.
  // It is used for writing output that should not
  // be followed by a newline, as in the case of
  // aout, dout, sout, etc.
  writeOutput(message) {
    this._write(message);
    this.output += message;
  }

  // This function writes debug output to stdout,
  // but it also checks if debugMode is enabled.
  // If debugMode is off, it writes the message 
  // without a newline.
  writeDebugOutputOrElse(message) {
    if(this.debugMode) {
      this._write(message + "\n");
    } else {
      this._write(message);
    }
    this.output += message;
  }

  executeTRAP() {
    switch (this.trapvec) {
      case 0: // HALT
        this.running = false;
        break;
      case 1: // NL
        this.writeOutput(newline);
        break;
      case 2:// DOUT
        let value = this.r[this.sr];
        // Convert unsigned 16-bit to signed 16-bit
        if (value & 0x8000) {
          value -= 0x10000;
        }
        const doutStr = `${value}`;
        this.writeDebugOutputOrElse(doutStr);
        break;
      case 3: // UDOUT
        // print as unsigned decimal
        const udoutStr = `${this.r[this.sr] & 0xFFFF}`;
        this.writeDebugOutputOrElse(udoutStr);
        break;
      case 4: // HOUT
        // print as hexadecimal; -x flag (options.hexOutput) forces 4-digit zero-padded output
        const houtRaw = this.r[this.sr].toString(16).toLowerCase();
        const houtStr = this.options.hexOutput ? houtRaw.padStart(4, '0') : houtRaw;
        this.writeDebugOutputOrElse(houtStr);
        break;
      case 5: // AOUT
        // print as ASCII character
        const aoutChar = String.fromCharCode(this.r[this.sr] & 0xFF);
        this.writeDebugOutputOrElse(aoutChar);
        break;
      case 6: // SOUT
        // print string at address
        this.executeSOUT();
        if(this.debugMode) {
          this.writeDebugOutput("");
        }
        break;
      case 7: // DIN
        while (true) {
          let { inputLine: dinInput, isSimulated, isEOF } = this.readLineFromStdin();

          if (isEOF) {
            this.raiseRuntimeError(new InterpreterRuntimeError('din: unexpected EOF on stdin', { explainKey: 'EOF_ON_STDIN' }));
          }
          if (dinInput.trim() === '') {
            continue;
          }

          let dinValue = parseInt(dinInput, 10);
          if (isNaN(dinValue)) {
            const errorMsg = `Invalid dec constant. Re-enter:${newline}`;
            this.writeOutput(errorMsg);
            continue;
          } else {
            this.r[this.dr] = dinValue & 0xFFFF;
            // No need to echo input here; already handled in readLineFromStdin()
            //// unless input is simulated
            if (isSimulated) {
              this.writeOutput(newline);
            } else {
              // add input to the output buffer w/ newline delimeter
              this.output += dinInput + newline;
            }
            break;
          }
        }
        break;
      case 8: // HIN
        while (true) {
          let { inputLine: hinInput, isSimulated, isEOF: hinEOF } = this.readLineFromStdin();

          if (hinEOF) {
            this.raiseRuntimeError(new InterpreterRuntimeError('hin: unexpected EOF on stdin', { explainKey: 'EOF_ON_STDIN' }));
          }
          if (hinInput.trim() === '') {
            continue;
          }

          let hinValue = parseInt(hinInput, 16);
          if (isNaN(hinValue)) {
            const errorMsg = `Invalid hex constant. Re-enter:${newline}`;
            this.writeOutput(errorMsg);
            continue;
          } else {
            this.r[this.dr] = hinValue & 0xFFFF;
            // No need to echo input here; already handled in readLineFromStdin()
            //// unless input is simulated
            if (isSimulated) {
              this.writeOutput(newline);
            } else {
              this.output += hinInput + newline;
            }
            break;
          }
        }
        break;
      case 9: // AIN
        let { char: ainChar, isSimulated, isEOF: ainEOF } = this.readCharFromStdin();
        if (ainEOF) {
          this.raiseRuntimeError(new InterpreterRuntimeError('ain: unexpected EOF on stdin', { explainKey: 'EOF_ON_STDIN' }));
        }
        this.r[this.dr] = ainChar.charCodeAt(0);
        // No need to echo input here; already handled in readCharFromStdin()
        break;
      case 10: // SIN
        // read a line of input from the user
        this.executeSIN();
        break;
      case 11: // m
        this.executeM();
        break;
      case 12: // r
        this.executeR();
        break;
      case 13: // s
        this.executeS();
        break;
      case 14: // bp
        this.handleSoftwareBreakpoint();
        break;
      default:
        // `Unknown TRAP vector: ${this.trapvec}`
        console.error(`Error on line 0 of ${this.inputFileName}`);
        console.error();
        this.raiseRuntimeError(new InterpreterRuntimeError('Trap vector out of range', { explainKey: 'TRAP_VECTOR_RANGE' })); // : ${this.trapvec}
    }
  }

  toSigned16(value) {
    value &= 0xFFFF; // Ensure 16-bit value
    if (value & 0x8000) {
        return value - 0x10000; // Convert to negative value
    } else {
        return value;
    }
  }

  setNZ(value) {
    this.flagsSet = true; // Set the flag set indicator
    value = this.toSigned16(value);
    if (value < 0) {
        this.n = 1;
        this.z = 0;
    } else if (value === 0) {
        this.n = 0;
        this.z = 1;
    } else {
        this.n = 0;
        this.z = 0;
    }
  }

  setCV(sum, x, y) {
    this.flagsSet = true; // Set the flag set indicator
    // Convert values to signed 16-bit integers
    sum = this.toSigned16(sum);
    x = this.toSigned16(x);
    y = this.toSigned16(y);

    // Initialize flags
    this.c = 0;
    this.v = 0;

    // Carry flag logic
    if (x >= 0 && y >= 0) {
        this.c = 0;
    } else if (x < 0 && y < 0) {
        this.c = 1;
    } else if (sum >= 0) {
        this.c = 1;
    } else {
        this.c = 0;
    }

    // Overflow flag logic
    if ((x < 0 && y >= 0) || (x >= 0 && y < 0)) {
        this.v = 0;
    } else if ((sum < 0 && x >= 0) || (sum >= 0 && x < 0)) {
        this.v = 1;
    } else {
        this.v = 0;
    }
  }

  signExtend(value, bitWidth) {
    const signBit = 1 << (bitWidth - 1);
    const mask = (1 << bitWidth) - 1;
    value = value & mask; // Mask the value to the specified bit width
    if (value & signBit) {
        // Negative number, extend the sign bits
        value |= ~mask;
    }
    return value;
  }

  signExtendMaskedValue(value, mask) {
    value &= 0xFFFF;
    mask &= 0xFFFF;

    if (mask === 0) {
      return 0;
    }

    const signBit = 1 << (31 - Math.clz32(mask));
    let result = value & mask;

    if (result & signBit) {
      result |= ~mask;
    }

    return result & 0xFFFF;
  }

  executeSEXT(value, fieldSelector) {
    value &= 0xFFFF;
    fieldSelector &= 0xFFFF;

    // Oracle demoU-style field selectors 0..15 follow a dedicated field-number
    // mapping rather than the raw mask behavior used by larger masks such as 0x1f.
    if (fieldSelector <= 0x0F) {
      return SEXT_PARITY_TABLE[fieldSelector][value & 0x1F];
    }

    return this.signExtendMaskedValue(value, fieldSelector);
  }

  raiseRuntimeError(error) {
    this.running = false;

    if (!(error instanceof Error)) {
      error = new InterpreterRuntimeError(String(error));
    }

    if (this.verboseModeOn) {
      const pc = `PC=0x${(this.pc || 0).toString(16).padStart(4, '0')}`;
      const regs = this.r
        ? this.r.map((v, i) => `r${i}=0x${(v || 0).toString(16).padStart(4, '0')}`).join(' ')
        : '';
      const mapEntry = this.sourceMap && this.sourceMap.addressToLine &&
        this.sourceMap.addressToLine.get(this.pc);
      const srcLine = mapEntry
        ? ` | line ${mapEntry.lineNumber}: ${mapEntry.sourceLine.trim()}`
        : '';
      console.error(`[interpreter] ${pc} ${regs}${srcLine}`);
    }

    throw error;
  }
}

// Instantiate and run the interpreter if this script is run directly
if (require.main === module) {
  const interpreter = new Interpreter();
  interpreter.generateStats = true; // Set to generate .lst and .bst files
  interpreter.main();
}

module.exports = Interpreter;
