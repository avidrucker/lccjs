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
const { suggestClosest } = require('../utils/suggest');

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

    // Label → address map from the assembler, wired in by ilcc.js when a source
    // file was assembled this session. null when a .e was loaded directly
    // (no assembler ran, so no symbols are available). Used by the a{label}
    // memory command to resolve labels to addresses. (#1041)
    this.symbolTable = null;

    // Pane layout — l{layout} command; up to 3 columns separated by /
    // Pane chars: r=registers, c=code snippet, m=memory, o=output
    this.paneLayout = { column0: 'ro', column1: 'mc', column2: '' };

    // Number of context rows (above + below current PC) shown in the code pane.
    // c{N} sets this at runtime; c0 hides the pane (matches Charlie's convention).
    this.codeContextRows = 5;

    // Program output buffer — captures aout/dout/sout etc. for the 'o' pane
    // Populated via writeOutput() override; does NOT go to stdout during interactive mode
    this.programOutput = '';
  }

  // writeOutput(message) — override Interpreter's stdout+buffer write.
  // In interactive mode all program I/O goes here instead of stdout so it
  // appears in the Output pane on the next render rather than polluting the UI.
  writeOutput(message) {
    this.programOutput += message;
    this.output += message;
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

  // ─── Box rendering helpers ────────────────────────────────────────────────
  // All pane lines are exactly 48 visible characters wide so columns can be
  // placed side-by-side without misalignment.

  // _boxTop(title) — 48-char box-drawing top border with centred title.
  _boxTop(title) {
    const label = `┤ ${title} ├`;
    const inner = 46; // chars between ┌ and ┐
    const dashes = inner - label.length;
    const left = Math.floor(dashes / 2);
    const right = dashes - left;
    return `┌${'─'.repeat(left)}${label}${'─'.repeat(right)}┐`;
  }

  // _boxBottom() — 48-char box-drawing bottom border.
  _boxBottom() {
    return `└${'─'.repeat(46)}┘`;
  }

  // _visibleLen(str) — string length ignoring ANSI escape sequences.
  _visibleLen(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '').length;
  }

  // _boxLine(content) — wrap content in a 48-char │ ... │ box line.
  // Pads based on visible length so ANSI-colored content aligns correctly.
  _boxLine(content) {
    const vis = this._visibleLen(content);
    const pad = Math.max(0, 44 - vis);
    return `│ ${content}${' '.repeat(pad)} │`;
  }

  // ─── Pane rendering methods (each returns string[]) ───────────────────────

  // registerPane — registers + stack in a 48-char box.
  registerPane(prevSnap, currSnap) {
    const text = this.displayRegisters(prevSnap, currSnap) + '\n' +
                 this.displayStack(this.stackAnchor);
    const lines = text.split('\n').filter((l) => l !== '');
    return [this._boxTop('Registers'), ...lines.map((l) => this._boxLine(l)), this._boxBottom()];
  }

  // codePane — source snippet in a 48-char box.
  // Returns [] when sourceMap is null or codeContextRows is 0 (pane hidden).
  codePane(sourceMap) {
    if (!sourceMap || this.codeContextRows === 0) return [];
    const text = this.displayCodeSnippet(sourceMap, this.codeContextRows);
    const lines = text.split('\n').filter((l) => l !== '');
    return [this._boxTop('Code Snippet'), ...lines.map((l) => this._boxLine(l)), this._boxBottom()];
  }

  // memoryPane — memory display in a 48-char box.
  memoryPane() {
    const text = this.displayMemory(this.memDisplayBase, this.memDisplayRows);
    const lines = text.split('\n').filter((l) => l !== '');
    return [this._boxTop('Memory'), ...lines.map((l) => this._boxLine(l)), this._boxBottom()];
  }

  // outputPane — program I/O buffer in a 48-char box.
  outputPane() {
    const raw = this.programOutput || '';
    const lines = raw.split('\n');
    // Drop a trailing empty string from split so we don't show a blank final row
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    return [
      this._boxTop('Output'),
      ...lines.map((l) => this._boxLine(l.replace(/\r/g, ''))),
      this._boxBottom(),
    ];
  }

  // paneLines(paneId, prevSnap, currSnap, sourceMap) — dispatch to the right pane method.
  paneLines(paneId, prevSnap, currSnap, sourceMap) {
    switch (paneId) {
      case 'r': return this.registerPane(prevSnap, currSnap);
      case 'c': return this.codePane(sourceMap);
      case 'm': return this.memoryPane();
      case 'o': return this.outputPane();
      default:  return [];
    }
  }

  // ─── Multi-column display ─────────────────────────────────────────────────

  // displayInteractiveMode — assemble pane columns from this.paneLayout and
  // write them to stdout side-by-side (48 chars per column).
  // Returns the number of lines written (for clearLines before the next render).
  displayInteractiveMode(prevSnap, currSnap, sourceMap) {
    const BLANK = ' '.repeat(48);
    const columns = [[], [], []];

    for (let i = 0; i < 3; i++) {
      const tokens = this.paneLayout[`column${i}`] || '';
      for (const ch of tokens) {
        columns[i].push(...this.paneLines(ch, prevSnap, currSnap, sourceMap));
      }
    }

    const height = Math.max(columns[0].length, columns[1].length, columns[2].length);
    let out = '\n';
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < 3; col++) {
        if (columns[col][row] !== undefined) {
          out += columns[col][row];
        } else if (columns[col].length > 0) {
          out += BLANK;
        }
      }
      out += '\n';
    }

    process.stdout.write(out);
    return (out.match(/\n/g) || []).length + 1; // +1 for console.log trailing newline
  }

  // handlePaneLayout(inputLine) — parse an l-command argument like "ro/mc" or "r/c/mo".
  // Returns { error: string, paneLayout: { column0, column1, column2 } }.
  handlePaneLayout(inputLine) {
    const result = { error: '', paneLayout: { column0: '', column1: '', column2: '' } };
    const parts = inputLine.split('/');
    if (parts.length > 3) {
      result.error = 'Layout supports at most 3 columns (separated by /).';
      return result;
    }
    for (let i = 0; i < parts.length; i++) {
      for (const ch of parts[i]) {
        if (!'rcmo'.includes(ch)) {
          result.error = `'${ch}' is not a valid pane identifier. Use r, c, m, or o.`;
          return result;
        }
        result.paneLayout[`column${i}`] += ch;
      }
    }
    return result;
  }

  // clearLines(n) — move cursor up n lines then clear to end of screen.
  clearLines(n) {
    if (n > 0) {
      process.stdout.write(`\x1b[${n}A`);
      process.stdout.write('\x1b[0J');
    }
  }

  // _readCommand() — read one interactive command line, consuming the trailing '\n'
  // that readLineFromStdin() deliberately leaves in inputBuffer for ain parity.
  // Program I/O traps (din/hin) need that '\n' so ain can read it; the interactive
  // prompt has no ain reads between commands, so we strip it here instead.
  _readCommand() {
    const result = this.readLineFromStdin();
    if (this.inputBuffer && this.inputBuffer[0] === '\n') {
      this.inputBuffer = this.inputBuffer.slice(1);
    }
    return result;
  }

  // runInteractive(sourceMap) — main interactive prompt loop.
  //
  // Commands (entered at "Input: " prompt):
  //   {N}         step forward N instructions
  //   {-N}        step backward N instructions (time-travel)
  //   0           re-display current state without stepping
  //   <enter>     repeat last step count
  //   a{hex}      set memory display base address  (e.g. a0010)
  //   m{N}        set memory display row count     (e.g. m4)
  //   c{N}        set code snippet context rows    (e.g. c5; c0 hides pane)
  //   s{anchor}   set stack anchor: register name or hex addr (e.g. ssp, s0ff0)
  //   l{layout}   set pane layout (e.g. lro/mc, lr/c/mo)
  //   h           show help
  //   q           quit
  //
  // sourceMap (optional) — { addressToLine: Map<pc, {lineNumber, sourceLine}>, allLines: string[] }
  // Passed to displayCodeSnippet(), which shows source context around the current PC.
  // null when running a pre-assembled .e file directly (no assembler in session).
  runInteractive(sourceMap) {
    this.initSnapshot();
    this.spInitial = this.r[6];

    let newlineCount = 0;

    const render = () => {
      const prevIdx = Math.max(0, this.currentIteration - 1);
      const prev = this.snapshot[prevIdx];
      const curr = this.snapshot[this.currentIteration];
      this.clearLines(newlineCount);
      newlineCount = this.displayInteractiveMode(prev, curr, sourceMap);
      if (!this.running) {
        process.stdout.write('--- Program halted. Step back with -N, or quit with q. ---\n');
        newlineCount++;
      }
    };

    render();
    process.stdout.write("Enter 'h' for help.\n");
    newlineCount++;

    let lastStep = 1;

    while (true) {
      process.stdout.write('Input: ');
      const { inputLine } = this._readCommand();
      const cmd = inputLine.trim();

      if (cmd === 'q') break;

      if (cmd === 'h') {
        process.stdout.write(this.displayHelp());
        newlineCount = 0; // help text scrolled; don't try to clear it on the next render
        continue;
      }

      if (cmd === '0') {
        render();
        continue;
      }

      if (cmd.startsWith('a')) {
        const { address, error } = this.resolveMemAddress(cmd.slice(1).trim());
        if (error) {
          process.stdout.write(error + '\n');
          newlineCount++;
          continue;
        }
        if (address !== null) this.memDisplayBase = address;
        render();
        continue;
      }

      if (cmd.startsWith('m')) {
        const n = parseInt(cmd.slice(1));
        if (!isNaN(n) && n >= 0) this.memDisplayRows = n;
        render();
        continue;
      }

      if (cmd.startsWith('s') && cmd.length > 1) {
        this.stackAnchor = cmd.slice(1);
        render();
        continue;
      }

      if (cmd.startsWith('c')) {
        const arg = cmd.slice(1);
        if (arg === '') {
          this.codeContextRows = 0;
        } else {
          const n = parseInt(arg, 10);
          if (!isNaN(n) && n >= 0) {
            this.codeContextRows = n;
          } else {
            process.stdout.write('Error: c{N} expects a non-negative integer (e.g. c5, c0).\n');
            newlineCount++;
            continue;
          }
        }
        render();
        continue;
      }

      if (cmd.startsWith('l')) {
        const result = this.handlePaneLayout(cmd.slice(1));
        if (result.error) {
          process.stdout.write(`Error: ${result.error}\n`);
          newlineCount++;
        } else {
          this.paneLayout = result.paneLayout;
          render();
        }
        continue;
      }

      // Numeric step command (may be negative)
      const n = parseInt(cmd, 10);
      if (!isNaN(n)) {
        if (n !== 0) lastStep = n;
        if (n > 0 && !this.running) {
          process.stdout.write('Program has halted. Step back with -N first.\n');
          newlineCount++;
          continue;
        }
        this.handleSteps(n);
        render();
        continue;
      }

      // Empty input: repeat last step count
      if (cmd === '') {
        if (lastStep > 0 && !this.running) {
          process.stdout.write('Program has halted. Step back with -N first.\n');
          newlineCount++;
          continue;
        }
        this.handleSteps(lastStep);
        render();
        continue;
      }

      process.stdout.write(`Unknown command: ${cmd}. Enter 'h' for help.\n`);
      newlineCount++;
    }
  }

  // resolveMemAddress(arg) — resolve the a{...} memory command argument to a
  // base address. Accepts either a symbol-table label or a hex address. (#1041)
  //   - empty arg          → { address: null, error: null }  (no-op redisplay)
  //   - known label        → { address, error: null }        (symbol table wins)
  //   - hex string         → { address, error: null }
  //   - unknown non-hex    → { address: null, error: '...' }  (with "did you mean?")
  // A defined label takes precedence over a hex reading of the same token, so a
  // label literally named e.g. "face" resolves to its address, not 0xface.
  resolveMemAddress(arg) {
    if (!arg) return { address: null, error: null };

    const table = this.symbolTable;
    if (table && Object.prototype.hasOwnProperty.call(table, arg)) {
      return { address: table[arg] & 0xFFFF, error: null };
    }

    const n = parseInt(arg, 16);
    if (!isNaN(n)) {
      return { address: n & 0xFFFF, error: null };
    }

    let msg = `Error: '${arg}' is not a known label or hex address.`;
    if (table) {
      const suggestion = suggestClosest(arg, Object.keys(table));
      if (suggestion) msg += ` Did you mean '${suggestion}'?`;
    }
    return { address: null, error: msg };
  }

  // displayHelp() — return the interactive mode help text.
  displayHelp() {
    return [
      'ilcc interactive commands:',
      '  {N}         step forward N instructions',
      '  {-N}        step backward N instructions',
      '  0           re-display without stepping',
      '  <enter>     repeat last step count',
      '  a{hex|label} set memory base address  (e.g. a0010, amyData)',
      '  m{N}        set memory row count     (e.g. m4)',
      '  c{N}        set code context rows    (e.g. c5, c0=hide)',
      '  s{anchor}   set stack anchor         (e.g. ssp, sfff2)',
      '  l{layout}   set pane layout          (e.g. lro/mc, lr/c/mo)',
      '              panes: r=registers  c=code  m=memory  o=output',
      '              use / to separate columns  (up to 3)',
      '  h           show this help',
      '  q           quit',
    ].join('\n') + '\n';
  }
}

module.exports = IInterpreter;
