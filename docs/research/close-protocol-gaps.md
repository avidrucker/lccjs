# Close-protocol gap analysis — #357

**Date:** 2026-06-01  
**Agent:** BANANA  
**Trigger:** #320 close missing velocity row, bad marker graduation, and closing comment.

---

## 1. What is currently enforced

Before any code runs, two hooks fire on push:

| Hook | What it catches |
|---|---|
| `commit-msg` | No issue-number scopes; no compound types |
| `pre-push` | Rebase/merge in progress; raw conflict markers; malformed `@todo` PDD markers (gem scan); non-blocking `puzzle:status` heartbeat |

`npm run close` adds four pre-flight checks before touching the remote:

| Guard | What it catches | Introduced |
|---|---|---|
| Branch shape | Not in a `<fruit>/issue-N` branch | #266 |
| `headClosesIssue(N)` | HEAD commit doesn't reference `Closes #N` | #266 |
| Guard 1 — ticket match | CSV row present but records the WRONG issue | #310 / #346 |
| Guard 2 — keyword match | Commit subject shares zero words with issue title | #311 |

Guard 1 is conditional — it only fires when a CSV row IS present. If no row was logged, it silently passes.

---

## 2. The three gaps and their root causes

### Gap 1: Velocity row not logged

**What's missing:** `close.js` does not require a velocity row to exist in the DB. Guard 1 checks row-ticket *consistency* but not row *presence*. An agent who skips `npm run velocity:log` entirely will pass Guard 1 with no signal.

