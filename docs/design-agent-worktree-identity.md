# Design — agent identity on worktree branches

Tracker: [#179](https://github.com/avidrucker/lccjs/issues/179)

## Problem

Multiple Claude agents work lccjs in parallel (the worktree-per-task workflow in
`docs/claude_workflow.md`). But there is no way to glance at the machine and see
**who** is working on **what** and since **when**.

- `git worktree list` shows topic branches, but the existing `worktree-issue-<N>`
  naming carries no agent identity — two agents look the same.
- `@inprogress` markers live *inside* each worktree's branch, so they are
  invisible from `main` until merged. This is exactly why `npm run puzzle:status`
  reports every puzzle as `AVAILABLE` even when an agent is mid-work in a
  worktree that hasn't pushed yet.

We want a visible, collision-free, self-assigned agent name.

## Goals

- A human-readable agent name (`apple`, `banana`, `cherry`, …) visible in
  `git worktree list` with zero extra tooling.
- **Self-assigned** — no human step required; an agent picks its own name.
- **Stable per session** — an agent keeps one fruit for every worktree it opens
  during its life.
- **Race-safe** — two agents starting at the same instant never end up sharing a
  fruit silently.

## Non-goals

- Cross-machine identity. Every worktree lives under one `$HOME`; single-machine
  coordination is enough.
- Persistent identity *across* sessions. A new session is a new fruit. We only
  care about "who is active right now."
- A central registry/lock file. Git's branch namespace is the source of truth;
  any file we maintain in parallel would just drift.

## Design

### Carrier = branch name

Convention: **`<fruit>/issue-<N>-<slug>`**, e.g. `apple/issue-179-agent-identity`.

The worktree lives at **`.claude/worktrees/<fruit>-issue-<N>/`**, matching the
existing `.claude/worktrees/` location from `docs/claude_workflow.md`.

This is backward-compatible with the existing tooling:
`scripts/puzzle-status.js` maps a worktree to its issue with the regex
`/issue-(\d+)/`, and both the branch (`…/issue-179-…`) and the path
(`…/apple-issue-179`) still contain `issue-179`. The fruit prefix is *additive*
— it does not break the issue join; `puzzle-status` is extended only to *display*
the fruit, not to depend on it.

```
$ git worktree list
…/lccjs                                  d28c060 [main]
…/.claude/worktrees/apple-issue-179      a1b2c3d [apple/issue-179-agent-identity]
…/.claude/worktrees/banana-issue-171     e4f5g6h [banana/issue-171-linker-coverage]
```

- **who** = fruit prefix (segment before the first `/` in the branch)
- **what** = `issue-<N>` in branch and path
- **when** = worktree directory mtime + first-commit timestamp (git records these)

Because the close path is `git push origin HEAD:main`, the fruit branch name
never lands on `main` — it is purely local coordination scaffolding, deleted with
the worktree at close.

### A fruit is "taken" iff a `<fruit>/*` branch exists

This keeps git as the single source of truth — no registry file to fall out of
sync. `claim.js` reads `git worktree list --porcelain`, takes each branch's
prefix before the first `/`, and that set is the taken-fruit set.

### Selection contract: `auto` vs `--as`

`claim.js` has two modes, and the distinction is what makes "stable per session"
work without the script needing to remember anything between invocations (it is
a fresh subprocess each time — the stability lives in the *agent's* context):

- **`auto`** (no `--as`): "give me a brand-new fruit nobody is using." Picks the
  lowest-indexed free fruit. Use this **once**, on your first claim of the
  session.
- **`--as <fruit>`**: "reuse this identity." Use this for every *subsequent*
  worktree you open in the same session, passing the fruit `auto` gave you (or
  the one a human assigned at launch). Same-fruit, different-issue branches are
  *expected* here.

### Race safety

The atomic operation is `git worktree add -b <branch>`: it fails if the branch
already exists. That fully protects the **(fruit, issue)** pair — two agents
can't both create `apple/issue-179-…`.

The subtle case is two agents in `auto` mode, within the same sub-second window,
both reading "apple is free" and then staking *different* issues
(`apple/issue-A`, `apple/issue-B`) — both succeed, both become apple. The
per-branch atomicity doesn't catch this because the branch names differ.

`auto` mode closes that window with **detect-and-rollback**: after staking, it
re-reads the worktree list; if any branch *other than the one it just created*
shares its fruit prefix, it lost the race — it removes its just-created
worktree+branch and retries with the next fruit. This is sound precisely because
`auto` promises a *fresh* fruit (so >1 same-fruit branch ⇒ collision), whereas
`--as` expects to share and skips the check.

### Algorithm (claim.js)

```
args: <issue-number> [slug] [--as <fruit>] [--base <ref=main>] [--dry-run]

taken = { branch.split('/')[0] for branch in `git worktree list --porcelain`
          if branch contains '/' }

if --as F:
    stake(F, issue, slug)            # branch-exists failure ⇒ hard error (this
                                     # issue already claimed under F)
else:
    for F in FRUITS where F not in taken:
        try stake(F, issue, slug)
        except branch-exists: continue          # lost the (fruit,issue) race
        if another <F>/* branch now exists:     # lost the fruit race
            rollback(F, issue); continue
        done
    if none free: fall back to `<lastFruit>-2` suffix (logged, not silent)

stake(F, N, slug):
    branch = `${F}/issue-${N}${slug ? '-'+slug : ''}`
    path   = `.claude/worktrees/${F}-issue-${N}`
    git worktree add <path> -b <branch> <base>
```

## Edge cases

- **Idle pick:** a name is only meaningful once the first worktree exists, so we
  couple pick + stake — `claim.js` never "reserves a fruit" without creating the
  worktree.
- **Fruit reuse after teardown:** if `apple` removes all its worktrees but is
  still alive, a later agent may `auto`-pick `apple`. Two apples then appear in
  *history* but never *concurrently*, which is all "who's working now" needs.
  > ⚠️ **#193 falsified the "never concurrently" claim.** Identity here is
  > worktree-scoped, not session-scoped: an agent sitting between puzzles is alive
  > but invisible to `takenFruits()`, so auto handed a live apple's name to another
  > agent. See [`research/claim-fruit-session-scope.md`](./research/claim-fruit-session-scope.md)
  > for the analysis and the recommended fix (mandatory `--as` for concurrent
  > fan-out now; a session-sentinel branch if it recurs).
- **Fruit-list exhaustion:** with ~24 fruits, exhaustion is unlikely; fall back
  to a `-2` suffix and log it (no silent cap).

## Components

1. `scripts/claim.js` + `npm run claim` — the read → pick → atomic-stake →
   (auto: detect-rollback) → retry helper. Prints the assigned fruit, branch,
   path, and next-step hints.
2. `scripts/puzzle-status.js` — extract the fruit from each worktree's branch and
   show it on `CLAIMED` / `IN-PROGRESS` rows (`… by apple`), so the reconciler
   finally attributes active work.
3. `docs/claude_workflow.md` — document the convention and tell agents to claim
   via `npm run claim` instead of bare `git worktree add`.

## Relation to existing tooling

- **`puzzle:status`** still answers "what is safe to grab" (marker × worktree ×
  issue state). This design only adds the agent attribution to its output.
- **`puzzle-velocity`** is unchanged — velocity rows are per puzzle, not per
  agent.
- Supersedes the bare `worktree-issue-<N>` branch name in
  `docs/claude_workflow.md` with `<fruit>/issue-<N>-<slug>`.
