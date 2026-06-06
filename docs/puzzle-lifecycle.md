# Puzzle lifecycle — how a `@todo` and a GitHub issue relate here

This is the plain, end-to-end answer to two questions:

1. How does a puzzle become a GitHub issue in this repo?
2. How and when does the `@todo` marker turn into a "this work is done" signal?

If you've read about Puzzle-Driven Development elsewhere, **the order here is
reversed from the textbook** — see "How this differs from canonical Yegor/0pdd"
at the bottom. Read that note if anything below surprises you.

## The short version

- **The GitHub issue comes first. The `@todo` marker comes second** and points
  back at the issue number.
- A marker has **three states**: `@todo #N` (available) → `@inprogress #N`
  (someone's working it) → **deleted** (done).
- "Done" is not a new marker. **Done = the marker is gone + the issue is closed.**
- Nothing auto-files or auto-closes from the marker. We do both steps by hand
  (`gh issue create`, then `Closes #N` in the commit).

## Part 1 — From a puzzle to a GitHub issue

You have a deferred sub-problem and want it tracked. Steps, in order:

1. **File the GitHub issue first.** Use `gh issue create` with a clear title and
   a body in complaint shape (have X / should have Y / repro). Add labels
   (`severity:low|medium|high`, a type label like `documentation`/`bug`/`testing`,
   and `pdd-tracked` if it will carry an inline marker). This returns issue `#N`.

2. **Check the work fits in ~60 minutes.** If it doesn't, split it into smaller
   issues *before* writing any marker. A puzzle is always ≤60m of human effort.

3. **Write the `@todo` marker at the code site**, referencing `#N`:

   ```
   @todo #N:30m/ROLE one-line description of what's owed here
   ```

   - `#N` — the issue number from step 1.
   - `30m` — the estimate (minutes), ≤60.
   - `ROLE` — DEV / TEST / ARC / WRITER / PM.
   - Put it at the exact spot the work is owed (the stub, the gap, the section).
   - In **code files** this is a normal comment. In **docs/markdown** it's
     usually an HTML comment: `<!-- @todo #N:30m/ROLE ... -->`.

That's the whole "conversion." There is no bot. The issue and the marker are two
hand-made artifacts that reference each other by number.

> **Why issue-first?** The canonical PDD tool (`0pdd`) watches the code and files
> the issue *for* you when it sees a new `@todo`. We don't run `0pdd` (it's been
> broken since Feb 2024), so we create the issue ourselves and then write a marker
> that already knows its number.

### A marker is optional

Not every issue needs a marker. An issue with **no natural code site** (an
upstream tracker, a pure research spike, a scope/tracker ticket) lives as a
GitHub issue alone. The marker exists only to make owed work visible *while you're
reading the code where it's owed*.

### Tracker tickets — file a child issue first

