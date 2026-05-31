# Today I Learned — 2026-05-31 (DRAGONFRUIT)

A short morning session: identify and remove two stale `puzzle:status` markers,
post GitHub comments on the closed issues, and retrospect on the three protocol
misses that turned a five-minute cleanup into a corrective loop.

## 1. Pre-flight start timestamp is not optional — I proved it by skipping it

The velocity protocol says: `date '+%Y-%m-%dT%H:%M:%S%z'` is the *first* action
before reading the issue or writing a line of code. I skipped it, did the whole
stale-marker cleanup, and ended up with an empty `started_iso` in the velocity row.
The user caught both the missing row *and* the missing timestamp in the same
correction.

There's no reconstruction path once the window closes. A retroactively guessed start
time is worse than an empty field — it's invented data. The protocol step is cheap;
the honesty tax of skipping it is paid in permanent holes in the calibration record.

## 2. The `at_todo` trap is meta-recursive in velocity notes

The #259 velocity row's notes described the work done: "Dropped one
`at_todo #259:30m/DEV` marker above `resetProcessStdin`." That description *was*
the live marker form. `puzzle:status`'s `git grep` found it and flagged #259 as a
phantom open marker — even though #259 was closed and the actual code-site marker
had been deleted.

The 2026-05-30 DRAGONFRUIT TIL (lesson 4) already documented this trap biting CSV
*data*. Today's case is one level deeper: it's a notes field whose subject is the
act of dropping a marker. The trap doesn't care about context or intent — any
substring matching `@(todo|inprogress) #[0-9]+:[0-9]` fires. Known surfaces so far:
code comments, TIL prose, velocity CSV notes, shell `echo` strings (APPLE, 2026-05-31).

> Recurring thread: this is the third DRAGONFRUIT encounter with the scanner (once
> in the TIL doc itself, once here). At four documented surfaces it belongs in the
> authority doc, not just TILs.

## 3. Two omissions, not one — the row and the worktree are separate obligations

The cleanup needed a worktree for the file edits (used correctly) and a velocity
row (skipped entirely). The user caught the row. When I added the row, it also
needed its own worktree — the row-append itself is a tracked file change. These are
two independent obligations, not one bundled thing. Treating them as one ("I'll log
it when I close") is what made the first omission invisible until called out.

## 4. `puzzle:status` and `git worktree list` are complements, not alternatives

`puzzle:status` only sees `@todo` / `@inprogress` marker-backed work. A RESEARCH
task with no code-site marker (or one just started, marker not yet dropped) is
invisible to it. APPLE's `APPLE-issue-280` worktree showed nothing on
`puzzle:status` — every puzzle read AVAILABLE — while `git worktree list` showed
the live worktree. The complete board picture requires both.

## 5. Stale worktrees outlive closed issues

APPLE closed #280, committed the findings doc, pushed the velocity row — and left
the worktree behind. `git worktree list` showed it still registered; the branch was
still local. The close tool gates on push success before running cleanup, but the
cleanup step still has to be explicitly invoked. A successful close that stops before
`worktree remove` + `branch -d` leaves a registry entry and a local branch that
will silently diverge as `main` moves on.
