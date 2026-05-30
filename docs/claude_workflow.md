# Claude Workflow — what an AI agent does for each puzzle

**Why this file exists (vs. `CLAUDE.md`):** `CLAUDE.md` is the lean, always-in-context
orientation loaded every session — it points here but deliberately does *not* duplicate
the protocol. This doc is the full, on-demand reference for the project's
Puzzle-Driven-Development process: read it before doing puzzle work, and treat it
as the authority when a quick summary and the detail disagree. It also serves human
reviewers asking "what happened / what should happen next." When the protocol changes,
this doc is the single source of truth to update (see "When this document is wrong" below).

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
- **Tool-failure discipline.** Any `tool_use_error` from Edit/Write/Bash means the operation **did not happen** — treat it as a hard block, not advice. Two real failure modes have shipped broken state in this project:
  - *Stale read* (`File has been modified since read`) — another agent touched the file between my Read and Edit. The file is unchanged from its pre-Read state; my intended edit is lost.
  - *Classifier outage* (`Opus temporarily unavailable, auto mode cannot determine safety`) — the Edit's safety check couldn't run. Write/Edit returns an error; the file is unchanged.
  Do NOT `git add` a file I just edited unless I've confirmed the edit applied — re-read, grep for the new content, or check `git diff`. A successful tool result for the *next* call after an error does NOT retroactively apply the failed one. This pattern shipped raw conflict markers in lccjs commit `cb798a7` (#139 close); followup `a19d115` cleaned it up. The puzzle-velocity skill 0.4.0 has a grep guard for the rebase-conflict variant specifically; this rule is the general case.

**If I'm working in a `git worktree`** (because of parallel-agent activity):

