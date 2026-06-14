# Codebase-Review Corpus Index — the 8 broad review/analysis artifacts

**Issue:** #1223 · **Role:** RESEARCH · **Agent:** FIG · **Date:** 2026-06-13
**Decomposed from:** #1206 (CLOSED — "thorough codebase review and analysis", closed as too-broad).

> **Update (#1239 / follow-ups, 2026-06-14):** three corrections since the 2026-06-13 snapshot —
> (1) **DDD dedup**: rows #5 and #6 were the same analysis; the #6 re-import was deduped into #5
> (`lccjs-ddd-analysis.md`) via #1239 — corpus is now **7 distinct docs**; (2) **tracking fix**: only
> **2** docs are untracked, not 3 (an earlier draft wrongly listed #6 — it was tracked); (3) **gap
> graduation**: the doc #7 P0/P1 bug findings were filed as #1237 / #1238 and linked from #1180.

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
| 5 | `docs/research/lccjs-ddd-analysis.md` | DDD critique: 6 strengths, 7 weaknesses, 7 recommendations, scorecard. | 2026-06-01 | **Canonical DDD doc.** Ticketed (staged/aspirational) via the tier trackers; nothing individually closed. The #6 re-import was deduped into this file (#1239). | tier trackers #428/#429/#430 (all OPEN); dedup #1239 |
| ~~6~~ | ~~`docs/research/849-ddd-analysis-2026-06-05.md`~~ **REMOVED** | ~~Same DDD critique as #5~~ — duplicate re-import, deduped into #5. | — | **Removed via #1239** (was a *tracked* re-import; provenance folded into #5). | #849 (CLOSED, import); #1239 (dedup) |
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
   remainder run unsigned; doc claims a semantic + possible parity bug. **Graduated → #1237** (verify
   against oracle first), linked from #1180. *(was: only inside the #1180 batch-triage.)*
2. **P1 `listingLoadPoint` not reset** (`claude-bugs-audit`, doc #7) — `resetAssemblyState()` omits it,
   so a reused `Assembler` leaks a prior `-l` value. **Graduated → #1238**, linked from #1180.
3. **"Easy wins" deliberately unfiled by the #931 triage** (doc #3) — confirmed-not-done, ≤30m each:
   `lcc --version` (8.4), honor `NO_COLOR`/`--no-color` (8.2), `--dry-run` (3.5), surface instruction
   count before the cap (8.5), `.sym` symbol-file output (6.5), finish/enable `REPORT_MULTI_ERRORS` (4.1).
4. **`init_code_review` correctness items** (doc #1) that overlap later docs and may still be live —
   *verify against current code before filing (out of scope here):* linker error propagation (writes a
   broken `.e` on error / `error()` doesn't abort), dead `throwOnRuntimeError` flag, `genStats` dec/hex
   inconsistency at non-zero `loadPoint`, CLI-scaffolding duplication across ~6 files, operand-parse
   copy-paste helper. The linker items intersect the #1224 linker-seam design.
5. **Open DDD tier-tracker items** (doc #5 → #428/#429/#430) — linker table rename, `lcc.js`
   relocation, interpreter state grouping (#255), trace/diff observer (#252). Staged, none individually closed.
6. **Doc-hygiene gaps** — **2** of the corpus docs are untracked on `main`, both already owned: doc #2
   (deep-code-review) → #1056; doc #7 (claude-bugs-audit) → covered by #1180's tracked/untracked acceptance
   item. DDD duplication (#5 ≡ #6) **RESOLVED** via #1239. *(Earlier draft miscounted as "3 of 8" and said
   #6/#7 had no ticket — corrected.)*

## Notes

- **Duplicate DDD docs — RESOLVED (#1239).** `lccjs-ddd-analysis.md` (#5) and `849-ddd-analysis-2026-06-05.md`
  (#6) were the same analysis. Deduped: #5 kept as canonical (the #849 import provenance folded into its
  header), #6 removed via `git rm`.
- **Untracked-on-main artifacts (corrected).** Only docs #2 (deep-code-review) and #7 (claude-bugs-audit) are
  untracked — **2** of the corpus, not 3. An earlier draft of this index wrongly listed #6, which was tracked
  all along. Both untracked docs are already owned: #2's commit by #1056, #7's tracked/untracked resolution by
  #1180's acceptance — no new commit ticket needed.
- **Method.** Ticket states verified via `gh issue view` / `gh issue list --state all` on 2026-06-13.
  "un-ticketed" means no match surfaced in that search; it is not a code-level confirmation that a finding
  is unresolved.
