#!/usr/bin/env node

// interpreterplus.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
// const ansiEscapes = require('ansi-escapes');
const Interpreter = require('../core/interpreter.js');
const { InvalidExecutableFormatError } = require('../utils/errors');

// Shared exit logic (isTestMode throw-vs-exit); wrapped below to add stdin cleanup.
// maybeExplain renders the `--explain` block for an error's explainKey, gated on
// the module-level cliExit flag the lccplus driver flips via setExplainMode (#1102).
const { fatalExit: exitProcess, maybeExplain } = require('../utils/cliExit');
const { TRAP_HALT, TRAP_BP } = require('../core/constants');
const {
  TRAP_CLEAR, TRAP_SLEEP, TRAP_NBAIN, TRAP_CURSOR,
  TRAP_SRAND, TRAP_MILLIS, TRAP_RESETC,
  TRAP_SOUND, TRAP_SOUND_LITERAL_FLAG, TRAP_WHO,
  EOP_RAND,
} = require('./constants');

// Number of interpreter steps executed per setImmediate tick in runAsync().
// Tuned for reasonable UI responsiveness in .ap games; adjust if lag is observed.
const ASYNC_BATCH_SIZE = 500;
const BUNDLED_SOUND_DIR = path.resolve(__dirname, '../../assets/sounds/lccplus');

// Sound slot table — index = sound code used by the `sound` trap.
// Override any slot via its LCCPLUS_SOUND_* env var (absolute path to a
// .wav/.oga/.ogg file). When SOUND_FILES_FROM_SYSTEM=1, the osDefaults
// paths are tried before the bundled fallback; otherwise only the bundled
// WAV is used. See docs/lccplus-isa.md § Sounds.
const SOUND_SLOTS = [
  {
    name: 'ding',
    envVar: 'LCCPLUS_SOUND_DING',
    bundled: path.join(BUNDLED_SOUND_DIR, 'ding.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/complete.oga'],
  },
  {
    name: 'doink',
    envVar: 'LCCPLUS_SOUND_DOINK',
    bundled: path.join(BUNDLED_SOUND_DIR, 'doink.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/bell.oga'],
  },
  {
    name: 'beep',
    envVar: 'LCCPLUS_SOUND_BEEP',
    bundled: path.join(BUNDLED_SOUND_DIR, 'beep.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/phone-outgoing-calling.oga'],
  },
  {
    name: 'ping',
    envVar: 'LCCPLUS_SOUND_PING',
    bundled: path.join(BUNDLED_SOUND_DIR, 'ping.wav'),
    osDefaults: ['/usr/share/sounds/LinuxMint/stereo/system-ready.ogg'],
  },
  {
    name: 'popsound',
    envVar: 'LCCPLUS_SOUND_POPSOUND',
    bundled: path.join(BUNDLED_SOUND_DIR, 'popsound.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/dialog-information.oga'],
  },
  {
    name: 'softbeep',
    envVar: 'LCCPLUS_SOUND_SOFTBEEP',
    bundled: path.join(BUNDLED_SOUND_DIR, 'softbeep.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/dialog-warning.oga'],
  },
  {
    name: 'bop',
    envVar: 'LCCPLUS_SOUND_BOP',
    bundled: path.join(BUNDLED_SOUND_DIR, 'bop.wav'),
    osDefaults: ['/usr/share/sounds/freedesktop/stereo/message.oga'],
  },
];

const SOUND_PLAYERS = [
  { command: 'paplay', args: (filePath) => [filePath] },
  { command: 'canberra-gtk-play', args: (filePath) => ['--file', filePath] },
  { command: 'ffplay', args: (filePath) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', filePath] },
  { command: 'aplay', args: (filePath) => [filePath] },
];

let dotenvLoaded = false;
const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);

function loadDotenvOnce() {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  try {
    require('dotenv').config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
  } catch (_) {
    // dotenv is a local convenience; sound fallbacks still work without it.
  }
}

function soundFilesFromSystem() {
  const value = process.env.SOUND_FILES_FROM_SYSTEM;
  if (value == null) return false;
  return TRUE_ENV_VALUES.has(String(value).trim().toLowerCase());
}

function firstExistingSoundPath(slot) {
  const envPath = process.env[slot.envVar];
  const candidates = (soundFilesFromSystem()
    ? [envPath, ...(slot.osDefaults || []), slot.bundled]
    : [slot.bundled]).filter(Boolean);
  return candidates.find((candidate) => {
    try {
      return fs.existsSync(candidate);
    } catch (_) {
      return false;
    }
  });
}

