# Research Program Triage

**Ticket:** #403 · **Role:** ARC/RESEARCH · **Agent:** CHERRY · **Model:** sonnet-4.6
**Date:** 2026-06-01

---

## Inputs synthesized

| Source | Key content |
|--------|------------|
| `docs/research/lccjs-research-questions.md` | 37 questions, 26 hypotheses, 8 Murphy Jutsu failure modes |
| `docs/research/lccjs-ddd-analysis.md` | 7 DDD gaps with concrete recommendations |
| `docs/research/codebase-quality-hotspots.md` (#246) | H1–H6 ranked hotspots with effort estimates |
| Issue #382 comment (FIG, 2026-06-01) | Code-quality tool run; N1–N3 new findings; H1–H6 status check |
| Open issue list | Cross-reference for what's already tracked |
| Issue #253 (closed) | Mnemonic descriptor table spike; Puzzles A+B still to file |

---

## Current backlog state (pre-triage)

### Tracked, in flight

| Issue | Topic | Status |
|-------|-------|--------|
| #252 | H1b — trace/diff lift out of `step()` | OPEN, blocked |
| #255 | H1a/H4 — decode extract + interpreter state grouping | OPEN, blocked |
| #253 | H2 — mnemonic→descriptor table | CLOSED (design only; Puzzles A+B not filed) |
| #172 | H6 — `picture.js`/`hexDisplay.js` coverage | OPEN (partially overlaps H6) |
| #218 | Parity backlog | OPEN |
| #166 | `src/extra` crash coverage | OPEN |
| #220 | Core behavior + test-coverage backlog | OPEN |
| #297 | Workflow mapping | OPEN |
| #402 | DDD gap analysis (ARCHITECT decision pending) | OPEN |
| #404 | Adversarial hypothesis triage (ARCHITECT decision pending) | OPEN |

### Not tracked yet (surfaced by #382 and this triage)

| Topic | Effort | Source |
|-------|--------|--------|
| H3 — linker dup init (`resetState` as single source of truth) | ~30m DEV | #246 |
| H5 — disassembler nesting flatten | ~45m DEV | #246 |
| H6 — picture/hexDisplay seam (coordinate with #172) | ~30m DEV | #246 |
| N1a — `name.js` exit seam (bare `process.exit` → `fatalExit`) | ~30m DEV | #382 |
| N1b — `disassembler.js` exit seam | ~30m DEV | #382 |
| N1c — `linkerStepsPrinter.js` exit seam | ~30m DEV | #382 (low priority) |
| N2 — assemblerplus trap vector named constants | ~20m DEV | #382 |
| N3 — assemblerplus console.log gating | ~15m DEV | #382 |
| H2 Puzzle A — core instruction table (DEV phase) | ~45m DEV | #253 design |
| H2 Puzzle B — plus registration cutover | ~25m DEV | #253 design |
| M1 — velocity data integrity audit | ~30m DATA | M1 |
| M2 — oracle-CI spike (containerize or mock) | ~60m SPIKE | M2 |
| Q10/Q14 — plus-subclass shadow hazard count (static analysis) | ~30m RESEARCH | M7/H10 |

---

## Murphy Jutsu triage

Assessed in descending severity × actionability:

### M7 — Plus-subclass shadow hazard (HIGH severity, NOW LOWER RISK)

**Status:** Architecturally addressed. #253's descriptor-table design eliminates the
shadow mechanism. Risk is HIGH until Puzzles A+B are implemented; after that, M7 is
resolved. **Action: file Puzzles A+B immediately (top of Tier 1).**

### M2 — Oracle not in CI (HIGH severity, medium actionability)

The oracle suite requires `LCC_ORACLE` env and a local binary. Cloud agents are blind
to oracle parity. Every instruction-encoding change is unvalidated until a human runs
the suite locally.

**Actionable spike:** containerize the oracle binary or design a snapshot-based mock
(pre-compute golden outputs for a representative corpus, run lccjs against them in CI
without needing the binary). The containerization path is harder; the snapshot/mock
path is achievable in ~60m. **File as SPIKE, Tier 2.**

**Minimum protective measure now:** an explicit CLAUDE.md note that any change touching
an `assemble*` method in the instruction-encoding path should be flagged for oracle
review before merge. Cost: ~5m to add. Do it in the H2 Puzzle A commit.

### M1 — Velocity data integrity (MEDIUM severity, high actionability)

Three known integrity risks in the velocity dataset:
1. `closed_commit` SHAs orphaned by rebases
2. `c_min` set post-hoc (APPLE self-audit finding — systemically missed)
3. SQLite DB and CSV export may have drifted

All three are auditable with current tools. **File DATA ticket, Tier 2.** Until the
audit runs, treat any C-estimate calibration analysis as provisional.

### M3 — Coordination coherence illusion (HIGH severity, low immediate actionability)

Agents work from stale snapshots; `puzzle:status` infers from local worktrees only.
No cross-agent live visibility exists. **Not a ticket to file now** — it's a
structural constraint of the worktree model. The protective measure is the existing
`npm run puzzle:status` + `git pull` pre-work protocol. Note for future SPIKE if
concurrency exceeds 3 simultaneous agents.

### M4 — Commit informativeness scoring (MEDIUM severity, medium actionability)

98.3% CC format compliance doesn't measure description quality. A short audit
(word-count distribution + keyword presence — file name, function name, behavior verb)
is achievable in a DATA session. **File DATA ticket, Tier 3.**

### M5 — PDD accumulating deferred architectural debt (MEDIUM-HIGH, ongoing)

The ≤60m cap is a feature, not a bug. The pile of ARC-gated deferred items (#252,
#255, H3, H5, H6, H2 Puzzles A+B) is real but bounded. **Not a ticket** — the mitigation
is implementing the queued work in priority order, which is what this triage produces.

### M6 — Self-audit optimism (MEDIUM severity, low immediate actionability)

Self-audits are structurally biased. Cross-agent audits would catch more. **Defer:**
requires a controlled session design. Note as Q7 in the research backlog, Tier 4.

### M8 — Observer effect (META, not actionable)

Every document committed changes future agent behavior. **Mitigate** by identifying a
stable measurement window in the velocity data (contiguous span with consistent
protocol) and restricting statistical analysis to it. Not a ticket — a data-analysis
constraint to document in velocity-related notebooks.

---

## Ranked work program

### Tier 1 — File immediately (clear scope, unblocked, high ROI)

These are the highest-confidence next actions. Each is self-contained, ≤60m, and
produces a directly measurable improvement to code quality or safety.

| Priority | Topic | Effort | Role | Notes |
|----------|-------|--------|------|-------|
| 1 | **H2 Puzzle A**: build `_instructionTable` in `assembler.js`, replace switch | ~45m | DEV | Design in `docs/research/mnemonic-descriptor-table.md`; oracle regression confirms parity |
| 2 | **H2 Puzzle B**: plus registration cutover — delete `AssemblerPlus.handleInstruction` override | ~25m | DEV | After Puzzle A; eliminates the shadow hazard permanently |
| 3 | **H3**: `linker.js` — make `resetState` single source of truth, constructor delegates | ~30m | DEV | Self-contained; no blocked deps; unblocks `linkerplus.js` (#plus_linker_planned) |
| 4 | **N1a**: `name.js` exit seam — replace bare `process.exit` with `fatalExit` | ~30m | DEV | Library module; highest purity payoff; directly enables future unit tests on name-resolution path |
| 5 | **H6**: `picture.js`/`hexDisplay.js` — extract pure format functions; coordinate with #172 | ~30m | DEV | Unlocks 0% coverage on two utility modules; fold into #172 rather than double-tracking |
| 6 | **N1b**: `disassembler.js` exit seam — replace 6 bare `process.exit` calls with `fatalExit` | ~30m | DEV | Pairs with disassembler crash work (#166, #384's findings) |

*Total Tier 1: ~190m of work (3–4 agent sessions at typical velocity)*

### Tier 2 — High-value, actionable with current data or modest setup

These are clearly worth doing and have defined scope; most produce information that
unlocks Tier 3 decisions.

| Priority | Topic | Effort | Role | Notes |
|----------|-------|--------|------|-------|
| 7 | **M1 audit**: velocity data integrity — SQLite/CSV diff, orphaned SHA check, post-hoc C-estimate detection | ~30m | DATA | Run before any calibration analysis is published |
| 8 | **Q10/Q14**: plus-subclass shadow hazard count — grep/AST analysis of core methods that `assemblerplus` overrides | ~30m | RESEARCH | Measures the risk M7 quantifies; becomes a baseline for "before/after #253 Puzzles A+B" |
| 9 | **Velocity analytics batch** (Q4, Q17, Q18, Q28, Q29): wall-clock per puzzle class; H estimate variance; learning curves per agent; statistical power of dataset | ~60m | DATA | Single Jupyter session; requires M1 audit first for clean data |
| 10 | **M2**: oracle-CI spike — design snapshot-based mock or minimal containerization | ~60m | SPIKE | Protective measure; cloud agents need some oracle signal without the binary |
| 11 | **H5**: `disassembler.js` nesting flatten — guard-clause refactor, oracle-diff confirmed | ~45m | DEV | After N1b (exit seam); oracle diff verifies no behavior change |

*Total Tier 2: ~225m (~4–5 agent sessions)*

### Tier 3 — Valuable but lower urgency or requires Tier 2 output

| Priority | Topic | Effort | Role | Notes |
|----------|-------|--------|------|-------|
| 12 | **N2**: `assemblerplus.js` trap vector named constants (`TRAP_CLEAR = 0x000F` etc.) | ~20m | DEV | Cosmetic but high discoverability gain; easy win adjacent to H2 Puzzle B |
| 13 | **Q9/Q12**: CLI-leak count vs bug density correlation; max-indent-depth vs bugs | ~45m | DATA | Requires exporting open_bugs.md into a structured form first |
| 14 | **M4**: commit informativeness audit — word count + keyword presence distribution | ~45m | DATA | After M1 establishes data discipline baseline |
| 15 | **Q20**: RESEARCH→actionable follow-up rate (how often do RESEARCH tickets produce DEV/TEST follow-ons?) | ~20m | DATA | Answerable from closed-issue history now; low effort |
| 16 | **DDD Gap 2**: linker table rename (`mca` → `moduleCurrentAddress`, etc.) | ~20m | DEV | Ubiquitous-language win; mechanical rename; part of #402 ARC decision scope |
| 17 | **DDD Gap 4**: move `lcc.js` to `src/cli/` | ~15m | DEV | Structural clarity; low risk; part of #402 ARC decision scope |
| 18 | **N3**: `assemblerplus.js` console.log gating | ~15m | DEV | Lowest priority; cosmetic; no correctness impact |

*Total Tier 3: ~180m (~3 sessions)*

### Tier 4 — Deferred (blocked, needs instrumentation, or controlled experiment design)

These are worth doing eventually but blocked on Tier 1–2 output or require setup that
isn't yet available.

| Topic | Blocker | Notes |
|-------|---------|-------|
| H1a: pure `decode(ir)` extract from `step()` | #255 blocked; needs H4 groundwork | File after #255 is unblocked |
| H1b: trace/diff lift into observer | After H1a | #252 |
| H4: interpreter state grouping (`cpu`/`io`/`diag`) | Currently blocked | #255 |
| Q25: mnemonic-table ROI measurement | After H2 Puzzles A+B land | Before/after experiment; needs baseline first |
| Q11: lines changed per new instruction before/after | Same blocker | |
| Q23: oracle false-negative rate | After M2 oracle-CI work | Needs systematic corpus |
| Q24: confound-controlled model comparison (Sonnet vs Opus) | After M1 data integrity | Needs clean velocity data |
| Q26: imputing missing c_min values | After M1 | Data quality prerequisite |
| Q28 learning curves (already in Tier 2 batch) | M1 | Same as velocity analytics batch |
| Agent coordination experiments (Q1, Q2, Q5, Q6, Q7) | Need controlled session design | Real experiments, not analysis of existing data |
| M6: cross-agent audit experiment | Need a fresh paired-agent session | Low priority |
| DDD Gap 1: explicit domain model objects (SymbolTable, MachineState) | Large scope; needs H1/H4 done first | Deferred |
| DDD Gap 3/6: errors.js relocation, report generation as domain service | Medium risk, low urgency | Coordinate with #402 |

### Tier 5 — Out of scope / aspirational

- Q30–Q32 (ISA design: LLM assembler conformance, parity deviation audit, opcode coverage) — valuable research but external to the development workflow
- Q33–Q35 (documentation as signal: WRITER/DEV ratios, TIL heatmap, glossary growth) — interesting retrospective analysis, low urgency
- Q36–Q37 (educational effectiveness: demo difficulty ranking, textbook-read effect) — out of scope for agentic development work
- M8 (observer effect): not actionable; constrain measurement windows instead

---

## Immediate ticket recommendations

These are the tickets CHERRY recommends filing right now, in order. The architect
should verify the estimates and adjust before filing.

| # | Title | Role | H | Cross-refs |
|---|-------|------|---|-----------|
| A | DEV: H2 Puzzle A — build `_instructionTable` in `assembler.js`, replace `handleInstruction` switch | DEV | 45m | #253, `docs/research/mnemonic-descriptor-table.md` |
| B | DEV: H2 Puzzle B — delete `AssemblerPlus.handleInstruction` override, register in constructor | DEV | 25m | #253, after Puzzle A |
| C | DEV: H3 — `linker.js` `resetState` as single source of truth | DEV | 30m | #246 H3 |
| D | DEV: N1a — `name.js` exit seam (`process.exit` → `fatalExit`) | DEV | 30m | #382 N1 |
| E | DEV: H6 — `picture.js`/`hexDisplay.js` pure-format extract (coordinate with #172) | DEV | 30m | #246 H6, #172 |
| F | DEV: N1b — `disassembler.js` exit seam (6 bare exits → `fatalExit`) | DEV | 30m | #382 N1, #166 |
| G | DATA: M1 velocity integrity audit — SQLite/CSV diff, orphaned SHA check | DATA | 30m | M1 |
| H | RESEARCH: Q10 — plus-subclass shadow hazard count via static analysis | RESEARCH | 30m | M7, H10 |

*Tickets A+B are the highest priority: they eliminate the active shadow-hazard risk (M7) and validate the #253 spike design.*

---

## Summary: the top line

The research backlog is large but well-structured. The action gradient is clear:

1. **Implement #253 design (A+B)** — eliminates M7, validates the spike, removes the CLAUDE.md standing warning.
2. **Clean up three exit-seam modules (D, F)** and **H3 linker dedup (C)** — easy wins that raise baseline code quality and enable future testing.
3. **Audit the velocity data (G) and shadow-hazard count (H)** — produces the empirical baseline for the hypothesis-testing program.
4. **Only after G completes: run velocity analytics batch and design the oracle-CI spike (M2).**

The remaining research questions (Q1–Q37) should be triage-sequenced after this first
wave lands. Many answers will emerge naturally from the code work; others can wait for
a dedicated DATA session once M1 is resolved.
