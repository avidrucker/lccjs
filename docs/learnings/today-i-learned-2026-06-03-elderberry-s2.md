# TIL 2026-06-03 — ELDERBERRY s2

**Context:** Session covering #505 (upstream bug-report tracker audit), #144
(demo-questions tracker closure), #297 (workflow ownership map research), and
follow-up issue filings (#560, #565–#568, #573).

---

## 1. A tracker's "Done when" and the human's close instruction can diverge — follow the human

**What happened:** Issue #505 ("Tracker: send and track upstream cuh63 6.3 bug
reports") has a "Done when: All child send issues are closed" criterion. At the
time I was assigned it, the children (#40, #159, #507) were still open. The human
explicitly said to close #505 once the tracker artifact (the updated
`reports_summary.md` + comment) was in place.

**The tension:** the issue's own acceptance criterion wasn't met. The instinct is
to leave the tracker open until children close.

**The rule:** when the human's explicit close instruction and the issue's own
"Done when" diverge, follow the human. A tracker's "Done when" is aspirational
scope written at filing time. The human who assigned the ticket knows whether the
deliverable (the artifact) is what actually matters for the session, independent
of the long-tail children. Close on instruction; let the children live.

---

## 2. A broken internal link is a deliverable in its own right

**What happened:** While closing tracker #144 (demo research questions), I found
that `docs/lcc-isa.md` contains a live reference to
`./research/jmp-condition-suffix-mnemonics.md` — a file that was created by BANANA
for #151 and then deleted in the #390 archive sweep. The link was silently broken.

**What I did:** Restored the file verbatim from git history (`git show
74bffb0:docs/research/...`) as part of the #144 closure commit, alongside the new
consolidated summary.

**The rule:** when research archiving deletes a file that another doc references,
the reference becomes a broken link — which is a real defect, not a cosmetic issue.
Before closing a tracker whose children involved research docs, grep for references
to those docs and verify the files still exist. If a file was intentionally archived
but is still linked, either restore it or update the link to point at the archive
or the replacement.

---

## 3. "Most forgotten step" is the highest-ROI automation target

**What happened:** The #297 workflow ownership map revealed that
`@todo → @inprogress` flip is the step most consistently skipped across all agents
— because it's manual, easy to forget, and has no enforcement. This makes
`npm run puzzle:status` report puzzles as `AVAILABLE` during active work.

**The pattern:** when mapping a workflow to find automation opportunities, sort by
"most frequently omitted" rather than "most complex." The highest-ROI fix is almost
always the simplest step that everybody skips, not the hardest step that is done
correctly when it is done at all.

**Takeaway:** For the lccjs workflow specifically — always flip the marker on
claim. Until #565 automates it, the habit is: immediately after `npm run claim N`
completes, grep for `@todo #N` and flip it before doing any other work.

---

## 4. `reports_summary.md` can silently contain stale or wrong claims

**What happened:** Auditing `reports_summary.md` for #505, I found that row #3
("jmp with missing register → **segfaults**") was factually wrong: the segfault
claim had been corrected in parity deviation #3's corrigendum (#261) months prior,
but `reports_summary.md` still said "segfaults." The file had drifted from
`parity_deviations.md`.

**The pattern:** when two docs describe the same fact (one as the authoritative
record, one as a summary), the summary can silently diverge after the authority is
updated. The fix is either to keep the summary as a pointer ("see
`parity_deviations.md` §3") or to audit both in the same commit whenever either
changes.

**Takeaway:** When doing a tracker audit that involves a summary doc, always
cross-check the summary's factual claims against the authoritative source. Don't
assume the summary is current just because it's recent.

---

## What landed

| Issue | Role | Deliverable |
|-------|------|-------------|
| #505 | PM | Updated `reports_summary.md`: added OG BUGs #19/#24, corrected row #3 segfault claim, expanded coverage section; tracker comment posted |
| #144 | RESEARCH | Restored `jmp-condition-suffix-mnemonics.md` (broken link repair); wrote `144-demo-research-closure.md` consolidating all four demo-question findings incl. gameSnake bump-allocator leak analysis |
| #297 | RESEARCH | Wrote `297-workflow-ownership-map.md`: full step-ownership table, 8 uncharted gaps, 10 improvements ranked by ROI |
| #560 | PM | Filed: research how free() could work in LCC(+) assembly |
| #565–#567 | PM | Filed DEV tickets for improvements A/B/C from #297 |
| #568 | PM | Filed tracker for all 8 uncharted workflow gaps |
