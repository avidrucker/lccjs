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
    this._stepWrites = [];        // Writes captured by storeMem() during the in-flight step()

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

  // storeMem(address, value) — observe every runtime memory store so the undo-log
  // can reverse it on backward step, regardless of where it lands. This replaces
  // the old per-step full-region scan (loadPoint..memMax), which silently missed
  // writes on the stack — `call`/`push`/locals all write high addresses above
  // memMax — so step-back left the stack contents stale (#1085, Gap A of #1043).
  // We record the OLD value before delegating the write; step() collects these
  // into the snapshot. Each capture is {address, old, new}; a single instruction
  // may produce several (e.g. the sin trap writes a whole string).
  // Efficient mode disables backward stepping, so skip the bookkeeping there.
  storeMem(address, value) {
    if (!this.efficientMode) {
      this._stepWrites.push({ address, old: this.mem[address], new: value });
    }
    super.storeMem(address, value);
  }

  // initSnapshot() — capture the pre-execution initial machine state as snapshot[0].
  // Must be called AFTER loadExecutableBuffer() and this.initialMem = this.mem.slice()
  // so that this.loadPoint, this.memMax, this.pc, this.r, this.initialMem are all set.
  // Analogous to Charlie's initializeLog() in interactive_lccjs/src/interactive/iinterpreter.js.
  initSnapshot() {
    this.snapshot = [];
    this.currentIteration = 0;
    // snapshot[0] is the pre-execution baseline; it has no write to undo. Memory
    // is restored by replaying per-step write deltas in reverse down to
    // targetIteration+1, so snapshot[0].memory.writes is never replayed — an
    // empty list is correct and sufficient (#1085).
    this.memoryChange = { writes: [] };
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
  // Memory-change capture: every store routes through storeMem() (overridden
  // above), which records {address, old, new} into this._stepWrites — regardless
  // of region. This replaces the old per-step full-region scan that missed stack
  // writes (Gap A, #1085) and could only ever record one changed word per step.
  // The delta stored in each snapshot entry is { writes: [...] }.
  //
  // Snapshot indexing:
  //   - snapshot[0] = initial state (from initSnapshot())
  //   - snapshot[N] = state after step N
  //   - currentIteration tracks which snapshot index is the current position
  //   - In efficient mode: only the two most-recent entries are kept
  step() {
    // 1. Reset the per-step write log; storeMem() appends to it during execution.
    this._stepWrites = [];

    // 2. Execute the instruction (stores are captured via storeMem()).
    super.step();

    // 3. Record this step's memory writes as the delta.
    this.memoryChange = { writes: this._stepWrites };

    // 4. Build the log entry for this step
    const logEntry = {
      pc: this.pc,
      ir: this.ir,
      running: this.running,
      registers: Array.from(this.r),
      flags: { c: this.c, v: this.v, n: this.n, z: this.z },
      memory: this.memoryChange,
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
  // Memory is restored by replaying write deltas in reverse: for each step from
  // currentIteration down to targetIteration+1, undo that step's writes.
  // We stop at targetIteration+1 (not targetIteration) because the writes recorded
  // in snapshot[N] PRODUCED state N; they should remain applied.
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

    // Restore memory by undoing each step's writes from currentIteration down to
    // targetIteration+1.
    for (let i = this.currentIteration; i > targetIteration; i--) {
      this.restorePrevMemory(i);
    }
  }

  // restorePrevMemory(state) — undo the memory writes recorded in snapshot[state]
  // by writing each captured old value back into this.mem. Writes are undone in
  // reverse capture order so overlapping writes within a single step (e.g. two
  // stores to the same address) restore the correct earliest value.
  restorePrevMemory(state) {
    const entry = this.snapshot[state];
    const writes = entry && entry.memory && entry.memory.writes;
    if (!writes) return;
    for (let i = writes.length - 1; i >= 0; i--) {
      this.mem[writes[i].address] = writes[i].old;
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

    // Dispatch is data-driven from COMMAND_REGISTRY (#1342): the first entry
    // whose match() accepts `cmd` handles it and returns an `effect` describing
    // the loop-state side-effects. This is the single source of truth that
    // displayHelp() is also generated from, so the two cannot drift, and the
    // collision guard prevents two commands claiming the same key.
    while (true) {
      process.stdout.write('Input: ');
      const { inputLine } = this._readCommand();
      const cmd = inputLine.trim();

      let handled = false;
      for (const entry of COMMAND_REGISTRY) {
        const m = matchCommand(cmd, entry);
        if (!m.matched) continue;
        const effect = entry.run(this, m.arg, lastStep) || {};
        if (effect.break) return;                          // q
        if (effect.output) process.stdout.write(effect.output);
        if (effect.resetNewline) newlineCount = 0;
        if (effect.incNewline) newlineCount++;
        if (effect.setLastStep !== undefined) lastStep = effect.setLastStep;
        if (effect.render) render();
        handled = true;
        break;
      }

      if (!handled) {
        process.stdout.write(`Unknown command: ${cmd}. Enter 'h' for help.\n`);
        newlineCount++;
      }
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

  // displayHelp() — return the interactive mode help text, GENERATED from
  // COMMAND_REGISTRY so it can never drift from the dispatch (#1342).
  displayHelp() {
    // Rendered in a reader-friendly order (steps first), decoupled from dispatch
    // precedence. The parity guard (command-registry.spec.js) fails if a command
    // is omitted here, so this list cannot silently drift from the registry.
    const HELP_ORDER = ['{N}', '0', '<enter>', 'a', 'm', 'c', 's', 'l', 'h', 'q'];
    const ordered = COMMAND_REGISTRY
      .filter((e) => e.helpLabel)
      .slice()
      .sort((a, b) => HELP_ORDER.indexOf(a.key) - HELP_ORDER.indexOf(b.key));
    const lines = ['ilcc interactive commands:'];
    for (const entry of ordered) {
      lines.push(`  ${entry.helpLabel.padEnd(11)} ${entry.help}`);
      if (entry.helpExtra) lines.push(...entry.helpExtra);
    }
    return lines.join('\n') + '\n';
  }
}

// ── Interactive command registry (#1342) ────────────────────────────────────
// Single source of truth for the ilcc `-i` TUI command surface; drives both the
// runInteractive() dispatch and the generated displayHelp(). Mirrors the
// assembler's `_instructionTable` idiom. Provenance per
// docs/debugger-command-registry.md (CH = Charlie's interactive_lccjs, which
// lccjs's ILCC is derived from). `test` points to the proving spec file or a
// `pending(#child)` marker (coverage guard, #1343).
//
// Entry: { key, match: 'exact'|'prefix'|'numeric'|'empty', minLen?, aliases?,
//          helpLabel, help, helpExtra?, provenance, test,
//          run(interp, arg, lastStep) -> effect }
// effect: { render?, output?, incNewline?, resetNewline?, setLastStep?, break? }
const COMMAND_REGISTRY = [
  {
    key: 'q', match: 'exact', helpLabel: 'q', help: 'quit',
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: () => ({ break: true }),
  },
  {
    key: 'h', match: 'exact', helpLabel: 'h', help: 'show this help',
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: (interp) => ({ output: interp.displayHelp(), resetNewline: true }),
  },
  {
    key: '0', match: 'exact', helpLabel: '0', help: 're-display without stepping',
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: () => ({ render: true }),
  },
  {
    key: 'a', match: 'prefix', helpLabel: 'a{hex|label}',
    help: 'set memory base address  (e.g. a0010, amyData)',
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: (interp, arg) => {
      const { address, error } = interp.resolveMemAddress(arg.trim());
      if (error) return { output: error + '\n', incNewline: true };
      if (address !== null) interp.memDisplayBase = address;
      return { render: true };
    },
  },
  {
    key: 'm', match: 'prefix', helpLabel: 'm{N}',
    help: 'set memory row count     (e.g. m4)',
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: (interp, arg) => {
      const n = parseInt(arg);
      if (!isNaN(n) && n >= 0) interp.memDisplayRows = n;
      return { render: true };
    },
  },
  {
    key: 's', match: 'prefix', minLen: 2, helpLabel: 's{anchor}',
    help: 'set stack anchor         (e.g. ssp, sfff2)',
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: (interp, arg) => { interp.stackAnchor = arg; return { render: true }; },
  },
  {
    key: 'c', match: 'prefix', helpLabel: 'c{N}',
    help: 'set code context rows    (e.g. c5, c0=hide)',
    provenance: 'CH', test: 'pending(#1343)',
    run: (interp, arg) => {
      if (arg === '') {
        interp.codeContextRows = 0;
      } else {
        const n = parseInt(arg, 10);
        if (!isNaN(n) && n >= 0) {
          interp.codeContextRows = n;
        } else {
          return {
            output: 'Error: c{N} expects a non-negative integer (e.g. c5, c0).\n',
            incNewline: true,
          };
        }
      }
      return { render: true };
    },
  },
  {
    key: 'l', match: 'prefix', helpLabel: 'l{layout}',
    help: 'set pane layout          (e.g. lro/mc, lr/c/mo)',
    helpExtra: [
      '              panes: r=registers  c=code  m=memory  o=output',
      '              use / to separate columns  (up to 3)',
    ],
    provenance: 'CH', test: 'pending(#1343)',
    run: (interp, arg) => {
      const result = interp.handlePaneLayout(arg);
      if (result.error) return { output: `Error: ${result.error}\n`, incNewline: true };
      interp.paneLayout = result.paneLayout;
      return { render: true };
    },
  },
  {
    key: '{N}', match: 'numeric', helpLabel: '{N}', help: 'step forward N instructions',
    helpExtra: ['  {-N}        step backward N instructions'],
    provenance: 'CH', test: 'interactive.unit.spec.js',
    run: (interp, cmd) => {
      const n = parseInt(cmd, 10);
      const setLastStep = n !== 0 ? n : undefined;
      if (n > 0 && !interp.running) {
        return {
          output: 'Program has halted. Step back with -N first.\n',
          incNewline: true, setLastStep,
        };
      }
      interp.handleSteps(n);
      return { render: true, setLastStep };
    },
  },
  {
    key: '<enter>', match: 'empty', helpLabel: '<enter>', help: 'repeat last step count',
    provenance: 'CH', test: 'pending(#1343)',
    run: (interp, _arg, lastStep) => {
      if (lastStep > 0 && !interp.running) {
        return { output: 'Program has halted. Step back with -N first.\n', incNewline: true };
      }
      interp.handleSteps(lastStep);
      return { render: true };
    },
  },
];

// matchCommand(cmd, entry) — does `cmd` match this entry, and what is its arg?
// Entries are tried in array order, so this also encodes dispatch precedence
// (exact/prefix before numeric; '0' before the numeric step so it stays exact).
function matchCommand(cmd, entry) {
  switch (entry.match) {
    case 'exact':
      return cmd === entry.key ? { matched: true, arg: '' } : { matched: false };
    case 'empty':
      return cmd === '' ? { matched: true, arg: '' } : { matched: false };
    case 'numeric':
      return !Number.isNaN(parseInt(cmd, 10)) ? { matched: true, arg: cmd } : { matched: false };
    case 'prefix': {
      const minLen = entry.minLen || 1;
      if (cmd.startsWith(entry.key) && cmd.length >= minLen) {
        return { matched: true, arg: cmd.slice(entry.key.length) };
      }
      return { matched: false };
    }
    default:
      return { matched: false };
  }
}

// Collision guard (#1342): no two entries (or aliases) may claim the same key.
// Runs at module load so a double-booking is a hard error, not a silent shadow.
function validateCommandRegistry(registry) {
  const seen = new Set();
  for (const entry of registry) {
    for (const k of [entry.key, ...(entry.aliases || [])]) {
      if (seen.has(k)) {
        throw new Error(`ilcc COMMAND_REGISTRY: duplicate command key '${k}'`);
      }
      seen.add(k);
    }
  }
  return registry;
}
validateCommandRegistry(COMMAND_REGISTRY);

IInterpreter.COMMAND_REGISTRY = COMMAND_REGISTRY;
IInterpreter.matchCommand = matchCommand;
IInterpreter.validateCommandRegistry = validateCommandRegistry;

module.exports = IInterpreter;
