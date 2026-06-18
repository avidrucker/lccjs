# Table-Driven Interpreter Trap/Eopcode Dispatch — Design

**Issue:** #1346 · **Role:** SPIKE (ARC) → spawns DEV · **Date:** 2026-06-18 · **Agent:** DRAGONFRUIT
**Source:** #1345 audit (site 3, recommendation #1) · **Precedent:** #417 (assembler-side cutover)

> **Scope:** Design only — **no production code changed by this ticket.** Output is this design
> + the DEV implementation puzzle(s) it spawns (linked at the bottom). Do not start the DEV
> refactor inside #1346 (yegor: architect before courier).

---

## 1. The current shape (what we are migrating)

### Core (`src/core/interpreter.js`)

| Site | Form | Lines |
|---|---|---|
| `step()` | 16-way `switch (this.opcode)` | 786–840 |
| `executeCase10()` | 14-way `switch (this.eopcode)` (opcode 10), `default` → `UNKNOWN_OPCODE` | 1246–1354 |
| `executeTRAP()` | 15-way `switch (this.trapvec)` (vectors `0x00`–`0x0E`), `default` → `TRAP_VECTOR_RANGE` | 1726–1855 |

All handlers are **instance methods** that read/write decoded fields published onto `this` by
`Object.assign(this, this.decode(this.ir))` in `step()` (`this.opcode/eopcode/trapvec/dr/sr/sr1/bit5`,
plus CPU state `this.mem/r/pc/running/n/z/c/v`).

### Plus (`src/plus/interpreterplus.js`)

`InterpreterPlus extends Interpreter` and overrides dispatch in two places:

- **`executeTRAP()`** (378–430): consults `this._extTrapHandlers[trapvec]` **first**, then a hardcoded
  `switch` over plus vectors, then falls through to `super.executeTRAP()` for core vectors.
- **`executeCase10()`** (445–454): `EOP_RAND` → `executeRand()`, else `super.executeCase10()`.

The plus switch dispatches **13** vectors:

| Kind | Vectors | Notes |
|---|---|---|
| **New** plus traps | `TRAP_WHO 0xF5` … `TRAP_RESETC 0xFF` (11 vectors) | high end of the 8-bit space, **reserved by convention only** |
| **Overrides** of core vectors | `TRAP_HALT 0x00`, `TRAP_BP 0x0E` | ⚠ behavioral overrides, see below |

Plus the one extended-opcode: `EOP_RAND 0x0E` (opcode-10 sub-op).

> ⚠ **Key finding the audit under-stated:** the plus dispatch is **not purely additive.** `TRAP_HALT`
> is re-handled to also call `resetProcessStdin()` (leave raw mode), and `TRAP_BP` is swapped from
> core's `handleSoftwareBreakpoint()` to `executeLccPlusBreakpoint()` (await-keypress + resume the
> async loop). Any registry design **must** let an extension intentionally *override* a core vector,
> not merely register unused ones. This directly shapes the answer to Q3.

### The shadow hazard (why we are here)

The vector range `0xF5`–`0xFF` is reserved **by convention only** — nothing in the base enforces
it. A change to base `executeTRAP`/`step`/dispatch can silently break or be shadowed by LCC+. The
right seam (`_extTrapHandlers` + `registerExtension()`) already exists but the plus traps bypass it
through the override `switch`. This is the exact mistake #417 already fixed on the assembler half.

---

## 2. The proven mirror: what #417 did on the assembler

`AssemblerPlus` no longer overrides `handleInstruction`. Its constructor writes 13 mnemonic entries
**into the shared `this._instructionTable`** the base owns (`assemblerplus.js` 17–34), and
`registerExtension(ext)` (39–48) lets external modules add more. Adding a core mnemonic can no
longer be shadowed because there is no override to shadow — both core and plus *register into one
base-owned table* and the base does the lookup.

**This design applies that same move to the interpreter's trap and eopcode dispatch.**

---

## 3. Spike questions — answered

### Q1 — Handler context contract → **explicit-arg `(vm) => …`**

**Decision:** registered handlers are plain functions taking the interpreter as an explicit
argument: `handler(vm)`, where `vm` is the interpreter instance. They read/write `vm.mem`, `vm.r`,
`vm.trapvec`, `vm.dr`, `vm.running`, etc.

**Why, over bound methods (`fn.bind(this)`, the current `_extTrapHandlers` form):**

1. **Testability** — an explicit-arg handler is callable against a minimal stub `{ r:[…], mem:[…],
   dr, … }` with no interpreter construction and no `this` ceremony. This is the same pure-seam
   discipline CLAUDE.md pushes for (handlers become data + a function, not behavior welded to a
   class).
