# Codebase quality hotspots — pass 1 of #246

**Spike (≤60m), DRAGONFRUIT, 2026-05-30.** Whole-`src/` sweep ranking the
highest-complexity / lowest-accessibility areas so pass-2 decomplect work can be
*targeted*, not vibes-driven. Read-only analysis; no behavior changed. Each ranked
row carries a suggested decomplect move and a rough effort — those become the
pass-2 `@todo` puzzles (seed list at the bottom).

Lens: cheap structural metrics (LOC, function span, nesting depth, `switch`/`case`
density, CLI-leak count) **×** centrality (core execution path weighs more than
`src/extra` tooling) **×** the [`decomplect`] catalog (state⊗time, inheritance,
syntax-over-data, scattered conditionals, display-braided-into-logic) **×** the
pure-seam/CLI boundary from `CLAUDE.md`.

## Raw signals (collected, not judged)

| file | LOC | fns | max indent | `case` | CLI leaks¹ | largest method (lines) |
|---|--:|--:|--:|--:|--:|---|
| `src/core/assembler.js` | 2282 | 234 | 14 | 92 | 12 | `handleDirective` 211, `handleInstruction` 172, `performPass` 137 |
| `src/core/interpreter.js` | 1731 | 155 | 16 | 53 | 14 | `step` 172, `constructor` 151, `main` 123, `executeTRAP` 122 |
| `src/extra/disassembler.js` | 920 | 96 | **28** | 39 | 18 | — |
| `src/extra/linkerStepsPrinter.js` | 709 | 75 | 12 | 6 | **62** | — |
| `src/interactive/iinterpreter.js` | 471 | 39 | — | — | — | `step` (mode/display tangle, see #134) |
| `src/plus/interpreterplus.js` | 413 | 42 | 14 | 10 | 16 | — |
| `src/core/lcc.js` | 378 | 32 | 16 | 15 | 27 | `main` (orchestration) |
| `src/core/linker.js` | 352 | 41 | 12 | 12 | 4 | constructor+`resetState` (dup), `main`, `link` |
| `src/plus/assemblerplus.js` | 187 | 21 | — | 8 | 9 | `handleInstruction` override |
| `src/utils/picture.js` | 126 | 13 | 16 | 6 | 26 | — (0% test coverage, #172) |
| `src/utils/hexDisplay.js` | 75 | 6 | 12 | — | 6 | — (0% test coverage, #172) |

¹ count of `console.*` / `process.exit` / `require('fs')` occurrences — a proxy for
CLI/IO concerns leaking into what should be a pure seam.

## Ranked hotspots

### 🔴 H1 — `interpreter.js` `step()`: fetch/decode/execute braided with trace+breakpoint+debug+display
- **Signals:** 172-line method; decode phase writes ~15 mutable fields onto `this`
  (`opcode`, `dr`, `sr1`, `imm5`, `pcoffset9`, `eopcode`, `trapvec`, …); four cross-cutting
  concerns interleaved in one loop body — instruction decode, `traceMode` source emit,
  `debugBreakpoint` check, `debugMode` dispatch, and a post-execute register/flag *diff
  printer* (`diffRegisters`, ~lines 685-720).
- **Why hard to change:** state⊗time — every decoded field is instance state mutated
  every tick, so any reader of `this.imm5` must know *when* in the cycle it's valid.
  Display logic (`process.stdout.write`, `<r3 = …>` diff format) lives inside the
  execution core, so you can't reuse decode without dragging the debugger along, and
  you can't test "what did instruction X decode to" without running a full step.
- **Decomplect move:** extract a pure `decode(ir) → {opcode, dr, imm5, …}` value (no
  `this` writes); lift trace/diff emission into an observer the step loop *calls*, not
  *contains* (step returns a delta; the printer consumes it). Pairs with #134's
  statechart framing for the interactive path.
- **Effort:** ~45–60m (decompose: decode-extract first, then display-lift).

### 🔴 H2 — assembler mnemonic dispatch is syntax-over-data, and `plus` re-opens it by inheritance
- **Signals:** `handleInstruction` (172 lines) + `handleDirective` (211 lines) are giant
  `switch (mnemonic)` blocks, each `case` calling an `assembleXXX` method; 92 `case`
  labels in the file. `assemblerplus.js` *overrides* `handleInstruction` with its own
  switch that ends in `default: super.handleInstruction(...)` (same pattern for
  `handleDirective`/`writeOutputFile`).
- **Why hard to change:** syntax-over-data — the mnemonic→encoder mapping is expressed as
  control flow, so it can't be enumerated, validated, or diffed against the ISA table as
  data. Worse, the LCC+ extension is complected into the *class hierarchy*: adding one
  trap means editing the subclass switch while mentally tracking the parent switch.
  `CLAUDE.md`'s standing warning ("check whether the plus subclasses override the method
  you're touching — a core change can be silently shadowed") **is the cost of this
  entanglement, written down.**
- **Decomplect move:** replace both switches with a mnemonic→descriptor table
  (`{mnemonic: {encoder, operandShape}}`); core ships the base table, plus *registers*
  extra entries into it instead of subclassing. Dispatch becomes a one-line table lookup
  shared by both toolchains; the shadowing hazard disappears.
- **Effort:** large — file as an ARC sub-spike, then ≥2 puzzles (table for directives,
  table for instructions, then the plus-registration cutover). Do **not** attempt in one
  60m task.

### 🟠 H3 — `linker.js`: state duplicated across constructor & `resetState`, mid-transition seam
- **Signals:** 11 instance fields initialized identically in `constructor` (l.12-23) **and**
  `resetState` (l.29-40) — add a 12th table and you must touch both or leak state between
  runs. `main`/`link` still own CLI parsing + `fs`, while `parseObjectModuleBuffer` is a
  clean pure seam — the transition `CLAUDE.md` flags as incomplete.
- **Why hard to change:** the dual init is a latent correctness trap (state⊗time across
  reused instances); the half-migrated boundary means callers can't tell which methods are
  pure. Also blocks the planned `linkerplus.js` ([[plus_linker_planned]], #—) from having a
  clean surface to build on.
- **Decomplect move:** make `resetState` the single source of truth and have the
  constructor call it; finish lifting `fs`/CLI out of `link()` into the wrapper so the
  pure link seam matches `assembleSource`/`executeBuffer`.
- **Effort:** ~30m for the dedup; the full pure-seam finish is a separate ~45m puzzle.

### 🟠 H4 — giant constructors as a sprawling mutable-state surface (`interpreter` 151L, `assembler` 137L)
- **Signals:** the interpreter constructor sets ~50 fields; the assembler's ~40. The object
  *is* its entire mutable execution state, all flat on `this`.
- **Why hard to change:** no grouping means no boundaries — registers, flags, I/O buffers,
  debug/trace flags, source-map, and report state all share one namespace, so it's unclear
  which fields are "machine state" vs "run options" vs "diagnostics." Encourages the H1/H3
  state⊗time problems.
- **Decomplect move:** group into cohesive sub-objects (`this.cpu` = regs+flags+pc,
  `this.io` = buffers, `this.diag` = trace/debug/breakpoint). Mechanical but high
  readability payoff; enables targeted reset.
- **Effort:** ~45m per module; do interpreter first (it feeds H1).

### 🟡 H5 — `disassembler.js`: extreme nesting (depth 28), low centrality
- **Signals:** deepest nesting in the repo (~14 levels), 920 LOC, 39 `case`, 18 CLI leaks.
- **Why hard to change:** raw cyclomatic load — but it's in `src/extra`, off the core
  assemble/run path, so blast radius is small.
- **Decomplect move:** guard-clause / early-return flattening + extract the per-opcode
  format arms. Worth doing, lower priority than core.
- **Effort:** ~45m, flatten-only (no behavior change), oracle-diff to confirm.

### 🟡 H6 — `utils/picture.js` & `hexDisplay.js`: 0% coverage, display logic with 26/6 CLI leaks
- **Signals:** already tracked by **#172** (refactor-gated coverage). `picture.js` mixes
  formatting with `console` output at nesting depth 16.
- **Why hard to change:** untestable as-is (no pure seam), so it's both a coverage and a
  decomplect target — separate the string-building from the printing and the tests follow.
- **Decomplect move:** split pure `formatPicture() → string` from the `console.log` sink;
  this is the refactor #172 is gated on. **Coordinate with / fold into #172** rather than
  double-tracking.
- **Effort:** ~30m; unlocks #172.

## Not hotspots (checked, deliberately excluded)
- `linkerStepsPrinter.js` — 709 LOC / 62 CLI calls, but it's a *printer*; output IS its
  job. Size ≠ entanglement here. Leave unless it grows logic.
- `src/utils/{errors,cliExit,fileArtifacts,reportArtifacts}.js` — small, single-purpose,
  already the right shape (these are the seams others should imitate).
- `gameSnake.ap` code quality → **#202**; TIL→improvement mining → **#207**;
  iinterpreter mode/display statechart → **#134** (H1 should coordinate with it).

## Pass-2 puzzle seed list (to be filed as `@todo #M:Est/ROLE`, sized here)
1. **H3 dedup** — `resetState` as single source of truth, constructor delegates. `~30m/DEV`.
2. **H6 / #172** — split `picture.js`/`hexDisplay.js` pure-format vs print. `~30m/DEV` (fold into #172).
3. **H1a** — extract pure `decode(ir)` from `step()`. `~45m/DEV`.
4. **H1b** — lift trace/register-diff display out of `step()` into an observer. `~45m/DEV` (after H1a; coordinate #134).
5. **H4** — group interpreter constructor state into `cpu`/`io`/`diag`. `~45m/DEV`.
6. **H2 (ARC sub-spike)** — design the mnemonic→descriptor table + plus-registration cutover. `~60m/ARC`, then decompose.
7. **H5** — flatten `disassembler.js` nesting (guard clauses), oracle-diff verified. `~45m/DEV`.

Recommended order: H3 → H6 → H1a → H1b → H4 → (H2 spike) → H5. Early items are
self-contained, low-risk wins that build the testing seams the harder ones lean on.

[`decomplect`]: ../../.. "decomplect skill — Rich Hickey 'Simple Made Easy' catalog"
