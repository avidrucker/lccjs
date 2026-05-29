# Interpreter Glossary

Glossary of LCC-specific terms used in `src/core/interpreter.js`.

Parent: #107 · See [README](./README.md) for entry conventions.

---

## Candidate term inventory (populated by spike #109)

Sections cluster the file into 7 areas. The write phase (#112) consolidates
each section's term names into definitions.

### (a) Machine model & runtime state

**Memory + registers:**
- `MAX_MEMORY` (65536 words; 2¹⁶ word-addressable space)
- `mem` (Uint16Array(65536) — main memory; 16-bit words)
- `r` (Uint16Array(8) — general-purpose registers r0..r7)
- Symbolic register aliases (also used in display formatting): `fp` = r5, `sp` = r6, `lr` = r7
- `pc` (program counter)
- `ir` (instruction register — last fetched word)
- Condition flags: `n` (negative), `z` (zero), `c` (carry), `v` (overflow)
- `flagsSet` (single-step trace flag — true when this step modified NZCV)

**Run-state bookkeeping:**
- `running` (main loop predicate)
- `output` (accumulated program output, used by `.lst` / `.bst` reports)
- `inputBuffer` (pre-loaded simulated input for tests / SIN / DIN / etc.)
- `instructionsExecuted` (program statistic)
- `maxStackSize` (program statistic; `MAX_MEMORY - sp` per step)
- `spInitial` (`r6` value at run start, for stack-empty detection)
- `memMax` (highest address written; tracks executable + ST writes)
- `loadPoint` (base address where the executable is loaded; default 0)
- `initialMem` (`mem` snapshot taken after loading, for the `.lst` / `.bst` "Loc Code" column)
- `headerLines` (parsed header entries — `S`/`G`/`A` strings — for inclusion in the listing)

**Configuration flags:**
- `generateStats` (whether to emit `.lst` / `.bst` after run)
- `instructionsCap` (500000 — infinite-loop guard threshold)
- `disableInfiniteLoopDetection` (override to skip the cap, e.g. for long-running `.ap` programs)
- `allowRuntimeDebugging` (gate for entering interactive debugger on cap-hit)
- `debugMode` (interactive debugger active)
- `traceMode` (per-instruction trace to stdout, `-t` flag)
- `debugBreakpoint` (address set by debug `b <addr>`; cleared on first hit)
- `sourceMap` (PC-to-source-line map populated by `lcc.js` from assembler pass 2; shape `{addressToLine: Map<addr, {lineNumber, sourceLine}>, allLines: string[]}`)
- `hasJumped` (trace flag — true if last step modified `pc` via branch / jmp / bl / blr)
- `options` (CLI option bag forwarded from `lcc.js`)

### (b) Executable loading & `.e` file format (consumer side)

**File signature & header parsing:**
- `'o'` intro byte (LCC executable signature; validated at offset 0)
- `'C'` code-start marker (terminates header parsing)
- Recognized header entry types in `.e` (subset of what assembler emits — externals are already resolved by linker):
  - `'S'` — start address (UInt16LE; sets initial PC = `loadPoint + startAddress`)
  - `'G'` — global label record (UInt16LE address + null-terminated label; preserved in `headerLines` for the listing but not used at runtime)
  - `'A'` — adjustment entry (UInt16LE address; preserved in `headerLines`; no runtime relocation done by interpreter)
- Unknown header entry → `InvalidExecutableFormatError("Unknown header entry: '<X>'")`
- `loadExecutableBuffer(buffer)` — parses header, loads 16-bit LE machine words into `mem[loadPoint…]`
- `loadExecutableFile(fileName)` — file-handle wrapper for `lcc.js` flow; validates `'o'` and `'C'` presence anywhere in the buffer (order-only check)
- `executeBuffer(buffer, options)` — in-memory entry point used by tests / pure callers (bypasses `lcc.js`)
- `'o'` signature error: `"<file> is not in lcc format"`
- File-extension guard: only `.e` accepted at the CLI level (custom LCC.js behavior — original LCC accepts any non-`.bin`/`.hex`/`.o`)

### (c) Fetch–decode–execute loop & trace mode

**Main loop:**
- `run()` (main loop — captures initial `r6`, then iterates `step()` while `running`)
- `step()` — fetch (`ir = mem[pc++]`), decode field extraction, dispatch by 4-bit opcode nibble
- Per-step bookkeeping: track changed registers + flags + jumps; bump `instructionsExecuted`; update `maxStackSize`
- Infinite-loop guard (`instructionsExecuted >= instructionsCap`): if CLI + TTY + allow flag → enter debugger; otherwise → `"Possible infinite loop"` runtime error

**Decoded instruction fields (set on each step):**
- `opcode` — bits 15-12 (4-bit base opcode)
- `code` — bits 11-9 (branch condition code; same field as `dr`)
- `dr` / `sr` — bits 11-9 (destination / source register)
- `sr1` / `baser` — bits 8-6 (first source / base register)
- `sr2` — bits 2-0 (second source register)
- `bit5` — bit 5 (register-form vs immediate-form selector)
- `bit11` — bit 11 (BL vs BLR selector at opcode 4)
- `imm5` — bits 4-0, sign-extended to 16 bits
- `pcoffset9` — bits 8-0, sign-extended (also reused as `imm9` for MVI)
- `pcoffset11` — bits 10-0, sign-extended (BL only)
- `offset6` — bits 5-0, sign-extended (base+offset memory + JMP/RET)
- `eopcode` — bits 4-0 (extended opcode for `OP_EXT` group)
- `trapvec` — bits 7-0 (trap vector for `OP_TRAP`)

**Opcode dispatch table** (decoded by `step()`):
- 0 BR · 1 ADD · 2 LD · 3 ST · 4 BL/BLR · 5 AND · 6 LDR · 7 STR · 8 CMP · 9 NOT · 10 CASE10 (extended-opcode group) · 11 SUB · 12 JMP/RET · 13 MVI · 14 LEA · 15 TRAP

**Trace mode:**
- Pre-step line: `<addr>:   <source text>` (from `sourceMap`; falls back to `(unknown)`)
- Post-step diff line: `<r0 = old/new>` per changed register, `<NZCV = nzcv>` if `flagsSet`, `<pc = old/new>` if `hasJumped`
- `traceMode` writes to stdout only; debug mode writes via `writeDebugOutput` so the trace is also captured in `output` (which feeds the `.lst`)

**Mnemonic-display tables (`hexToMnemonic`):**
- Base opcode table (16 entries — same as the assembler's `OP_*` constants)
- Extended-opcode table (14 entries — `PUSH`/`POP`/`SRL`/`SRA`/`SLL`/`ROL`/`ROR`/`MUL`/`DIV`/`REM`/`OR`/`XOR`/`MVR`/`SEXT`)
- Trap-vector table (15 entries — `HALT`/`NL`/`DOUT`/`UDOUT`/`HOUT`/`AOUT`/`SOUT`/`DIN`/`HIN`/`AIN`/`SIN`/`M`/`R`/`S`/`BP`)
- Branch-code table (8 entries — `BRZ`/`BRNZ`/`BRN`/`BRP`/`BRLT`/`BRGT`/`BRC`/`BR`)
- Unknown mnemonic fallback: `Unknown(<hex>)`

### (d) Per-instruction execute methods & arithmetic helpers

**Per-instruction methods (one per dispatch case):**
- `executeBR` — uses `code` to select condition (Z=1, Z=0, N=1, N==Z (positive), N!=V (lt), N==V && Z=0 (gt), C=1, always)
- `executeADD` / `executeSUB` / `executeCMP` — register-form or imm5-form via `bit5`; signed-overflow + carry semantics
- `executeAND` / `executeNOT`
- `executeLD` / `executeST` — pc-relative (`pc + pcoffset9`)
- `executeLDR` / `executeSTR` — `r[baser] + offset6`
- `executeMVI` (load 9-bit signed immediate) · `executeLEA` (pc + offset)
- `executeJMP` — `r[baser] + offset6`; covers both JMP and RET (RET = JMP via lr)
- `executeBLorBLR` — `bit11=1` → BL with pcoffset11; `bit11=0` → BLR with `baser + offset6`; both stash return address in `r[7]` (lr)
- `executeCase10` (extended-opcode group, eopcode 0..13):
  - 0 PUSH (`mem[--sp] = sr`) · 1 POP (`dr = mem[sp++]`)
  - 2 SRL · 3 SRA · 4 SLL · 5 ROL · 6 ROR (4-bit shift count `ct` from bits 8-5; default 1 when assembler omits it; `c` flag = last bit shifted out)
  - 7 MUL · 8 DIV · 9 REM (DIV/REM by zero → `"Floating point exception"`)
  - 10 OR · 11 XOR · 12 MVR (register-to-register move) · 13 SEXT (uses field selector)
  - Unknown eopcode → `"Unknown extended opcode: <n>"` (oracle silently exits; LCC.js throws)

**Sign-extension & arithmetic helpers:**
- `toSigned16(value)` — coerce 16-bit unsigned to signed (-32768..32767)
- `setNZ(value)` — set N/Z flags from signed value; sets `flagsSet`
- `setCV(sum, x, y)` — set carry + overflow flags based on signed operands
- `signExtend(value, bitWidth)` — generic sign-extend
- `signExtendMaskedValue(value, mask)` — sign-extend across an arbitrary bitmask (sign bit = highest set bit of mask)
- `executeSEXT(value, fieldSelector)` — small-selector (0..15) uses `SEXT_PARITY_TABLE`; larger selectors fall back to `signExtendMaskedValue`
- `SEXT_PARITY_TABLE` — 16×32 oracle-parity lookup for `sext` with field selectors 0..15

### (e) Trap implementations & line/char input

**Trap dispatch table (matches assembler trap-vector assignments):**
- 0 `HALT` — sets `running = false`
- 1 `NL` — writes platform newline
- 2 `DOUT` — signed decimal output
- 3 `UDOUT` — unsigned decimal output
- 4 `HOUT` — hex output; `-x` (`options.hexOutput`) pads to 4 zero-padded digits
- 5 `AOUT` — ASCII char (low 8 bits of `r[sr]`)
- 6 `SOUT` (`executeSOUT`) — read null-terminated string from `mem[r[sr]…]`
- 7 `DIN` — read decimal int; reprompts with `"Invalid dec constant. Re-enter:"`
- 8 `HIN` — read hex int; reprompts with `"Invalid hex constant. Re-enter:"`
- 9 `AIN` — read single char (`readCharFromStdin`)
- 10 `SIN` (`executeSIN`) — read a line into `mem[r[sr]…]`; null-terminated
- 11 `M` (`executeM`) — full memory display (debug trap, no operand)
- 12 `R` (`executeR`) — full register + flags display (debug trap)
- 13 `S` (`executeS`) — stack display from `sp` to `MAX_MEMORY-1`; marks `fp` with `<--- fp`
- 14 `BP` (`handleSoftwareBreakpoint`) — software breakpoint; enters debugger if `allowRuntimeDebugging` + TTY; otherwise → `"software breakpoint"` runtime error
- Unknown trap vector → `"Trap vector out of range"` runtime error (with synthetic `"Error on line 0 of <file>"` prefix)

**Input helpers:**
- `readLineFromStdin()` — reads a line; honors `inputBuffer` for simulated input (also echoes simulated input to `output`); handles `\r` / `\r\n` line endings; returns `{inputLine, isSimulated}`
- `readCharFromStdin()` — single-char read; same `inputBuffer` honoring + simulated echo

### (f) Symbolic debugger (Phase 1 oracle parity, #102)

**Loop & prompt:**
- `debug()` — interactive command loop; prompt format `<mnemonic.lowercase()>>> ` (e.g. `add>>> `, `trap>>> `, etc.)
- Breakpoint banner on hit: `"Breakpoint at"` + indented source line (or hex word fallback); breakpoint cleared after first hit
- `_debugShowState(addr)` — single-line current-instruction display: `"<addr padded>:     <source text or hex>"`

**Command set (matches oracle Phase 1):**
- Enter (empty input) — step one instruction
- `q` — quit (`running = false`)
- `g` — continue (turn off `debugMode`, run to end / next breakpoint)
- `b <hex addr>` — set breakpoint at address; `b` alone — clear breakpoint
- `r` — register display (`_debugShowRegs`; same format as `-r`)
- `m` — all-memory display (`_debugShowAllMem`)
- `m <hex addr> [count]` — display 1 or `count` words at `addr` (`_debugShowMem`)
- `i` — display next instruction's source text (no execute)
- `h` — help text (lists command set; includes some commands not yet implemented like `c <reg|label|addr> val` and integer-N step counts)
- `s` — stack display (top-down from `0xFFFF` to current `sp`)
- Unrecognized input — falls through to step (oracle backward-compat)
- `canEnterInteractiveDebugger()` — only true in CLI + TTY + non-test mode (pure API callers / tests never block in the prompt)

### (g) Output / display / errors & CLI orchestration

**Output helpers:**
- `writeOutput(message)` — stdout + `output` (no trailing newline; used by aout/dout/sout)
- `writeDebugOutput(message)` — stdout + `output` with trailing newline (used by debug + error messages)
- `writeDebugOutputOrElse(message)` — newline only in `debugMode`; otherwise no newline (used by DOUT/UDOUT/HOUT/AOUT so debug output stays single-line in normal runs)
- `newline` (`'\r\n'` on win32, `'\n'` elsewhere)

**Post-run displays (forwarded from CLI flags via `options`):**
- `-m` (`options.memDisplay`) — `"Memory display"` block: `addr: word` for each used word from `loadPoint` to `memMax`
- `-r` (`options.regDisplay`) — `"Register display"` block: PC/IR/NZCV header + two register lines with `fp`/`sp`/`lr` aliases
- `-x` (`options.hexOutput`) — forces HOUT to 4-digit zero-padded output

**Error model:**
- `error(message)` — print to stderr; sets `running = false` (non-fatal "stop and continue" path)
- `raiseRuntimeError(error)` — set `running = false`; throw an `InterpreterRuntimeError` (catch site decides whether to CLI-exit)
- `InvalidExecutableFormatError` — typed error for header / signature failures (thrown by `loadExecutableBuffer`)
- `InterpreterRuntimeError` — typed error for runtime conditions
- Catch-site shape (`main`): wraps runtime errors as `"Runtime Error: <msg>"`; lets `"is not in lcc format"` pass through as-is

**CLI orchestration (`main`):**
- Direct invocation vs `lcc.js`-driven (`inputFileName` pre-set check is on `loadExecutableFile`, not here)
- Argument parsing — recognized switches: `-nostats`, `-d` (debug), `-L<hex>` (load point)
- Recognized errors: `"Usage: ..."`, `"Bad command line switch: <arg>"`, `"Cannot open input file <file>"`, `"<file> is not in lcc format"`, `"Unsupported file type for interpreter.js (expected .e)"`
- CLI status output: `"Starting interpretation of <file>"`, `"lst file = <X>"`, `"bst file = <Y>"`, `"====================================================== Output"`
- `constructBSTLSTFileName(inputFileName, isBST)` → sibling `.lst` / `.bst` filename via `constructSiblingFileName`
- `userName` from `nameHandler.createNameFile(inputFileName)` — fed into the `.lst` / `.bst` header
- Auto-instantiation when `require.main === module` — direct CLI usage sets `generateStats = true`

---

## Definitions (populated by write #112)

### `mem` / `MAX_MEMORY`

The interpreter's 65536-word (16-bit each) main memory, modelled as a `Uint16Array`. `MAX_MEMORY` (= 65536) is the literal cap; addresses wrap modulo it on every fetch / store. The word-addressable convention is shared with the assembler — see `[.string` directive](assembler.md#string).

**Source:** `src/core/interpreter.js:18, 67, 215`
**See also:** [r], [loadPoint], [memMax]

### `r` (registers)

The eight general-purpose registers `r0..r7`, modelled as a `Uint16Array(8)`. They are stored as 16-bit *unsigned* values; signedness is applied on demand by `[toSigned16]` inside the arithmetic execute methods. Three of the registers have symbolic aliases honored at the display layer: `r5 = fp` (frame pointer), `r6 = sp` (stack pointer), `r7 = lr` (link register).

**Source:** `src/core/interpreter.js:72, 216, 322-323`
**See also:** [pc], [ir], [toSigned16]

### `pc` / `ir`

`pc` is the program counter; `ir` is the instruction register (the last word fetched from `mem`). On each step `pc` is read, `mem[pc++]` lands in `ir`, then `ir` is decoded into the field set used by the per-instruction execute methods.

**Source:** `src/core/interpreter.js:77, 82, 604`
**See also:** [step], [decoded instruction fields]

### NZCV flags

The four condition flags: `n` (negative), `z` (zero), `c` (carry), `v` (overflow). Stored as separate `0`/`1` fields. Set by arithmetic operations via `[setNZ]` and `[setCV]`; consumed by `[executeBR]`'s 3-bit condition decoding. `flagsSet` is a per-step bool indicating whether the current instruction modified any of NZCV — used by trace / debug output to decide whether to render the `<NZCV = …>` line.

**Source:** `src/core/interpreter.js:87-102, 1640-1685`
**See also:** [setNZ], [setCV], [executeBR]

### Runtime state bookkeeping

A cluster of fields tracking per-run progress and statistics for the `.lst` / `.bst` reports:

- `running` — main-loop predicate; flipped by `HALT`, runtime errors, or debug `q`
- `output` — accumulator string of every byte emitted by `[writeOutput]`; feeds the `Output` block in the listing reports
- `inputBuffer` — pre-loaded simulated input (tests / pure callers populate this so SIN/AIN/DIN don't block on real stdin)
- `instructionsExecuted` — bump-counter for the `Program statistics` block
- `spInitial` — `r6` captured at run start, used by `[executeS]` to detect "stack empty"
- `maxStackSize` — max observed `MAX_MEMORY - r6` across all steps
- `memMax` — highest address written (ST and the executable loader update this so the post-run memory display can stop at the right point)
- `initialMem` — `mem` snapshot taken after loading; the `.lst` / `.bst` `Loc Code` column comes from here so post-run mutations don't pollute the listing

**Source:** `src/core/interpreter.js:107-147, 595, 769-774`
**See also:** [executeS], [Listing reports (.lst/.bst)](assembler.md#bst--lst)

### `loadPoint` / `headerLines`

`loadPoint` is the base mem address machine code is written to (default 0; `-L<hex>` CLI flag sets it). PC is initialized to `loadPoint + startAddress` after parsing. `headerLines` is the human-readable representation of the parsed `.e` header entries (`S xxxx`, `G xxxx label`, `A xxxx`); included verbatim in the `.lst` / `.bst` output.

**Source:** `src/core/interpreter.js:137, 162, 551, 565, 573, 591`
**See also:** [executeBuffer], [.e file format (consumer)](#executable-loading)

### `sourceMap`

PC-to-source-line map produced by the assembler at the end of pass 2 and forwarded by `lcc.js` when `-t` is used. Shape: `{addressToLine: Map<addr, {lineNumber, sourceLine}>, allLines: string[]}`. Consumed by `[debug]` and trace-mode pre-step output to render `addr:   <source text>` instead of raw hex.

**Source:** `src/core/interpreter.js:198-203, 624-626, 982-985`
**See also:** [debug], [trace mode]

### Run-time guard flags

A handful of bool flags that gate runtime behaviours:

- `debugMode` — interactive debugger is active (entered via `-d`, `BP` trap, infinite-loop guard, or breakpoint hit)
- `traceMode` — emit per-instruction trace to stdout (no interactive prompt); set by `-t`
- `instructionsCap` (= 500000) — soft cap for the infinite-loop guard
- `disableInfiniteLoopDetection` — bypass the cap entirely; useful for long-running `.ap` programs where the cap fires spuriously
- `allowRuntimeDebugging` — set per `executeBuffer` call to gate whether cap-hit can enter the debugger
- `debugBreakpoint` — address set by debug `b <addr>`; cleared on first hit (single-shot)
- `hasJumped` — per-step bool set by branch / jump / bl / blr; used by trace / debug output to decide whether to render `<pc = old/new>`

**Source:** `src/core/interpreter.js:167-209, 752-767`
**See also:** [step], [debug], [canEnterInteractiveDebugger]

### Executable loading (`loadExecutableBuffer` / `loadExecutableFile` / `executeBuffer`)

Three entry points for getting an `.e` file into memory:

- `executeBuffer(buffer, options)` — pure in-memory entry; used by tests and `lcc.js`. Verifies the `'o'` intro byte and calls `loadExecutableBuffer`, then runs.
- `loadExecutableBuffer(buffer)` — strict header parser; reads typed entries (`'S'`, `'G'`, `'A'` only — `'E'`/`'e'`/`'V'` are linker-time and never appear in a *finished* `.e`) until `'C'`, then streams little-endian 16-bit words into `mem[loadPoint..]`. Unknown entry → `InvalidExecutableFormatError`.
- `loadExecutableFile(fileName)` — filesystem wrapper used by `lcc.js`'s flow; looser signature check (looks for `'o'` then `'C'` *anywhere* in the buffer in order, instead of strict header parsing).

**Source:** `src/core/interpreter.js:274-336, 477-521, 523-592`
**See also:** [.e / .o file format](assembler.md#e--o-file-format), [InvalidExecutableFormatError]

### `step` / decoded instruction fields

`step()` is one iteration of fetch–decode–execute: fetches `mem[pc++]` into `ir`, sets all the decoded field slots from the bit layout (see table below), then dispatches by `opcode`. Field slots set on every step:

| Slot | Bits | Purpose |
|---|---|---|
| `opcode` | 15-12 | 4-bit base opcode (16 entries) |
| `code` / `dr` / `sr` | 11-9 | branch condition code / destination / source register |
| `sr1` / `baser` | 8-6 | first source / base register |
| `sr2` | 2-0 | second source register |
| `bit5` | 5 | register-vs-immediate form selector |
| `bit11` | 11 | BL vs BLR selector at opcode 4 |
| `imm5` | 4-0 | sign-extended to 16 bits |
| `pcoffset9` / `imm9` | 8-0 | sign-extended to 16 bits |
| `pcoffset11` | 10-0 | sign-extended; used only by BL |
| `offset6` | 5-0 | sign-extended; base+offset memory ops + JMP/RET |
| `eopcode` | 4-0 | extended opcode for opcode 10 (`CASE10`) |
| `trapvec` | 7-0 | trap vector for opcode 15 |

Same field shapes as the assembler — see [16-bit instruction word field layout](assembler.md#per-instruction-encoders).

**Source:** `src/core/interpreter.js:602-697`
**See also:** [run], [opcode dispatch table]

### Opcode dispatch table

The 16-way switch in `step()` dispatching by `opcode`. Most opcodes go to a dedicated `execute<Mnemonic>` method; opcode 10 (`CASE10`) is the extended group containing PUSH/POP/SRL/SRA/SLL/ROL/ROR/MUL/DIV/REM/OR/XOR/MVR/SEXT, demuxed by `eopcode`. Unknown opcode → `[InterpreterRuntimeError]("Unknown opcode: <n>")`.

**Source:** `src/core/interpreter.js:646-697`
**See also:** [step], [executeCase10]

### `run` (main loop)

The top-level loop. Captures `spInitial = r[6]` at entry, then `while (running) step()`. The `running` predicate is flipped by `HALT`, `BP` (if not in interactive debug), runtime errors, or the infinite-loop guard.

**Source:** `src/core/interpreter.js:594-600`
**See also:** [step], [Run-time guard flags]

### Trace mode

`-t` flag: a non-interactive per-instruction trace. Before each step prints `<addr>:   <source text>` (from `sourceMap`, falls back to `(unknown)`). After each step prints a diff line: `<r0 = old/new>` per changed register, `<NZCV = nzcv>` if `flagsSet`, `<pc = old/new>` if `hasJumped`. Parallel to debug-mode formatting but routed straight to stdout (skipping `output`) so the trace doesn't pollute the `.lst` reports.

**Source:** `src/core/interpreter.js:191-196, 620-627, 700-744`
**See also:** [debug], [hasJumped], [flagsSet]

### `hexToMnemonic`

Lookup table that decodes a 16-bit machine word back into the mnemonic the assembler used. Tables follow the same dispatch as `step()`: 16-entry base, 14-entry extended (for `CASE10`), 15-entry trap (`HALT`/`NL`/`DOUT`/.../`BP`), 8-entry branch-condition. Unknown mnemonic falls back to `Unknown(<hex>)`. Consumed by `[debug]` for the prompt prefix (e.g. `add>>> `).

**Source:** `src/core/interpreter.js:778-855`
**See also:** [debug]

### `executeBR`

Conditional branch dispatch. Decodes the 3-bit `code` field into one of 8 conditions: equal (Z=1), not-equal (Z=0), negative (N=1), positive (N==Z), signed less-than (N≠V), signed greater-than (N==V && Z=0), carry (C=1), always. Same condition table as the assembler's branch-code lookup. If condition met, advances PC by `pcoffset9`; sets `hasJumped` accordingly.

**Source:** `src/core/interpreter.js:1037-1069`
**See also:** [NZCV flags], [Branch condition codes](assembler.md#assembleBR)

### `executeADD` / `executeSUB` / `executeCMP`

The signed-arithmetic trio. Register vs immediate form chosen by `bit5`. Each computes its sum / difference, sets NZCV via `[setNZ]` and `[setCV]`. `executeSUB` and `executeCMP` route through `[toSigned16]` first; `executeADD` works directly on unsigned values for the result computation but uses the operands for overflow detection. `CMP` is `SUB` minus the destination write — same flag side effect, no register mutation.

**Source:** `src/core/interpreter.js:1015-1035, 1178-1216`
**See also:** [setNZ], [setCV], [toSigned16]

### `executeCase10` (extended-opcode dispatch)

The 14-way demux for opcode 10. Each `eopcode` value (0..13) routes to inline logic for PUSH/POP/SRL/SRA/SLL/ROL/ROR/MUL/DIV/REM/OR/XOR/MVR/SEXT. Shift count `ct` is a 4-bit field from bits 8-5 (defaults to 1 when the assembler omits it; SRA range-checks 0..15 strictly, others use naïve parse). DIV / REM by zero throws `[InterpreterRuntimeError]("Floating point exception")` — LCC's idiosyncratic wording for integer-divide-by-zero, matching the oracle. Unknown `eopcode` → `Unknown extended opcode` runtime error (oracle silently exits; LCC.js prefers to surface invalid binaries).

**Source:** `src/core/interpreter.js:1071-1176`
**See also:** [executeSEXT], [InterpreterRuntimeError]

### `executeBLorBLR` / `executeJMP`

Branch-and-link / jump dispatch. `executeBLorBLR` reads `bit11`: 1 → BL (PC += pcoffset11 + 1, save old PC in `r[7]`); 0 → BLR (PC = r[baser] + offset6, save old PC in `r[7]`). `executeJMP` handles both JMP and RET (RET being JMP with baser=7); it just sets PC = r[baser] + offset6 and trips `hasJumped`.

**Source:** `src/core/interpreter.js:1261-1277`
**See also:** [step], [hasJumped]

### Memory access methods

`executeLD` / `executeST` / `executeLEA` use pc-relative addressing (`pc + pcoffset9`); `executeLDR` / `executeSTR` use base+offset6 (`r[baser] + offset6`). `executeMVI` loads `imm9` directly into `r[dr]`. `executeST` and `executeSTR` also bump `[memMax]` so the post-run memory display knows the new high-water mark.

**Source:** `src/core/interpreter.js:1232-1259`
**See also:** [memMax]

### Arithmetic helpers

- `toSigned16(value)` — coerce a 16-bit unsigned to its signed interpretation (-32768..32767)
- `setNZ(value)` — set N/Z flags from a signed value; also flips `flagsSet`
- `setCV(sum, x, y)` — set carry + overflow given signed operands and the signed sum
- `signExtend(value, bitWidth)` — generic sign-extend across a fixed bit-width
- `signExtendMaskedValue(value, mask)` — sign-extend across an arbitrary bitmask (the sign bit is taken as the highest set bit of `mask`)

**Source:** `src/core/interpreter.js:1631-1714`
**See also:** [NZCV flags], [executeSEXT]

### `executeSEXT` / `SEXT_PARITY_TABLE`

LCC's SEXT (sign-extend) with a quirk: selectors 0..15 follow an oracle-specific *field-number* mapping (a 16×32 lookup table baked into the source), not the raw bit-mask behaviour that larger selectors use. Selectors ≥ 0x10 fall through to `signExtendMaskedValue`. The table exists because the oracle's `sext` treats small field selectors as named field modes rather than literal masks; LCC.js mirrors that to stay oracle-parity.

**Source:** `src/core/interpreter.js:23-40, 1716-1727`
**See also:** [signExtendMaskedValue]

### `executeTRAP` (trap dispatch table)

The 15-way trap dispatch by `trapvec`. Vectors match the assembler's encoding exactly: 0 `HALT`, 1 `NL`, 2 `DOUT` (signed decimal), 3 `UDOUT` (unsigned decimal), 4 `HOUT` (hex; `-x` pads to 4 digits), 5 `AOUT` (low 8 bits as ASCII), 6 `SOUT` (null-terminated string from `mem[r[sr]…]`), 7 `DIN` / 8 `HIN` (reprompt on `Invalid <kind> constant. Re-enter:`), 9 `AIN` / 10 `SIN` (line input), 11-13 `M`/`R`/`S` (debug-display traps), 14 `BP` (software breakpoint). Vectors outside this set throw `Trap vector out of range` after a synthetic `"Error on line 0 of <file>"` header.

**Source:** `src/core/interpreter.js:1509-1629`
**See also:** [readLineFromStdin], [readCharFromStdin], [handleSoftwareBreakpoint]

### `readLineFromStdin` / `readCharFromStdin`

Input shims that honour `[inputBuffer]` for simulated input (tests, pure callers). When `inputBuffer` is empty, fall back to a blocking `fs.readSync` on stdin's fd. `readLineFromStdin` handles `\r`, `\n`, and `\r\n` line endings explicitly (Windows-friendliness); `readCharFromStdin` reads one byte at a time. Simulated input is echoed into `[output]` so the listing reports show user input alongside program output.

**Source:** `src/core/interpreter.js:1290-1386`
**See also:** [executeTRAP], [inputBuffer (runtime bookkeeping)]

### `handleSoftwareBreakpoint`

Implements the `BP` trap (`0x0e`). If `[allowRuntimeDebugging]` is off, it just throws `[InterpreterRuntimeError]("software breakpoint")`. If on (and we're in a real TTY), prints `"software breakpoint"` and flips into interactive `[debug]`. The distinction lets test runs surface a `BP` cleanly without blocking, while CLI runs drop into the debugger as a developer would expect.

**Source:** `src/core/interpreter.js:1460-1473`
**See also:** [debug], [canEnterInteractiveDebugger]

### `debug` (interactive debugger)

The Phase-1 oracle-parity debug REPL (see #102). Prompt format is `<mnemonic.lowercase()>>> ` (e.g. `add>>> ` or `trap>>> `). The command set matches the oracle subset:

- Enter — step one instruction
- `q` — quit (`running = false`)
- `g` — go: turn off `debugMode`, continue until breakpoint or end
- `b <hex>` — set breakpoint at address; `b` alone — clear breakpoint
- `r` — register display
- `m` — all-memory display; `m <hex> [n]` — display n words at address
- `i` — display source text of next instruction (no execute)
- `h` — help screen
- `s` — stack display (top-down from `0xFFFF` to current `sp`)
- Unrecognized input — falls through to step (oracle backward-compat)

Breakpoints fire once: the banner `Breakpoint at` is printed and the breakpoint cleared on first hit.

**Source:** `src/core/interpreter.js:860-977, 982-1011`
**See also:** [hexToMnemonic], [canEnterInteractiveDebugger], [Run-time guard flags]

### `canEnterInteractiveDebugger`

Three-way guard: `allowRuntimeDebugging && process.stdin.isTTY && !isTestMode`. Only a real CLI invocation can ever enter the interactive `[debug]` prompt — pure-API callers, in-process tests, and any callsite that didn't opt in via `allowDebugOnInfiniteLoop` will fail-fast or terminate instead of blocking on `readLineFromStdin`.

**Source:** `src/core/interpreter.js:267-271, 758-766`
**See also:** [debug], [handleSoftwareBreakpoint]

### Output helpers

Three sinks for emitted bytes, differing in newline policy:

- `writeOutput(message)` — stdout + accumulate into `output`; no trailing newline. Used by AOUT/DOUT/SOUT so program output stays mid-line until the program writes its own NL.
- `writeDebugOutput(message)` — stdout + `output` with a trailing newline. Used by `[debug]` and error messages.
- `writeDebugOutputOrElse(message)` — newline only when `debugMode` is active; otherwise no newline. Used by DOUT/UDOUT/HOUT/AOUT *traps* (not their helper methods) so debug runs render one line per value and normal runs concatenate them.

`newline` is the platform line-ending constant (`'\r\n'` on win32, `'\n'` elsewhere).

**Source:** `src/core/interpreter.js:1476-1507`
**See also:** [executeTRAP]

### Post-run memory / register displays

CLI-only output blocks printed *after* `run()` returns, gated by per-call options forwarded from `lcc.js`:

- `options.memDisplay` (`-m`) — `Memory display` block: `addr: word` for each used word from `loadPoint` to `memMax`
- `options.regDisplay` (`-r`) — `Register display` block: PC/IR/NZCV header + two register lines with `fp`/`sp`/`lr` aliases
- `options.hexOutput` (`-x`) — forces `HOUT` to 4-digit zero-padded output (otherwise prints the minimum-width hex)

**Source:** `src/core/interpreter.js:308-325, 1533-1535`
**See also:** [run], [executeTRAP]

### Error model

Two typed errors plus two helpers, mapping cleanly to "you shouldn't be loading that file" vs "execution went sideways":

- `InvalidExecutableFormatError` — header / signature parse failure (`loadExecutableBuffer`)
- `InterpreterRuntimeError` — runtime conditions (unknown opcode / trap, divide-by-zero, infinite-loop, software breakpoint)
- `error(message)` — set `running = false`, write `message` to stderr; non-fatal stop-and-continue path
- `raiseRuntimeError(error)` — set `running = false` and throw; catch site (`main`) decides whether to CLI-exit

CLI catch shape: `Runtime Error: <msg>` wraps any thrown `InterpreterRuntimeError`; `"is not in lcc format"` is allowed to pass through verbatim because the user-facing wording is meaningful.

**Source:** `src/core/interpreter.js:8, 444-450, 1729-1743`
**See also:** [Possible-infinite-loop error], [Floating-point-exception error]

### `main` (CLI orchestration)

CLI entry point: parses args, opens the input file, calls `executeBuffer`, then writes `.lst` / `.bst` if `generateStats` is true. Recognized switches: `-nostats` (suppress reports), `-d` (enter debug mode immediately), `-L<hex>` (load point). Bad switches → `Bad command line switch: <arg>`. Status output during the run: `Starting interpretation of <file>`, `lst file = <X>`, `bst file = <Y>`, `====================================================== Output`. Direct CLI usage (`require.main === module`) sets `generateStats = true` and instantiates a single `Interpreter`.

**Source:** `src/core/interpreter.js:349-470, 1746-1751`
**See also:** [constructBSTLSTFileName], [executeBuffer]

### `constructBSTLSTFileName`

Sibling-file naming helper: maps `inputFileName + (isBST ? '.bst' : '.lst')` to the report path via the shared `constructSiblingFileName` utility. Used by `main` to compute the report paths printed before `Output` and (via `writeReportFiles`) to write them.

**Source:** `src/core/interpreter.js:472-474`
**See also:** [`.lst` / `.bst` report](assembler.md#bst--lst)

### `userName` (via `nameHandler`)

User identity string read from `name.nnn` by `nameHandler.createNameFile(inputFileName)`. Inserted at the top of every `.lst` / `.bst` report (right after the `LCC.js Assemble/Link/Interpret/Debug Ver` line). Triggered lazily — only when `generateStats` is true and reports are about to be written.

**Source:** `src/core/interpreter.js:14, 454-463`
**See also:** [main]