function playSoundFile(filePath) {
  for (const player of SOUND_PLAYERS) {
    const result = spawnSync(player.command, player.args(filePath), {
      stdio: 'ignore',
      timeout: 5000,
    });
    if (!result.error && result.status === 0) {
      return true;
    }
    if (result.error && result.error.code !== 'ENOENT') {
      continue;
    }
  }
  return false;
}

function resetProcessStdin() {
  // setRawMode is TTY-only; off a TTY there is no raw mode to leave and no
  // terminal cursor to restore (the escape would leak into piped output).
  // This chokepoint is reached via fatalExit/exit-handler/HALT/Ctrl-C.
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(false);
  process.stdin.pause();
  // process.stdout.write(ansiEscapes.cursorShow); // show cursor
  process.stdout.write('\u001B[?25h'); // show cursor
  }

// Restore a screen-manipulated terminal before printing a runtime error, so the
// message isn't clobbered by hidden-cursor / cleared-screen artifacts (#1032).
// Superset of resetProcessStdin: it also drops to a fresh line when the program
// moved or cleared the screen, so the error lands visibly below its output.
// Cursor/screen escapes target stdout, so they're guarded on stdout.isTTY (the
// pattern the `cursor`/`resetc` extras use) — never on stdin — to keep piped
// output clean.
function restoreTerminal(screenManipulated) {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }
  if (process.stdout.isTTY) {
    process.stdout.write('\u001B[?25h'); // show cursor (undo a `cursor` hide)
    if (screenManipulated) {
      // After clear / cursor moves the cursor may sit mid-screen; move to a
      // fresh line so the message prints below the program's output.
      process.stdout.write('\n');
    }
  }
}

function fatalExit(message, code = 1) {
  resetProcessStdin();
  exitProcess(message, code);
}

class InterpreterPlus extends Interpreter {
  constructor() {
    super();
    loadDotenvOnce();
    this.keyQueue = []; // For non-blocking input
    this.nonBlockingInput = true; // Default to non-blocking
    this.seed = 0; // Seed for random number generator
    // .ap programs run indefinitely by design (game loops); disable the
    // maxSteps-based infinite-loop detection inherited from Interpreter.
    this.disableInfiniteLoopDetection = true;
    // Tracks whether the program cleared the screen or moved/hid the cursor, so
    // a runtime error can restore the terminal before printing (#1032).
    this.screenManipulated = false;
  }

  // Register an external extension module's trap handlers.
  // ext.trapHandlers: { [trapVec]: function } — each fn is bound to this instance.
  registerExtension(ext) {
    this._extTrapHandlers = this._extTrapHandlers || {};
    for (const [vec, fn] of Object.entries(ext.trapHandlers || {})) {
      this._extTrapHandlers[Number(vec)] = fn.bind(this);
    }
  }

