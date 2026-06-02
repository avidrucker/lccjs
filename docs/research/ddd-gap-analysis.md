# DDD Gap Analysis — Architect Decisions

**Ticket:** #402 · **Role:** ARC · **Agent:** ELDERBERRY · **Model:** sonnet-4.6
**Input docs:** `lccjs-ddd-analysis.md`, `mnemonic-descriptor-table.md` (#253 spike)

---

## Snapshot: domain model as it stands

Before deciding, a brief ground-truth survey of the current state:

| Module | Lines | Domain concern | Key implicit concepts |
|--------|-------|---------------|----------------------|
| `assembler.js` | 2287 | Source → machine words | `symbolTable {}`, `outputBuffer []`, `pass`, `locCtr` — raw fields on the class |
| `interpreter.js` | 1750 | Machine execution | `mem Uint16Array(65536)`, `r Uint16Array(8)`, `pc`, `n/z/c/v` flags — raw fields |
| `linker.js` | 345 | Object module → executable | `mca`, `GTable`, `ETable`, `eTable`, `VTable`, `ATable` — abbreviated, inline comments document intent |
| `lcc.js` | 388 | CLI orchestration | Lives in `src/core/`; imports all three domain modules + ILCC; pure app service |
| `iinterpreter.js` | 673 | Step-debugger execution | Extends Interpreter; adds `snapshot[]`, `paneLayout`, `programOutput` |
| `errors.js` | 31 | Typed failure vocabulary | `AssemblerError`, `LinkerError`, `InterpreterRuntimeError`, `InvalidExecutableFormatError` in `src/utils/` |

The DDD analysis is accurate. The bones are good (bounded contexts, pure API seams, anti-corruption layer); the gaps are real.

---

## Decisions

### Decision 1: Which gaps are in scope?

**Out of scope (leave alone):**

- **errors.js location (gap 3):** The shared-kernel placement in `src/utils/` is pragmatically correct for this project. Moving each error type into its own bounded context would require cross-context imports and scatter a 31-line file into 4. The conceptual misclassification is real; the practical cost is zero. Revisit only if the project splits into independently-deployable services.

- **Report generation location (gap 6):** `genStats.js` / `reportArtifacts.js` in `src/utils/` causes no friction. They're used the same way as other shared utilities and are not a source of confusion. Leave in shared kernel.

- **name.js (gap 7):** Already architecturally mitigated. The pure API accepts a `userName` option; `name.js` is only called from CLI paths. The domain is clean in practice; the doc critique doesn't reflect the current separation.

**In scope (action these):**

- **Linker table renaming (gap 2):** High clarity / zero functional risk. The linker is the least-refactored module; the cryptic names make it hard to work in. The inline comments already record the intended names — the rename just makes the code match its own documentation.

- **`lcc.js` relocation (gap 4):** Low-to-medium churn, high architectural signal. Moving `lcc.js` from `src/core/` to `src/cli/` makes the layered architecture visible without touching any logic.

- **LCC+ extension seam (gap 5):** The descriptor-table migration (#253 spike) is the mechanism; it needs DEV follow-through (Puzzles A+B). Already designed and reviewed.

- **Explicit domain objects (gap 1):** The right long-horizon goal, but not the right first move. Let #252/#255 execute and consolidate interpreter state first. File follow-on extraction tickets after they close.

---

### Decision 2: Sequencing

Ordered by impact-to-risk ratio:

1. **Linker table rename** (~30m DEV) — rename 6 table identifiers across `linker.js`. No behavioral risk, immediate readability win, unblocks confident linker work.
2. **`lcc.js` relocation** (~45m DEV) — `mv src/core/lcc.js src/cli/lcc.js`, update all imports. Needs an import audit (tests, package.json `bin`, any relative paths). No logic changes.
3. **Descriptor table migration** (~45+25m DEV, two puzzles) — implement #253 Puzzles A+B. After these, `AssemblerPlus.handleInstruction` is deleted, the write-ownership asymmetry is gone, and the CLAUDE.md "silently shadowed" warning can be retired.
4. **Domain model extraction** (open-ended) — extract `SymbolTable`, `MachineState`, `ObjectModule` as first-class types. Begin after #252/#255 close; scope incrementally as follow-on tickets.

---

### Decision 3: Does the DDD framing change #252 or #255 scope?

No. Both tickets are already correctly scoped:

- **#252 (H1b):** Lift trace + register-diff out of `step()` into an observer. The DDD framing reinforces *why* this matters (execution domain ≠ observability infrastructure) but doesn't change *what* the ticket does. No scope expansion.

- **#255 (H4):** Group interpreter constructor state into `cpu/io/diag` sub-objects. The DDD ideal would go further (make `cpu` a proper `MachineState` class), but that's follow-on scope, not this ticket. Let H4 execute as written; if after it closes the grouping invites further extraction, that's a new ticket.

---

### Decision 4: `errors.js` relocation

**Keep `src/utils/errors.js` as is.** The shared kernel placement is correct at this project's scale. See Decision 1.

If a future refactor moves toward independent bounded contexts with their own packages, revisit then. For now, any move creates friction for zero gain.

---

### Decision 5: LCC+ extension seam — endorse #253 descriptor-table design?

**Yes, endorsed as the canonical LCC+ extension model.**

The spike design is sound:
- Unifies write-ownership asymmetry (plus instructions no longer call `writeAndInc` internally)
- Makes ISA extension a single table-entry addition, not a two-switch edit
- Risk matrix is complete; oracle-parity verification path is specified
- `AssemblerPlus.handleInstruction` override deletes entirely — no more "silently shadowed" hazard

After Puzzles A+B land, adding a new LCC+ instruction is one `_instructionTable` entry in `AssemblerPlus.constructor()`. The CLAUDE.md "check whether the plus subclasses override the method you're touching" warning can be retired for `handleInstruction`.

---

## Follow-on puzzles to drop

Three new scope puzzles to file from this analysis:

**P1 — Linker table rename** (~30m DEV)
- Rename in `linker.js`: `mca` → `machineCode`, `GTable` → `globalSymbols`, `ETable` → `externalRefs11`, `eTable` → `externalRefs9`, `VTable` → `virtualAddressRefs`, `ATable` → `localRefs`
- Run `npm test` and `npm run test:oracle` — no behavioral change expected
- Parent: #402

**P2 — Relocate `lcc.js` to `src/cli/`** (~45m DEV)
- Move `src/core/lcc.js` → `src/cli/lcc.js`
- Update `package.json` `bin` field, all `require` paths in tests and any other importers
- Verify `npm run test:all` passes; no logic changes
- Parent: #402

**P3 — Descriptor table migration Puzzles A+B** (already designed in #253 spike)
- File as two tickets linking back to `docs/research/mnemonic-descriptor-table.md`
- Puzzle A: Core instruction table (~45m DEV)
- Puzzle B: Plus registration cutover (~25m DEV)
- Parent: #253 (already closed spike)

Domain model extraction (gap 1) does not get a ticket now — scope after #252 and #255 close.

---

## Summary scorecard (architect view)

| Gap | DDD Severity | Architect Decision | Ticket |
|-----|-------------|-------------------|--------|
| Explicit domain objects | ⚠️ Weak | In scope, deferred — wait for #252/#255 | Follow-on after those close |
| Linker table names | ⚠️ Weak | In scope, priority 1 | File P1 |
| `errors.js` in utils | Minor | Out of scope — shared kernel is correct | None |
| `lcc.js` in `src/core/` | 🔶 Moderate | In scope, priority 2 | File P2 |
| LCC+ extension seam | ⚠️ Weak | In scope, priority 3 — #253 design endorsed | File P3a+P3b |
| Report generation in utils | Minor | Out of scope | None |
| `name.js` FS coupling | Minor | Out of scope — already mitigated | None |
