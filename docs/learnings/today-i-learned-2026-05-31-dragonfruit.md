# Today I Learned — 2026-05-31 (DRAGONFRUIT)

A short morning session: find and remove two false-alarm "open puzzle" detections
that were clogging the project board, post GitHub comments explaining what happened,
then get corrected on three process steps I skipped.

---

*For readers new to this repo: every piece of work gets a row in a time-tracking
spreadsheet (`docs/puzzle-velocity.csv`) recording what was done and how long it
took. Code changes go on a separate Git branch ("worktree") so multiple agents can
work in parallel without clobbering each other. A scanner (`npm run puzzle:status`)
searches every file in the repo for `@todo` markers to show which tickets are still
in progress.*

---

## 1. Capture the start time before doing anything else

**What happened:** I forgot to record when I started the task. I did the whole
cleanup, then went to fill in the time-tracking row — and found I had no start time
to put there. That field is permanently blank for this session.

**Why it matters:** You can't reconstruct the start time after the fact. Guessing
is worse than leaving it blank, because a guessed time is invented data.

**What to do:** Run `date` as the literal first action when picking up a ticket —
before reading the issue, before writing any code. It takes two seconds and can't
be recovered later.

## 2. Writing *about* a marker accidentally becomes a marker

**What happened:** The scanner looks for `@todo #<number>:<estimate>` anywhere in
any file. BANANA had finished ticket #259 and written a note in the spreadsheet:
*"Dropped one `at_todo #259:30m/DEV` marker above resetProcessStdin."* That sentence
— describing a marker BANANA had just removed from the code — itself matched the
scanner. The scanner reported #259 as an unfinished open puzzle, even though the
issue was closed and the real marker was gone.

**Why it matters:** The scanner has no sense of context. It doesn't know whether
the pattern appears in a code comment, a doc, a spreadsheet note, or a shell
script. Any text matching `@todo #<number>:<digit>` fires it.

**What to do:** When writing about a marker in prose or notes, use `at_todo`
instead of `@todo`. This breaks the pattern without changing the meaning to a human
reader. This has now bitten the project in four different places (code comments,
a TIL doc, a spreadsheet notes field, a shell script string) — it belongs in the
main workflow doc.

## 3. Logging the work is a separate task from doing the work

**What happened:** The cleanup had two chores: (1) edit the files, and (2) log the
work in the spreadsheet. I did (1) on a separate branch as required. I forgot (2)
entirely. The user caught the missing log row. Then when I went to add it, that
spreadsheet edit also needed its own separate branch, because the spreadsheet is a
tracked file that multiple agents may write to at the same time.

**Why it matters:** Thinking of the log row as part of "closing the ticket" makes
it easy to skip, because you feel done once the real work is committed. But the log
entry is an independent obligation with its own commit and its own branch.

**What to do:** After finishing the work commit, explicitly ask: "Did I open a
separate branch and write the time-tracking row?" — not "did I close the ticket?"

## 4. Two commands together show who is actually working on what

**What happened:** `npm run puzzle:status` showed every ticket as available.
But `git worktree list` showed APPLE had a live working branch for ticket #280.
APPLE was already working on it — the board just couldn't see it because APPLE
hadn't yet placed a `@todo` marker in the code.

**Why it matters:** `puzzle:status` only knows about work that has a marker placed
in a source file. A research task, or any task whose marker hasn't been dropped yet,
is invisible to it. `git worktree list` shows every active branch regardless of
markers. Reading only one gives a false picture.

**What to do:** Run both before deciding what's available to grab.

## 5. Finishing a ticket isn't the same as cleaning up the branch

**What happened:** APPLE closed ticket #280, pushed the work, and closed the issue
— but left the working branch checked out on disk. `git worktree list` still
showed it; the local branch still existed.

**Why it matters:** A working branch left behind silently falls out of date as
`main` moves on. It clutters the branch list and confuses the board check above.

**What to do:** The close sequence has a cleanup step — `worktree remove` and
`branch -d` — that still has to be explicitly run even after a successful push.
Done pushing ≠ done closing.
