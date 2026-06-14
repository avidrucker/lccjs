# Codebase-Review Corpus Index — the 8 broad review/analysis artifacts

**Issue:** #1223 · **Role:** RESEARCH · **Agent:** FIG · **Date:** 2026-06-13
**Decomposed from:** #1206 (CLOSED — "thorough codebase review and analysis", closed as too-broad).

This is a **dedupe/index pass**, not a fresh review. It catalogues the 8 broad codebase-review /
analysis artifacts produced over the last few weeks, records (per document) whether their findings
became issues, and ends with a pointer-only list of un-ticketed gaps. No code was read or re-reviewed;
ticket status is from `gh issue` search as of 2026-06-13 and is hedged where a search could miss a ticket.

> **Scope boundary:** the 8 docs below **are** the corpus for this index. Narrow single-issue research
> docs and per-area audits elsewhere in `docs/research/` (e.g. `cli-flag-audit.md`, `ddd-gap-analysis.md`,
> `github-pages-docs-audit.md`, `test-suite-audit-522.md`) are out of scope. A later ticket can widen it.

## Status legend

- **ticketed** — at least one GitHub issue tracks the finding (link `#N`); may be open or closed.
- **resolved** — the finding's tracking issue is CLOSED (work shipped or dispositioned).
- **un-ticketed** — no matching issue found as of this pass; a candidate gap (see the gaps list).

Per-document status below is a **rolled-up summary** (counts + the governing tickets), not a per-finding
enumeration — that was the agreed granularity for this ticket (keeps it inside the 60m box).

## Index

