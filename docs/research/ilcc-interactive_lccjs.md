# Research: ItBeCharlie/interactive_lccjs

**Date:** 2026-05-27  
**Repo:** https://github.com/ItBeCharlie/interactive_lccjs  
**Local clone:** `/home/avi/Documents/Study/JavaScript/interactive_lccjs`  
**Author:** Charlie (ItBeCharlie)  
**Purpose:** Identify which features should be brought into `lccjs` to give Charlie a single, stable, feature-rich repo.

---

## What is interactive_lccjs?

An extension of the base LCC.js interpreter/assembler with three major additions:

1. **`ilcc`** — Interactive stepping debugger with time-travel backward execution
2. **`lcc+` / `lccplus`** — Real-time extension instructions for games/terminal UI
3. Various utility tools (disassembler, hex viewer, link step printer)

The codebase lives in `src/` with four subdirectories:

```
src/
├── core/          # Standard assembler, interpreter, linker, lcc (largely shared with lccjs)
├── interactive/   # ilcc: iassembler.js, iinterpreter.js (~2,405 lines), ilcc.js
├── plus/          # LCC+: assemblerplus.js, interpreterplus.js, lccplus.js
├── extra/         # disassembler.js, linkerStepsPrinter.js
└── utils/         # genStats.js, name.js, hexDisplay.js, picture.js, assembleAll.js
```

---

## Unique Features (not in lccjs today)

### 1. Interactive Stepping Debugger (`src/interactive/iinterpreter.js`)

The headline feature. ~2,405 lines.

**How it works:**
- After each instruction, drops into an interactive prompt
- User enters a number N to step forward N instructions, or -N to step backward N
- The last entered step count is remembered across prompts

**Backward execution / time-travel:**
- `this.snapshot[]` array records the complete machine state delta at each instruction
- Forward: re-execute from the recorded snapshot
- Backward: restore state by replaying snapshot deltas in reverse
- `this.currentIteration` tracks which snapshot index is current
- Efficient mode (`-e` flag): disables snapshots to save memory (backward then impossible)

**Multi-pane terminal display (after each step):**
- **Register pane** — all 8 registers with color-coded changes
- **Code snippet pane** — current instruction with N lines of context (configurable)
- **Memory pane** — hex viewer at a configurable base address (`a{hex}` command)
- **Stack pane** — static (`s{hex}`) or register-relative (`s{register}`) viewing
- **Output pane** — accumulated program output
- Layout: up to 3 columns, configurable with `l` command at runtime

**Commands at the prompt:**
| Command | Effect |
|---|---|
| `{N}` (positive) | Step forward N instructions |
| `{-N}` (negative) | Step backward N instructions (rewind) |
| `0` | Re-display current state without executing |
| `h` | Show help |
| `q` | Quit |
| `a{hex}` | Set memory display base address |
| `m{int}` | Set memory display row count |
| `s{hex\|register}` | Set stack view anchor |
| `l` | Reconfigure pane layout |

**Flags:**
- `-e` / efficient mode: disables snapshot logging (forward-only, lower memory)
- `-c` / colorblind mode: alternate color palette

---

### 2. LCC+ Real-Time Extensions (`src/plus/`)

Non-standard instructions for terminal games and interactive programs. Uses `.ap`/`.ep` file extensions. Programs must include `.lccplus` directive to opt in.

**New instructions:**

| Mnemonic | Effect |
|---|---|
| `nbain` | Non-blocking ASCII input — reads a single keypress without blocking |
| `clear` | Clear the terminal screen |
| `resetc` | Partial clear (clear below cursor?) |
| `cursor` | Show/hide cursor |
| `sleep` | Delay execution (milliseconds) |
| `millis` | Read millisecond timer (modulo 1000) into register |
| `srand` | Seed the random number generator |
| `rand` | LCR-based random number into register |

**File extensions:**
- `.ap` — LCC+ assembly source
- `.ep` — LCC+ executable (linked/assembled)

---

### 3. Disassembler (`src/extra/disassembler.js`)

Partial implementation. Takes a `.e` file and produces `.a` assembly source.

**Currently handles:**
- Most arithmetic/data instructions: mov, ld, add, sub, lea, div, mul
- `.start` directive recovery

**Missing:**
- `A` and `G` header entries (global/extern symbols — labels lost)
- Full operand reconstruction for all instructions
- Named labels (only auto-generated placeholders)

---

### 4. Other Utilities

| Tool | File | Description |
|---|---|---|
| Hex viewer | `src/extra/hexDisplay.js` (also `src/utils/hexDisplay.js`) | Hexdump of `.e`/`.o` files with ASCII column |
| Link step printer | `src/extra/linkerStepsPrinter.js` | Verbose linking visualization |
| Batch assembler | `src/utils/assembleAll.js` | Assemble all `.a` files in a directory |
| Hex picture viewer | `src/utils/picture.js` | Human-readable binary decoder showing header structure |

---

## What's Incomplete / In-Progress

