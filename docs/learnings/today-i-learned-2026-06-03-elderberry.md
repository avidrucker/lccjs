# Today I Learned — 2026-06-03 (ELDERBERRY)

Date: 2026-06-03
Context: Session covering #533/#541 (npm getcwd fix), #525 (oracle-setup docs),
#514 (contributor .env), #529 (SIN EOF behavior).

---

## 1. A subprocess cannot fix its parent's CWD

When `npm run close N` is run from inside a worktree, npm's own process starts
with CWD = that worktree directory. After `close.js` deletes the worktree, npm's
process still holds that (now-gone) CWD. When npm tries to call `getcwd()` during
its post-run cleanup, the OS returns ENOENT and prints:

```
pwd: error retrieving current directory: getcwd: cannot access parent directories: No such file or directory
```

**What I tried first (wrong):** `"close": "exec node scripts/close.js"` in
`package.json`. The reasoning: `exec` replaces bash with node, so no bash process
is left to fail getcwd on exit. Plausible — but wrong. The error persisted because
the source was npm's own process (or a shell npm spawns to check for a `postclose`
lifecycle hook), not the inner script shell.

**The invariant:** No subprocess can change its parent's working directory. A child
calling `process.chdir()` or bash running `cd` only moves *that* process. The
parent's CWD is fixed at its start and stays until the parent moves it itself.

**The fix (#541):** Don't delete the worktree while the parent is still alive.
`close.js` now does everything inline (git pull, report, print CLOSE OK), then
*defers* the actual filesystem teardown — `git worktree remove` + `git branch -D`
+ `git worktree prune` — to a detached subprocess spawned just before `close.js`
exits. `close.js` exits 0 while the worktree still exists; npm's post-run cleanup
runs against a still-present CWD; the detached subprocess removes the worktree
a moment later. Safe because the closing commit is already confirmed on
`origin/main` before any teardown runs.

**Transferable rule:** if deleting a directory causes a process to fail getcwd on
exit, don't delete it until after that process exits. Defer the deletion to a
detached subprocess — the OS keeps inodes alive until all open file descriptors
close, but for *directory* removal it's sufficient to just defer until the parent's
exit path has run.

---

## What landed

| Commit | Change |
|---|---|
| `662d940` | #533 — exec approach (wrong fix, later superseded) |
| `1c8a947` | #541 — deferred teardown (correct fix) |
| `9f9d8e5` | #529 — SIN throws on EOF, consistent with din/hin/ain |
| `be0f0f8` | #525 — oracle-setup.md: note auto .env copy on claim |
| `584a7f7` | #514 — CONTRIBUTORS block in .env.example |