2. **Decouples handler from inheritance** — the whole point of the migration is that LCC+ stops
   being a *dispatch subclass*. A handler that closes over `this` keeps the inheritance assumption
   alive; `(vm) =>` makes the context a parameter, so the same handler works whether `vm` is a core
   `Interpreter`, an `InterpreterPlus`, or a future configured instance.
3. **Cheap, mechanical port of the 11 plus methods** — `executeClear()` et al. already only touch
   `this`. They register as thin adapters `(vm) => vm.executeClear()` **or** are rewritten to take
   `vm`. Either way the body is unchanged; only the call surface moves. The existing
   `_extTrapHandlers` `.bind(this)` indirection is *removed*, not ported.

**Justification check against the constraint** ("InterpreterPlus's existing handlers must port
cleanly"): yes — keep the 11 `executeX()` methods as-is and register `(vm) => vm.executeClear()`
adapters in the minimal cut; promote them to free `(vm) =>` functions later if/when LCC+ retires as
a class (Q4 follow-on). No handler logic is rewritten in the minimal cut.

> Note the assembler precedent uses closures-over-`this` (`(ops) => this.assembleTrap(...)`), which
> is the bound-method flavor. We deliberately diverge to `(vm) =>` for the interpreter because
> interpreter handlers mutate far more shared CPU state than assembler encoders, so the testability
> win is larger and the explicit context is worth more. Flag this divergence for Charlie.

### Q2 — Registry shape + ownership → **two base-owned tables; `registerExtension` becomes the one mechanism**

The **base `Interpreter`** owns two registries, populated in its constructor with the core handlers:

```
this._trapTable    = { [trapvec:int]:  (vm) => void }   // vectors 0x00–0x0E today
this._eopcodeTable = { [eopcode:int]:  (vm) => void }   // sub-ops of opcode 10
```

- **Core** registers its 15 traps + 14 eopcodes into these tables in the base constructor (replacing
  the two big `switch` bodies).
- **`executeTRAP()`** becomes: `const h = this._trapTable[this.trapvec]; if (!h) raise(TRAP_VECTOR_RANGE); h(this);`
- **`executeCase10()`** becomes the same against `_eopcodeTable`, `default` → `UNKNOWN_OPCODE`.
- **Plus** registers `TRAP_WHO…TRAP_RESETC` + the two overrides + `EOP_RAND` into the **same** base
  tables — in `InterpreterPlus`'s constructor, after `super()`.
- The existing **`_extTrapHandlers`/`registerExtension(ext)`** is folded into this: `registerExtension`
  writes into `_trapTable` (and, extended, `_eopcodeTable`) via the guarded `registerTrap` API below.
  The separate `_extTrapHandlers` map and its first-place lookup in `executeTRAP` are **deleted** —
  one mechanism, one lookup.

`step()`'s 16-way opcode switch is **left as-is** — it is a fixed 4-bit space (0–15), fully covered,
never extended by plus, and not a shadow hazard. Converting it is out of scope (note it as a
possible later tidy, not a goal).

### Q3 — Collision / range enforcement → **guarded `registerTrap(vec, handler, {override})`**

Replace the convention-only reservation with an explicit base API:

```
registerTrap(vec, handler, { override = false } = {}) {
  if (this._trapTable[vec] && !override) {
    throw new Error(`trap vector 0x${vec.toString(16)} already registered (pass {override:true} to replace)`);
  }
  this._trapTable[vec] = handler;
}
```

- **Default = error on double-booking.** This is the same "no double-booked keys" discipline #1342
  is applying to the *debugger command table* (different layer, same principle — cross-reference, do
  not share code).
- **`{override:true}` is the escape hatch the real code needs** — because plus *legitimately*
  overrides `TRAP_HALT` and `TRAP_BP` (see §1). Making override silent would re-hide the hazard;
  making it impossible would break LCC+. An explicit `{override:true}` at the plus registration site
  documents the intentional shadow *as data at the call site*, which is strictly better than today's
  invisible `super`-fallthrough.
- **Range validation:** assert plus's *new* vectors land in the reserved high band
  (`0xF5 <= vec <= 0xFF`) and core's in the low band (`vec <= 0x0E`); a *new* registration (override
  false) outside its band throws. This converts the comment-only reservation into a runtime guard.
