# TIL 2026-06-01 — ELDERBERRY (session 2)

**Tickets closed:** #402 (ARC), #410 (DEV), #424 (DATA), #371 (DEV), #441 (docs)  
**Filed as follow-ons:** #414, #415, #418, #421 (from #402), #436 (from #424)  
**Roles:** ARC × 1, DEV × 3, DATA × 1

---

## Lessons

### 1. Parity deviation doc is part of the fix, not optional follow-up

When #371 replaced the misleading `Assembling …` message with `Loading … (no assembly
pass) — N word(s)`, the inline code comment already noted the oracle prints nothing for
`.bin`/`.hex` inputs. That's a documented divergence — it belongs in
`docs/parity_deviations.md` as a BY DESIGN entry the moment the behavior ships.

The user caught it immediately after close. The recovery took a filed issue (#441),
a worktree, and a separate commit. Total extra cost: ~10 minutes.

**Rule:** any time you change user-visible output that differs from oracle behavior,
check `parity_deviations.md` before closing. If the deviation isn't there, add it in
the same commit as the fix.

---

### 2. A research ticket needs a link back from the issue, not just a committed doc

After closing #424 (data integrity audit), the report was committed to
`docs/research/velocity-data-integrity-audit.md` — but no comment was posted on the
GitHub issue pointing to it. Anyone reading the closed ticket sees no deliverable.

The user caught it: "did you leave the audit findings somewhere as a doc, or as a
comment on the ticket?"

**Rule:** for any RESEARCH or DATA ticket whose deliverable is a file, post a comment
on the issue with the path (or a GitHub link) immediately before or after closing.
The commit message is not visible from the issue view.

---

### 3. File the follow-on ticket before you close the parent

Both #424 and #402 generated follow-on work. The right sequence:

1. Identify the follow-ons while writing the deliverable
2. File the follow-on tickets (with parent links)
3. *Then* close the parent

Closing first and filing later risks the follow-ons being forgotten — especially if
the session ends between steps. The follow-on is part of completing the parent.

---

### 4. Negative delta fields are a sign-convention bug, not just a data quirk

The velocity schema uses `delta_h_min = h_min − actual_min` (headroom remaining —
positive when under-estimate). Two DRAGONFRUIT rows (IDs 303/308) had it backwards:
`actual − estimate`, producing negative values. The data looked plausible at a glance
(fast actual on a short task) but would produce wrong calibration math if delta fields
are aggregated directly.

**Rule:** when logging, delta = estimate − actual. Positive = you had time to spare.
Negative means you went over, which is unusual and worth a note. A delta of −28 should
be a red flag, not a silent entry.

---

### 5. "Cross-repo SHA" is a real pattern — document it in the notes field

Six velocity rows had `closed_commit` SHAs that don't resolve in the lccjs git history.
All six had notes explicitly saying "cross-repo close: SHA in avidrucker/claude-config."
The audit confirmed they're valid commits in the sibling repo, not orphans.

The lesson isn't about the SHAs — it's that the notes field did its job. Because prior
agents wrote "cross-repo close: SHA in …" at log time, the audit took 30 seconds to
resolve instead of becoming an investigation. Contextual notes written at close time
pay off whenever anyone audits the data later.

---

## What went well

- **ARC + DATA + DEV mix closed cleanly.** The DDD gap analysis (#402) produced four
  well-scoped follow-on tickets; none required back-and-forth to define scope.
- **Velocity integrity audit found real issues.** Two sign-flipped delta rows corrected
  in SQLite; stale CSV re-exported. The audit was the point — finding nothing would
  have been an equally valid outcome.
- **All 50 test suites passed on every DEV fix** without needing snapshot updates.
  Small, targeted changes (3 lines changed in #371, 4 in #410) are easy to verify.

## What didn't go well

- **Two protocol misses caught by the user** (#371 missing parity doc, #424 missing
  issue comment). Both are now in memory and in this TIL. The common cause: treating
  "code committed" as "ticket done" instead of working through the full close checklist.
- **Had to file #441 as a separate issue** to do a 20-line doc edit, because the #371
  worktree was already torn down. Worktree discipline means you can't retroactively edit
  the same branch — the overhead of a new issue + claim + close is the correct cost of
  catching something after close, not a workaround.
