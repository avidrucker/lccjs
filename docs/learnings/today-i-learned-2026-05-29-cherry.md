# Today I Learned — 2026-05-29 (CHERRY)

Date: 2026-05-29
Agent: CHERRY
Context: A session that started as triage + status-checking and turned into two
closes. Verified the `puzzle-velocity` skill version (frontmatter lied), closed
**#160** (validation-prompt "no file writes" doc) the hard way — two manual
rebase rounds fighting the velocity CSV — then turned that exact pain into a
research spike, **#186**, and fixed it: `merge=union` on the CSV + a single-commit
close that logs `closed_commit` empty. Skill bumped to 0.6.0. The #186 close
dogfooded its own fix.

---

## 1. `merge=union` fires under `rebase`, not just `merge` — but only fixes *one* of two pains

The whole #186 recommendation rested on an assumption I refused to ship unproven:
does the built-in `union` merge driver run during a `git rebase` (our real
scenario — `pull --rebase` before push), or only during a `git merge`? A
throwaway-repo test settled it: two divergent branches each appending a row to a
`merge=union`-attributed CSV, rebased together → **0 conflict markers, both rows
kept.** `rebase` replays each commit through the 3-way-merge machinery, so custom
drivers apply.

But the same test exposed the trap: my commit's SHA still changed
(`79e238c → ca419d5`) across the rebase. So there were **two independent pains**
hiding behind "CSV merge conflicts": (A) the *line-content* conflict on the shared
last row, and (B) the closing commit's *SHA being rewritten*. `union` kills A —
and, by making the rebase stop stopping, makes B **silent** (the row would ship a
stale SHA with no prompt to fix it). A fix aimed at A alone would have quietly
made B worse.

**The rule:** when a fix targets "merge conflicts," separate *content* conflicts
from *commit-identity* (SHA) churn — they're different problems. A union driver
solves content and can mask identity. Prove the driver fires in your actual
workflow (rebase ≠ merge) before recommending it, and check what it does to the
other failure mode.

## 2. Don't store a value the rebase will rewrite — derive it from durable history

The velocity row's `closed_commit` recorded the SHA of the commit that closed the
ticket. But that commit gets a new SHA on every rebase round, so the field
orphaned repeatedly — the #160 close cycled `5c811f8 → 45f2654 → ab80bbc`, each
hand-fixed mid-rebase. The two-commit close pattern (commit 1 closes; commit 2
logs commit 1's SHA) is *inherently* rebase-fragile: it denormalizes a soon-to-be-
rewritten identity. The fix wasn't a better capture — it was to **stop capturing**:
log `closed_commit` empty and derive it any time from the commit's own durable
message, `git log --grep "Closes #N" -1 --format=%h`.

**The rule:** never denormalize a value that a later history-rewrite will change.
If it's recoverable from durable history (a `Closes #N` message, a tag), derive on
demand instead of storing a copy that goes stale.

## 3. Prefer the project's own claim tooling over the generic harness worktree

The harness's worktree helper named my branch `worktree-cherry+issue-160-…`
(sanitising `/`→`+`, prefixing `worktree-`). That **breaks attribution**:
`puzzle-status.js` derives the agent identity by splitting the branch on `/`
(`cherry/issue-160` → fruit `cherry`), so the `+`-form showed `CLAIMED` with no
"by cherry". The project ships `npm run claim -- <issue> --as cherry`, which
produces the convention-correct `cherry/issue-N-slug` branch that the reconciler
understands. I discarded the harness worktree and re-claimed properly.

**The rule:** when a repo ships its own worktree/claim tooling, use it. Other
scripts depend on the naming convention it enforces; the generic harness tool
doesn't know those conventions and will silently produce names that break them.

## 4. "What version is this?" — trust the VERSION/CHANGELOG, not the loaded frontmatter

Asked to confirm the `puzzle-velocity` skill version, the skill body my session
had loaded said `version: 0.4.0`. The canonical `VERSION` file and `CHANGELOG`
both said `0.5.0` (uncommitted). The frontmatter had simply never been bumped when
0.5.0 was cut — and separately, skill metadata is cached at *session start*, so
even a corrected file wouldn't refresh mid-session. Two layers of staleness.

**The rule:** version questions are answered by the source of truth (`VERSION` /
`CHANGELOG`), not the frontmatter a doc happens to carry, and not the metadata the
session cached at launch. When they disagree, the bump was half-done — finish it.

## 5. Close a process-changing ticket *using* the new process

#186 changed the close protocol. I closed it with the new protocol: one commit,
`closed_commit` empty, `merge=union` live. That made the close itself the
end-to-end test — it proved the SHA dance was gone (clean single-commit push) and
that the SHA was still recoverable (`git log --grep "Closes #186"` → `ba8c3c9`).
If the new flow had a hole, the close would have hit it.

**The rule:** when a ticket changes a workflow, dogfood it on that ticket's own
close. The close becomes the regression test; shipping the change and *then* using
the old way on its own close would be a tell that you don't trust the fix.

---

## What landed

| Artifact | Change |
|---|---|
| [#160](https://github.com/avidrucker/lccjs/issues/160) | **Closed** — added a "no file writes" prompt-discipline note + reusable subagent-prompt template to `docs/lccjs-assembly-skill-validation.md`. Closing commit `ab80bbc` (after 2 manual rebase rounds — the pain that motivated #186). |
| [#186](https://github.com/avidrucker/lccjs/issues/186) | **Filed + closed** — spike: keep the CSV, add `merge=union`, single-commit close, `closed_commit` empty/derived; SQLite rejected (binary → unmergeable/undiffable). `docs/research/velocity-log-storage.md`. Closing commit `ba8c3c9`. |
| `.gitattributes` | `docs/puzzle-velocity.csv merge=union` — retires the CSV rebase-conflict dance. |
| `docs/puzzle-velocity.md` | Single-commit close protocol; `closed_commit` empty + derive-via-`git log --grep`; column ref updated. |
| `puzzle-velocity` skill | **0.6.0** in `claude-config` (`f39b8ba`) — protocol mirror + changelog. (Also fixed its 0.4.0→0.5.0 frontmatter lag, `9553df9`.) |

## Open threads for tomorrow

- **Optional, not filed:** a bulk `closed_commit` backfill reconciler (fill empty
  SHAs from `git log --grep`). Decided *not* needed — derive-on-demand loses no
  data and nothing reads the column; it'd be a 30s one-shot if ever wanted.
- **#161** scope shrank: now that new rows log `closed_commit` empty, the
  cross-repo-SHA convention only applies to historical rows.
- Pre-existing **#156** STALE marker (closed issue, marker not deleted) — owned by
  banana, flagged to them; not mine to clean.

## Related artifacts

- `docs/research/velocity-log-storage.md` — the #186 spike writeup with the
  `merge=union`-under-rebase evidence and the SQLite rejection.
- `git log --grep "Closes #N" -1 --format=%h` — the one-liner that makes lesson 2
  work (derive any row's `closed_commit`).
- [TIL 2026-05-28-004](./today-i-learned-2026-05-28-004.md) — earlier same-week
  session; its lesson 4 ("never hard-code a predicted issue number under
  concurrent agents") is the sibling of lesson 3 here — both are "the shared
  state isn't yours to predict/name unilaterally."
