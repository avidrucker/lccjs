# Hardening the puzzle close sequence (#242)

**Status:** RESEARCH complete — recommendation below, awaiting the tool-vs-discipline
go/no-go before the implementation puzzle(s) are picked up.
**Role:** RESEARCH (process-hardening) · severity:medium · agent CHERRY, 2026-05-30.

## 1. The problem in one sentence

The close sequence is a **documented discipline with no enforcement**: cleanup
(`git worktree remove` / `git branch -D`) runs on *separate, ungated lines* after
`git push`, so when the push loses a parallel-agent race the cleanup fires anyway
— removing the worktree and deleting the branch while the closing commit is still
only local and the issue is still OPEN.

The full incident (agent BANANA closing #200, 2026-05-30) is in the #242 body. The
work survived **only** because `git branch -D` printed the dangling SHA and a human
noticed it. A `--force` removal, a `gc`, or simply not reading the output would have
lost a committed puzzle.

## 2. Root cause — two compounding factors

1. **Single-shot push is inherently racy in a multi-agent repo.** Between an
   agent's `rebase` and its `push`, another agent can land on `main`, so the
   non-fast-forward push is refused (`cannot lock ref 'refs/heads/main'`). A correct
   close must **loop** fetch→rebase→push until it lands, not push once.
2. **Cleanup is not gated on push success.** Newline-separated shell statements run
   unconditionally. `claude_workflow.md:162` *says* "confirm the commits are on
   `origin/main` first, THEN remove," but nothing enforces it — the one-liner
   silently bypasses the discipline.

These are independent: fixing the retry loop without gating cleanup still loses work
if the loop gives up; gating cleanup without the loop turns every race into a manual
recovery. **Both must be fixed together.**

## 3. What already exists to build on

The repo has already converged on the patterns this fix needs — the claim side is
the template:

| Asset | Where | Relevance |
|---|---|---|
| `scripts/claim.js` | the *stake* tool | Direct mirror for an *unstake* tool: `sh()`/`die()`/`report()` helpers, **pure decision seams** (`assessBaseStaleness`, `shouldBlockClaim`) unit-tested without a repo, `module.exports` for testing. |
| `pre-push` hook (#188) | `scripts/git-hooks/pre-push` | Already **blocks** a push made mid-rebase/merge or with conflict markers in tracked files. The close tool's push goes through this — partial state can't ship. |
| CSV `merge=union` (#186) | `.gitattributes` | `docs/puzzle-velocity.csv` + `docs/puzzle-clusters.csv` auto-union on rebase, so the retry loop's rebases never conflict on the velocity row. |
| stale-main guard (#228) | `claim.js` `--allow-stale-main` | The *claim*-side analogue of this *close*-side guard; same offline-first philosophy (null/unknown ⇒ proceed). |

So the fix is **additive and idiomatic**, not a new subsystem.

## 4. Options considered

The #242 body lists four candidate directions. Assessed:

| # | Option | Strength | Verdict |
|---|---|---|---|
| 1 | **`npm run close` / unstake tool** (mirror of `npm run claim`): assumes the `Closes #N` commit exists → loop fetch/rebase/push → verify `git branch -r --contains HEAD` includes `origin/main` → **only then** remove worktree + branch. | Removes the footgun entirely; automates the race retry; symmetric with claim. | **RECOMMENDED.** |
| 2 | `scripts/assert-pushed.js <sha>` — exits non-zero unless the SHA is on `origin/main`; mandated before any removal. | Cheap, composable, but doesn't replace the racy newline-chain or add the retry loop. Relies on the agent remembering to call it. | **Adopt as a sub-part of Option 1**, not standalone. |
| 3 | Document a `&&`-gated chain in `claude_workflow.md`. | Weakest — relies on every agent typing `&&` perfectly every time. The discipline already exists in prose (`:162`) and *still* failed. | Reject as the primary fix; keep as the documented fallback for when the tool isn't available. |
| 4 | Pre-removal git hook refusing to remove a worktree whose HEAD isn't on `origin/main`. | `git worktree remove` has no hook point; would need a wrapper, which is just Option 1 by another name with worse ergonomics. | Reject. |

**Why a tool over discipline (the core decision the #242 body flags):** the claim
side already made exactly this call — staking became `npm run claim`, not a
documented `git worktree add` recipe, *because* an unenforced recipe drifts. The
close side is the symmetric footgun and deserves the symmetric answer. The incident
is direct evidence that the prose discipline (already written at `:162`) does not
hold under the racy path it's meant to govern.

## 5. Recommended design — `scripts/close.js` (`npm run close`)

### Boundary: what the tool does NOT do
- It does **not** author the closing commit. The agent still writes the marker
  deletion + CSV row + `Closes #N` message and commits — that content is judgment,
  not mechanism. The tool takes over **after** the commit, owning only the racy
  push + the gated cleanup. (Keeps the tool from ever fabricating a close.)

### Pre-flight (abort loudly, change nothing on failure)
1. Confirm we're in a `<fruit>/issue-<N>` worktree, not the main checkout.
2. Confirm `HEAD` is a commit whose message contains `Closes #<N>` (the agent
   actually committed the close) — else die: "no closing commit on HEAD."
3. Confirm a clean tree (no staged/unstaged/untracked changes) and **no
   rebase/merge in progress, no conflict markers** — reuse the `pre-push` guard's
   checks so the tool refuses before it starts, not mid-loop.

### The retry loop (the heart of the fix)
```
for attempt in 1..MAX (default 5):
    git fetch origin main
    git rebase origin/main
        └─ on conflict:
             - if every conflicted path is a merge=union file → should never
               happen (union auto-resolves); treat as a bug, abort.
             - if any NON-union file conflicts (TODOS.md, a source file) →
               git rebase --abort, die with the conflicted paths. Do NOT
               auto-resolve; a human/agent resolves and re-runs close. (Mirrors
               the puzzle-velocity skill's grep-guard discipline.)
    push_out = git push origin HEAD:main   (capture stderr)
    classify(push_out):
        - ok            → break (landed)
        - race          → ("cannot lock ref" / "non-fast-forward" / "fetch first")
                          loop again (someone landed between our rebase and push)
        - rejected-other→ (hook block, auth, protected branch) die immediately;
                          retrying won't help
if not landed after MAX → die: "push lost the race N times; commit <sha> is
    SAFE and local. Re-run `npm run close` or recover manually." (NEVER cleanup.)
```

### Verify-then-cleanup gate (the second half of the fix)
```
sha = git rev-parse HEAD
onMain = git branch -r --contains <sha> | includes origin/main
assert onMain   # the assert-pushed seam (Option 2 folded in)
if not onMain → die (NEVER remove the worktree)
# only now:
git worktree remove <this worktree>   (run from main root, or chdir out first)
git branch -D <fruit>/issue-<N>-<slug>
git worktree prune
```

### Post-close (best-effort, non-fatal)
- Re-check the issue actually auto-closed (`gh issue view <N> --json state`); if
  still OPEN after a beat (the `Closes` keyword sometimes lags), post a comment /
  `gh issue close`. Offline ⇒ skip, like claim's gh calls.

### Pure, unit-testable seams (mirroring claim.js)
- `classifyPushError(stderr) → 'ok' | 'race' | 'rejected-other'` — the retry
  decision; pure string logic, no git. The race signatures from the incident +
  the common cases: `cannot lock ref`, `non-fast-forward`, `fetch first`,
  `[rejected]`.
- `shouldCleanup({ onOriginMain }) → bool` — the gate; cleanup iff the SHA is on
  origin/main. Trivially testable, and the single chokepoint that makes "cleanup
  after a failed push" structurally impossible.
- `classifyRebaseConflict(paths, unionFiles) → 'none' | 'union-only' | 'blocking'`
  — keeps the union-vs-non-union policy out of the I/O path.

These three pure functions are where the tests live; `main()` does the git I/O,
exactly as `assessBaseStaleness`/`shouldBlockClaim` relate to claim's `main()`.

## 6. Open questions for the go/no-go

1. **Tool vs discipline** — recommendation is the tool (Option 1, with Option 2
   folded in). Confirm before an implementer picks up the DEV puzzle.
2. **Does the tool author the commit, or start after it?** Recommendation: start
   *after* (boundary above). The alternative (tool runs `git commit`) couples it to
   commit-message judgment and the marker/CSV edits — more surface, more ways to
   fabricate a bad close.
3. **Non-union rebase conflict policy** — recommendation: abort + hand back, never
   auto-resolve (only the CSV/cluster files are safe to union; TODOS.md and source
   are not).
4. **MAX retries** — 5 is a guess; a race that loses 5× straight likely signals a
   hot `main` or a stuck agent, worth surfacing rather than looping forever.
5. **Relationship to the claim-side guards (#228 stale-main, #227 closed-state) and
   the coordination cluster (#237 soft-lock).** This is their close-side analogue;
   it could share a small `scripts/lib/git.js` (sh/die/issue-read) extracted from
   claim.js — optional, a cleanup puzzle of its own.

## 7. Proposed decomposition (file after go/no-go)

- **DEV #A (~45m):** implement `scripts/close.js` + `npm run close` — pre-flight,
  the fetch/rebase/push retry loop, the verify-then-cleanup gate, the three pure
  seams. Wire the `pre-push` checks in pre-flight.
- **TEST #B (~30m):** unit tests for `classifyPushError`, `shouldCleanup`,
  `classifyRebaseConflict` (pure, no repo — mirror `claim.*.spec.js`); plus one
  serial e2e that simulates a lost race (push to a bare remote out from under the
  tool) and asserts the worktree/branch **survive**.
- **WRITER #C (~15m):** replace the manual close chain in `claude_workflow.md`
  (§"At close", :139-162) and `puzzle-velocity.md` with `npm run close`, keeping the
  `&&`-gated manual chain as the documented fallback.

(#A+#B could be one DEV+TEST puzzle if the implementer prefers; kept split so each
stays ≤60m H.)

## 8. Interim procedure (until the tool lands)

Use the `&&`-gated chain so a failed push aborts cleanup, and **never** newline-separate:

```bash
git commit -m "... Closes #N"
git fetch origin main && git rebase origin/main && git push origin HEAD:main \
  && git branch -r --contains HEAD | grep -q origin/main \
  && git worktree remove .claude/worktrees/<fruit>-issue-<N> \
  && git branch -D <fruit>/issue-<N>-<slug>
```

If the push is rejected, re-run the `fetch && rebase && push` head of the chain
until it lands; the cleanup tail only runs once the whole `&&` chain reaches it.
The recovery recipe in the #242 body is the manual fallback if cleanup ever runs
early.
