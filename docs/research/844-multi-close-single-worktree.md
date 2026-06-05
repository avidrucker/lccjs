# 844 — Multi-Close Single-Worktree Protocol

**Date:** 2026-06-05  
**Agent:** APPLE  
**Issue:** #844 — RESEARCH: close.js can't close a second issue from the same single-worktree session

---

## Root cause

`close.js` performs a **single `git push origin HEAD:main`** that sends all unpushed commits at once. There is no partial-push mode: once two commits exist on the worktree branch, any close operation from that branch pushes both. This has two consequences:

1. **Branch check at entry (lines 618–625):** close.js rejects any invocation from `main` — it requires the current branch to match `<fruit>/issue-<N>`. Once the first close removes the worktree, the shell re-roots to `main` and the second `npm run close` fails immediately.

2. **`--branch` flag can't save a gone worktree:** The `--branch <name>` flag lets close run from `main`, but only if the worktree directory still exists — it `chdir`s into it (line 634). Once the worktree is torn down, `--branch` also fails.

3. **`--keep` works only in the interleaved case:** `--keep` skips teardown after a successful close. If used on the first close (before the second commit exists), the worktree survives for the second commit. But if **both commits are pre-made**, `--keep` on the first close pushes ALL unpushed commits — leaving `origin/main..HEAD` empty when the second `npm run close` runs. `findClosingCommitSha` scans `origin/main..HEAD`, finds nothing, and dies.

---

## Two working protocols

### Protocol A — Interleaved (commit-and-close between files)

Use this when you can sequence commits deliberately:

1. Make commit A (`Closes #A` + velocity CSV)
2. From the worktree: `npm run close A --keep` — pushes commit A, keeps worktree alive
3. Make commit B (`Closes #B` + velocity CSV)  
4. From the worktree: `npm run close B` — pushes commit B, tears down

**Why it works:** At step 2, commit B has not been made yet, so only commit A is in `origin/main..HEAD`. The push lands only A. The worktree survives (`--keep`). Step 4 sees only commit B in `origin/main..HEAD` and closes normally.

**Constraint:** commit B must not exist when `close A --keep` runs.

---

### Protocol B — Batch (both commits already made; close last first)

Use this when both commits are already in the branch (the common case when two files conflict):

1. Both commits are in the worktree: commit A (`Closes #A`) then commit B (`Closes #B`)
2. From inside the worktree: `npm run close B` — pushes **both** commits, tears down
3. GitHub auto-closes issue A via the `Closes #A` footer in commit A (already on `origin/main`)
4. Post closing comment for A manually: `gh issue comment A --body "Closed in <sha>."`

**Why it works:** `findClosingCommitSha(B)` scans `origin/main..HEAD` and finds commit B first. The push lands all commits. GitHub parses every commit's body on push and fires the auto-close webhook for any `Closes #N` it finds. `close.js`'s teardown runs once for B; A's teardown (worktree removal, branch deletion) is moot — already done by B's close.

**What doesn't run for A:** `close.js`'s issue-state verification step (the `gh issue view` / force-close call). In practice GitHub auto-close is reliable and the issue will be CLOSED. If you want certainty: run `gh issue view A --json state -q .state` manually after B's close.

---

## Evaluation of the issue's four options

| Option | Verdict |
|--------|---------|
| **1 — `--skip-teardown` flag** | Already exists as `--keep` — just needs documentation |
| **2 — multi-issue `close N M`** | Would be cleanest UX; requires non-trivial close.js changes; overkill given the working protocols |
| **3 — document "close last first"** | ✅ Recommended — zero code changes, works today |
| **4 — prohibit single-worktree multi-issue** | Overcorrects; the single-worktree pattern is legitimate for file-conflict avoidance |

---

## Recommendation

**No code changes needed.** Document Protocol A (`--keep` + interleaved) and Protocol B (close-last-first) in `docs/claude_workflow.md`. The `--keep` flag is already implemented and tested; it just needs to appear in the workflow guide. A `do-this-not-that.md` entry for the "batch commit, then close last" pattern would also help.

---

*Closes #844*
