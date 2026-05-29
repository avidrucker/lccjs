# DRY analysis: core symbolic debugger vs the `ilcc`/`iinterpreter` extension

**Issue:** #146 (research/ARC spike, ≤60m) · **feeds:** #134 (statechart for `iinterpreter.js`)
**Date:** 2026-05-28

## Question

Two stepping/interactive execution paths appear to reimplement overlapping
logic. Map the overlap, ROI-rank it, and recommend what to consolidate (and what
to leave separate) — *before* #134 models a statechart, so the statechart targets
consolidated code rather than codifying duplication.

## The two paths

| | Core symbolic debugger | Interactive `ilcc` extension |
|---|---|---|
| Files | `src/core/interpreter.js` (`debug()`, `step()` diff block, `_debugShow*`) | `src/interactive/iinterpreter.js` (466 L) + `ilcc.js` (174 L) |
| Class | `Interpreter` | `IInterpreter extends Interpreter` |
| Prompt | `mnemonic>>> ` | `Input: ` |
| Commands | Enter/q/g/`b`/`r`/`m`/`i`/`h`/`s`/`c` | `N`/`-N`/`0`/`a`/`m`/`s`/`h`/`q` |
| Display | oracle-parity text (`<r0 = 0/5>`, `pc=… ir=… NZCV=…`) | rich TUI panes (ANSI color, mem grid, stack window, source snippet) |
| Direction | forward-only | forward **+ backward** (snapshot time-travel) |
| Purpose | byte-exact oracle parity (tested) | exploratory debugging UX |

**Crucial framing:** the *execution* core (fetch/decode/`execute*`, `loadExecutable`,
`signExtend`, the 500k cap) is **already shared** — `IInterpreter.step()` calls
`super.step()`. So this is **not** "two interpreters." The duplication is confined
to the **debug/display layer**, and the two layers are *deliberately different
products* (oracle-faithful vs TUI). That distinction drives the recommendation:
**share the data/logic beneath them; do NOT merge their presentation.**

## Overlap inventory, ROI-ranked

ROI = (shared surface × drift-risk if duplicated) ÷ extraction risk.

| # | Overlap | Where (duplicated in) | ROI | Recommendation |
|---|---|---|---|---|
| 1 | **Changed-state diff** — "which regs/flags/pc changed since the previous step" | core `step()` ll.702–744 (inline `<rN=old/new>`/`<NZCV>`/`<pc>`) **vs** `iinterpreter.displayRegisters()` ll.214–251 (prev/curr snapshot diff) | **HIGH** | Extract a pure `diffState(prev, curr)` → `{regs:[{i,old,new}], flags, pc}`. Each debugger *renders* the result its own way. This is the one piece of real shared **logic** (the rest is presentation), and it's subtle — drift here = parity bugs. |
| 2 | **Hex/format helpers + register-name table** — `h4 = v=>(v&0xFFFF).toString(16).padStart(4,'0')`; `sp/fp/lr` aliasing | redefined ~6×: `iinterpreter` ll.217, 258, 279, 280 (REG_ALIASES); core `_debugShowRegs` l.990, `_debugShowMem` | **HIGH** | Extract `format.js` (`h4`, `REG_NAMES`, `REG_ALIASES`). Trivial, zero-risk, kills ~6 copies. |
| 3 | **Machine-state "view" accessor** — regs/flags/pc/ir + a mem window + a stack window, as plain data | core reads `this.r`/`this.mem` ad hoc in `_debugShow*`; `iinterpreter` reads via `snapshot[]` entries | MED | Optional: a normalized `stateView` (the snapshot shape is already close). Lets both derive panes from one accessor. Defer until #1/#2 land. |
| 4 | **Register / memory / stack pane rendering** | core `_debugShowRegs`/`_debugShowAllMem`/`_debugShowMem`/`s`-cmd **vs** `iinterpreter.displayRegisters`/`displayMemory`/`displayStack` | LOW | **Leave separate.** Output is intentionally different (oracle-exact text vs colorized TUI). A shared renderer would risk drifting the oracle-parity text, which is regression-tested. Share the *data* (#1, #3), not the layout. |
| 5 | **Prompt command dispatch** (ad-hoc string/regex if-chains) | core `debug()` ll.880–976 **vs** `iinterpreter.runInteractive()` ll.383–446 | LOW | **Leave separate.** Two different command *languages* by design (oracle keys vs TUI keys). A shared command-table pattern is possible but low payoff; not worth coupling. |
| 6 | **CLI driver orchestration** (arg parse → assemble → load → run) | `ilcc.js` ll.48–153 mirrors `lcc.js` | LOW | Out of scope for this spike (debugger DRY); note for a separate driver-DRY ticket if it bites. |

## Recommendation

**Consolidate the substrate, keep the two debuggers as distinct front-ends.**

Create a small shared debug-support layer that both `Interpreter` (oracle
debugger) and `IInterpreter` (TUI) depend on:

- **`src/core/debug/format.js`** — `h4()`, `REG_NAMES`, `REG_ALIASES`. (overlap #2)
- **`src/core/debug/stateDelta.js`** — pure `diffState(prev, curr)` returning the
  changed regs/flags/pc; no formatting. (overlap #1)

Explicitly **do not** merge: the two prompt loops, the two command languages, or
the two presentation layers (#4, #5). The oracle-parity display text in core
`debug()`/`step()` is byte-exact-tested against the real `lcc`; routing it through
a shared renderer would put that parity at drift risk for little gain.

### Hand-off to #134 (statechart)

The statechart should model `iinterpreter.runInteractive()`'s loop — an **exec
region** (running/paused/stepping/awaiting-input/halted) with an orthogonal
**display region** (which panes/anchors are active) — and treat the extracted
`stateDelta`/`format` modules as **pure dependencies it calls**, not logic it
re-embeds. Module boundary for #134: `runInteractive` = the machine's event loop;
`renderDisplay` = the display region's side-effect; `diffState`/`format` = pure
deps. The per-opcode `step()` switch stays a switch (out of scope, per #134).

## Decomposed build puzzles

Both are independently grabbable; do #2-equivalent first (zero-risk warm-up):

- **Build A — `format.js` (#163)** (~30m/DEV, low risk): extract `h4` + register
  name/alias tables; replace the ~6 local redefinitions across `interpreter.js`
  and `iinterpreter.js`. No behavior change; existing tests must stay green.
- **Build B — `stateDelta.js` (#164)** (~45m/DEV, medium risk): extract pure
  `diffState(prev, curr)`; route core `step()`'s inline diff and
  `iinterpreter.displayRegisters()`'s change-detection through it. **Acceptance:
  oracle-parity test output (`<rN=old/new>`, `<NZCV>`, `<pc>`) is byte-identical
  before/after** — this is the risk, so add/run the oracle diff suite as the gate.

(Overlap #3 `stateView` is deferred — re-evaluate after A/B; #4/#5/#6 are
"leave separate" with rationale above.)

Markers go in at build-start (these doc-tracked build issues are the backstop
until then; `docs/**` is not pdd-scanned).
