# TIL 2026-06-14 — HONEYDEW

**Context:** This session closed #1093 (`test(test-runner): e2e suite for --test mode`). The code work itself was straightforward once the subprocess-based e2e coverage was in place. The durable lesson came from the close tail: the closing comment, the worktree teardown, and the error-log discipline did not all happen in the same place.

---

## 1. `npm run close` can remove the worktree before the final comment step

**What happened:** I ran `npm run close 1093` after the closing commit landed. The close script completed the Git side, deleted the claim ref, and tore down the worktree. The closing comment was still outstanding, so the next attempt to post it from inside the deleted worktree failed. I had to retry from the main checkout.

**What I learned:** Close is not just "commit and push." In this repo, the close script can finish by removing the very directory I am standing in. Any follow-up action that still needs the checkout must move first, not after the close. The safe mental model is: once close runs, assume the worktree is gone.

**The rule:** **Post any remaining GitHub comment from the main checkout after close lands; do not assume the closing worktree will still exist.**

---

## 2. Every failed retry is a separate error row

**What happened:** The final comment path failed more than once: first through the GitHub connector, then through the CLI. I initially treated the repeated connector 403 as "the same failure" and only logged the first one. That was wrong. The rule here is not "log one row per failure class." It is "log each actual failure event."

**What I learned:** The error log is an execution trace, not a deduplicated summary. If I press the same button again and it fails again, that is new signal. The database should show that retry, because it tells future agents that the first workaround did not actually resolve the underlying issue. The repeated row is especially useful when the first failure is a network or permission problem and the second failure reveals the fallback path is also blocked.

**The rule:** **Log every distinct failed attempt, even when the error message is the same; retries are data, not duplicates.**

---

## What landed

| Artifact | Change |
|---|---|
| `tests/new/lcc.test-mode.e2e.spec.js` | Added subprocess-level `lcc --test` coverage for pass, diff-fail, timeout, exit-code mismatch, malformed spec, and missing program. |
| `tests/new/lcc.test-spec-dispatch.integration.spec.js` | Removed the redundant direct-call smoke test after the real e2e suite landed. |
| #1093 | Closed with the new e2e suite and velocity row. |

## Open threads

- The closing comment landed after the close commit, but the body of issue #1325 still reflects the first failed attempt and should be cleaned up later if that issue is reused for another TIL.
- The session exposed two workflow edges that may deserve authority-doc treatment later: post-close comment placement and retry-level error logging discipline.
