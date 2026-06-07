# Triage — `deep-code-review-claude-2026-06-03.md` (#931)

**Author:** APPLE · **Date:** 2026-06-06 · **Role:** RESEARCH

Audits all **47 brainstormed items** in `docs/deep-code-review-claude-2026-06-03.md`
(8 sections). Each item gets a disposition:

- **DONE** — already implemented (file cited).
- **DUP #N** — an open issue already tracks it.
- **CANDIDATE** — feasible & untracked → either a child filed now (priority items) or deferred to backlog.
- **ASPIRATIONAL** — large / external-dependency / different-project; backlog with rationale.

Per the issue's "don't file speculatively" rule, children were filed **only** for the
five flagged high-leverage items where actionable and untracked. Everything else is
dispositioned in the table (the decision-pass requirement is satisfied by an explicit
DONE / DUP / defer-with-rationale, not by filing 40 tickets — `yegor-microtasks`).

---

## Priority five (confirmed/scoped first, per issue)

| Item | State | Decision |
|---|---|---|
| **Browser playground** (2.1) | `src/browser/{api,lcc-injector,lcc-worker}.js` foundation exists | **DUP → #677** (TRACKER, GH Pages playground), plus #707/#450/#1024/#1027/#1028 in the web lane. Linked, not re-filed. |
| **Step-back / reverse execution** (1.6) | not implemented; ilcc has snapshots (`prevSnap/currSnap`) but no rewind | **CANDIDATE → #1043** (SPIKE — snapshot cadence, memory cost, ilcc integration before any build). |
| **"Explain this error"** (1.3) | partial: `suggestClosest` gives "did you mean" (#883/#891); no per-error explanation catalog | **CANDIDATE → #1042** (SPIKE — design the `--explain` catalog; deconflict with #891's suggestion paths). |
| **Symbolic memory display** `m myLabel` (3.3) | not done — ilcc `m` takes an address; `symbolTable` not exposed to runtime | **CANDIDATE → #1041** (DEV — feasible now; assembler already has `symbolTable`). |
| **Assignment test-runner YAML** (7.3) | not implemented | **CANDIDATE → #1044** (SPIKE — YAML dep policy [repo is zero-runtime-dep], spec format, runner surface). |

---

## Full triage (all 47)

### §1 Learning & Pedagogy
| # | Item | Disposition |
|---|---|---|
| 1.1 | Per-instruction plain-English explanation in trace | CANDIDATE — defer (medium; pairs with 1.3 `--explain`). |
| 1.2 | Execution timeline (register evolution table) | CANDIDATE — defer (overlaps ilcc register pane + #252 observer refactor). |
| 1.3 | **"Explain this error"** | **child #1042** (priority). |
| 1.4 | Annotated listing (live values in `.lst`) | CANDIDATE — defer (medium). |
| 1.5 | Optimization advisor | ASPIRATIONAL — fuzzy heuristic, low ROI. |
| 1.6 | **Step-back / reverse execution** | **child #1043** (priority). |
| 1.7 | Conditional breakpoint (`b r0==5`) | CANDIDATE — defer (ilcc has address breakpoints only). |
| 1.8 | "What changed?" exit summary | CANDIDATE — defer (small-medium). |

### §2 Visualization & UI
| # | Item | Disposition |
|---|---|---|
| 2.1 | **Browser playground** | **DUP → #677** (priority). |
| 2.2 | Register diff highlighting | **DONE (partial)** — ilcc `registerPane(prevSnap, currSnap)` already diffs; colorblind mode exists (`-c`). |
| 2.3 | Memory heat map | ASPIRATIONAL — niche. |
| 2.4 | Call stack visualization | CANDIDATE — defer (medium; ilcc `s`/memory pane is raw today). |
| 2.5 | Program flow graph (ASCII CFG) | ASPIRATIONAL — large. |
| 2.6 | Source-level debugger pane layout | **DONE (partial)** — ilcc already has r/c/m/o panes. |

### §3 Developer Ergonomics
| # | Item | Disposition |
|---|---|---|
| 3.1 | Watch expressions | CANDIDATE — defer (pairs with 1.7/3.2 debugger expr engine). |
| 3.2 | Conditional stepping (`step until`) | CANDIDATE — defer (ilcc `s<n>` may partially step; `until` absent). |
| 3.3 | **Symbolic memory display** | **child #1041** (priority). |
| 3.4 | Assembly REPL | ASPIRATIONAL — large; no REPL today. |
| 3.5 | `--dry-run` | CANDIDATE — **easy win** (assemble + list, skip execute). |
| 3.6 | Named register aliases in output | **DONE** — `src/core/debug/format.js` `REG_NAMES = [...,'fp','sp','lr']`. |
| 3.7 | Diff two executions | ASPIRATIONAL — depends on 5.1 trace format. |

### §4 Error Messages & Diagnostics
| # | Item | Disposition |
|---|---|---|
| 4.1 | Multiple errors | **DONE (scaffold)** — `REPORT_MULTI_ERRORS` in `assembler.js`; CANDIDATE to finish/enable. |
| 4.2 | Suggested fixes (pcoffset9 distance hint) | CANDIDATE — defer (complements #891). |
| 4.3 | Source snippet + caret | **DONE (partial)** — present under `--verbose`; making it default risks oracle parity — defer. |
| 4.4 | "Did you mean?" (mnemonic) | **DONE** — `suggestClosest`, `assembler.js`; tracked by **#891**. |
| 4.5 | Undefined label "did you mean" | **DONE** — `assembler.js` label suggestions (#883). |
| 4.6 | Runtime error context | CANDIDATE — defer (LCC+ slice tracked by #1011/#1031/#1032; core path untracked). |

### §5 Output & Export
| # | Item | Disposition |
|---|---|---|
| 5.1 | JSON execution trace | CANDIDATE — defer (medium; enables graders/visualizers). |
| 5.2 | Annotated HTML listing | ASPIRATIONAL — large; overlaps web lane. |
| 5.3 | Test fixture generator (`--record`) | CANDIDATE — defer (pairs with 7.3/7.4). |
| 5.4 | GDB remote stub | ASPIRATIONAL — author flagged high-effort. |

### §6 Language / ISA Extensions
| # | Item | Disposition |
|---|---|---|
| 6.1 | Macro assembler | ASPIRATIONAL — large; SPIKE-gate if pursued. |
| 6.2 | `.include` directive | CANDIDATE — defer (medium; interacts with linker model). |
| 6.3 | Inline data comments (disasm in `.lst`) | CANDIDATE — defer (`src/extra/disassembler.js` exists; wire to listing). |
| 6.4 | `assert` pseudo-instruction | CANDIDATE — defer (LCC+ candidate; feasible). |
| 6.5 | Symbol file `.sym` output | CANDIDATE — **easy win** (`symbolTable` → file; pairs with 3.3). |

### §7 Educational Tooling Integration
| # | Item | Disposition |
|---|---|---|
| 7.1 | VS Code extension | ASPIRATIONAL — separate project (lcc-tools exists for highlighting). |
| 7.2 | Assignment submission mode (`--submit`) | ASPIRATIONAL — large; pairs with 7.3. |
| 7.3 | **Test-runner YAML (`--test`)** | **child #1044** (priority). |
| 7.4 | Execution replay from fixture | ASPIRATIONAL — depends on 5.3. |

### §8 Quality-of-Life
| # | Item | Disposition |
|---|---|---|
| 8.1 | Persistent debugger history | CANDIDATE — defer (small). |
| 8.2 | `--no-color`/`--color` (NO_COLOR) | CANDIDATE — **easy win** (only `-c` toggle today; honor `NO_COLOR`). |
| 8.3 | Config file (`.lccrc`) | CANDIDATE — defer (medium). |
| 8.4 | `lcc --version` | CANDIDATE — **easy win** (no `version` in `package.json`, no flag). |
| 8.5 | Progress indicator before instruction cap | CANDIDATE — **easy win** (count tracked; surface it). |
| 8.6 | Friendly HALT message | CANDIDATE — defer (**parity caveat:** adds stdout the oracle doesn't emit — must be opt-in/non-default). |

---

## Tally

- **DONE / DONE-partial:** 6 (2.2, 2.6, 3.6, 4.3, 4.4, 4.5) + 1 scaffold (4.1)
- **DUP (tracked):** 1 (2.1 → #677)
- **Children filed (priority):** 4 — #1042 (1.3), #1043 (1.6), #1041 (3.3), #1044 (7.3)
- **CANDIDATE (deferred to backlog):** ~24
- **ASPIRATIONAL:** ~11

## Recommended "easy wins" (file on pickup — deliberately not filed now)

Low-effort, confirmed-not-done, confirmed-feasible. Held back to avoid ticket-sprawl
from one audit (`yegor-microtasks`); each is a clean ≤30m DEV when an agent grabs it:

- **8.4** `lcc --version` (add `version` to `package.json` + flag)
- **8.2** honor `NO_COLOR` / explicit `--no-color`/`--color`
- **3.5** `--dry-run` (assemble + list, skip execute)
- **8.5** surface instruction count before the cap error
- **6.5** `.sym` symbol-file output
- **4.1** finish/enable the `REPORT_MULTI_ERRORS` scaffold

**Parity guardrail for any output-adding item** (8.6, parts of 1.x/8.5): new stdout the
oracle never emits must be opt-in or debug-only, or it breaks the oracle-parity suites.

## Note on the source doc

`docs/deep-code-review-claude-2026-06-03.md` is **untracked on `main`** (did not carry
into this worktree; read from the main checkout). Committing it is out of scope here but
worth a follow-up so the brainstorm is version-controlled alongside this triage.
