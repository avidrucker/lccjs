// iinterpreter.js — Interactive stepping debugger extending lccjs's core Interpreter
// Enables forward/backward step-through execution with time-travel via snapshot log.
//
// Architecture:
//   class IInterpreter extends Interpreter
//   - this.snapshot[]: per-instruction state delta (registers, flags, pc, ir, memory change)
//   - this.currentIteration: which snapshot index is current (0 = initial state)
//   - Efficient mode (-e): disables snapshots for long-running programs (forward-only)
//
// Entry point: src/interactive/ilcc.js (see @todo #88)
// Reference:   ItBeCharlie/interactive_lccjs/src/interactive/iinterpreter.js (~2405 lines)

'use strict';

const Interpreter = require('../core/interpreter');

class IInterpreter extends Interpreter {
  constructor() {
    super();

    // Snapshot / time-travel state
    this.snapshot = [];           // Per-instruction state deltas; index 0 = initial state
    this.currentIteration = 0;   // Which snapshot index is currently active (≥ 0)
    this.memoryChange = null;     // Most-recent memory delta; set by initSnapshot() and step()

    // Mode flags (set from CLI options in runInteractive)
    this.efficientMode = false;   // -e: disable snapshot logging (forward-only, lower memory)
    this.colorblindMode = false;  // -c: alternate ANSI color palette

    // Display configuration — mutable at runtime via prompt commands
    this.memDisplayBase = 0;      // a{hex}: base address for the memory pane
    this.memDisplayRows = 2;      // m{int}: number of rows (8 words each) in the memory pane
    this.stackAnchor = 'sp';      // s{hex|register}: anchor for the stack pane
  }

  // initSnapshot() — capture the pre-execution initial machine state as snapshot[0].
  // Must be called AFTER loadExecutableBuffer() and this.initialMem = this.mem.slice()
  // so that this.loadPoint, this.memMax, this.pc, this.r, this.initialMem are all set.
  // Analogous to Charlie's initializeLog() in interactive_lccjs/src/interactive/iinterpreter.js.
  initSnapshot() {
    this.snapshot = [];
    this.currentIteration = 0;
    this.memoryChange = {
      hasChanged: false,
      address: this.loadPoint,
      old: Array(this.memMax + 1 - this.loadPoint).fill(0),
      new: Array.from(this.initialMem.slice(this.loadPoint, this.memMax + 1)),
    };
    const logEntry = {
      pc: this.pc,
      ir: 0,
      registers: Array.from(this.r),
      flags: { c: this.c, v: this.v, n: this.n, z: this.z },
      memory: this.memoryChange,
    };
    this.snapshot.push(logEntry);
  }

  // step() — execute one instruction and record a state delta in snapshot[].
  // Overrides Interpreter.step() to add snapshot logging.
  //
  // Memory-change detection: scans loadPoint..memMax before and after execution
  // to find the first word that changed. Covers ST/STR/LD-style writes within
  // the loaded program region; stack writes (outside memMax) are not tracked here.
  //
  // Snapshot indexing:
  //   - snapshot[0] = initial state (from initSnapshot())
  //   - snapshot[N] = state after step N
  //   - currentIteration tracks which snapshot index is the current position
  //   - In efficient mode: only the two most-recent entries are kept
  step() {
    // 1. Capture pre-step state
    const preRegs = Array.from(this.r);
    const preFlags = { c: this.c, v: this.v, n: this.n, z: this.z };
    const loadPt = this.loadPoint;
    const scanMax = this.memMax;
    const preMem = this.mem.slice(loadPt, scanMax + 1);

    // 2. Reset memory-change tracking for this instruction
    this.memoryChange = {
      hasChanged: false,
      address: null,
      old: null,
      new: null,
    };

    // 3. Execute the instruction
    super.step();

    // 4. Detect first changed address in the loaded program region
    for (let i = 0; i < preMem.length; i++) {
      if (this.mem[loadPt + i] !== preMem[i]) {
        this.memoryChange.hasChanged = true;
        this.memoryChange.address = loadPt + i;
        this.memoryChange.old = [preMem[i]];
        this.memoryChange.new = [this.mem[loadPt + i]];
        break;
      }
    }

    // 5. Build the log entry for this step
    const logEntry = {
      pc: this.pc,
      ir: this.ir,
      registers: Array.from(this.r),
      flags: { c: this.c, v: this.v, n: this.n, z: this.z },
      memory: { ...this.memoryChange },
    };

    // 6. Append / overwrite snapshot at the next position
    const nextIdx = this.currentIteration + 1;
    if (!this.efficientMode) {
      if (nextIdx >= this.snapshot.length) {
        this.snapshot.push(logEntry);
      } else {
        // Re-stepping already-snapshotted territory (after backward step + re-forward)
        this.snapshot[nextIdx] = logEntry;
      }
    } else {
      // Efficient mode: keep only the two most-recent entries (prev + current)
      if (this.snapshot.length < 2) {
        this.snapshot.push(logEntry);
      } else {
        this.snapshot[0] = this.snapshot[1];
        this.snapshot[1] = logEntry;
      }
    }
    this.currentIteration = nextIdx;
  }

  // @todo #96:60m/DEV Implement handleSteps(N): forward N via step(); backward N via restoreFromTo() using snapshot deltas (OB-039)
  handleSteps(stepNumber) {
    throw new Error('OB-039 not yet implemented — see @todo #96');
  }

  // @todo #98:30m/DEV Implement displayRegisters(prevSnapshot, currSnapshot): show all 8 registers + flags; highlight changed values (OB-040)
  displayRegisters(prevSnapshot, currSnapshot) {
    throw new Error('OB-040 not yet implemented — see @todo #98');
  }

  // @todo #89:30m/DEV Implement displayMemory(baseAddr, rows): show rows×8 memory words as 'ADDR: w0 w1 ... w7'; highlight PC row (OB-041)
  displayMemory(baseAddr, rows) {
    throw new Error('OB-041 not yet implemented — see @todo #89');
  }

  // @todo #92:30m/DEV Implement displayStack(anchor): show N words around anchor (hex addr or register name); mark SP position (OB-042)
  displayStack(anchor) {
    throw new Error('OB-042 not yet implemented — see @todo #92');
  }

  // @todo #95:60m/DEV Implement displayCodeSnippet(sourceMap, contextRows): show current PC + N lines of context from sourceMap (OB-043)
  // BLOCKED by #77 (PC→source-line map must be built by assembler pass 2 and passed in)
  displayCodeSnippet(sourceMap, contextRows) {
    throw new Error('OB-043 not yet implemented (blocked by #77) — see @todo #95');
  }

  // @todo #97:45m/DEV Implement runInteractive(sourceMap): prompt loop — renderDisplay, read command, dispatch handleSteps/config/quit (OB-044)
  runInteractive(sourceMap) {
    throw new Error('OB-044 not yet implemented — see @todo #97');
  }
}

module.exports = IInterpreter;