  main(args) {
    args = args || process.argv.slice(2);

    if (args.length < 1) {
      console.error('Usage: node interpreterplus.js <input filename> [options]');
      fatalExit('Usage: node interpreterplus.js <input filename> [options]', 1);
    }

    // parse args, same as parent
    let i = 0;
    while (i < args.length) {
      let arg = args[i];
      if (arg.startsWith('-')) {
        // same logic for -nostats, etc.
        if (arg.startsWith('-L')) {
          // load point logic
          let loadPointStr = arg.substring(2);
          if (!loadPointStr) {
            i++;
            if (i >= args.length) {
              console.error('Error: -L option requires a value');
              fatalExit('Error: -L option requires a value', 1);
            }
            loadPointStr = args[i];
          }
          this.loadPoint = parseInt(loadPointStr, 16);
          if (isNaN(this.loadPoint)) {
            console.error(`Invalid load point value: ${loadPointStr}`);
            fatalExit(`Invalid load point value: ${loadPointStr}`, 1);
          }
        } else {
          console.error(`Bad command line switch: ${arg}`);
          fatalExit(`Bad command line switch: ${arg}`, 1);
        }
      } else {
        if (!this.inputFileName) {
          this.inputFileName = arg;
        } else {
          console.error(`Unexpected argument: ${arg}`);
          fatalExit(`Unexpected argument: ${arg}`, 1);
        }
      }
      i++;
    }

    if (!this.inputFileName) {
      console.error('No input file specified.');
      fatalExit('No input file specified.', 1);
    }

    // Only allow .ep files
    const extension = path.extname(this.inputFileName).toLowerCase();
    if (extension !== '.ep') {
      console.error('Unsupported file type for LCC+ (expected .ep)');
      fatalExit('Unsupported file type', 1);
    }

    console.log(`Starting interpretation of ${this.inputFileName} (LCC+)`);

    let buffer;
    try {
      buffer = fs.readFileSync(this.inputFileName);
    } catch (err) {
      console.error(`Cannot open input file ${this.inputFileName}`);
      fatalExit(`Cannot open input file ${this.inputFileName}`, 1);
    }

    // check that first two chars are 'o' and 'p'
    if (buffer[0] !== 'o'.charCodeAt(0) || buffer[1] !== 'p'.charCodeAt(0)) {
      console.error(`${this.inputFileName} is not in LCC+ format (missing 'op')`);
      fatalExit('Not an LCC+ .ep file', 1);
    }

    // We don't skip the 'o' and 'p' bytes
    let offset = 0;
    const realBuffer = buffer.slice(offset);

    // Now let parent's loadExecutableBuffer handle from that point on.
    // It raises typed InvalidExecutableFormatError (carrying NOT_LCC_FORMAT /
    // BAD_EXE_HEADER explain keys) on a corrupt header, which throws — route it
    // through the same funnel runtime faults use so `--explain` renders the block
    // here, mirroring the core driver's try/catch at interpreter.js (#1273).
    try {
      this.loadExecutableBuffer(realBuffer, 'p');
    } catch (error) {
      this.handleRuntimeError(error);
    }

    this.initialMem = this.mem.slice(); // copy memory

    // set up input
    // Off a TTY (piped input, redirect, CI), setRawMode does not exist and there
    // is no live keyboard to read. Skip raw-mode + the data listener entirely;
    // the keyQueue then stays empty, so nbain returns 0 ("no key") on every poll
    // (its existing empty-queue branch). Write-only programs run to completion;
    // input-driven programs simply see no keypresses.
    if (this.nonBlockingInput && process.stdin.isTTY) {
      // set up raw mode for non-blocking input
      process.stdin.setRawMode(true);
      process.stdin.setEncoding('utf8');
      process.stdin.resume();

      process.on('exit', () => {
        resetProcessStdin();
      });
  
      // Each "data" event might contain multiple characters if typed quickly
      process.stdin.on('data', (chunk) => {
        for (const char of chunk) {
          if (char === '\u0003') { // Ctrl-C
            resetProcessStdin();
            process.exit(); // Exit the process
          }
          // for the Enter key
          else if (char === '\r' || char === '\n') {
            this.keyQueue.push('\n');
          }

          else {
            // For arrows, ctrl, etc., you'll get escape sequences
            // e.g. '\u001b[A' for arrow-up. For normal keys, char is straightforward.
            this.keyQueue.push(char);
          }
        }
      });
    }

    // run
    try {
      this.startNonBlockingLoop();
    } catch (error) {
      // Belt-and-suspenders: runBatch catches its own throws (below), so this
      // only fires if startNonBlockingLoop throws *before* entering runBatch's
      // try. Route it through the same funnel for one consistent error contract.
      this.handleRuntimeError(error);
    }
  }

  startNonBlockingLoop() {
    this.running = true;

    const runBatch = () => {
      if (!this.running) return;
      // The loop runs across many setImmediate ticks; a throw in any tick but
      // the first would escape main()'s try/catch and become an uncaught
      // exception (Node dumps a raw stack trace). Wrapping the per-tick stepping
      // funnels every batch's errors into one handler. (#1031)
      try {
        for (let i = 0; i < ASYNC_BATCH_SIZE; i++) {
          if (!this.running) break;
          this.step();
        }
      } catch (error) {
        this.handleRuntimeError(error);
        return; // do not schedule another tick after a fatal runtime error
      }
      setImmediate(runBatch);
    };

    runBatch();
  }

