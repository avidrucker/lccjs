# Artifact Summary

What this project produces, how, and why — organized by category.

**Two tiers:** generated/derived artifacts get a full row each; authored documentation families get a pattern-level row (one entry per family, not per file).

---

## 1. LCC core toolchain outputs

Produced by the core assembler/linker/interpreter pipeline. All are **local-only** (gitignored).

| Artifact | Pattern | Produced by | Value | Staleness |
|----------|---------|-------------|-------|-----------|
| Executable | `*.e` | `assembler.js` (single-module) or `linker.js` (multi-module) | The runnable binary the interpreter consumes | Stale when source `.a` changes; regenerate with `node src/core/lcc.js` |
| Object file | `*.o` | `assembler.js` with multi-module flag | Relocatable intermediate; input to the linker | Stale when source `.a` changes |
| Listing file | `*.lst` | assembler/lcc (report path) | Human-readable source + hex + symbol table; oracle-parity reference | Regenerated on each assemble run |
| BST (batch symbol table) | `*.bst` | interpreter (report path) | Execution trace with register states; oracle-parity reference | Regenerated on each interpreter run |

**Supported inputs (not outputs):** `lcc.js` also accepts `*.hex` (raw machine code, one 4-digit hex word per line) and `*.bin` (raw binary) as direct-execution inputs, bypassing the assembler. These are input formats — the toolchain never writes them.

---

## 2. LCC+ toolchain outputs

Produced by the LCC+ pipeline (`src/plus/`). **Local-only** (gitignored).

| Artifact | Pattern | Produced by | Value | Staleness |
|----------|---------|-------------|-------|-----------|
| LCC+ executable | `*.ep` | `assemblerplus.js` | LCC+ runnable; requires `.lccplus` directive in source | Stale when source `.ap` changes |

---

## 3. PDD (Puzzle-Driven Development) outputs

| Artifact | Path | Produced by | Committed? | Value | Staleness |
|----------|------|-------------|------------|-------|-----------|
| Puzzle XML | `puzzles.xml` | `pdd` Ruby gem via `npm run puzzles` | No — gitignored | Machine-readable list of all `@todo` puzzle markers in tracked files; feeds the pre-push scan | Regenerated on each `npm run puzzles` run; stale the moment a marker is added/removed |
| Cluster manifest | `docs/puzzle-clusters.csv` | Hand-authored | Yes | Maps cluster names → issue numbers, plus optional `blocked_by` deps (`cluster,issue,blocked_by`). `puzzle:status` reads it to derive two *live* states (nothing is stored, so both self-clear): **LOCKED** 🔒 — a *different* member of the same cluster currently holds a live worktree, so the shared code-area is hands-off (a soft-lock: grabbable in principle, #222); and **BLOCKED** ⚪ — the row's `blocked_by` issue is still open (#358). LOCKED is rarely seen in output: it needs a clustermate in-progress at the moment you scan. | Updated manually when clusters are defined or resolved |

---

## 4. Velocity & analytics artifacts

Since the SQLite migration (#289/#290), the write path is **`npm run velocity:log` → `~/.lccjs/lccjs.db` (SQLite, source of truth) → `npm run velocity:export` → `docs/puzzle-velocity.csv`**. The CSV is a derived, read-only export — never hand-edit it.

| Artifact | Path | Produced by | Committed? | Value | Staleness |
|----------|------|-------------|------------|-------|-----------|
| Velocity log | `docs/puzzle-velocity.csv` | `scripts/velocity-export.js` (full-file export from `~/.lccjs/lccjs.db`; auto-runs after every `velocity:log` INSERT, also via `npm run velocity:export`) | Yes — read-only export; **never hand-edit**. `~/.lccjs/lccjs.db` (SQLite) is the source of truth | Per-ticket H/C estimates vs actuals; a flat, diff-friendly view of the DB | Regenerated on every `velocity:log` (or `velocity:export`); drifts from the DB only if an export is skipped |
| Enriched velocity | `stats/puzzle-velocity-enriched.csv` | `stats/enrich.py` (reads all rows from `~/.lccjs/lccjs.db`) | No — gitignored | Adds git-churn columns, GH issue timestamps, and derived flags/ratios for notebook analysis | Goes stale whenever new rows land in `~/.lccjs/lccjs.db`; re-run `enrich.py` before analysis |
| Analysis notebooks | `stats/*.ipynb` | Jupyter (human-run) | Yes — with embedded outputs | Exploratory velocity analysis to surface calibration insights and improve estimate accuracy over time | Outputs are frozen at last run; re-execute (`jupyter nbconvert --execute --inplace`) after a fresh `enrich.py` run |

---

## 5. Git & workflow infrastructure

| Artifact | Path | Produced by | Committed? | Value | Staleness |
|----------|------|-------------|------------|-------|-----------|
| pre-push hook | `scripts/git-hooks/pre-push` | Hand-authored | Yes | Blocks pushes mid-rebase, with conflict markers, or with malformed PDD puzzles | Stable; updated only when hook policy changes |
| commit-msg hook | `scripts/git-hooks/commit-msg` | Hand-authored (#283) | Yes | Rejects issue-ID scopes and compound commit types at commit time | Stable; install via `npm run setup` after cloning |
| Worktree dirs | `.claude/worktrees/<AGENT>-issue-<N>/` | `npm run claim` | No — gitignored | Isolated working copies for parallel agents; each branch scoped to one puzzle | Cleaned up after `npm run close` (or manually via `git worktree remove`) |
| Author name cache | `name.nnn` | LCC interpreter (first run) | No — gitignored | Caches the author name used in `.lst`/`.bst` report headers; mirrors OG LCC behaviour | Persists across runs; delete to reset the cached name |
| Oracle env config | `.env` | Hand-authored (copy of `.env.example`) | No — gitignored | Points `LCC_ORACLE` at the local `cuh63/lcc` binary for oracle-parity test suites | Stable once set; oracle suites auto-skip when absent |
| Jest coverage | `coverage/` | `jest --coverage` | No — gitignored | Line/branch coverage report (HTML + lcov) | Regenerated on each coverage run |

---

## 6. Authored documentation families

One row per family. Individual files are not enumerated here.

| Family | Pattern | Value |
|--------|---------|-------|
| TIL entries | `docs/learnings/today-i-learned-*.md` | Per-session agent lessons; indexed in `docs/learnings/README.md` |
| Research deliverables | `docs/research/*.md` | Spike/probe findings that close a RESEARCH puzzle (e.g. sext semantics, off-TTY contract, SQLite schema) |
| Glossaries | `docs/glossary/*.md` | Human-readable reference for assembler, interpreter, and linker internals |
| Oracle parity log | `docs/parity_deviations.md` | Canonical list of intentional divergences from OG LCC behaviour; check before "fixing" a parity mismatch |
| Bug reports | `docs/cuh63-*.md` | Upstream bug reports drafted for Prof. Dos Reis (OG LCC defects found during parity work) |
| Reference docs | `docs/*.md` (api, assembler, interpreter, linker, lcc-isa, lccplus-isa, etc.) | ISA tables, module APIs, and feature documentation for the toolchain |
| Workflow & process | `docs/claude_workflow.md`, `docs/puzzle-lifecycle.md`, `docs/pitfalls.md` | Agent-operating instructions; read before puzzle work |
| Velocity protocol | `docs/puzzle-velocity.md` | Column reference, role codes, and calibration takeaways for the velocity CSV |