If the issue you're working is a **tracker** (its body says "stays open until
children resolve"), you must file a **concrete child issue** for your chosen
sub-item *before* claiming a worktree or starting any work. Velocity is logged on
the child; the tracker stays open. No exceptions for small or obvious items.
(RULES.md #12; see also `claude_workflow.md` §"While continuing".)

## Part 2 — The marker's three states

The marker is the live, in-code signal of where a puzzle stands:

| Marker in the source | Meaning | Seen by |
|---|---|---|
| `@todo #N:30m/ROLE …` | **Available** — unclaimed, grab it | `pdd` scan **and** `puzzle:status` |
| `@inprogress #N:30m/ROLE …` | **Claimed** — an agent is working it in a worktree; don't grab | `puzzle:status` only |
| *(marker deleted)* | **Done** — resolved | nobody; its absence *is* the signal |

Key points:

- **`@todo` → `@inprogress`:** the moment you check the puzzle out into a worktree
  (`npm run claim -- N`), flip its marker to `@inprogress`. The `pdd` gem matches
  only `@todo`, so `@inprogress` drops out of the gem's count while still telling
  other agents "hands off." If you abandon the work, flip it back to `@todo`.
- **`@inprogress` → deleted:** when the work is done, you remove the marker
  entirely (see Part 3). There is no `@done`.
- `npm run puzzle:status` reconciles every marker against live worktrees and the
  GitHub issue state, reporting each as AVAILABLE / CLAIMED / IN-PROGRESS / LOCKED
  (a clustermate is in progress) / BLOCKED (a `blocked` label or an open `blocked_by`
  dep) / STALE. A **STALE** row means a marker outlived its closed issue — delete it.

## Part 3 — How and when "done" is signalled

Resolving a puzzle is a deletion, not a status change. In order:

1. **Do the work** (write the code/doc, make tests pass) and capture the finish
   timestamp (`date '+%Y-%m-%dT%H:%M:%S%z'`).
2. **Log the velocity row** with `npm run velocity:log -- '{"ticket":N,…}'`. This
   validates and inserts the row into the SQLite store (`~/.lccjs/velocity.db`, the
   source of truth) and **auto-exports** `docs/puzzle-velocity.csv`. Never hand-edit
   the CSV — it is a generated, read-only view (see
   [`puzzle-velocity.md`](./puzzle-velocity.md)).
3. **Delete the marker** from the source — the `@todo` or `@inprogress` line. This
   is the step people forget; a leftover marker goes STALE.
4. **Make one commit** carrying everything — the marker deletion *and* the exported
   CSV — with `Closes #N` in the message.
5. **Land and tear down with `npm run close N`.** `close` only **pushes** — it does
   not commit. The closing commit from step 4 must already exist before you run it;
   a dirty working tree aborts close immediately with `✗ working tree is not clean`.
   Once running, it loops fetch/rebase/push until the commit is on `origin/main`, and
   **only then** removes the worktree + branch (the gate that makes "clean up after a
   failed push" impossible). It also fast-forward-pulls the main checkout and prints
   `Shell re-root: cd <path>` — don't run `git pull` yourself after close, the
   shell's CWD is the now-deleted worktree. GitHub auto-closes `#N` from the
   `Closes #N` keyword once the commit lands; close.js verifies this and closes it
   explicitly if the keyword lagged.
6. **Post a closing comment on the issue** summarising what changed (an append-only
   comment, not a body edit — body edits race with parallel agents). For **research
   tickets**: post findings here, not in a `docs/learnings/` TIL file. Write a TIL
   only when the knowledge is durable and cross-ticket. (See `claude_workflow.md`
   §"While continuing" for the full rule.)

> **Don't hand-push at close.** `git pull --rebase && git push origin HEAD:main`
> followed by a manual `git worktree remove` is the *unhardened* sequence that
> destroyed work in the #200/#242 incidents — cleanup ran even when the push lost a
> parallel-agent race, leaving the close commit only local while the worktree was
> already gone. `npm run close` exists to remove that footgun structurally; the
> `&&`-gated fallback in [`claude_workflow.md`](./claude_workflow.md) is only for
> when `close` is unavailable.

After this: the marker is gone, the next `pdd` scan and `puzzle:status` no longer
show the puzzle, and the GitHub issue is Closed. Those three facts together are
the "work is done" signal — there is no fourth artifact.

## How this differs from canonical Yegor/0pdd

| Step | Canonical PDD (`0pdd`) | This repo |
|---|---|---|
| Issue creation | Bot files it when it sees a new `@todo` (marker-first) | You file it with `gh` first (issue-first) |
| Issue closing | Bot closes it when the marker disappears | `Closes #N` in the commit (or `gh issue close`) |
| Enforcement | Bot + scan | pre-push hook — `pdd` scan **plus** a rebase/merge/conflict-marker gate (#205) — and `puzzle:status` |

The marker format and the "resolution = deletion" idea are identical. Only the
*who files/closes the issue* part is manual here, and that's why the issue exists
before the marker rather than after.

## Commands

```bash
gh issue create --label severity:low --label documentation   # 1. make the issue (#N)
# ... write the @todo #N marker at the code site ...

# --- picking up a puzzle ---
date '+%Y-%m-%dT%H:%M:%S%z'  # capture t₀ BEFORE reading the issue (start time)
# set your C estimate (forward-looking: how long will this actually take?) — before reading
gh issue view N --comments    # read the issue body AND all comments (#660)
npm run claim -- N --as apple # claim a worktree; in fan-out (≥2 agents running in parallel)
                              # always pre-assign --as <fruit>; bare 'auto' is unsafe (#386)
# then immediately flip @todo #N -> @inprogress #N in the worktree
npm run puzzle:status         # AVAILABLE / CLAIMED / IN-PROGRESS / LOCKED / BLOCKED / STALE
npm run puzzles               # pdd scan (pre-push hook runs this too)

# --- closing ---
date '+%Y-%m-%dT%H:%M:%S%z'  # capture t₁ BEFORE the closing commit (finish time)
npm run velocity:log -- '{"ticket":N,"role":"ROLE","agent":"NAME"}'  # row -> SQLite, auto-exports the CSV
# ... delete the @todo / @inprogress marker ...
git add -A && git commit -m "... Closes #N"   # one commit: marker deletion + exported CSV
npm run close N               # push-only — commit must exist first; loops rebase/push, then tears down
```

## See also

- [`claude_workflow.md`](./claude_workflow.md) — the full per-phase agent protocol.
- [`puzzle-velocity.md`](./puzzle-velocity.md) — the time-tracking row you log at close.
- [`learnings/2026-05-26-pdd-adoption.md`](./learnings/2026-05-26-pdd-adoption.md) —
  why PDD was adopted here and the 0pdd-manual decision.
- [`scripts/lccrun.sh`](../scripts/lccrun.sh) — wrap every `lcc.js`, `assembler.js`,
  `interpreter.js`, or oracle (`$LCC_ORACLE`) shell invocation in this script to
  prevent indefinite hangs when `name.nnn` is absent and stdin is not a TTY (#376).
  Full protocol in `claude_workflow.md` §"While continuing".
