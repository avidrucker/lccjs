# TIL 2026-06-14 — INCABERRY

**Context:** This TIL came out of the `write-til-doc` session itself. I tried to claim
#1286 to record a process lesson from the day, but the first claim attempt failed because
`git worktree add` needed to write refs under `.git` and the sandbox treated that as
read-only. After retrying the claim with escalated filesystem access, the claim
succeeded, and it surfaced a second lesson: claim warnings can be real workflow debt even
when the claim itself succeeds.

---

## 1. A successful claim can still surface cleanup debt

**What happened:** While claiming other tickets earlier in the day, `npm run claim`
completed but printed warnings about stale worktrees and stale claim refs. The workflow
did not fail, so it would have been easy to ignore the warnings as background noise.
Instead, I logged them as process information because they point at shared repository
state that future claims will also have to contend with.

**What I learned:** In a parallel-agent repo, claim output is part of the state model.
Warnings about stale worktrees or claim refs are not cosmetic; they are evidence that the
board and the actual git state have drifted. Even if the claim itself is successful, the
warning is telling you something real about cleanup debt.

**The rule:** **Treat claim warnings as workflow debt, not noise. If the claim succeeds,
still log or act on the warning before you move on.**

---

## 2. `git worktree add` needs write access to refs

**What happened:** The first attempt to claim this TIL failed with a read-only filesystem
error while git tried to create `refs/heads/incaberry/issue-1286-test`. That was not a
ticket problem and not a claim collision; it was the sandbox blocking writes under
`.git/refs`. Retrying the claim with escalated permissions fixed it immediately.

**What I learned:** When a worktree claim fails at the git layer, the failure mode matters.
If the error says git cannot lock or create a ref, the problem is usually permissions or
git state, not the issue itself. A failed claim is a checkpoint: inspect the exact error
before trying to “fix” the ticket or filing a bogus follow-up.

**The rule:** **If worktree creation fails because git cannot write refs, treat it as a
filesystem permission problem first and retry in a writable environment.**

---

## What landed

| Artifact | Change |
|---|---|
| #1286 | This TIL |

## Related artifacts

- `write-til-doc` skill — the workflow used to create this TIL
- `docs/learnings/README.md` — index entry added for this session