- **I claim under a self-assigned agent identity** so `git worktree list` shows *who* is working *what*. I run `npm run claim -- <issue>` instead of bare `git worktree add`; it picks the lowest free **fruit** name (apple, banana, …), stakes the worktree at `.claude/worktrees/<fruit>-issue-<N>/` on branch `<fruit>/issue-<N>-<slug>`, and prints the name. **My fruit is stable for the whole session** — for any *further* worktree I open I pass `--as <fruit>` to reuse it (`auto` is for the first claim only; it returns a brand-new fruit and is race-safe via detect-and-rollback). See `docs/design-agent-worktree-identity.md`.
- The worktree lives at `.claude/worktrees/<fruit>-issue-<N>/` on branch `<fruit>/issue-<N>-<slug>`. (Legacy worktrees used `worktree-issue-<N>`; both still carry `issue-<N>`, so `puzzle:status` recognises either — it just can't attribute the legacy ones to an agent.)
- I work in the worktree, not in the main checkout.
- All file edits and commits happen in the worktree.
- I push using the trunk-based pattern: `git push origin HEAD:main` (after rebase).
- **I flip the puzzle's marker from `@todo` to `@inprogress`** the moment I check it out, so the marker on `main` reads as *claimed*, not idle. `pdd` ignores `@inprogress` (it matches only `@todo`), so this keeps the gem's count clean while signalling other agents to keep off. At close the marker is deleted as usual; if I abandon the work, I flip it back to `@todo`.
- **`npm run puzzle:status`** reconciles every marker against live worktrees and GitHub issue state — it shows each puzzle as `AVAILABLE` / `CLAIMED` / `IN-PROGRESS` / `STALE`, and attributes claimed/in-progress rows to the owning agent (`… by apple`) when the worktree branch carries a fruit identity. Run it before grabbing a puzzle (don't grab a `CLAIMED`/`IN-PROGRESS` one) and after closing (a `STALE` row means a marker outlived its closed issue — delete it). `-- --strict` exits non-zero on any stale marker, for gating.
- **I remove my worktree when I finish** (this is mandatory, not optional — see "At close" below). A worktree left on disk after the issue is closed is cruft: it looks like a live claim to other agents and to `puzzle:status`, but no one is in it. The owning agent cleans up its own worktree; do not assume someone else will.

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

<!-- @todo #201:30m/WRITER this close sequence is STALE — it predates #186. The current protocol (docs/puzzle-velocity.md "Protocol" step 5 + "closed_commit: derive, don't capture") is a SINGLE commit with closed_commit left empty (CSV merge=union auto-resolves parallel rows), not the two-commit + capture-SHA flow shown below. Rewrite this section and the closed_commit row in "What I track in the CSV" to match #186; cross-reference it. See #201. -->

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
5. **Remove my worktree** — `ExitWorktree --remove` (for one created via `EnterWorktree`) or `git worktree remove .claude/worktrees/issue-<N>` + `git worktree prune`. This is **mandatory**: confirm the commits are on `origin/main` first (`git branch -r --contains HEAD` → `origin/main`), then remove. Leaving a worktree behind after close is the #1 source of "is someone working on this?" confusion — it reads as a live claim when no agent is in it. Delete the throwaway `worktree-issue-<N>` branch too (it's merged and has no remote).
6. Report what changed in 1-2 sentences. Include the velocity Δ if it's interesting.

**What I do *not* do at close:**

- I don't squash commits or rewrite history once pushed.
- I don't force-push to `main`, ever, without explicit user authorization.
- I don't open a PR unless asked — the project uses trunk-based merges.
- I don't gold-plate. Once the ticket scope is met, I stop.
- I don't leave my worktree on disk after closing. Cleaning it up is part of closing (step 5), not a later chore for someone else.

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
| `agent` | which agent did it — the worktree fruit identity, uppercased (e.g. `APPLE`); trailing column. Empty if unknown. |

Empty cells = "not tracked" (common for rows logged retroactively, or — for
`agent` — work done before #180 or by an unidentified agent). **Log the `agent`
on every new row** (it's the fruit you claimed with `npm run claim`); don't
backfill historical rows whose agent you can't verify.

---

## PDD scan coverage & the `at_todo` placeholder

`npm run puzzles` runs the `pdd` gem over the repo to enforce that every real
puzzle marker is backed by a GitHub issue. **What it scans is controlled by
[`.pddignore`](../.pddignore)** (root) — a gitignore-style file, one exclude glob
per line, read by `scripts/run-pdd.sh` and translated into `pdd --exclude`
arguments. To change what's scanned, edit `.pddignore`; nothing is hardcoded in
`package.json` anymore.

The default policy is **scan all source, blacklist the rest**: code under `src/**`
and friends is scanned; `docs/**`, all `*.md`, fixtures, generated trees,
throwaway/experiment dirs, and the scanner's own files are excluded.

**The substring trap.** `pdd` is a dumb, case-sensitive *substring* matcher. It
flags the bare uppercase keyword (`@todo`'s uppercase form, or `TODO` / `TODO:`)
**anywhere** in a scanned file — even buried inside a larger token. A stray
mention with no leading space aborts the *entire* scan with a parse error, not
just that line. So in a scanned (code) file you can never write the uppercase
keyword unless you mean a real puzzle.

**The `at_todo` placeholder (code files only).** When you need to *talk about*
the marker concept in a scanned code file — a comment explaining the puzzle
system, a variable, a doc-comment — write it lowercase: **`at_todo`**. Lowercase
is invisible to the matcher (verified: lowercase passes, uppercase aborts even
inside a token like `AT_TODO`). Rules:

- Use `at_todo` **only in scanned code files**, and only to *discuss* the concept
  — never as an actual obligation. A real puzzle is always the uppercase
  `@todo #N:Est/ROLE` form with a backing issue.
- In **non-scanned files** (`docs/**`, `*.md` — this very document) there's no
  matcher to dodge, so write the real keyword normally for readability.
- Don't invent uppercase variants (`AT_TODO`, `AT-TODO`, …) to "escape" the
  scanner — they all contain the uppercase keyword as a substring and will trip
  it. Lowercase `at_todo` is the one safe spelling.

## Concept glossary (one-liners)

- **PDD** — Puzzle-Driven Development. Unfinished work lives as a `@todo #N:Est/ROLE description` comment in code, tied to a GitHub issue.
- **Puzzle** — one such `@todo` + ticket pair. Cap is 60m human time.
- **`@inprogress`** — a `@todo` that's been checked out into a worktree. Same shape (`@inprogress #N:Est/ROLE`), but signals "claimed, don't grab." Invisible to the `pdd` gem; surfaced by `npm run puzzle:status`. Flip back to `@todo` if abandoned, delete on close.
- **`puzzle:status`** — `scripts/puzzle-status.js`, run via `npm run puzzle:status`. Joins markers × worktrees × issue state into AVAILABLE / CLAIMED / IN-PROGRESS / STALE. The authority on "what's safe to grab" and "what marker is orphaned."
- **`.pddignore`** — root file (gitignore-style) listing the globs the puzzle scanner skips. Read by `scripts/run-pdd.sh`; the single source of truth for scan coverage.
- **`at_todo`** — lowercase placeholder for *discussing* the marker concept inside a scanned code file without tripping the case-sensitive `pdd` substring matcher. Never an actual obligation; see "PDD scan coverage" above.
- **Spike** — a bounded research puzzle that produces findings, not code. Labeled `research` (not `pdd-tracked`).
- **Tracker** — a GitHub issue that doesn't represent a single work unit but tracks N child puzzles. Example: #108 tracked the 5 assembler.js spikes.
- **H / C** — Human / Claude time estimates. H drives the Yegor cap (discipline). C is my forward-looking forecast (calibration).
- **Worktree** — a separate working directory + branch for parallel-agent work. Lives at `.claude/worktrees/<fruit>-issue-<N>/` on branch `<fruit>/issue-<N>-<slug>`, claimed via `npm run claim`. The fruit (apple, banana, …) is the **agent identity** for the session. See `docs/design-agent-worktree-identity.md`.
- **Trunk-based** — agents push directly to `main` (with `git push origin HEAD:main` from a feature branch). No PRs by default.

---

## When this document is wrong

This doc reflects current convention. If the protocol changes (the skill bumps a version, the close sequence changes, etc.), update this doc in the same commit. Stale workflow docs are worse than missing ones.

If you (the user) see me doing something different from what's described here, call it out — either I have a reason and should explain it, or I'm drifting and should correct.
