# TIL 2026-06-14 — ELDERBERRY

**Context:** A PM-hygiene session that started as a single ticket review (#1231, "correct #1102's dependency block") and turned into a live case study in concurrency drift. Over the session I groomed the #1102 dependency cluster (#1231/#1232/#1233), watched its facts go stale *three times* underneath me, and ended by filing the bug that describes the exact failure I'd just lived (#1243). Tickets touched: #1231, #1233, #1102, #1134, #1211, #1243, #1244.

---

## 1. A ticket can be OPEN and still be wrong — facts drift during execution, not just at claim time

**What happened:** I was assigned #1231, whose premise was *"#1005 is the open gate"* for #1102. By the time I picked it up, #1005 had already closed (08:39, commit `bf008e9`) — ~9 minutes after the trio was filed at 08:30. I corrected #1231, groomed #1102, and closed #1233 (~10:26) with notes naming #1100 as the live blocker for the interpreter-runtime half. Twenty minutes later #1100 closed (10:46, commit `eb17f3a`), invalidating guidance I'd written minutes earlier. `grep explain src/core/interpreter.js` went from empty to 9 hits while I wasn't looking.

**What I learned:** The repo already has a claim-time freshness contract (#1159): before you start, re-check that *the assigned ticket itself* is still OPEN. But that guard never fired here — the assigned tickets stayed OPEN the whole time. What rotted was the state of the tickets they *referenced*, and it rotted *mid-task*. Grooming/PM tickets are uniquely exposed to this: their entire content is metadata about other tickets, so they're invalidated by exactly the sibling work an orchestrator tends to schedule in the same wave.

**The rule:** **For any grooming/PM ticket, re-resolve the state of every ticket it references immediately before you finalize an edit or close — claim-time freshness (#1159) does not cover referenced tickets changing during execution.** (Filed as #1243; mitigation sketch extends #1159 from claim-time/self to execution-time/referents.)

---

## 2. "Should it be revised or closed?" — consult the discipline before trusting the engineering instinct

**What happened:** When #1005 landed, #1233 (a proposal to *split* #1102 into an unblocked assembler half and a #1100-blocked interpreter half) was partly overtaken. My engineering lean was to **revise** it — keep the split, just fix the stale "blocked-by #1005" label, so the ready half could ship. Then the user asked what yegor-pm would advise. Loading the skill flipped my answer.

**What I learned:** yegor-microtasks says don't decompose a task that already fits the budget — #1102 is 30m, under the 60m cap, and *"pre-decomposing everything upfront is waste."* yegor-pdd says the right way to handle a blocked sub-problem isn't a second ticket filed speculatively — it's a `@todo` puzzle dropped *at the code site, during implementation*, once you actually hit the wall. Those two together said: **close #1233**, do #1102's unblocked half, and puzzle the blocked half if/when you reach it. The split's *goal* (independent gating) survives; the split-as-an-upfront-ticket doesn't. (Then #1100 landed too, making #1102 fully unblocked — reinforcing the close.)

**The rule:** **Before deciding revise-vs-close on a decomposition ticket, check it against yegor-microtasks + yegor-pdd: a sub-cap task is not split upfront; a blocked sub-problem becomes a PDD puzzle during work, not a speculative sibling ticket.**

---

## 3. The "new" problem was already filed — search the whole tracker, then augment + carve, don't duplicate

**What happened:** Asked to file an "urgent" ticket about the orchestrator assigning overlapping work, I searched `gh issue list --state all` first and found the problem was already #1134 (open bug), sitting inside a fully-sequenced improvement cluster (tracker #1211, plus #1159, #630, #810, #1046-48). A fresh top-level ticket would have been the fourth near-duplicate.

**What I learned:** The disciplined move wasn't "file" or "don't file" — it was *both halves of a split*: (a) augment the canonical home (#1134) with this session's hard evidence in its existing "Evidence — observed in a single session" format, and (b) carve out only the genuinely-new mechanism (dependency-coupled, execution-time content drift) as a focused, higher-severity child (#1243) so urgency wasn't buried in #1134's "Wave 4 / last" slot. The new ticket earns its existence by being narrower and more actionable than the parent, not by restating it.

**The rule:** **Search `--state all` before filing; when the problem already exists, augment the canonical ticket with evidence and carve out only the novel, independently-actionable facet as a linked child — never a parallel duplicate.** (Reinforces the existing search-before-filing discipline.)

---

## 4. Non-destructive correction is the default, even on tickets you're about to close

**What happened:** I corrected stale text on #1231, #1102, and #1233. In every case I used strikethrough + a `SEE COMMENTS FOR CORRECTIONS` banner + a correction comment, and I left GRAPE's prior readiness-review comment on #1102 untouched as the historical record — even though I was the one closing the tickets.

**What I learned:** The instinct to "just rewrite it cleanly since I'm closing it anyway" is wrong. The redline *is* the value: a future reader (or the #1243 fix author) can see that the dependency state drifted, which is the whole point. Preserving the original wrong text next to the correction is what makes the drift legible.

**The rule:** **Redline, don't rewrite — strikethrough + banner + comment — and never edit another agent's comment; the preserved error is evidence.** (Existing convention, #300 / yegor-tickets.)

---

## What landed

| Artifact | Change |
|---|---|
| #1231 | dependency block corrected (non-destructive) and closed |
| #1233 | closed as superseded — PDD-over-split per yegor-pm |
| #1102 | body + comments corrected to current reality (now fully unblocked) |
| #1134 | augmented with this session's 3-drift evidence + the new mechanism |
| #1211 | #1243 added as a Wave-4 child, flagged Wave-1-able |
| #1243 | **new** severity:high bug — dependency-coupled f-a-o overlap → mid-execution content drift |

## Open threads

- #1232 (pin #1102's test AC) remains open and drift-clean — a valid standalone grooming task, untouched here.
- #1243's mitigation is a *sketch*, not a decided solution; the deliverable is still "choose the effective rule."

## Related artifacts

- Issues #1243 (filed), #1134 (home bug), #1211 (tracker), #1159 (the claim-time contract this extends)
- Reference anchor for the session lives in [#1243 comment](https://github.com/avidrucker/lccjs/issues/1243#issuecomment-4701531524)
