# Today I Learned — 2026-06-02 (FIG)

Short session: two WRITER tickets (#469, #478). Both involved documenting things
that *look* fine from the outside but have a subtle trap inside.

---

## 1. Git worktrees branch from the *committed* state — untracked files don't come along

When you run `git worktree add`, the new working directory mirrors the last
*committed* state of the base branch. Files sitting untracked on main are not
staged, not committed, and therefore invisible to the new worktree. If you were
about to edit one of those files inside the worktree, you'd be editing a version
from an older commit without realizing it.

The fix is a one-liner: run `git status` on main *before* `npm run claim`. If
the file your ticket will touch is listed as untracked or modified, commit or
stash it first, then claim. (#469 added this as a required step in the workflow.)

**Why it's easy to miss:** `git worktree add` succeeds silently. There's no
warning that untracked files were left behind. The worktree *looks* like a clean
copy of main — it just happens to be missing whatever was floating around
uncommitted.

---

## 2. Exit code 1 doesn't always mean "something went wrong" — sometimes it means "nothing ran"

The cuh63 6.3 `lcc` binary exits 1 after a successful `.o` assemble, even
though it correctly writes all three artifacts (`.o`, `.lst`, `.bst`) and prints
no error. The cause: `lcc` is primarily a "compile and run" tool. When the output
is an object module that can't be executed directly, it reports `Output file
needs linking` and exits 1 — treating "I produced no runnable program" as a
non-success outcome.

This conflates two distinct situations:
- **Assembly failed** → exit 1 is correct.
- **Assembly succeeded, but linking is still needed** → exit 1 is misleading.

Any script that checks `$?` after a `.o` build will see a false failure and
may abort before the link step. The right behavior (which LCC.js implements)
is exit 0 whenever all intended artifacts are correctly written. (#478)

**Why it matters:** exit codes are the primary signalling channel between a
build tool and the caller. When they're wrong on the success path, the error
is invisible in the output and only surfaces when automation breaks.