  // Single funnel for runtime errors thrown anywhere in the async run loop,
  // regardless of which setImmediate batch raised them. Mirrors the core
  // toolchain contract (lcc.js): print "Runtime Error: <msg>" and exit 1, so a
  // runtime fault in an .ap is surfaced as reliably as in a plain .a/.e run.
  // (#1031 — capture; #1032 — restore the terminal before printing.)
  // Verbose branch mirrors core Interpreter.raiseRuntimeError() (#1078, req 4 of #1011).
  handleRuntimeError(error) {
    this.running = false;
    // Restore screen-manipulated state first (show cursor, leave raw mode, drop
    // to a fresh line) so the message isn't clobbered by a hidden cursor or a
    // cleared/repositioned screen the program left behind (#1032).
    restoreTerminal(this.screenManipulated);

    const message = `Runtime Error: ${error && error.message ? error.message : error}`;

    // Verbose enrichment: mirror core Interpreter.raiseRuntimeError() verbose output.
    // Shows PC, register dump, and source line from sourceMap if available.
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

    console.error(message);
    // The inherited runtime errors (DIV_BY_ZERO, UNKNOWN_OPCODE, EOF_ON_STDIN, …)
    // carry an explainKey; render its `--explain` block before exiting so .ap
    // runtime faults are explained just like core .e runs (#1102, mirrors the
    // core interpreter's cliErrorExit(..., explainKey) funnel).
    maybeExplain(error && error.explainKey);
    fatalExit(message, 1);
  }

  // extracts header entries and loads machine code into memory.
  // File-format/header faults raise typed InvalidExecutableFormatError carrying the
  // same NOT_LCC_FORMAT / BAD_EXE_HEADER explain keys the core load path uses
  // (interpreter.js loadExecutableBuffer), so `--explain` renders a block here too.
  // raiseRuntimeError throws; the caller (main) catches and funnels through
  // handleRuntimeError (#1273).
  loadExecutableBuffer(buffer, secondIntroHeader = '') {
    let offset = 0;

    // Read file signature
    if (buffer[offset++] !== 'o'.charCodeAt(0)) {
      this.raiseRuntimeError(new InvalidExecutableFormatError('Invalid file signature: missing "o"', { explainKey: 'NOT_LCC_FORMAT' }));
    }

    if (secondIntroHeader !== '' && buffer[offset++] !== 'p'.charCodeAt(0)) {
      this.raiseRuntimeError(new InvalidExecutableFormatError('Invalid file signature: missing "p"', { explainKey: 'NOT_LCC_FORMAT' }));
    }

    // Do not store the 'o' or 'p' signatures in headerLines

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

    // for debugging purposes
    // console.log(`All instructions: ${this.loadPoint.toString(16).padStart(4, '0')} - ${this.memMax.toString(16).padStart(4, '0')}`);
    // for (let i = this.loadPoint; i <= this.memMax; i++) {
    //   console.log(`${i.toString(16).padStart(4, '0')}: ${this.mem[i].toString(16).padStart(4, '0')}`);
    // }

    // Set PC to loadPoint + startAddress
    this.pc = (this.loadPoint + startAddress) & 0xFFFF;
  }

  // Next we must override executeTRAP to handle the LCC+ extension traps.
  // LCC+ trap vectors occupy the HIGH end of the 8-bit space (0xF9–0xFF) so
  // they cannot alias future core traps that grow upward from 0x0F.
  executeTRAP() {
    if (this._extTrapHandlers && this._extTrapHandlers[this.trapvec]) {
      return this._extTrapHandlers[this.trapvec]();
    }
    switch (this.trapvec) {
      // Keep parent's existing trap handling
      // but we add back the ones we removed from parent:
      case TRAP_HALT: // HALT
        this.running = false;
        // turn off raw mode for non-blocking input
        resetProcessStdin();
        break;
      case TRAP_BP: // bp breakpoint
        this.executeLccPlusBreakpoint();
        break;
      case TRAP_CLEAR: // clear
        this.executeClear();
        break;
      case TRAP_SLEEP: // sleep
        this.executeSleep();
        break;
      case TRAP_NBAIN: // nbain
        this.executeNonBlockingAsciiInput();
        break;
      case TRAP_CURSOR: // cursor
        this.executeToggleCursor();
        break;
      case TRAP_SRAND: // srand
        this.executeSrand();
        break;
      case TRAP_MILLIS: // millis
        this.executeMillis();
        break;
      case TRAP_RESETC: // resetc
        this.executeResetCursor();
        break;
      case TRAP_SOUND: // sound r0..r4
        this.executeSound();
        break;
      case TRAP_WHO: // who / whodis
        this.executeWho();
        break;
      default:
        // If it's not a known LCC+ trap, call parent's method
        super.executeTRAP();
    }
  }

  executeLccPlusBreakpoint() {
    if (!process.stdin.isTTY) {
      process.stderr.write('lcc+: breakpoint hit off-TTY — interactive terminal required; exiting.\n');
      fatalExit('breakpoint hit off-TTY', 1);
      return;
    }
    this.running = false;
    process.stdin.once('data', () => {
      this.running = true;
      this.startNonBlockingLoop();
    });
  }