| Item | Status |
|---|---|
| Disassembler | Partial — missing G/A headers, auto-generated labels |
| `sext` behavior | Marked uncertain; exact oracle behavior not confirmed |
| Line length validation (300 char) | Not consistently reproducible from oracle |
| `operand detection refactor` | TODOS.md item: rewrite to accept `{validTypes: [...]}` |
| Linker default output location | Same open question as our OB-033 |
| Infinite loop → auto-debugger | Mentioned but not confirmed implemented |
| Breakpoints / watchpoints | Mentioned in TODOS, not implemented |
| Website / web interface | TODOS item — just an idea |
| Terminal graphics (GBA/NES style) | Far-future LCC+ idea |

---

## Divergences from lccjs

Things charlie has that lccjs doesn't, and vice versa:

| Area | interactive_lccjs | lccjs |
|---|---|---|
| Interactive debugger (`ilcc`) | ✅ Full TUI stepping with time-travel | ❌ Missing |
| LCC+ extensions | ✅ nbain, clear, sleep, rand, etc. | ✅ (already present) |
| Disassembler | ✅ Partial | ✅ Partial (OB-002 @todo) |
| `-m`/`-r` post-run display | ❌ Not wired | ✅ Implemented (OB-034/035) |
| `-x` 4-digit hout | ❌ Not wired | ✅ Implemented (OB-036) |
| Oracle parity test suite | ❌ Uses Docker for oracle | ✅ Direct oracle binary e2e tests |
| PDD / structured issue tracking | ❌ TODOS.md list style | ✅ GH issues + @todo markers |
| `.bst`/`.lst` generation | ✅ `genStats.js` | ✅ `buildReportArtifacts()` |
| `mvr` instruction | ✅ | ? (needs check) |
| `sext` instruction | ⚠️ Uncertain behavior | ✅ Implemented (OB-002 tracked) |
| Hexdump viewer | ✅ `picture.js` | ❌ Missing |
| Batch assembler | ✅ `assembleAll.js` | ❌ Missing |

---

## Priority Features to Incorporate into lccjs

In rough ROI order:

1. **Interactive stepping debugger (`ilcc`)** — The headline differentiator. Charlie's primary need. Large undertaking; see scope ticket #N (to be created).
2. **LCC+ extensions** — Already in lccjs; need to verify parity of nbain/clear/sleep/rand with Charlie's version.
3. **Hexdump / picture viewer** — Low effort port; useful for debugging `.e` and `.o` files.
4. **`operand detection refactor`** — Charlie's TODOS.md item; aligns with lccjs OB-028 (already done via `determineOperandType()`).
5. **Disassembler improvements** — Both repos have partial implementations; pooling effort here makes sense.

---

## Open Questions — RESOLVED 2026-05-27

### #79 — ilcc as separate binary vs `lcc -i` mode flag
**Decision: Separate binary (`ilcc.js`).** The interactive interpreter has a fundamentally different
execution model (prompt-driven vs run-to-halt). Integrating as a flag would require messy branching.
Mirrors the existing pattern: `lccplus.js` is separate from `lcc.js`. If Charlie wants `lcc -i`, it
can be a thin alias later.

### #85 — Does `iassembler.js` differ from lccjs's `assembler.js`?
**No meaningful divergences.** `iassembler.js` is a near-copy of Charlie's `src/core/assembler.js`
(tabs vs spaces only). lccjs's assembler is the more evolved version — adds `assembleSource()`,
`resetAssemblyState()`, `createAssemblyResult()`, `AssemblerError`. When porting ilcc, use lccjs's
assembler directly; retire `iassembler.js`.

### #86 — What is `mvr`?
**`mvr dr, sr1`** copies sr1 into dr. Encoding: `0xA000 | (dr<<9) | (sr1<<6) | 0x000C` (opcode A,
eopcode 12). Oracle-confirmed (outputs correctly). **Already in lccjs at `assembler.js:1216`.**
Nothing to port.

### #80 — Snapshot memory footprint: is efficient mode (`-e`) sufficient?
**Yes.** Each snapshot entry ≈ 120–150 bytes. At lccjs's 20K instruction cap: ~3 MB (negligible).
At 100K: ~15 MB (fine). Efficient mode (`-e`, forward-only) is the correct escape hatch for
long-running programs. Document this in `ilcc --help`. Future option: sliding window (keep last K
snapshots) if the instruction cap is ever lifted.

### #87 — LCC+ unification: separate files vs feature flag?
**Keep separate (Option A).** LCC+ instructions are not in OG LCC (oracle rejects `nbain`, `rand`).
The `extends Assembler` / `extends Interpreter` inheritance pattern is clean and protects oracle
parity tests. LCC+ code is small (195 + 418 lines) — not worth merging into core. When porting
ilcc, `IInterpreter extends Interpreter` (not InterpreterPlus).

---

## See Also

- [`docs/research/web-ilcc.md`](web-ilcc.md) — Aidan's web IDE + autograder (another downstream fork)
- `src/interactive/iinterpreter.js` in the clone — core of the stepping debugger
- GH issue #78 — scope ticket for ilcc incorporation
