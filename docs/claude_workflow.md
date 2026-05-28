# Claude Workflow — what an AI agent does for each puzzle

This doc describes what a Claude (or any AI agent following the project's
conventions) does at each phase of working on a "puzzle" — a single bounded
piece of work tied to a GitHub issue and time-tracked in
[`puzzle-velocity.csv`](./puzzle-velocity.csv).

It is intentionally short. Detailed protocols live in their own files:

- [`puzzle-velocity.md`](./puzzle-velocity.md) — the time-tracking protocol + column reference + calibration history
- `~/.claude/skills/puzzle-velocity/SKILL.md` — the skill that auto-triggers the protocol when an agent picks up or closes a puzzle
- [`glossary/README.md`](./glossary/README.md) — the entry conventions for writing glossary definitions
- Memories at `~/.claude/projects/-home-avi-Documents-Study-JavaScript-lccjs/memory/` — feedback / project / reference notes the user has confirmed

If you're a human reviewer wondering "what happened" or "what should happen
next," start here.

---

## The four phases

```
                    ┌──── At start ─────┐
                    │  pick up ticket   │
                    │  capture H, C, t₀ │
                    └─────────┬─────────┘
                              ▼
                ┌──── While continuing ─────┐
                │   do the work             │
                │   surface findings        │
                └──────────┬────────────────┘
                           ▼
              ┌──── Maybe paused ─────┐
              │  user pivots / waits  │
              └─────────┬─────────────┘
                        ▼
                ┌──── At close ─────┐
                │  capture t₁       │
                │  two-commit close │
                │  velocity row     │
                └────────┬──────────┘
                         ▼
                    next puzzle
```

---

## At start (picking up a puzzle)

**Before reading the issue:**

1. Capture the start timestamp:
   ```bash
   date '+%Y-%m-%dT%H:%M:%S%z'
   ```
   Time starts the moment context-gathering begins, *not* the moment work begins. Reading the issue counts as start.

2. If the ticket has no C (Claude) estimate yet, set one now — before reading anything substantive about the task. This is a *forward-looking* prediction; the point is to track how my expectations align with reality.

**Then:**

3. Read the ticket body via `gh issue view <N>`.
4. Read referenced docs / source files needed for context.
5. (Optional) `TaskCreate` if the puzzle has 3+ distinct sub-steps worth tracking.
6. Pick the smallest concrete first step and start.

**What I do *not* do at start:**

- I don't expand scope ("while I'm here, let me also …"). The scope is fixed at the ticket body.
- I don't take destructive setup steps (force-pushing, dropping branches, deleting files) without explicit user authorization.
- I don't speculatively decompose work I haven't started. Decomposition happens when I see the work is too big — not as a default.

---

## While continuing (doing the work)

- **Stay in scope.** Anything outside the ticket gets logged as a finding, not pursued.
- **Surface findings as I notice them.** Open questions, unexpected behaviour, brittle code — these become candidate follow-up puzzles. I usually mention them at close so the user decides whether to file new tickets.
- **Verify as I go.** For code changes: assemble, run tests, exercise the change. For doc changes: re-read for accuracy and link sanity. For research: cite source line numbers so the reasoning is checkable.
- **Use TaskUpdate** to mark sub-steps complete if I created tasks. Cleaning up the task list is part of the work.
- **Brief, accurate status updates** — one sentence at key moments, not a running monologue.

**If I'm working in a `git worktree`** (because of parallel-agent activity):

- The worktree lives at `.claude/worktrees/issue-<N>/` on branch `worktree-issue-<N>`.
- I work in the worktree, not in the main checkout.
- All file edits and commits happen in the worktree.
- I push using the trunk-based pattern: `git push origin HEAD:main` (after rebase).

---

## While paused

A pause happens in two shapes:

**Brief pause (within the same session):**

- User asks a question, pivots, or wants me to wait for confirmation.
- I stop new work but keep my mental context.
- I don't commit in-progress prose — half-written work doesn't go into git.
- I don't restart from scratch when work resumes; the conversation context bridges it.