  executeCase10() {
    switch (this.eopcode) {
      case EOP_RAND: // rand
        this.executeRand();
        break;
      default:
        // If it's not EOP_RAND, call parent's method
        super.executeCase10();
    }
  }

  // We re-add the actual methods:
  executeClear() {
    console.clear();
    this.screenManipulated = true; // so a later runtime error restores first (#1032)
  }

  executeSleep() {
    const milliseconds = this.r[this.sr];
    // Stop the stepping, resume after setTimeout
    this.running = false;
    setTimeout(() => {
      if (!this.running) {
        this.running = true;
        this.startNonBlockingLoop();
      }
    }, milliseconds);
  }  

  executeNonBlockingAsciiInput() {
    // If the queue has data, pop the oldest key,
    // otherwise return 0 (or -1) to signify "no key"
    if (this.keyQueue.length > 0) {
      const nextKey = this.keyQueue.shift();
      // We'll store the ASCII code in register DR
      this.r[this.dr] = nextKey.charCodeAt(0);
    } else {
      // No key in queue
      this.r[this.dr] = 0; 
    }
  }

  executeToggleCursor() {
    // by default, in the beginning of all programs, the cursor is visible
    // if the passed in register is 0, hide the cursor
    // if the passed in register is non-zero, show the cursor
    if (!process.stdout.isTTY) return; // escape targets stdout — guard on stdout, not stdin
    if (this.r[this.dr] === 0) {
      process.stdout.write('\u001B[?25l');
      this.screenManipulated = true; // hidden cursor must be restored on error (#1032)
      //process.stdout.write(ansiEscapes.cursorHide); // hide cursor
    } else {
      process.stdout.write('\u001B[?25h'); // show cursor
      // process.stdout.write(ansiEscapes.cursorShow); // show cursor
    }
  }

  executeSrand() {
    // seed the random number generator
    // with the value in the passed in source register
    this.seed = this.r[this.sr];
  }

  executeRand() {
    // Linear Congruential Generator (LCG) constants
    const a = 48271;    // Multiplier (commonly used LCG constant)
    const c = 10139;    // Increment (another standard value)
    const m = 0x10000;  // Modulus (2^16 for 16-bit)

    // Update seed using LCG formula, then apply three xorshift mixing steps
    this.seed = (a * this.seed + c) % m;
    this.seed ^= (this.seed << 13) & 0xFFFF;  // XOR shift left by 13
    this.seed ^= (this.seed >> 17) & 0xFFFF;  // XOR shift right by 17
    this.seed ^= (this.seed << 5) & 0xFFFF;   // XOR shift left by 5
    // console.log("new seed: " + this.seed);
    let range;
    if (this.r[this.dr] <= this.r[this.sr1]) {
      range = this.r[this.sr1] - this.r[this.dr] + 1;
      this.r[this.dr] = (this.seed % range) + this.r[this.dr];
    } else {
      range = this.r[this.dr] - this.r[this.sr1] + 1;
      this.r[this.dr] = (this.seed % range) + this.r[this.sr1];
    }
  }

  // returns just the current milliseconds of the system clock
  executeMillis() {
    this.r[this.dr] = Date.now() % 1000;
  }

  executeResetCursor() {
    if (!process.stdout.isTTY) return; // escape targets stdout — guard on stdout, not stdin
    process.stdout.write('\u001B[H'); // move cursor to home
    this.screenManipulated = true; // cursor moved — restore before an error print (#1032)
  }

  executeSound() {
    const slotIndex = (this.ir & TRAP_SOUND_LITERAL_FLAG) ? this.sr : this.r[this.sr];
    const slot = SOUND_SLOTS[slotIndex];
    if (!slot) {
      process.stdout.write('\x07');
      return;
    }

    const filePath = firstExistingSoundPath(slot);
    if (filePath && this.playSoundFile(filePath)) {
      return;
    }
    process.stdout.write('\x07');
  }

  playSoundFile(filePath) {
    return playSoundFile(filePath);
  }

  executeWho() {
    try {
      const name = fs.readFileSync('name.nnn', 'utf8').trim();
      process.stdout.write(name);
    } catch (_) {
      // name.nnn absent
    }
  }
}

// If run directly
if (require.main === module) {
  const interpPlus = new InterpreterPlus();
  interpPlus.generateStats = false; // default to no stats
  interpPlus.main();
}

module.exports = InterpreterPlus;
module.exports.SOUND_SLOTS = SOUND_SLOTS;