**Root cause:** The Guard 1 design (file in #310) explicitly accepted this — "not every close has a velocity row" — to handle research/PM closes that legitimately skip the log. The trade-off was loose enforcement in exchange for not blocking edge cases. The edge cases are now documented, so a stricter default is feasible.

**Automatable:** Yes. Query `~/.lccjs/velocity.db` for `SELECT id FROM velocity WHERE ticket = N LIMIT 1` in the close.js pre-flight. Die if the result is empty. Provide `--skip-velocity-check` for the legitimate no-row cases (pure PM triage, retroactive-log scenarios). This does add a `better-sqlite3` dependency to `close.js` (which currently has none), but the DB is already used by velocity-log.js and velocity-export.js in the same `scripts/` tree, so the dep is already in the project.

### Gap 2: `@inprogress` marker not deleted

**What's missing:** Two layers of enforcement both miss this:

1. The `pdd` gem scans only for `@todo`; it ignores `@inprogress` by design. A lingering `@inprogress #N` sails through the pre-push scan.
2. `close.js` never checks whether a marker for the issue being closed still exists in the worktree.

`puzzle:status` does flag a post-close `@inprogress` as STALE — but only after the push lands and only if someone runs `puzzle:status` manually. It is non-blocking in the pre-push hook.

**What happened in #320:** The agent transformed the marker into a `// Implemented #320: …` tracking comment rather than deleting it. The transformed comment:
- Doesn't match the `@todo` pattern → passes `pdd` scan
- Doesn't match `@inprogress` → passes `puzzle:status` heartbeat  
- Is a plain comment → passes `headClosesIssue(N)` which checks the commit message, not source files
- Violates two conventions simultaneously: marker-must-be-deleted and don't-reference-the-task-in-comments

**Root cause:** Agents in "done mode" sometimes annotate rather than delete. No enforcement point exists between the closing commit and `npm run close`.

**Automatable:** Yes. In `close.js` pre-flight, after verifying the tree is clean (post-commit), run `git grep -n '@\(todo\|inprogress\) #<N>'` over tracked JS/TS files. If any match is found, die — the marker was not removed. This is a pure shell check, no new deps. Provide `--skip-marker-check` for issues that legitimately have no source marker (research/PM/docs-only tickets).

Bonus: also grep for the exact "Implemented #N" anti-pattern as a courtesy warning (non-blocking), since that's the specific failure mode #320 hit.

### Gap 3: No closing comment

**What's missing:** The workflow doc (§ "At close" step 3) says to update a tracker checkbox via comment. But "if there's no tracker, this step is skipped" — which agents interpret broadly as "optional." There is no tracker-independent obligation to leave a summary comment.

**Root cause:** The doc conflates tracker-checkbox update (structural) with findings-summary comment (informational). The former has a clear trigger; the latter is vague. In practice, a research ticket always has something worth summarizing in a comment — the findings themselves — but the doc doesn't make this explicit.

**Automatable:** No. Comment quality is judgment. A script can print a reminder, but cannot write the comment. Making `npm run close` print a post-success reminder ("Step 4: post a closing comment on the issue with your findings") would help, but this is a UX nudge, not enforcement.

The closest enforcement-adjacent option: add `--close-comment-posted` as a required flag (or acknowledge prompt) to `npm run close`, so the agent must explicitly claim they posted it. This creates friction but no actual verification. Probably not worth it.

**Recommendation:** Tighten the workflow doc instead: replace "Update tracker checkbox via an issue comment, if there's no tracker, this step is skipped" with "Post a 1–3 sentence summary comment on the issue — always, regardless of whether there's a tracker. For research tickets this is the findings summary. For DEV tickets it's a one-liner noting what changed and the commit SHA."

---

## 3. Which close steps are automatable

| Step | Currently enforced | Gap | Automatable? |
|---|---|---|---|
| Commit contains `Closes #N` | Yes (`headClosesIssue`) | — | ✓ already done |
| Velocity row recorded for N | Consistency only (Guard 1) | Presence not required | ✓ new guard in `close.js` |
| Marker for N deleted | Not enforced | Passes through pre-push | ✓ new guard in `close.js` |
| Commit subject ↔ issue title keyword overlap | Yes (Guard 2) | — | ✓ already done |
| Post closing comment | Not enforced | Pure prose obligation | ✗ judgment only — doc fix |
| Timestamps captured | Not enforced | Pure prose obligation | ✗ judgment only |
| `@todo → @inprogress` flip at claim time | Not enforced | Some agents skip | Partially (reminder in `claim.js` output — already printed; low signal) |

---

## 4. Would a skill invocation reminder at claim time help?

Partially. `claim.js` already prints "flip the puzzle marker @todo #N → @inprogress #N" in its post-claim output. A parallel reminder ("invoke puzzle-velocity skill at close") would be visible at claim time, not close time — a long gap. Agents in a hurry at close time won't remember it.

The velocity-log and marker-deletion gaps are not attention problems; they're enforcement problems. The steps ARE documented; they still get skipped. The correct fix is enforcement at the point of failure (close.js pre-flight), not earlier reminders.

---

## 5. Recommended actions

### File as DEV tickets

**DEV-A: close.js — require velocity row before landing (≤20m H)**  
Pre-flight check: query `~/.lccjs/velocity.db` for `ticket = N`. Die if none found. `--skip-velocity-check` bypass. Implementation site: alongside `checkVelocityTicketMatch()` in `close.js`. Test: unit-test the pure lookup logic; e2e test that a missing row blocks the close.

**DEV-B: close.js — check marker deleted before landing (≤15m H)**  
Pre-flight check: `git grep` for `@todo #N` or `@inprogress #N` in tracked source files. Die if match found. `--skip-marker-check` bypass. No new deps. Test: unit-test the grep command shape; e2e test that a lingering marker blocks the close.

These two can be combined into one ~30m H DEV ticket since they're both close.js pre-flight additions.

### Handle as a doc update (no DEV ticket needed)

**DOCS: close sequence — always post a closing comment**  
Replace the conditional "if there's a tracker" framing with a blanket obligation: post a 1–3 sentence summary on the issue, always. Include in this commit (the #357 close commit).

---

## 6. What the #312 `@inprogress` anti-pattern implies for puzzle:status --strict

`puzzle:status --strict` already exits non-zero on any STALE marker. If the pre-push hook ran it with `--strict` (instead of as a non-blocking heartbeat), a lingering `@inprogress #N` where N is about to close would block the push — giving a second line of defense beyond the new close.js guard. Trade-off: `--strict` makes a network `gh` call; the pre-push hook must handle `gh` unavailability gracefully (treat as "no issue info → skip the stale check"). This is separate from the two DEV tickets above and lower priority (the close.js guard fires first).
