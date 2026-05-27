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

  // handleSteps(N) — step forward N instructions (N > 0) or backward N (N < 0); N=0 is a no-op.
  //
  // Forward: calls step() N times while this.running; each call advances currentIteration
  //   and appends/overwrites snapshot at currentIteration+1.
  //
  // Backward: restores state from snapshot[currentIteration - |N|] (clamped to 0).
  //   Uses restorePrevState() which replays memory deltas in reverse without touching
  //   the snapshot array, so a subsequent forward step can overwrite cleanly.
  //
  // Efficient mode: backward stepping is disabled (snapshot only has 1-2 entries);
  //   a negative stepNumber is ignored silently.
  handleSteps(stepNumber) {
    if (stepNumber === 0) return; // re-display without stepping

    if (stepNumber > 0) {
      for (let i = 0; i < stepNumber && this.running; i++) {
        this.step();
      }
    } else {
      if (this.efficientMode) return; // backward not supported in efficient mode
      const newIteration = Math.max(this.currentIteration + stepNumber, 0);
      this.restorePrevState(newIteration);
      this.currentIteration = newIteration;
    }
  }

  // restorePrevState(targetIteration) — restore CPU and memory to the state recorded
  // in snapshot[targetIteration].
  //
  // CPU (pc, flags, registers) is read directly from the snapshot entry.
  // Memory is restored by replaying memory deltas in reverse: for each step from
  // currentIteration down to targetIteration+1, undo the memory write if hasChanged.
  // We stop at targetIteration+1 (not targetIteration) because the delta recorded in
  // snapshot[N] was the write that PRODUCED state N; it should remain applied.
  restorePrevState(targetIteration) {
    const log = this.snapshot[targetIteration];

    // Restore CPU
    this.pc = log.pc;
    this.c = log.flags.c;
    this.v = log.flags.v;
    this.n = log.flags.n;
    this.z = log.flags.z;
    for (let i = 0; i < 8; i++) this.r[i] = log.registers[i];

    // Restore memory by undoing writes from currentIteration down to targetIteration+1
    for (let i = this.currentIteration; i > targetIteration; i--) {
      if (this.snapshot[i] && this.snapshot[i].memory.hasChanged) {
        this.restorePrevMemory(i);
      }
    }
  }

  // restorePrevMemory(state) — undo the memory write recorded in snapshot[state]
  // by writing snapshot[state].memory.old back into this.mem.
  restorePrevMemory(state) {
    const delta = this.snapshot[state].memory;
    if (delta.address != null) {
      for (let i = 0; i < delta.old.length; i++) {
        this.mem[delta.address + i] = delta.old[i];
      }
    }
  }

  // displayRegisters(prevSnapshot, currSnapshot) — render the register pane.
  // Returns a multi-line string.
  //
  // Format (one line per row):
  //   r0: XXXX  r1: XXXX  r2: XXXX  r3: XXXX
  //   r4: XXXX  fp: XXXX  sp: XXXX  lr: XXXX
  //   pc: XXXX  ir: XXXX
  //   NZCV: NZCV
  //
  // Changed registers are highlighted: ANSI green in normal mode;
  // '*' prefix in colorblind mode (-c).
  displayRegisters(prevSnapshot, currSnapshot) {
    const prev = prevSnapshot;
    const curr = currSnapshot;
    const h4 = (v) => (v & 0xFFFF).toString(16).padStart(4, '0');

    const fmt = (name, idx) => {
      const val = h4(curr.registers[idx]);
      if (prev && prev.registers[idx] !== curr.registers[idx]) {
        return this.colorblindMode
          ? `*${name}: ${val}`
          : `${name}: \x1b[92m${val}\x1b[0m`;
      }
      return `${name}: ${val}`;
    };

    const fmtFlag = (name, oldVal, newVal) => {
      if (prev && oldVal !== newVal) {
        return this.colorblindMode
          ? `*${name}:${newVal}`
          : `${name}:\x1b[92m${newVal}\x1b[0m`;
      }
      return `${name}:${newVal}`;
    };

    const lines = [
      `${fmt('r0',0)}  ${fmt('r1',1)}  ${fmt('r2',2)}  ${fmt('r3',3)}`,
      `${fmt('r4',4)}  ${fmt('fp',5)}  ${fmt('sp',6)}  ${fmt('lr',7)}`,
      `pc: ${h4(curr.pc)}  ir: ${h4(curr.ir)}`,
    ];

    const prevFlags = prev ? prev.flags : curr.flags;
    const nzcv = ['n','z','c','v']
      .map((f) => fmtFlag(f.toUpperCase(), prevFlags[f], curr.flags[f]))
      .join(' ');
    lines.push(`NZCV: ${nzcv}`);

    return lines.join('\n');
  }

  // displayMemory(baseAddr, rows) — render the memory pane.
  // Returns a multi-line string. Each output line shows 8 words:
  //   ADDR: w0 w1 w2 w3 w4 w5 w6 w7
  // All values are zero-padded 4-digit hex. Addresses wrap at 0xFFFF.
  displayMemory(baseAddr, rows) {
    const h4 = (v) => (v & 0xFFFF).toString(16).padStart(4, '0');
    let output = '';
    for (let row = 0; row < rows; row++) {
      const rowAddr = baseAddr + row * 8;
      if (rowAddr > 0xFFFF) break;
      const words = [];
      for (let col = 0; col < 8; col++) {
        const addr = rowAddr + col;
        if (addr > 0xFFFF) break;
        words.push(h4(this.mem[addr]));
      }
      output += `${h4(rowAddr)}: ${words.join(' ')}\n`;
    }
    return output;
  }

  // displayStack(anchor) — render the stack pane showing 8 words around the anchor.
  // anchor may be: a register name ('sp', 'fp', 'r0'–'r7') or a hex string ('fff2').
  // The current SP position is marked with '>'.
  // Returns a multi-line string.
  displayStack(anchor) {
    const h4 = (v) => (v & 0xFFFF).toString(16).padStart(4, '0');
    const REG_ALIASES = { r0:0, r1:1, r2:2, r3:3, r4:4, fp:5, r5:5, sp:6, r6:6, lr:7, r7:7 };

    let baseAddr;
    if (typeof anchor === 'number') {
      baseAddr = anchor & 0xFFFF;
    } else if (Object.prototype.hasOwnProperty.call(REG_ALIASES, anchor)) {
      baseAddr = this.r[REG_ALIASES[anchor]] & 0xFFFF;
    } else {
      baseAddr = parseInt(anchor, 16) & 0xFFFF;
    }

    const sp = this.r[6] & 0xFFFF;
    const DISPLAY_ROWS = 8;
    const startAddr = Math.max(0, baseAddr - Math.floor(DISPLAY_ROWS / 2));
    let output = `Stack @ ${anchor} (${h4(baseAddr)}):\n`;
    for (let i = 0; i < DISPLAY_ROWS; i++) {
      const addr = startAddr + i;
      if (addr > 0xFFFF) break;
      const val = h4(this.mem[addr]);
      const marker = addr === sp ? '>' : ' ';
      const label = addr === sp ? '  <- sp' : '';
      output += `${marker} ${h4(addr)}: ${val}${label}\n`;
    }
    return output;
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
