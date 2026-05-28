# Interpreter Glossary

Glossary of LCC-specific terms used in `src/core/interpreter.js`.

<!-- @todo #112:60m/WRITER Write definitions for each inventoried term; LCC-specific angle only. Blocked by #109. See #112 -->

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

_To be filled in after the spike completes._
