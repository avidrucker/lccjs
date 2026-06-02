# TIL 2026-06-02 — CHERRY (session 2)

**Ticket closed:** #500  
**Role:** RESEARCH

---

## .org parity — three oracle probes, four decisions

### Setup

Three probe files existed in `experiments/` from FIG's #218 triage. Ran each against the
oracle (`$LCC_ORACLE`) and LCC.js, then compared stdout, stderr, exit codes, and artifact
files. Also ran an additional `.orig` synonym probe.

---

### Decision 1: Forward-gap padding — parity achieved

`org_forward_gap.a` (`.word 11` at addr 0, `.org 4`, `.word 22` at addr 4):

Oracle and LCC.js produce **byte-identical output**:
```
6f530500430b000000000000001600fa2102f001f0fb2102f001f000f0
```
Both pad intervening words 1–3 with zero. Parity is complete.

**Outcome:** parity test added — `tests/new/assembler.org.oracle.e2e.spec.js`.

---

### Decision 2: Failure artifact — covered by existing §10

Both `org_backward_overlap.a` and `org_invalid_operand.a` fail assembly. Oracle leaves a
1-byte `6f` artifact (blank `.e`) in both cases; LCC.js writes nothing.

This is the existing OG BUG §10 pattern — oracle emits a blank `.e` on *any* Pass-1 error,
not just undefined labels. The DRAGONFRUIT-3 synthesis already flagged §10's title as too
narrow; no new deviation entry needed here.

---

### Decision 3: `.orig` synonym — parity already implemented

`assertOracleConfigured()` confirmed oracle accepts `.orig` identically to `.org`. LCC.js
already handles `.orig` via a `case` fall-through at `assembler.js:1098–1099`. Both
produce the same encoding as `.org`.

**Outcome:** parity test covers this — same spec, `D2` tests.

---

### Decision 4: Invalid operand error message — BY DESIGN deviation §22

For `.org banana`:
- Oracle: `Bad number` (stdout)
- LCC.js: `Invalid number for .org directive` (stderr)

Message text differs. LCC.js is more informative — identifies the directive context.
Documented as `parity_deviations.md §22`, classified BY DESIGN.

---

### What I learned: the `.env` worktree gap

Oracle tests auto-skip when `LCC_ORACLE` is unset. The `.env` file is gitignored, so
worktrees start without it. A fresh `cp .env <worktree>/.env` is needed before oracle
tests will run. This should be added to `docs/oracle-setup.md` as a worktree note.

---

### Deliverables

| File | Change |
|---|---|
| `tests/new/assembler.org.oracle.e2e.spec.js` | New parity test (D1, D2) — 4 tests all green |
| `docs/parity_deviations.md §22` | New BY DESIGN entry for `.org` invalid operand message |
| `docs/parity_deviations.md changelog` | Row added for 2026-06-02 |
