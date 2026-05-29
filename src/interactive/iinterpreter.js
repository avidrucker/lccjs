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
const { h4, REG_ALIASES } = require('../core/debug/format');
const { diffRegisters, diffFlags } = require('../core/debug/stateDelta');

class IInterpreter extends Interpreter {
  constructor() {
    super();

    // Snapshot / time-travel state
    this.snapshot = [];           // Per-instruction state deltas; index 0 = initial state
    this.currentIteration = 0;   // Which snapshot index is currently active (≥ 0)
    this.memoryChange = null;     // Most-recent memory delta; set by initSnapshot() and step()

    // Mode flags (set from CLI options in runInteractive)
    // @todo #134:60m/ARC these mode/display fields + the prompt-command dispatch are an
    //  ad-hoc state machine; research modeling them as a statechart (XState or hand-rolled):
    //  an exec region (running/paused/stepping/awaiting-input/halted) with an orthogonal
    //  display region (stack/mem panes). Keep the per-opcode step() switch out of scope.
    //  Design + plan: docs/research/xstate-iinterpreter.md ; see #134
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
      running: this.running,
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
      running: this.running,
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
    this.running = log.running !== undefined ? log.running : true;
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

    // Shared "what changed" computation (same as the core debugger). When there is
    // no previous snapshot (initial state) nothing is highlighted.
    const changedRegs = prev
      ? new Set(diffRegisters(prev.registers, curr.registers).map((d) => d.i))
      : new Set();
    const changedFlags = prev
      ? diffFlags(prev.flags, curr.flags)
      : { n: false, z: false, c: false, v: false };

    const fmt = (name, idx) => {
      const val = h4(curr.registers[idx]);
      if (changedRegs.has(idx)) {
        return this.colorblindMode
          ? `*${name}: ${val}`
          : `${name}: \x1b[92m${val}\x1b[0m`;
      }
      return `${name}: ${val}`;
    };

    const fmtFlag = (name, flagKey, newVal) => {
      if (changedFlags[flagKey]) {
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

    const nzcv = ['n','z','c','v']
      .map((f) => fmtFlag(f.toUpperCase(), f, curr.flags[f]))
      .join(' ');
    lines.push(`NZCV: ${nzcv}`);

    return lines.join('\n');
  }

  // displayMemory(baseAddr, rows) — render the memory pane.
  // Returns a multi-line string. Each output line shows 8 words:
  //   ADDR: w0 w1 w2 w3 w4 w5 w6 w7
  // All values are zero-padded 4-digit hex. Addresses wrap at 0xFFFF.
  displayMemory(baseAddr, rows) {
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

  // displayCodeSnippet(sourceMap, contextRows)
  //   sourceMap — { addressToLine: Map<number, {lineNumber, sourceLine}>, allLines: string[] }
  //               Built by assembler after pass 2; null when running a pre-assembled .e file.
  //   contextRows — number of lines to show above and below the current PC line (default 3).
  //
  // Returns a formatted string showing source context around the current PC.
  // Lines are 0-indexed in allLines; lineNumber from listing is 1-indexed.
  // The current-PC line is prefixed with "-> "; surrounding lines with "   ".
  displayCodeSnippet(sourceMap, contextRows = 3) {
    if (!sourceMap || !sourceMap.addressToLine || !sourceMap.allLines) {
      return `   [no source — PC: ${this.pc.toString(16).padStart(4, '0')}]\n`;
    }

    const entry = sourceMap.addressToLine.get(this.pc);
    if (!entry) {
      // PC is between code-producing lines (e.g. data word, or past end of program)
      return `   [source unknown — PC: ${this.pc.toString(16).padStart(4, '0')}]\n`;
    }

    const { lineNumber } = entry; // 1-indexed
    const allLines = sourceMap.allLines;
    const totalLines = allLines.length;

    const firstLine = Math.max(0, lineNumber - 1 - contextRows);     // 0-indexed
    const lastLine  = Math.min(totalLines - 1, lineNumber - 1 + contextRows); // 0-indexed

    let output = '';
    for (let i = firstLine; i <= lastLine; i++) {
      const lineNum1 = i + 1; // back to 1-indexed for display
      const marker   = (lineNum1 === lineNumber) ? '->' : '  ';
      const lineStr  = (allLines[i] !== undefined) ? allLines[i] : '';
      output += `${marker} ${String(lineNum1).padStart(4)}: ${lineStr}\n`;
    }
    return output;
  }

  // runInteractive(sourceMap) — main interactive prompt loop.
  // Called after the executable is loaded (loadExecutableBuffer) and
  // this.initialMem is set. Renders state after each command.
  //
  // Commands (entered at "Input: " prompt):
  //   {N}       step forward N instructions
  //   {-N}      step backward N instructions (time-travel)
  //   0         re-display current state without stepping
  //   a{hex}    set memory display base address (e.g. a0010)
  //   m{N}      set memory display row count (e.g. m4)
  //   s{anchor} set stack anchor: register name or hex addr (e.g. ssp, s0ff0)
  //   h         show this help
  //   q         quit
  //
  // sourceMap (optional) — { addressToLine: Map<pc, {lineNumber, sourceLine}>, allLines: string[] }
  // Passed to displayCodeSnippet(), which shows source context around the current PC.
  // null when running a pre-assembled .e file directly (no assembler in session).
  runInteractive(sourceMap) {
    this.initSnapshot();
    this.spInitial = this.r[6];

    const renderDisplay = () => {
      const prevIdx = Math.max(0, this.currentIteration - 1);
      const prev = this.snapshot[prevIdx];
      const curr = this.snapshot[this.currentIteration];
      process.stdout.write(this.displayRegisters(prev, curr) + '\n');
      process.stdout.write(this.displayMemory(this.memDisplayBase, this.memDisplayRows) + '\n');
      process.stdout.write(this.displayStack(this.stackAnchor) + '\n');
      if (sourceMap) {
        process.stdout.write(this.displayCodeSnippet(sourceMap) + '\n');
      }
      if (!this.running) {
        process.stdout.write('--- Program halted. Step back with -N, or quit with q. ---\n');
      }
    };

    renderDisplay();
    process.stdout.write("Enter 'h' for help.\n");

    let lastStep = 1; // remembered across prompts

    while (true) {
      process.stdout.write('Input: ');
      const { inputLine } = this.readLineFromStdin();
      const cmd = inputLine.trim();

      if (cmd === 'q') break;

      if (cmd === 'h') {
        process.stdout.write(this.displayHelp());
        continue;
      }

      if (cmd === '0') {
        renderDisplay();
        continue;
      }

      if (cmd.startsWith('a')) {
        const addr = parseInt(cmd.slice(1), 16);
        if (!isNaN(addr)) this.memDisplayBase = addr & 0xFFFF;
        renderDisplay();
        continue;
      }

      if (cmd.startsWith('m')) {
        const n = parseInt(cmd.slice(1));
        if (!isNaN(n) && n >= 0) this.memDisplayRows = n;
        renderDisplay();
        continue;
      }

      if (cmd.startsWith('s') && cmd.length > 1) {
        this.stackAnchor = cmd.slice(1);
        renderDisplay();
        continue;
      }

      // Numeric step command (may be negative)
      const n = parseInt(cmd, 10);
      if (!isNaN(n)) {
        if (n !== 0) lastStep = n;
        const steps = n;
        if (steps > 0 && !this.running) {
          process.stdout.write('Program has halted. Step back with -N first.\n');
          continue;
        }
        this.handleSteps(steps);
        renderDisplay();
        continue;
      }

      // Empty input: repeat last step count
      if (cmd === '') {
        if (lastStep > 0 && !this.running) {
          process.stdout.write('Program has halted. Step back with -N first.\n');
          continue;
        }
        this.handleSteps(lastStep);
        renderDisplay();
        continue;
      }

      process.stdout.write(`Unknown command: ${cmd}. Enter 'h' for help.\n`);
    }
  }

  // displayHelp() — return the interactive mode help text.
  displayHelp() {
    return [
      'ilcc interactive commands:',
      '  {N}       step forward N instructions',
      '  {-N}      step backward N instructions',
      '  0         re-display without stepping',
      '  <enter>   repeat last step count',
      '  a{hex}    set memory base address (e.g. a0010)',
      '  m{N}      set memory row count    (e.g. m4)',
      '  s{anchor} set stack anchor        (e.g. ssp, sfff2)',
      '  h         show this help',
      '  q         quit',
    ].join('\n') + '\n';
  }
}

module.exports = IInterpreter;
