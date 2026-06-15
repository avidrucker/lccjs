# Interpreter Glossary

LCC-specific vocabulary used in `src/core/interpreter.js` — the virtual
machine: its memory/register model, `.e` executable loading, the
fetch–decode–execute loop, per-instruction and trap implementations, the
interactive debugger, and the `.lst` / `.bst` reporting path. See
[README](./README.md) for entry conventions and the other module glossaries.

---

## Definitions

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
- `maxSteps` (default 500000; pass `-1` or `Infinity` for unlimited) — step cap for the infinite-loop guard; set via `--max-steps N` on the CLI
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

**Source:** `interpreter.js` — `loadExecutableBuffer()`, `loadExecutableFile()`, `executeBuffer()`
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

**Source:** `interpreter.js` — `step()`
**See also:** [run], [opcode dispatch table]

### Opcode dispatch table

The 16-way switch in `step()` dispatching by `opcode`. Most opcodes go to a dedicated `execute<Mnemonic>` method; opcode 10 (`CASE10`) is the extended group containing PUSH/POP/SRL/SRA/SLL/ROL/ROR/MUL/DIV/REM/OR/XOR/MVR/SEXT, demuxed by `eopcode`. Unknown opcode → `[InterpreterRuntimeError]("Unknown opcode: <n>")`.

**Source:** `interpreter.js` — `step()`, grep `switch (this.opcode)`
**See also:** [step], [executeCase10]

### `run` (main loop)

The top-level loop. Captures `spInitial = r[6]` at entry, then `while (running) step()`. The `running` predicate is flipped by `HALT`, `BP` (if not in interactive debug), runtime errors, or the infinite-loop guard.

**Source:** `interpreter.js` — `run()`
**See also:** [step], [Run-time guard flags]

### Trace mode

`-t` flag: a non-interactive per-instruction trace. Before each step prints `<addr>:   <source text>` (from `sourceMap`, falls back to `(unknown)`). After each step prints a diff line: `<r0 = old/new>` per changed register, `<NZCV = nzcv>` if `flagsSet`, `<pc = old/new>` if `hasJumped`. Parallel to debug-mode formatting but routed straight to stdout (skipping `output`) so the trace doesn't pollute the `.lst` reports.

**Source:** `src/core/interpreter.js:191-196, 620-627, 700-744`
**See also:** [debug], [hasJumped], [flagsSet]

### `hexToMnemonic`

Lookup table that decodes a 16-bit machine word back into the mnemonic the assembler used. Tables follow the same dispatch as `step()`: 16-entry base, 14-entry extended (for `CASE10`), 15-entry trap (`HALT`/`NL`/`DOUT`/.../`BP`), 8-entry branch-condition. Unknown mnemonic falls back to `Unknown(<hex>)`. Consumed by `[debug]` for the prompt prefix (e.g. `add>>> `).

**Source:** `interpreter.js` — `hexToMnemonic()`
**See also:** [debug]

### `executeBR`

Conditional branch dispatch. Decodes the 3-bit `code` field into one of 8 conditions: equal (Z=1), not-equal (Z=0), negative (N=1), positive (N==Z), signed less-than (N≠V), signed greater-than (N==V && Z=0), carry (C=1), always. Same condition table as the assembler's branch-code lookup. If condition met, advances PC by `pcoffset9`; sets `hasJumped` accordingly.