| # | Artifact | Scope (one line) | Date | Rolled-up status | Governing / linked tickets |
|---|----------|------------------|------|------------------|----------------------------|
| 1 | `docs/init_code_review.md` | Broad first-pass review: code clarity/correctness, doc drift, test suite, demos — ~14 enumerated bugs + 10 prioritized recs. Frozen at commit `87f41d4`. | 2026-05-24 | **Mixed.** Doc-drift items mostly **resolved** inline (#211). Several correctness items still live and now overlap docs #4/#7. | #211 (CLOSED, doc drift); correctness items overlap #246/#1180 |
| 2 | `docs/deep-code-review-claude-2026-06-03.md` ⚠️*untracked on main* | 47-item **feature/UX brainstorm** (8 sections: pedagogy, viz, ergonomics, errors, export, ISA-ext, tooling, QoL). Not a bug review. | 2026-06-03 | **Fully triaged** by doc #3. 4 children filed+**resolved**, 1 DUP open, ~6 DONE, ~24 deferred, ~11 aspirational. | triaged via #931; children #1041/#1042/#1043/#1044 (CLOSED); DUP #677 (OPEN); commit tracked by #1056 (OPEN) |
| 3 | `docs/research/931-deep-code-review-triage.md` | Disposition table mapping all 47 items of doc #2 to DONE / DUP / CANDIDATE / ASPIRATIONAL. The mapping layer. | 2026-06-06 | **Complete** (it *is* the findings→status map for #2). Itself the source of 6 deliberately-unfiled "easy wins". | #931 (CLOSED); see "easy wins" in gaps list |
| 4 | `docs/research/codebase-quality-hotspots.md` | `src/` complexity hotspot ranking H1–H6 + 7-item pass-2 decomplect puzzle seed list. | 2026-05-30 | **Nearly fully ticketed; 5/7 resolved.** Only H1b and H4 still open. | #246 (CLOSED); H1a→#251✓, H1b→**#252 (OPEN)**, H3→#254/#405✓, H4→**#255 (OPEN)**, H2→#253/#416/#418✓, H5→#256/#678/#699✓, H6→#172✓ |
| 5 | `docs/research/lccjs-ddd-analysis.md` | DDD critique: 6 strengths, 7 weaknesses, 7 recommendations, scorecard. | 2026-06-01 | **Ticketed (staged/aspirational)** via the tier trackers; nothing individually closed. **Duplicate of #6.** | tier trackers #428/#429/#430 (all OPEN) |
| 6 | `docs/research/849-ddd-analysis-2026-06-05.md` ⚠️*untracked on main* | **Same DDD critique as #5**, re-imported from the Claude.ai app with a provenance header. | 2026-06-06 (imported) | **Duplicate content of #5** — dedupe candidate. Import task closed. | #849 (CLOSED, import); same tier trackers #428/#429/#430 |
| 7 | `docs/research/claude-bugs-audit-2026-06-06.md` ⚠️*untracked on main* | Adversarial bug hunt: **P0 signed div/rem**, **P1 `listingLoadPoint` reset omission**, P2 robustness notes, architecture notes. Explicitly flags bugs *not* in `open_bugs.md`. | 2026-06-06 | **Findings not individually ticketed**; tracked as a batch by an OPEN triage ticket. P0/P1 have no individual issue. | tracked by **#1180 (OPEN triage)**; related meta #1181 (OPEN) |
| 8 | `docs/research/952-initiative-overview.md` | High-level catalogue of 10 project initiatives + a "core 4" prioritization recommendation. Strategic, not a findings doc. | 2026-06-06 | **Informational.** No discrete bugs to track; references dozens of issues as context. | #952 (CLOSED) |

✓ = CLOSED.  ⚠️*untracked on main* = file exists in the working tree but is not committed (see Notes).

## The #931 → #1056 deep-code-review pipeline (cross-reference, not re-derived)

Docs #2 and #3 form a pipeline already established elsewhere; this index points to it rather than
restating it:

- **#931** (CLOSED) audited the 47-item brainstorm in doc #2 and produced the triage table (doc #3),
  filing 4 priority children (#1041/#1042/#1043/#1044 — all CLOSED) and linking 1 DUP (#677, OPEN).
- **#1056** (OPEN) tracks committing the still-untracked brainstorm (doc #2) and annotating it as
  triaged-via-#931.

## Un-ticketed gaps (pointers only — filing is a follow-up, per #1223 "Won't have")

1. **P0 signed `div`/`rem`** (`claude-bugs-audit`, doc #7) — registers are `Uint16Array`, so division/
   remainder run unsigned; doc claims a semantic + possible parity bug. No individual ticket found;
   currently only inside the **#1180** batch-triage. Highest-severity open pointer.
2. **P1 `listingLoadPoint` not reset** (`claude-bugs-audit`, doc #7) — `resetAssemblyState()` omits it,
   so a reused `Assembler` leaks a prior `-l` value. No individual ticket; inside #1180.
3. **"Easy wins" deliberately unfiled by the #931 triage** (doc #3) — confirmed-not-done, ≤30m each:
   `lcc --version` (8.4), honor `NO_COLOR`/`--no-color` (8.2), `--dry-run` (3.5), surface instruction
   count before the cap (8.5), `.sym` symbol-file output (6.5), finish/enable `REPORT_MULTI_ERRORS` (4.1).
4. **`init_code_review` correctness items** (doc #1) that overlap later docs and may still be live —
   *verify against current code before filing (out of scope here):* linker error propagation (writes a
   broken `.e` on error / `error()` doesn't abort), dead `throwOnRuntimeError` flag, `genStats` dec/hex
   inconsistency at non-zero `loadPoint`, CLI-scaffolding duplication across ~6 files, operand-parse
   copy-paste helper. The linker items intersect the #1224 linker-seam design.
5. **Open DDD tier-tracker items** (docs #5/#6 → #428/#429/#430) — linker table rename, `lcc.js`
   relocation, interpreter state grouping (#255), trace/diff observer (#252). Staged, none individually closed.
6. **Doc-hygiene gaps** — 3 of 8 corpus docs are untracked on `main` (#1056 covers doc #2; **docs #6 and
   #7 have no commit-tracking ticket**), and the DDD analysis is **duplicated** (#5 ≡ #6).

## Notes

- **Duplicate DDD docs.** `lccjs-ddd-analysis.md` (#5) and `849-ddd-analysis-2026-06-05.md` (#6) are the
  same analysis; #6 is a later re-import with a provenance header. Recommend keeping one (the imported #6
  carries provenance) and cross-linking or removing the other — a clean follow-up, not done here.
- **Untracked-on-main artifacts.** Docs #2, #6, #7 exist in the working tree but are uncommitted, so they
  did not carry into this ticket's worktree (read from the main checkout). Only doc #2 has a commit ticket
  (#1056). Docs #6 and #7 should get one so the corpus is version-controlled.
- **Method.** Ticket states verified via `gh issue view` / `gh issue list --state all` on 2026-06-13.
  "un-ticketed" means no match surfaced in that search; it is not a code-level confirmation that a finding
  is unresolved.
