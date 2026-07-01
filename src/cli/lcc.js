#!/usr/bin/env node

// lcc.js

const fs = require('fs');
const path = require('path');
const Assembler = require('../core/assembler');
const Interpreter = require('../core/interpreter');
const Linker = require('../core/linker');
const ILCC = require('../interactive/ilcc');
const { LinkerError, TestSpecError, TestRunnerError } = require('../utils/errors');
const { loadTestSpec, loadFencedSpec } = require('../testrunner/specLoader');
const { runTestSpec } = require('../testrunner/runner');
const nameHandler = require('../utils/name.js');
const { buildReportArtifacts } = require('../utils/reportArtifacts');
const { constructSiblingFileName, writeReportFiles } = require('../utils/fileArtifacts');
const { formatFlagDiagnostics } = require('../utils/flagDiagnostics');

const newline = process.platform === 'win32' ? '\r\n' : '\n';

const { fatalExit, cliErrorExit, cliWrappedErrorExit, setExplainMode, setShowErrId } = require('../utils/cliExit');

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
    this.userName = null;
  }

  resolveUserName(inputFileName = this.inputFileName) {
    try {
      return nameHandler.createNameFile(inputFileName);
    } catch (error) {
      cliWrappedErrorExit('Error handling name file:', error, 1);
    }
  }

  buildReportArtifacts(includeSourceCode, includeComments, now) {
    const userName = this.userName ?? this.resolveUserName();

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

    // --test short-circuits the normal assemble/link/run dispatch entirely
    // (#1092). The spec path was consumed by parseArguments, so this.args may be
    // empty here — run the test mode before the no-input-file guard below.
    if (this.options.testSpec !== undefined) {
      this.runTestMode(this.options.testSpec);
      return;
    }

    if (this.args.length === 0) {
      cliErrorExit('No input file specified.', 1);
    }

    // If multiple inputs were supplied, the "main input file" is the first one
    this.inputFileName = this.args[0];

    // -i flag: delegate entirely to the interactive debugger (ILCC).
    // Supported: .a, .bin, .hex (assembled first) and .e (loaded directly).
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

    // Resolve the author name before any assembly or execution — matches oracle
    // behavior (oracle always prompts for name first). Writes name.nnn if absent;
    // subsequent calls in assembler/interpreter just read from the file.
    // Guards:
    //   - linking (.o → .e): linker writes no report artifacts, name not needed.
    //   - generateStats=false: no .lst/.bst will be written, name not needed.
    if (!firstArgIsObjectFile && this.generateStats) {
      this.userName = this.resolveUserName();
    }

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
   * Forwards -e (efficient), -c (colorblind), -d (debug), -l<hex>, -o,
   * -t (trace), -x (hexOutput), -f (fullLineDisplay) flags.
   * Does NOT forward -m/-r: those are post-run batch dumps emitted by
   * executeBuffer(); interactive mode bypasses that path entirely.
   * ilcc.js stays as a thin standalone wrapper; this method is the canonical
   * path reached via `lcc -i`.
   */
  runInteractiveMode() {
    const ilcc = new ILCC();

    // Forward relevant options
    ilcc.options.efficientMode   = !!this.options.efficientMode;
    ilcc.options.colorblindMode  = !!this.options.colorblindMode;
    ilcc.options.debug           = !!this.options.debug;
    ilcc.options.trace           = !!this.options.trace;
    ilcc.options.hexOutput       = !!this.options.hexOutput;
    ilcc.options.fullLineDisplay = !!this.options.fullLineDisplay;
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
    linker.verboseModeOn = !!this.options.verbose;
    linker.showErrIdOn = !!this.options.showErrId; // #1555

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

  /**
   * Assignment test-runner — CLI surface for `lcc --test <spec.json>` (#1092).
   *
   * Orchestration only: resolve the spec (loadSpec), run it through the runner
   * core (runTestSpec, #1091), print a pass/fail report, and map the outcome to
   * a CI exit code:
   *   0 — every case passed
   *   1 — the spec ran but one or more cases failed
   *   2 — the spec could not be run (malformed spec / missing program / format)
   */
  runTestMode(specPath) {
    let spec;
    try {
      spec = this.loadSpec(specPath);
    } catch (err) {
      if (err instanceof TestSpecError) {
        cliErrorExit(err.message, 2);
      }
      throw err;
    }

    let results;
    try {
      results = runTestSpec(spec);
    } catch (err) {
      if (err instanceof TestRunnerError) {
        cliErrorExit(err.message, 2);
      }
      throw err;
    }

    this.reportTestResults(results);
  }

  /**
   * Spec-format dispatch seam (#1092 design ruling; sniff convention ruled in
   * #1240). The format is detected by CONTENT, not extension: a JSON spec always
   * opens with `{`, a fenced literal-block spec (#1114) with a `program:` header.
   * So the first non-blank character decides — `{` → JSON loader (#1090), any-
   * thing else → fenced loader. This means any extension works (.json / .test /
   * .txt), which is the student-friendly choice and unambiguous because the two
   * formats cannot be mistaken for each other. `program` inside the spec is
   * resolved relative to the spec file's own directory.
   */
  loadSpec(specPath) {
    const buffer = fs.readFileSync(specPath);
    const baseDir = path.dirname(path.resolve(specPath));
    const firstNonBlank = (buffer.toString('utf8').match(/\S/) || [])[0];
    if (firstNonBlank === '{') {
      return loadTestSpec(buffer, baseDir);
    }
    return loadFencedSpec(buffer, baseDir);
  }

  /**
   * Print the per-case report and exit with the CI-appropriate code.
   * Result shape (from runTestSpec): { name, pass, reason, expected, actual }.
   * On a FAIL whose reason is an output mismatch, show a first-diff block;
   * other failures (timeout, exit-code mismatch) just show the reason.
   */
  reportTestResults(results) {
    let passed = 0;
    let failed = 0;

    for (const r of results) {
      if (r.pass) {
        passed++;
        console.log(`PASS  ${r.name}`);
      } else {
        failed++;
        console.log(`FAIL  ${r.name}  (${r.reason})`);
        if (r.reason === 'output mismatch') {
          console.log(this.formatFirstDiff(r.expected, r.actual));
        }
      }
    }

    console.log(`${passed} passed, ${failed} failed`);

    if (failed > 0) {
      // fatalExit → process.exit(1) in normal runs; throws under Jest so an
      // in-process test can assert on it. The e2e suite (#1093) spawns a real
      // subprocess and observes the literal exit code.
      fatalExit(`${failed} test case(s) failed`, 1);
    }
    // All passed → return for a natural exit 0.
  }

  /**
   * Render the first line at which expected and actual diverge, with both
   * full multi-line bodies for context. Keeps a teacher's eye on *where* the
   * mismatch starts rather than forcing a full manual diff.
   */
  formatFirstDiff(expected, actual) {
    const exp = String(expected).split('\n');
    const act = String(actual).split('\n');
    const max = Math.max(exp.length, act.length);
    let firstDiffLine = max; // 0 if identical (shouldn't happen on a mismatch)
    for (let i = 0; i < max; i++) {
      if (exp[i] !== act[i]) {
        firstDiffLine = i + 1;
        break;
      }
    }
    return [
      `      first diff at line ${firstDiffLine}:`,
      `        expected: ${JSON.stringify(expected)}`,
      `        actual:   ${JSON.stringify(actual)}`,
    ].join('\n');
  }

  constructOutputFileName(inputFileName) {
    return constructSiblingFileName(inputFileName, '.e');
  }

  printHelp() {
    console.log('Usage: lcc.js <infile>');
    console.log('Optional args: -d -m -r -t -f -x -i -e -c -v -nostats --max-steps N (-ms<N>) -l<hex loadpt> -o <outfile> -h');
    console.log('   -d:   debug, -m mem display at end, -r: reg display at end');
    console.log('   -f:   full line display, -x: 4 digit hout, -h: help');
    console.log('   -i:   interactive stepping debugger mode (.a and .e files only)');
    console.log('   -e:   efficient mode (with -i: forward-only stepping, lower memory)');
    console.log('   -c:   colorblind mode (with -i: alternate ANSI palette)');
    console.log('   Note: -t, -x, -f are forwarded to interactive mode; -m and -r are not');
    console.log('         (-m/-r are post-run batch dumps; interactive mode has no batch path)');
    console.log('   -v / --verbose: verbose output (assembler, interpreter, and linker)');
    console.log('   --explain: append a student-friendly explanation to known errors');
    console.log('   --show-err-id: show a unique, citable error ID (e.g. asm-014) inline; off by default, combinable with --explain');
    console.log('        (full error-ID catalog + stability policy: docs/error-ids.md)');
    console.log('   --sounds-on: enable LCC+ sound mnemonics (ding/doink/beep/...) in core LCC (BEL fallback if no audio player)');
    console.log('   -nostats: suppress .lst/.bst report generation');
    console.log('   --max-steps N (or -ms<N>): set execution step cap (default 500000; use -1 for unlimited)');
    console.log('   --test <spec>: run an assignment spec (input->expected_output cases);');
    console.log('         spec may be JSON or the fenced literal-block format (auto-detected by content);');
    console.log('         prints PASS/FAIL per case; exits 0 all-pass, 1 any-fail, 2 spec error');
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
    // Collected during the loop, reported once at the end as non-blocking
    // warnings (#1373): unknown flags, not-yet-implemented flags, and known
    // LCCjs deviations (#1371).
    const unknownFlags = [];
    const unimplementedFlags = [];
    const deviatedFlags = [];
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
            // Known flag, but a deliberate no-op in LCCjs: LCCjs never truncates
            // listing lines (unlike LCC), so "full list" is always on. Reported
            // as a documented deviation, not "unimplemented". (#1371)
            this.options.fullLineDisplay = true;
            deviatedFlags.push('-f');
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
            this.generateStats = false;
            break;
          case '-h':
            this.printHelp();
            fatalExit('Printing help message after -h flag used.', 0);
          case '-v':
          case '--verbose':
            this.options.verbose = true;
            break;
          case '--explain':
            // Opt-in student-friendly error explanations (#1096). Combinable
            // with -v. Off by default so oracle-parity output is unchanged.
            // (No short alias: -x is already taken by hex output.)
            this.options.explain = true;
            setExplainMode(true);
            break;
          case '--show-err-id':
            // Opt-in inline error IDs (#1552, mechanism per #1480). Independent
            // of --explain (IDs stay hidden under bare --explain), combinable
            // with it. Off by default so the plain stream's oracle parity holds.
            this.options.showErrId = true;
            setShowErrId(true); // also surface ids on the interpreter/linker cliExit path (#1562)
            break;
          case '--sounds-on':
            // Enable the LCC+ sound trap (0xF8) in core LCC (#1504). OFF by
            // default so core behavior + oracle-parity output are unchanged.
            this.options.soundsOn = true;
            break;
          case '--test': {
            // Assignment test-runner surface (#1092, parent #1044). Consumes the
            // next arg as the spec path and short-circuits the extension dispatch
            // in main(). Exit 2 (not 1) on a missing value: like a malformed spec,
            // the tests could not be run — the CI "couldn't-run" bucket, distinct
            // from exit 1 "tests ran, some failed".
            i++;
            if (i >= args.length) {
              cliErrorExit('Missing spec path after --test', 2);
            }
            this.options.testSpec = args[i];
            break;
          }
          case '--max-steps': {
            i++;
            if (i >= args.length) {
              cliErrorExit('Missing value after --max-steps', 1);
            }
            const n = parseInt(args[i], 10);
            if (isNaN(n)) {
              cliErrorExit(`Invalid --max-steps value: ${args[i]}`, 1);
            }
            this.options.maxSteps = n;
            break;
          }
          default:
            if (arg.startsWith('-ms')) {
              // -ms<N> short form of --max-steps (instruction cap, #1350).
              const cap = parseInt(arg.substr(3), 10);
              if (!isNaN(cap)) this.options.maxSteps = cap;
            } else if (arg.startsWith('-l')) {
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
              // Unknown flag — collect and warn at the end, don't abort (#1373).
              unknownFlags.push(arg);
            }
            break;
        }
      } else {
        // Non-option argument
        this.args.push(arg);
      }
      i++;
    }

    // Report unknown / unimplemented / deviated flags as non-blocking warnings.
    for (const line of formatFlagDiagnostics({ unknown: unknownFlags, unimplemented: unimplementedFlags, deviated: deviatedFlags })) {
      process.stderr.write(line + '\n');
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

    // Wire -v/--verbose flag
    assembler.verboseModeOn = !!this.options.verbose;

    // Wire --explain flag (#1096)
    assembler.explainModeOn = !!this.options.explain;

    // Wire --show-err-id flag (#1552)
    assembler.showErrIdOn = !!this.options.showErrId;

    // Set input and output file names
    assembler.inputFileName = this.inputFileName;
    assembler.outputFileName = this.outputFileName || this.constructOutputFileName(this.inputFileName);

    // Update this.outputFileName to match assembler's output
    this.outputFileName = assembler.outputFileName;

    // Store the assembler instance
    this.assembler = assembler;

    // Pre-set userName so assembler.main() can use it for object-module report
    // artifacts without calling name.js itself (DDD gap 7, #880).
    assembler.userName = this.userName;

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

    // Wire -v/--verbose flag
    interpreter.verboseModeOn = !!this.options.verbose;

    // Wire -t flag: enable per-step trace output and attach sourceMap when available
    interpreter.traceMode = !!this.options.trace;

    // Wire --sounds-on flag (#1504): enable the gated sound trap in core LCC
    interpreter.soundsOn = !!this.options.soundsOn;

    // Wire --max-steps N flag
    if (this.options.maxSteps !== undefined) {
      interpreter.maxSteps = this.options.maxSteps;
    }
    if (this.assembler && this.assembler.sourceMap) {
      interpreter.sourceMap = this.assembler.sourceMap;
    }

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