- An analogous `registerEopcode(code, handler, {override})` guards `_eopcodeTable` (plus's `EOP_RAND
  = 0x0E` is a *new* eopcode above core's `EOP_SEXT = 0x0D`, so it registers with `override:false`).

### Q4 — Construction path → **minimal cut now; full `InterpreterPlus` retirement is a separate, larger effort**

Can `.ap` run a *configured base `Interpreter`* instead of an `InterpreterPlus` subclass? **Not from
this ticket — and dispatch is not what blocks it.** `InterpreterPlus` overrides three things that are
**not dispatch concerns**:

- `main()` — `.ep` arg parsing + raw-mode stdin wiring,
- `loadExecutableBuffer()` — `.ep` (`op`-signature) header verification,
- `startNonBlockingLoop()` / `runBatch()` — the `setImmediate` async run loop (vs core's synchronous
  `run()`), plus `handleRuntimeError`, `keyQueue`, `screenManipulated`.

Table-driven dispatch removes the **dispatch** override only. Retiring the class entirely would also
require lifting the async loop + `.ep` load path + non-blocking input config into either the base or
a separate runner object — a materially bigger change with its own blast radius.

**Minimal cut that removes the shadow hazard (this ticket's target):** base owns `_trapTable` /
`_eopcodeTable` + guarded register APIs; core and plus both register into them; `InterpreterPlus`
**deletes its `executeTRAP` and `executeCase10` overrides** and instead registers its handlers in its
constructor. The class stays (for `main`/load/async-loop), but it is **no longer a dispatch
subclass** — exactly the hazard CLAUDE.md warns about is gone. Full retirement is filed as a
**follow-on ARC** (not a DEV here), explicitly out of scope.

### Q5 — ROI / risk + cut plan

**Blast radius:** base `executeTRAP`/`executeCase10` (two switch bodies → table lookups), the base
constructor (register ~29 core handlers), `InterpreterPlus` (delete 2 overrides, add ~14
registrations), the `_extTrapHandlers`/`registerExtension` seam (collapse into the table), and
`src/plus/play.js`'s `registerExtension` consumer. The `.ep` load path and `main` are **untouched**.
Test surface: existing core trap/eopcode e2e + the LCC+ trap suites must stay green; add unit tests
for the register guard.

**Risk:** medium-low. The behavior per vector is unchanged — only the dispatch mechanism moves. The
one subtlety is preserving plus's `TRAP_HALT`/`TRAP_BP` overrides via `{override:true}` (don't let
them silently no-op). Oracle parity is unaffected (trap *semantics* don't change).

**DEV puzzle breakdown (each ≤60m H):**

1. **DEV-A — base trap/eopcode registry + core conversion.** Add `_trapTable`/`_eopcodeTable`,
   `registerTrap`/`registerEopcode` (with the double-book + range guards, Q3), register all core
   handlers in the base constructor, convert `executeTRAP`/`executeCase10` to table lookups keeping
   the existing `TRAP_VECTOR_RANGE` / `UNKNOWN_OPCODE` defaults. ~50m.
2. **DEV-B — port LCC+ onto the registry.** In `InterpreterPlus`'s constructor register the 11 new
   trap vectors + `EOP_RAND`, plus `TRAP_HALT`/`TRAP_BP` with `{override:true}`; delete the
   `executeTRAP`/`executeCase10` overrides and the now-redundant `_extTrapHandlers` map; route
   `registerExtension` (and `play.js`) through `registerTrap`. ~45m. **Depends on DEV-A.**
3. **DEV-C — guard tests.** Unit tests for `registerTrap`/`registerEopcode`: double-book throws,
   `{override:true}` replaces, out-of-band new vector throws; smoke that an LCC+ `.ap` still runs all
   extras. ~35m. **Depends on DEV-A; can land alongside DEV-B.**

**Follow-on (NOT filed as DEV here):** ARC re-scope of full `InterpreterPlus`-as-class retirement
(lift `.ep` load + async loop into base/runner so `.ap` runs a configured base `Interpreter`).
Larger; revisit after DEV-A/B/C. Coordinate with the #1352 tripwire (post-composition constructor
state-grouping re-scope) and the #429 decomplect tracker.

---

## Open questions for the human / Charlie (`@ItBeCharlie`)

1. **Context-contract divergence from #417.** The assembler half uses closures-over-`this`; this
   design picks explicit-arg `(vm) =>` for the interpreter (Q1). Accept the divergence for
   testability, or keep symmetry with #417 and use bound methods?
2. **Override visibility.** Is `{override:true}` at the plus registration site the right way to encode
   the intentional `TRAP_HALT`/`TRAP_BP` shadow, or should those two be modeled as core "hooks"
   (e.g. base `onHalt()`/`onBreakpoint()` the subclass sets) rather than vector overrides?
3. **Eopcode table scope.** Worth converting `executeCase10` in the same pass (DEV-A), or is the
   trap table the higher-ROI half to do first and the eopcode half a fast-follow?
4. **`step()` opcode switch.** Leave the 16-way opcode switch alone (recommended), or fold it into the
   table pattern for uniformity even though it is a closed 4-bit space with no extension hazard?
