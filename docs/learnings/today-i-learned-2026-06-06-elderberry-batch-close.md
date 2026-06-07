# TIL 2026-06-06 — ELDERBERRY (session 2: multi-issue batch close)

> Second ELDERBERRY session this day. The first
> ([velocity.db → lccjs.db sweep](./today-i-learned-2026-06-06-elderberry.md))
> is a separate topic.

**Context:** Promoted three behavioral-audit findings (#1007 gaps G1–G3) into
durable process docs — #1019 (PII rule → `RULES.md` + `do-this-not-that.md`),
#1020 (worktree-teardown discipline), #1021 (never bundle `rm`/heredoc cleanup
into a substantive Bash call). All three edit the same files, so I ran them from
a single worktree with a multi-issue batch close — which is where most of the
day's lessons came from.

---

## 1. The multi-issue batch close closes the *branch's* issue, not the "last-committed" one

**What happened:** The `#844` multi-issue protocol B in `docs/claude_workflow.md`
says: *"Run `npm run close B` (the last-committed issue) from inside the
worktree."* I claimed #1019 (so the branch was `elderberry/issue-1019-…`),
committed in order 1019 → 1020 → 1021, then ran `npm run close 1021` as
instructed. It died instantly:

```
[close] ✗ branch "elderberry/issue-1019-…" does not match issue #1021. Wrong worktree?
```

`scripts/close.js:713` gates the close target against the **branch name**
(`/issue-<N>\b`). The branch is named for the *claimed* issue, which — when you
claim the first one — is the *first*-committed issue, not the last. Protocol B's
wording silently assumes you claimed the issue you commit last.

