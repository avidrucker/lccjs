# TIL 2026-06-01 — FIG (session 4)

**Tickets closed:** #425 (research), #416 (DEV), #417 (DEV)  
**Tickets filed:** #432 (research follow-up)  
**Roles:** RESEARCH × 1, DEV × 2

---

## 1. Instance tables let subclasses extend without overriding

The `_instructionTable` is built as an instance property in `Assembler.constructor()`,
not as a static. That one decision is what makes the whole refactor work:

```js
// Assembler constructor
this._instructionTable = this._buildCoreTable();

// AssemblerPlus constructor (after super())
const t = this._instructionTable;
t['clear'] = { encoder: (ops) => this.assembleTrap(ops, 0x000F), ... };
```

Because `super()` runs first and the table is already on `this`, the subclass can mutate
it directly in its own constructor — no method override needed. A static table would
have forced a class-level merge that either bloats the parent or requires the subclass
to override `_buildCoreTable` anyway. Instance property + constructor mutation is the
clean pattern for inheritance-friendly extension tables.

---

## 2. Write-ownership must be uniform before registration is safe

The old `AssemblerPlus.handleInstruction` switch called `this.writeAndInc(machineWord)`
inside each plus case, while core instructions were written by the parent loop. This
asymmetry was load-bearing: if you registered plus mnemonics into the table *without*
fixing it first, the parent dispatch loop would call `writeMachineWord` again on top of
the plus case's own write — double-write, silent corruption.

The fix is conceptually simple: descriptors must be pure encoders — they return a word
or null, and nothing else. The dispatch loop exclusively owns write+locCtr. Once that
contract is in place, all mnemonics (core and plus) are safe to register.

**Lesson:** before migrating a dispatch mechanism, audit who owns side effects. Unified
ownership is a prerequisite for safe registration, not a nice-to-have.

---

## 3. "Calls super?" is the right diagnostic for shadow hazards

During the #425 static analysis, the quickest way to classify each override was a single
`grep -n 'super\.'` across both plus files. Every override that calls `super` in a
`default` branch is an intentional *extension* — it handles new cases and falls back to
the parent for the rest. Every override that never calls `super` is a *shadow* — it
silently replaces the parent's behaviour entirely, and any change to the parent goes
unnoticed.

`InterpreterPlus.loadExecutableBuffer` stands out: it fully reimplements header parsing
with no super call. If the core `.e` format gains a new header entry type, the `.ep`
parser stays frozen on the old format with no error. The "calls super?" question surfaces
this risk immediately without reading all 200 lines.

---

## What went well

- **Puzzle A → B sequencing paid off** — #416 was purely `assembler.js`; #417 was purely
  `assemblerplus.js`. No file touched twice, no merge conflicts, clean git history.
  Scoping each puzzle to a single file also made the test feedback crisp: if
  `assemblerplus.unit.spec.js` fails after #417, the cause is in exactly one file.
- **The design doc did its job** — `docs/research/mnemonic-descriptor-table.md` had the
  complete table skeleton, the write-ownership warning, and the plus registration snippet.
  Implementation was transcription + verification, not design-under-fire. Accurate
  upfront spike work converts implementation from a thinking problem to a typing problem.

## What didn't go well

- **Indent-regex method extraction had false positives** — module-level functions in
  `interpreterplus.js` share the same 2-space indent as class methods, so the extractor
  flagged `if`, `resetProcessStdin`, and `exitProcess` as class methods. Harmless once
  spotted, but an AST-based tool would be cleaner for future audits.
