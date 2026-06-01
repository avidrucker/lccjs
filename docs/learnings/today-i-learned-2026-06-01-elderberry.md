# TIL 2026-06-01 — ELDERBERRY

**Tickets closed:** #188, #222, #358, #364, #324, #368 (ARC, open), #207  
**Roles:** ARC × 3, DEV × 1, WRITER × 1, RESEARCH × 2

---

## Lessons

### 1. The follow-on issue + comment is part of the ARC deliverable

On #188, I closed the issue after writing the synthesis doc — but left no follow-on issue
for the branch-protection decision I'd marked "user-owned." The user caught it immediately:
"did you leave the human-decision-required label on the relevant issue as well as comment
to clarify what needs to be decided?"

The full ARC close sequence when a user decision is required:
1. Write the recommendation (the synthesis doc or comment)
2. File a `decision`-labeled follow-on issue with the options table and a clear ask
3. Post a cross-reference comment on the parent ticket pointing to the new issue
4. *Then* close the parent

Skipping steps 2–3 loses the decision in the closed-issue archive where no one will act
on it.

---

### 2. Sanity-checking neighboring entries catches more than the primary target

On #364 (fix parity §4 OB-001), the issue explicitly asked to "sanity-check the two
sibling entries still under 'fix pending'." Both siblings (§5 OB-002 and §6 OB-026) were
also stale — all three corresponding GH issues were CLOSED. The "LCC.js BUG" section
went from 3 entries to 0.

The habit: whenever correcting one entry in a list or section, scan the immediate neighbors
before committing. Doc rot clusters — a stale entry usually has stale neighbors.

---

### 3. "Already fixed" is a valid and fast RESEARCH outcome

#324 asked for the accurate "Produced by" description for `puzzle-velocity.csv` in
`artifacts-summary.md`. Reading the file revealed the row was already correct — fixed by a
prior commit six hours before the issue was read. Total time: ~1 minute.

Correct close: post the finding as a comment ("row is already accurate, here's why"),
close the issue. Don't manufacture work to justify a ticket.

---

### 4. close.js SHA-rewrite is cosmetic — recognize it and move on

Encountered the SHA-rewrite teardown failure on multiple closes today (known issue #350,
research complete). Pattern: `npm run close` prints "push reported success but SHA is NOT
on origin/main — refusing to remove worktree" and exits 1. The commit *is* on main (just
under a rebased SHA). Check with `git log --oneline origin/main -3`, confirm, then manually
`git worktree remove` + `git branch -D`.

Until P-2 (the DEV fix) lands, this is the expected manual recovery sequence. It's not a
real close failure.

---

### 5. The TIL synthesis reveals what single-doc reading obscures

Reading 37 TIL docs sequentially (via the README index) makes individual lessons feel
equally important. The synthesis pass (#207) revealed that the *same* failure — tool-call
batching → confabulated state — was independently hit by 6 different agents across 5 days.
That recurrence signal is invisible until you count.

The meta-lesson: a lesson that appears once is a one-off; the same lesson from 3+
independent agents is a structural defect. The right fix for a structural defect is a guard,
not sharper prose.

---

## What went well

- **7 tickets in one session.** The ARC + RESEARCH + WRITER mix covered a lot of ground
  without any getting stuck. Research-flavored tickets (read, synthesize, recommend) close
  faster than implementation ones.
- **`npm run close` mostly just worked.** The SHA-rewrite cosmetic error aside, the
  retry-loop correctly rebased through concurrent pushes from other agents (2–3 retries on
  some closes) without losing work.
- **#358 DEV was clean.** The `blocked_by` wiring touched two functions and added 6 tests —
  all passed on the first run. Having the existing test file as a template made the test
  scaffolding fast.
- **The Explore agent handled the 37-doc batch read efficiently.** Rather than reading all
  37 docs serially, delegating the batch read freed the main context for synthesis work.

## What didn't go well

- **Missing the ARC follow-on discipline on #188.** Caught by the user. The recovery
  (file #355, post correction comment) took 5 minutes and was embarrassing overhead.
  Root cause: I treated "write the recommendation" as the whole deliverable and forgot
  the "make the decision actionable" tail.
- **SHA-rewrite fires on almost every close.** Not my bug to fix (P-2), but the manual
  teardown friction adds up across 7 closes. Each one requires a `git log` check and two
  git commands to confirm before cleanup.
- **Classifier blocked the skill doc edit for #358.** The `~/.claude/skills/` path is
  outside the project tree; editing it hit a transient classifier denial. The functional
  behavior was correct (annotation propagates via the detail string), so the impact was
  only a missing doc update. Still: know this path is sensitive before trying.