**What I learned:** The close target is determined by the worktree branch, full
stop. Commit order is irrelevant to which `npm run close <N>` is legal — every
sibling lands via its own `Closes #N` footer when the branch is pushed. I closed
`1019` (the branch's issue) and #1020/#1021 auto-closed from their footers.

**The rule:** **In a single-worktree multi-issue close, run `npm run close
<branch-issue>` — the issue the worktree is named for — regardless of commit
order.** Filed #1052 to fix the protocol-B wording.

---

## 2. Guard 1 (velocity ticket-match) false-positives in a batch close — `--skip-ticket-match` is the intended bypass

**What happened:** Even `npm run close 1019` then complained that the velocity
row added in HEAD recorded ticket #1021, not #1019. `checkVelocityTicketMatch`
(close.js:424) inspects **only** `git show HEAD -- docs/puzzle-velocity.csv` —
and in a batch close, HEAD is the *last* sibling's commit, so its lone CSV row
belongs to a different issue than the one being closed.

**What I learned:** This guard exists to catch digit-transposition typos in a
*single*-issue close. In a batch close it's a structural false-positive, and
the die() message itself names the escape hatch: *"Pass `--skip-ticket-match`
if intentional."*

**The rule:** **A multi-issue batch close needs `npm run close <branch-issue>
-- --skip-ticket-match`** — the HEAD velocity row legitimately belongs to a
sibling. (Also captured in #1052.)

---

## 3. Velocity-CSV rebase conflicts resolve by re-exporting from the DB, never by hand-merging

**What happened:** The close's internal rebase hit a `CONFLICT (content): Merge
conflict in docs/puzzle-velocity.csv` because concurrent agents (DRAGONFRUIT's
`6ce1fb7`, etc.) landed velocity rows on `origin/main` while I worked. The close
aborted the rebase cleanly. I rebased by hand and at **each** of the three
conflicting commits ran:

```bash
node scripts/velocity-export.js        # regenerate the CSV from ~/.lccjs/lccjs.db
git add docs/puzzle-velocity.csv …
GIT_EDITOR=true git rebase --continue  # separate command, per do-this-not-that
```

**What I learned:** `docs/puzzle-velocity.csv` is an *auto-generated export* of
the SQLite DB, which already holds every agent's rows. Hand-merging conflict
hunks is pointless and error-prone — the DB is the source of truth, so a fresh
`velocity-export.js` produces the correct merged file every time. close.js does
exactly this on its own retry (`velocity CSV conflict auto-resolved
(re-exported from SQLite)`); doing it by hand mid-rebase is the same move.

**The rule:** **Resolve any `puzzle-velocity.csv` rebase/merge conflict by
re-running `node scripts/velocity-export.js`, not by editing the hunks.**

---

## 4. A scope-audit "deletion" of a sibling's file can be a pre-rebase diff artifact — verify, don't panic

**What happened:** The successful close printed a scope audit that alarmed me:

```
docs/research/931-deep-code-review-triage.md | 141 ---------------------------
```

I had not touched that file. The audit is `git diff --stat origin/main` taken
*before* the close's rebase — and `origin/main` had advanced to include
`2432d36` (the #931 triage doc) after my branch point, so relative to my old
base the file read as "deleted." After close.js rebased my commits onto the new
`origin/main`, the file was preserved. I confirmed with
`git cat-file -e origin/main:docs/research/931-…` → still present.

**What I learned:** A pre-rebase scope-audit diff compares against a moving
target. An apparent deletion of a file you never touched usually means
*origin added it after your base*, not that your push removes it — but it is
worth one read-only verification, because clobbering a sibling's work is exactly
the failure mode worktrees are supposed to prevent.

**The rule:** **If a close's scope audit shows a deletion you didn't make,
verify the file on `origin/main` after the close (`git cat-file -e
origin/main:<path>`) before assuming damage — it's almost always a pre-rebase
diff artifact.**

---

## 5. The getcwd error after teardown is cosmetic — exactly as the #1020 entry I just wrote says

**What happened:** `npm run close` exited non-zero with
`getcwd: cannot access parent directories` because the worktree was removed while
my shell's cwd was still inside it. Stdout already showed `CLOSE OK` and
`#1019 is CLOSED`. This is the *exact* failure mode I had documented minutes
earlier in the #1020 do-this-not-that entry.

**What I learned:** Living the rule you just wrote is good calibration. The
non-zero exit is noise; `CLOSE OK` + `commit … confirmed on origin/main` is the
real signal. Trust the stdout, re-root via the printed `Shell re-root: cd …`
path.

**The rule:** **Treat `getcwd: cannot access parent directories` after a close as
cosmetic — confirm via `CLOSE OK` in stdout, never re-run close on the basis of
the exit code.** (Already in `claude_workflow.md` and now `do-this-not-that.md`.)

---

## 6. I batched three `gh issue comment` calls and the tool-pacing hook blocked me — while closing the discipline tickets

**What happened:** Posting the three closing comments, I fired all three
`gh issue comment` calls in one turn. A `PostToolBatch` hook stopped
continuation: *"Batched ≥2 state-changing Bash calls — stale-read footgun.
Re-issue serially."* The comments had already posted, but the irony is total: I
tripped the tool-pacing discipline in the very session that promoted three
process-discipline rules. Logged as error row id=48 (HOOK_BLOCK).

**What I learned:** The one-at-a-time rule (do-this-not-that → "Tool pacing")
applies to `gh` state-changing calls too, not just `git`. Closing comments are
not exempt just because they feel like cleanup.

**The rule:** **Issue state-changing Bash/`gh` calls one at a time — including
batches of closing comments — and read each result before the next.** (Already
covered by the existing Tool-pacing entry; this is a fresh sighting, not a new
rule.)

---

## What landed

| Artifact | Change |
|---|---|
| `RULES.md` | New rule 22 — no PII in issues/comments/commits (#1019) |
| `docs/do-this-not-that.md` | "Personal data in public channels" (#1019), worktree-teardown entry (#1020), "Cleanup in Bash calls" (#1021) |

## Open threads

- #1052 — fix the #844 protocol-B wording (close the branch's issue; mention `--skip-ticket-match`).

## Related artifacts

- Issues #1019, #1020, #1021 (the work); #1007 (the audit that spawned them); #1052 (protocol-B fix)
- [First ELDERBERRY TIL today](./today-i-learned-2026-06-06-elderberry.md) (velocity.db → lccjs.db sweep)
- `docs/claude_workflow.md` → "Multi-issue single-worktree close (#844)"
- Error row id=48 (HOOK_BLOCK)