**Source:** `interpreter.js` — `executeBR()`
**See also:** [NZCV flags], [Branch condition codes](assembler.md#assembleBR)

### `executeADD` / `executeSUB` / `executeCMP`

The signed-arithmetic trio. Register vs immediate form chosen by `bit5`. Each computes its sum / difference, sets NZCV via `[setNZ]` and `[setCV]`. `executeSUB` and `executeCMP` route through `[toSigned16]` first; `executeADD` works directly on unsigned values for the result computation but uses the operands for overflow detection. `CMP` is `SUB` minus the destination write — same flag side effect, no register mutation.

**Source:** `interpreter.js` — `executeADD()`, `executeSUB()`, `executeCMP()`
**See also:** [setNZ], [setCV], [toSigned16]

### `executeCase10` (extended-opcode dispatch)

The 14-way demux for opcode 10. Each `eopcode` value (0..13) routes to inline logic for PUSH/POP/SRL/SRA/SLL/ROL/ROR/MUL/DIV/REM/OR/XOR/MVR/SEXT. Shift count `ct` is a 4-bit field from bits 8-5 (defaults to 1 when the assembler omits it; SRA range-checks 0..15 strictly, others use naïve parse). DIV / REM by zero throws `[InterpreterRuntimeError]("Floating point exception")` — LCC's idiosyncratic wording for integer-divide-by-zero, matching the oracle. Unknown `eopcode` → `Unknown extended opcode` runtime error (oracle silently exits; LCC.js prefers to surface invalid binaries).

**Source:** `interpreter.js` — `executeCase10()`
**See also:** [executeSEXT], [InterpreterRuntimeError]

### `executeBLorBLR` / `executeJMP`

Branch-and-link / jump dispatch. `executeBLorBLR` reads `bit11`: 1 → BL (PC += pcoffset11 + 1, save old PC in `r[7]`); 0 → BLR (PC = r[baser] + offset6, save old PC in `r[7]`). `executeJMP` handles both JMP and RET (RET being JMP with baser=7); it just sets PC = r[baser] + offset6 and trips `hasJumped`.

**Source:** `interpreter.js` — `executeBLorBLR()`, `executeJMP()`
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

**Source:** `interpreter.js` — `executeSEXT()`, `SEXT_PARITY_TABLE` (const)
**See also:** [signExtendMaskedValue]

### `executeTRAP` (trap dispatch table)

The 15-way trap dispatch by `trapvec`. Vectors match the assembler's encoding exactly: 0 `HALT`, 1 `NL`, 2 `DOUT` (signed decimal), 3 `UDOUT` (unsigned decimal), 4 `HOUT` (hex; `-x` pads to 4 digits), 5 `AOUT` (low 8 bits as ASCII), 6 `SOUT` (null-terminated string from `mem[r[sr]…]`), 7 `DIN` / 8 `HIN` (reprompt on `Invalid <kind> constant. Re-enter:`), 9 `AIN` / 10 `SIN` (line input), 11-13 `M`/`R`/`S` (debug-display traps), 14 `BP` (software breakpoint). Vectors outside this set throw `Trap vector out of range` after a synthetic `"Error on line 0 of <file>"` header.

**Source:** `interpreter.js` — `executeTRAP()`
**See also:** [readLineFromStdin], [readCharFromStdin], [handleSoftwareBreakpoint]

### `readLineFromStdin` / `readCharFromStdin`

Input shims that honour `[inputBuffer]` for simulated input (tests, pure callers). When `inputBuffer` is empty, fall back to a blocking `fs.readSync` on stdin's fd. `readLineFromStdin` handles `\r`, `\n`, and `\r\n` line endings explicitly (Windows-friendliness); `readCharFromStdin` reads one byte at a time. Simulated input is echoed into `[output]` so the listing reports show user input alongside program output.

**Source:** `interpreter.js` — `readLineFromStdin()`, `readCharFromStdin()`
**See also:** [executeTRAP], [inputBuffer (runtime bookkeeping)]

### `handleSoftwareBreakpoint`

Implements the `BP` trap (`0x0e`). If `[allowRuntimeDebugging]` is off, it just throws `[InterpreterRuntimeError]("software breakpoint")`. If on (and we're in a real TTY), prints `"software breakpoint"` and flips into interactive `[debug]`. The distinction lets test runs surface a `BP` cleanly without blocking, while CLI runs drop into the debugger as a developer would expect.

**Source:** `interpreter.js` — `handleSoftwareBreakpoint()`
**See also:** [debug], [canEnterInteractiveDebugger]

### `debug` (interactive debugger)

The Phase-1 oracle-parity debug REPL. Prompt format is `<mnemonic.lowercase()>>> ` (e.g. `add>>> ` or `trap>>> `). The command set matches the oracle subset:

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

**Source:** `interpreter.js` — `debug()`
**See also:** [hexToMnemonic], [canEnterInteractiveDebugger], [Run-time guard flags]

### `canEnterInteractiveDebugger`

Three-way guard: `allowRuntimeDebugging && process.stdin.isTTY && !isTestMode`. Only a real CLI invocation can ever enter the interactive `[debug]` prompt — pure-API callers, in-process tests, and any callsite that didn't opt in via `allowDebugOnInfiniteLoop` will fail-fast or terminate instead of blocking on `readLineFromStdin`.

**Source:** `interpreter.js` — `canEnterInteractiveDebugger()`
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

Reports generated by this path contain a **memory-dump code section** (`Loc   Code` column header, no source text), because the interpreter has no access to the original assembly source. This distinguishes the interpreter-only path from the `lcc.js` combined path, where `assembler.listing` supplies a source-annotated code section alongside the runtime output and statistics. See [`.bst` / `.lst` report](assembler.md#bst--lst) for the full three-caller comparison.

**Source:** `interpreter.js` — `main()`
**See also:** [constructBSTLSTFileName], [executeBuffer]

### `constructBSTLSTFileName`

Sibling-file naming helper: maps `inputFileName + (isBST ? '.bst' : '.lst')` to the report path via the shared `constructSiblingFileName` utility. Used by `main` to compute the report paths printed before `Output` and (via `writeReportFiles`) to write them.

**Source:** `interpreter.js` — `constructBSTLSTFileName()`
**See also:** [`.lst` / `.bst` report](assembler.md#bst--lst)

### `userName` (via `nameHandler`)

User identity string read from `name.nnn` by `nameHandler.createNameFile(inputFileName)`. Inserted at the top of every `.lst` / `.bst` report (right after the `LCC.js Assemble/Link/Interpret/Debug Ver` line). Triggered lazily — only when `generateStats` is true and reports are about to be written.

**Source:** `src/core/interpreter.js:14, 454-463`
**See also:** [main]
