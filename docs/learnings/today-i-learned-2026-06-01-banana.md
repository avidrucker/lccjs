# Today I Learned — 2026-06-01 (BANANA)

Eight tickets across close-sequence hardening, pdd policy, and DB schema auditing.
The through-line: most of today's bugs were enforcement gaps — things the toolchain
could detect but didn't. Several were fixed today; others became DEV tickets.

---

## 1. The stale-SHA gate blocks teardown after a successful close — and the fix was already in the codebase

`close.js` captures `sha = headSha()` before the push loop. Any non-trivial rebase
(another agent pushed between your commit and your push attempt) rewrites the SHA, so
the teardown gate's `onOriginMain(sha)` checks a stale identifier and refuses cleanup —
even though the work landed cleanly (#350 research).

The fix (#354, closed by APPLE): re-read HEAD as `landedSha = headSha()` after the loop
exits with `landed === true`, then gate on that. Simple, self-contained, confirmed working
in the wild: the #361 close raced on attempt 1, rebased, and the gate passed correctly
because #354 was already in the codebase.

**Pattern:** when `npm run close` fires "push reported success but SHA is NOT on
origin/main" — check `git log --oneline origin/main -3` first. If your commit message is
there, the close succeeded and you can clean up manually.

---

## 2. Guard 1's agent-name filter breaks when terminal name ≠ branch-prefix fruit

`close.js` Guard 1 derived the closing agent from the branch prefix (e.g. `banana` from
`banana/issue-317-...`) and filtered velocity rows to that name. When the velocity row
uses the *terminal* name (`CHERRY`) instead, the filter picks up a concurrent `BANANA`
row for a different ticket and ignores the correct `CHERRY` row → false-positive mismatch
blocking a legitimate close (#361).

**The fix:** ticket-first logic — if any added row records the correct ticket, Guard 1
passes immediately. Agent-name filtering only runs as a fallback when no correct-ticket
row exists (preserving the original #278 digit-transposition detection). Also threaded
`CLAUDE_AGENT_NAME` as the preferred identity source.

**Pattern:** when a guard uses an indirect proxy for identity (branch prefix ≈ agent
name), add a direct check (correct ticket present) as the primary path.

---

## 3. Close-protocol gaps are enforcement gaps, not attention gaps

Three close steps were skipped in the #320 session: velocity row not logged, `@inprogress`
marker transformed rather than deleted, closing comment not posted (#357 research).

The key finding: `close.js` Guard 1 validates *consistency* (row records the right ticket)
but not *presence* (row exists at all). An agent who skips `velocity:log` entirely passes
silently. Similarly, nothing checks whether a `@todo`/`@inprogress` marker for the issue
still exists in source after the closing commit.

Both are automatable as close.js pre-flight checks (filed as DEV child #359). The closing
comment is judgment-only — the fix was to change the workflow doc from "if there's a
tracker" to "always, regardless of tracker."

---

## 4. npm's own process CWD can't be fixed by a shell wrapper

`npm run close` exits 1 after teardown with `getcwd: cannot access parent directories`
(#360). The `close.sh` wrapper was supposed to fix this by cd-ing to the main root after
the Node process exits. It doesn't help because **npm's own Node process** inherits the
parent shell's CWD at launch time — before close.sh even runs. `close.sh` can only change
its own subprocess CWD.

The correct fix (option 3): document the cosmetic error. Added a `Note:` line to close.js
output and updated `claude_workflow.md`. Verify success via `CLOSE OK` in stdout, not
exit code.

**Pattern:** a shell wrapper invoked via `npm run` cannot retroactively change npm's
process CWD. The parent shell must `cd` before invoking `npm run` if the CWD matters.

---

## 5. SQLite's `datetime()` silently returns NULL for compact UTC offsets

ISO 8601 timestamps with compact offsets (`-1000`) parse correctly in most tools, but
SQLite's built-in `datetime()` and `julianday()` functions return NULL silently for this
format (#284 research). They only accept the colon form (`-10:00`).

The DB has 93 older rows in compact form, 105 newer rows in colon form. Duration queries
using `julianday()` silently produce NULL for the older rows. Workaround: `substr(ts,
1, 19)` strips the offset; safe because all timestamps are in the same timezone (HST).

**Pattern:** when SQLite date functions return unexpected NULLs, the format is almost
always wrong before checking the value. Test with a literal known-good string first.

---

## What went well

- **Research directly unblocked other agents.** The #350 stale-SHA analysis was filed as
  #354 and closed by APPLE before the end of the same day. Seeing it confirmed working
  in the #361 close was satisfying.
- **The Guard 1 fix was clean.** A pure seam (`computeVelocityMismatch`), 8 targeted unit
  tests, the exact repro from the issue body — no surprises.
- **Immediate doc fixes in the same commit.** Adding CHORE/DATA to velocity-schema.md and
  VALID_ROLES as part of #284 rather than filing a separate doc ticket kept it tight.
- **DEV tickets were filed with enough detail to be actionable.** The #372 migration SQL
  is copy-pasteable; the #359 guards follow the existing `--skip-*` flag pattern.

## What didn't go well

- **Pre-numbered a child ticket (#362) before filing it.** The actual ticket came out as
  #372, requiring a correction pass on the research doc. Lesson: file the ticket first,
  then reference it — never predict the number.
- **`--skip-keyword-check` was needed on several research-type closes.** Research commit
  subjects (e.g. "confirm #283 is correct commit-msg hook citation") share no keywords
  with the issue title ("find the issue that introduced the commit-msg hook") by accident
  of phrasing. Not a real failure, but a mild friction point on every research close.
- **The stale-SHA bug hit two more closes after #354 was merged** (#357 and the early
  #361 attempt), because those worktrees were based off main before #354 landed. Expected
  behaviour but a reminder that concurrent sessions can be behind even when the fix exists.