**Long pause (likely end-of-session, context compaction risk):**

- If significant work is uncommitted, I propose committing it as a draft with a clear "WIP" prefix — never with `Closes #N`.
- If the puzzle is more than half done but not closeable, I suggest writing a handoff doc via the `/handoff` skill so the next session/agent can resume cleanly.
- I don't try to force-close a puzzle that isn't actually done just to land *something*.

---

## At close (finishing the puzzle)

**Before the closing commit:**

1. Capture the finish timestamp:
   ```bash
   date '+%Y-%m-%dT%H:%M:%S%z'
   ```
2. Final verification — does the change actually do what it should?

**The close sequence** (full protocol in [`puzzle-velocity.md`](./puzzle-velocity.md)):

```bash
git commit -m "... Closes #N"      # commit 1: closes the ticket
git pull --rebase                  # critical: parallel agents may have pushed
sha=$(git rev-parse --short HEAD)  # capture POST-rebase SHA
# Append CSV row to docs/puzzle-velocity.csv with $sha
git commit -m "docs(velocity): log #N — …"   # commit 2
git push
```

The `git pull --rebase` step **must** happen between commit 1 and the SHA capture. This is the one parallel-agent gotcha worth memorizing — without it, the CSV ends up pointing at an unreachable commit.

**After the push:**

3. Update tracker checkbox **via an issue comment**, not a body edit. (Body edits race with parallel agents; comments are append-only.) If there's no tracker, this step is skipped.
4. Mark any related TaskCreate tasks as complete via TaskUpdate.
5. Report what changed in 1-2 sentences. Include the velocity Δ if it's interesting.

**What I do *not* do at close:**

- I don't squash commits or rewrite history once pushed.
- I don't force-push to `main`, ever, without explicit user authorization.
- I don't open a PR unless asked — the project uses trunk-based merges.
- I don't gold-plate. Once the ticket scope is met, I stop.

---

## What I track in the CSV

One row per closed puzzle in [`puzzle-velocity.csv`](./puzzle-velocity.csv). Columns:

| Column | Meaning |
|---|---|
| `ticket` | GitHub issue number |
| `title` | short title |
| `role` | DEV / TEST / ARC / WRITER / PM |
| `h_min` | Human time estimate (drives Yegor's ≤60m cap) |
| `c_min` | Claude time estimate (for forecasting) |
| `actual_min` | wall-clock from start to closing commit |
| `delta_h_min` | `actual_min − h_min` |
| `delta_c_min` | `actual_min − c_min` |
| `started_iso` / `finished_iso` | ISO 8601 with timezone |
| `closed_commit` | git short SHA, captured *after* `pull --rebase` |
| `notes` | free-text — anomalies, context, surprises |

Empty cells = "not tracked" (common for rows logged retroactively).

---

## Concept glossary (one-liners)

- **PDD** — Puzzle-Driven Development. Unfinished work lives as a `@todo #N:Est/ROLE description` comment in code, tied to a GitHub issue.
- **Puzzle** — one such `@todo` + ticket pair. Cap is 60m human time.
- **Spike** — a bounded research puzzle that produces findings, not code. Labeled `research` (not `pdd-tracked`).
- **Tracker** — a GitHub issue that doesn't represent a single work unit but tracks N child puzzles. Example: #108 tracked the 5 assembler.js spikes.
- **H / C** — Human / Claude time estimates. H drives the Yegor cap (discipline). C is my forward-looking forecast (calibration).
- **Worktree** — a separate working directory + branch for parallel-agent work. Lives at `.claude/worktrees/issue-<N>/`.
- **Trunk-based** — agents push directly to `main` (with `git push origin HEAD:main` from a feature branch). No PRs by default.

---

## When this document is wrong

This doc reflects current convention. If the protocol changes (the skill bumps a version, the close sequence changes, etc.), update this doc in the same commit. Stale workflow docs are worse than missing ones.

If you (the user) see me doing something different from what's described here, call it out — either I have a reason and should explain it, or I'm drifting and should correct.
