# TIL 2026-06-07 — GRAPE

**Context:** A long process/review session: I filed and drove a multi-pass review of agent HONEYDEW's
Hermes skill-port work (tracker #1105, passes #1106/#1107), wrote a workflow guardrail (#1122), and
filed a string of follow-up tickets (#1109, #1125, #1126, #1131, #1145, #1159). Several lessons came
not from the review content but from *how the work flowed* through the repo's multi-agent machinery.

---

## 1. Multi-pass review trackers want one centralized findings folder, not flat files

**What happened:** #1105 was a tracker with three child review passes (#1106 ticket-quality,
#1107 skill-quality, #1108 execution/logging), each producing its own findings doc. The repo's
convention is flat `docs/research/NNNN-slug.md`, but three related docs scattered flat are hard to
reassemble. I decided on a single tracker-numbered subfolder —
`docs/research/1105-honeydew-hermes-review/` with `01-…`, `02-…`, `03-…` plus a `README.md` index +
consolidated verdict.

**What I learned:** the decision paid off in a way I didn't plan: a *different* agent (DRAGONFRUIT)
closed pass 3 and dropped `03-execution-and-logging.md` straight into the same folder without being
told to. A well-named shared container coordinates parallel agents for free. The README-as-index also
gave the last pass to close a natural place to write the cross-pass verdict.

**The rule:** **For any multi-pass/multi-doc deliverable, create one tracker-numbered folder with a README index up front — it becomes the coordination point other agents find on their own.**

---

## 2. Write a guardrail, then actually live it the same session

**What happened:** #1122 was a process bug — an agent did a full investigation *inline on `main`*,
before claiming and before reading `docs/logs/`, and filed inaccurate findings. I wrote the guardrail
into `docs/claude_workflow.md` "At start" ("investigation/research requests are tickets too: claim
before producing findings; sweep `docs/logs/` + prior `docs/research/` before concluding"). Two tasks
later I was assigned "Take #1061." Instead of trusting the briefing, I ran `gh issue view 1061` first
— and it was already **CLOSED** (~10 hours stale). The guardrail I'd just written caught a real
wasted-cycle before it happened, and the catch itself became #1159.

**What I learned:** the verify-before-claim step isn't bureaucracy — it's the cheapest possible probe,
and in a fast multi-agent repo, briefings/assignments go stale in *hours*. Also: I applied the same
"sweep existing evidence before duplicating" habit when filing #1159 (searched the open-issue queue,
found the #630/#1134 cluster, and delineated my ticket from them rather than duplicating).

**The rule:** **Verify the issue is OPEN before claiming, every time — assignments and briefings are snapshots that decay; the issue tracker is the only live truth.** (Authority: `docs/claude_workflow.md` "At start"; #1122; #1131.)

---

## 3. The stale-base footgun family — trust the pushed commit, not the audit

**What happened:** every `npm run close` I ran (#1109, #1107, #1122) printed a scary scope-audit diff
claiming I'd **deleted** files I never touched (once "387 deletions" including another agent's
research doc). Each time I stopped and verified the *real* pushed commit
(`git show --stat <sha>`, check its parent, `git cat-file -e origin/main:<file>`) — and each time the
push was clean: only my files changed, every "deleted" file still on `origin/main`. Root cause:
`close.js` computes the audit as `git diff --stat origin/main` (HEAD vs the *tip*, not the merge-base)
before its rebase, so files added to `main` after my branch's base show as phantom deletions. Filed
#1145 with the fix (diff `merge-base..HEAD`).

**What I learned:** a slightly-stale worktree base (normal here — I even claimed #1107 with
`--allow-stale-main`) makes the close audit *lie*. The danger isn't the lie itself; it's that a
phantom "you deleted X" could bait a destructive "fix." The discipline is to treat the audit as a
hint and confirm against the actual commit + `origin/main`.

**The rule:** **When the close scope-audit shows deletions you didn't make, don't react — verify the pushed commit's real diff and its presence on `origin/main` first; it's almost always a stale-base artifact.** (Authority: #1145.)

---

## 4. Check the memory index before writing a new memory

**What happened:** while closing #1122 I wrote a fresh `feedback`-type memory for the
investigate-before-claim lesson — then noticed `MEMORY.md` already indexed
`feedback_claim_and_evidence_before_findings` covering the exact same #1121/#1122 lesson. I'd created
a duplicate. I augmented the canonical one with the new pointers (#1122 doc location, #1131) instead,
and had the human delete my dup (the `rm` was correctly blocked by the no-rm guard).

**What I learned:** memory recall scans descriptions, so a near-duplicate dilutes retrieval and drifts.
The index exists precisely so you check before writing.

**The rule:** **Before writing a new memory, grep `MEMORY.md` for the lesson — update the canonical entry rather than adding a second one.**

---

## What landed

| Artifact | Change |
|---|---|
| `docs/research/1105-honeydew-hermes-review/` | Centralized review folder: 01/02 findings + README verdict (#1106/#1107) |
| `docs/claude_workflow.md` "At start" | Investigate-before-claim + evidence-sweep guardrail (#1122) |
| `docs/puzzle-velocity.csv` | Rows for #1105, #1106, #1107, #1109, #1122 (agent GRAPE) |
| Tickets filed | #1109, #1125, #1126, #1131, #1145, #1159 (findings → tickets, Rule 10) |

## Open threads

- #1145 (close scope-audit merge-base fix) and #1159 (orchestration assignment freshness) are filed
  but unimplemented — both land in the scripts/skills lanes, not mine.
- The orchestration assignment list that handed me a 10-hour-stale #1061 suggests the triage snapshot
  needs a freshness contract (#1159).

## Related artifacts

- Tracker #1105; passes #1106, #1107, #1108 · process bug #1122 · footgun tickets #1145, #1159
- `docs/research/1122-investigate-before-claim-guardrail.md`
- Memory: `feedback_claim_and_evidence_before_findings`
