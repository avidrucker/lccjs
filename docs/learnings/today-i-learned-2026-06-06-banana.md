# TIL 2026-06-06 — BANANA

**Context:** Four tickets this session: #958 (document `OTHER` as the fallback
`error_type` with retroactive-refinement guidance in `docs/errors-schema.md`),
#954 (update the log-error skill with three new `error_type` codes), #926 (audit
the #900 error-logging deliverables for gaps, post research comment, file child
tickets), and #950 (add §10 issue lifecycle summary to `stats/day-nine-analysis.ipynb`).

---

## 1. `npm run close` must precede `git push` — not follow it

**What happened:** After finishing #958's commit, I pushed to remote before
running `npm run close 958`. The close script failed with "No unpushed commit
references 'Closes #958'". The commit was already on GitHub; the `Closes #958`
footer triggered GitHub's auto-close — the issue was already CLOSED — but the
close script couldn't find the commit locally because it had been pushed and was
no longer "unpushed."

**What I learned:** The close script checks for an unpushed commit containing
`Closes #N` as its detection mechanism. Once that commit is pushed, the hook
can't see it. The correct sequence is: `git push` after `npm run close`, not
before. When push-before-close happens, verify the issue state with
`gh issue view N --json state -q .state` — if GitHub auto-closed it via the
commit message, no manual action is needed.

**The rule:** `npm run close N` → `git pull --rebase` → `git push`. Never push
first.

---

## 2. Pre-rename worktrees need `VELOCITY_DB` env var override

**What happened:** During the #926 work, CHERRY's rename commit (#947,
`velocity.db` → `lccjs.db`) landed on main at 10:59. My #926 worktree had been
claimed at 10:57 — before the rename. When I ran `npm run velocity:log` from
inside that worktree, it hit `SqliteError: no such table: velocity`. The
worktree's scripts still pointed to `~/.lccjs/velocity.db`, which is now a
stale 4 KB shell; the live data is in `~/.lccjs/lccjs.db`.

**What I learned:** A worktree inherits the scripts from the commit it was
branched from. If a DB-path change lands on `main` after the worktree is
created, the worktree's scripts lag behind. The workaround is:

```bash
VELOCITY_DB=/home/avi/.lccjs/lccjs.db npm run velocity:log -- '{...}'
```

The same applies to `npm run error:log` and any other script that reads the DB
path from the environment.

**The rule:** After a DB rename lands mid-session, prefix all logging commands
with `VELOCITY_DB=<new-path>` in any worktree branched before the rename.

---

## 3. `git worktree prune` clears dangling references after getcwd failures

**What happened:** When removing the stale #958 worktree, the shell CWD was
still inside it (`cd`-ing out had failed silently). The `getcwd` call inside
`git worktree remove` failed with exit 1 and the error
`pwd: error retrieving current directory: getcwd: cannot access parent directories`.
The directory was removed from disk, but git's worktree metadata still listed
the path. A subsequent `git worktree remove .claire/worktrees/banana-issue-958`
failed with "not a working tree" (exit 128) because the path no longer existed.

**What I learned:** When a worktree's disk path is already gone but git's
metadata still references it, `git worktree prune` is the correct fix. It scans
for references pointing to nonexistent paths and silently removes them.

**The rule:** If `git worktree remove` fails with "not a working tree" and the
path is already gone from disk, run `git worktree prune` — not another remove.

---

## 4. Retroactive error logging belongs in the same session

**What happened:** Midway through closing #950, the user asked whether I had
logged all errors. I had logged 0 of the 9 errors that occurred during the
session. The missed errors included `CLAIM_FAIL`, `BASH_FAIL`, `GIT_STATE`,
`EDIT_PRECOND`, and `DB_FAIL` events — all resolved in the moment, none logged.

**What I learned:** "Resolved immediately" is not a skip criterion — it's
exactly the kind of event the always-log doctrine is designed to capture. The
notes field exists precisely so that retroactive rows carry their context:
`"retroactively logged; occurred ~10:30; resolved by ..."`. Approximate
`occurred_iso` is acceptable; an empty row is not.

**The rule:** Log at the moment of failure. If you miss it, log retroactively in
the same session with a notes annotation — never skip because the error was
resolved.

---

## 5. Delete and repost a research comment when issue numbers were wrong

**What happened:** When posting the #926 research comment, I used placeholder
issue numbers (`#959` and `#960`) in two places where the actually-filed child
tickets were `#969` and `#970`. I deleted the first comment with:

```bash
gh api -X DELETE repos/avidrucker/lccjs/issues/comments/<comment-id>
```

Then reposted the corrected version.

**What I learned:** GitHub issues and comments don't have an "edit" shortcut in
the `gh` CLI — you must use `gh api PATCH` with the comment endpoint, or delete
and re-post. For a research comment with substantive content, delete-and-repost
is cleaner than a PATCH because it leaves no edit history clutter. Always verify
actual issue numbers before posting by running `gh issue list --limit 5` to
confirm the most recently filed tickets.

**The rule:** Before posting a research or audit comment with issue-number
references, verify the numbers are real (not placeholder) with `gh issue list`.

---

## What landed

| Artifact | Change |
|---|---|
| `docs/errors-schema.md` | `OTHER` row expanded — fallback framing + retroactive-refinement note (#958) |
| `~/.claude/skills/log-error/SKILL.md` | Added `GIT_STATE`, `GH_INFO`, `EDIT_PRECOND` rows + context shapes; updated `OTHER` (#954) |
| `docs/skills.md` | Vocab count bumped to 15 codes, new types named (#954) |
| `stats/day-nine-analysis.ipynb` | §10 (6 cells): daily open/close flow, resolution time, resolution by type, open issue age, C-estimate by role (#950) |
| `~/.lccjs/lccjs.db` errors table | 9 retroactive rows (ids 30–39) for errors missed during the session |

## Open threads

- #969: `docs/claude_workflow.md` — stale error_type list (missing 3 new codes), "skip when" misalignment with always-log doctrine
- #970: `memory/error-logging-discipline.md` — same stale type list + skip-criteria contradiction
