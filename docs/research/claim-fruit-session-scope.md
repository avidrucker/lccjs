# Claim auto-fruit: worktree-scoped vs session-scoped identity

**Issue:** #193 (research spike, ≤60m) · **reporter:** banana (surfaced claiming #152)
**Date:** 2026-05-29 · **spike by:** apple · **relates to:** #188 (concurrency-safe work-tracking)

## Question

`npm run claim -- <N>` in **auto** mode is supposed to hand out "a brand-new fruit
nobody is using." On 2026-05-29 it handed banana the identity **`apple`** while a
separate, still-alive `apple` session was working `#168`. Why, and what should the
fix be — given the original design ([`design-agent-worktree-identity.md`](../design-agent-worktree-identity.md))
deliberately ruled out a registry file?

## Root cause (confirmed)

`takenFruits()` derives the "in use" set **only from live git worktrees**:

```js
// scripts/claim.js
function takenFruits() {
  return new Set(listWorktreeBranches().map((b) => b.fruit).filter(Boolean));
}
// listWorktreeBranches() parses `git worktree list --porcelain`
```

So a fruit is judged free **the instant its last worktree is removed**. Auto picks
the lowest-index free fruit (`claim.js:164-165`). Verified empirically: with apple
and banana both holding live worktrees, `node scripts/claim.js 999 --dry-run`
returns `cherry` — i.e. auto is *correct while an agent holds a worktree*. The
collision only opens in the **gap between an agent's worktrees**: agent-apple had
closed #168 and removed `apple-issue-168` in the seconds around banana's claim, so
`apple` looked free even though the apple session was still alive.

**Identity is worktree-scoped, not session-scoped.** That is the whole bug.

## Why the "obvious" fix does not work

The `claim.js` header comment (lines 26–27) and the design doc (lines 36, 72) both
assert *"a fruit is taken iff a `<fruit>/*` branch exists — git's branch namespace
is the source of truth."* **The implementation does not match that claim** —
`takenFruits()` looks at *worktree-attached* branches, not the full branch
namespace. (Sub-finding A, below.)

But reconciling the code to the comment — scanning `git branch --list '<fruit>/*'`
instead of the worktree list — **would not fix #193**, because the close protocol
([`claude_workflow.md`](../claude_workflow.md) step 5) deletes the branch too
(`git branch -D <fruit>/issue-N-...`). After a close, *both* the worktree and the
branch are gone, so any git-artifact-per-puzzle scheme frees the fruit at close.

The gap can only be closed by an artifact whose lifetime is the **session**, not a
single puzzle — something that survives the teardown of any individual worktree.

## The falsified assumption

The design doc already documented this edge case (line 139–141, *"Fruit reuse after
teardown"*) but dismissed it:

> Two apples then appear in *history* but never *concurrently*, which is all
> "who's working now" needs.

#193 is the **counterexample**: the two apples *were* concurrent — both sessions
alive at once — because the design conflated **worktree-liveness** with
**session-liveness**. When an agent sits between puzzles (worktree removed, session
thinking/triaging/waiting on the user), it is live but invisible to `takenFruits()`.
That interval is common: every agent passes through it on every close→next-claim
hop. So this is not an exotic race; it is structural.

## Options

| # | Approach | Mechanism | Honors "no registry file" non-goal? | Cost | Verdict |
|---|---|---|---|---|---|
| A | **Session sentinel branch** | First auto-claim also creates a puzzle-independent `<fruit>/session` branch (no worktree). `takenFruits()` scans all `<fruit>/*` branches. Deleted only at session end; stale ones swept by branch-reflog age. | ✅ git *is* the registry | med | **Principled fix** |
| B | Session lockfile / heartbeat | `.claude/agents/<fruit>` file with pid + mtime heartbeat; auto excludes fresh/live entries. | ❌ the exact file the doc forbade | med–high | Rejected |
| C | Time-window no-recycle | Auto skips fruits "recently active" per a timestamp source (velocity-CSV `finished_iso`, or branch reflog). | ~ (heuristic, no new file) | low | Weak — fragile window |
| D | **Mandatory `--as` for concurrent work** | Auto stays first-claim-only; when launching ≥2 agents, the human pre-assigns `--as <fruit>`. Auto is the solo-work fallback. | ✅ no new mechanism | ~0 | **Immediate mitigation** |

Notes:
- **C** both false-positives (skips a genuinely free fruit) and false-negatives (a
  session idle longer than the window still collides). It trades a structural bug
  for a tuned-constant bug. Not recommended.
- **B** is what the design explicitly rejected ("any file we maintain in parallel
  would just drift"), and it carries the same teardown-reliability weakness as A
  without A's benefit of staying inside git.
- **A** keeps git as the single source of truth (the design's stated principle),
  and a sentinel branch is cheap. Its weakness — a crashed session leaves a stale
  `<fruit>/session` branch — is bounded by a reflog-age sweep (a stale sentinel is
  detectable and harmless; worst case auto suffixes to `apple-2`, which already
  exists as the exhaustion fallback).

## Recommendation (ROI-weighted; severity is **low**)

1. **Now, zero code — adopt D as the stance.** This is already how the project
   operates in practice: the human assigns identities when fanning out
   ("BANANA take #161, CHERRY take #166"). Make it explicit in
   `claude_workflow.md`: *bare `auto` is only safe for the first claim of a
   **solo** session; when ≥2 agents run, pre-assign `--as`.* This removes the
   collision in the common case at no cost.

2. **If/when the collision recurs despite (1) — implement A** as a follow-up DEV
   puzzle (~45m): sentinel `<fruit>/session` branch + branch-scoped `takenFruits()`
   + a reflog-age staleness sweep + session-end cleanup hook. This is the only
   option that actually makes identity session-scoped while honoring the
   no-registry-file principle. Defer until observed-again, per severity:low.

3. **Reject B and C.** Record them here so they are not re-proposed.

This deliberately does **not** ship a fix in the spike: severity is low, a logging
mitigation already exists (see the `terminal-agent-name-vs-fruit` agent memory —
log the velocity row under the terminal-given name, not the auto fruit), and the
principled fix (A) is non-trivial enough to warrant its own bounded puzzle.

## Proposed follow-up puzzles

- **DEV (~45m), deferred:** implement Option A (session sentinel branch). Gate:
  only schedule if a real apple/apple-style concurrent collision is observed again.
- **DOCS (~10m):** Sub-finding A — the `claim.js` header comment (lines 26–27) and
  `design-agent-worktree-identity.md` (line 36) claim branch-namespace is the
  source of truth, but `takenFruits()` is worktree-scoped. Correct the comments to
  describe what the code does, and cross-link this doc. (Cheap; do regardless of A.)

## Appendix — facts verified during the spike

- `node scripts/claim.js 999 --dry-run` → `cherry` while apple + banana hold live
  worktrees (auto is correct under worktree-liveness).
- `git worktree list --porcelain` is the sole input to `takenFruits()`; no branch
  scan, no file.
- Close (`claude_workflow.md` step 5) removes the worktree **and** `git branch -D`s
  the branch — so a branch-namespace scan would not, by itself, fix #193.
- #193 has no code/markdown puzzle marker (markdown-only research issue); nothing
  to flip or delete on close.
