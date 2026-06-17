# Claim-ref housekeeping (`refs/claims/issue-N`)

When `npm run claim` warns about a **stale claim ref** and hands you a
`git push origin :refs/claims/issue-N` command, this doc explains what that ref is,
why it stranded, whether it's safe to sweep, and the one way to get it wrong.

> **TL;DR** — `refs/claims/issue-N` is a server-side advisory lock that stops two
> agents in *different clones* from claiming the same issue. It's deleted at close.
> A session that dies before closing strands it. Sweeping a ref for a **CLOSED**
> issue (or an OPEN issue whose claiming session is confirmed dead) is safe and
> only deletes that one remote ref. The hazard is sweeping a ref for an issue
> someone is **actively working** — that removes a live lock.

---

## What the ref is

`npm run claim N` does two things: it creates your local worktree, *and* it stakes a
cross-clone lock on the remote. The lock is a git ref, `refs/claims/issue-N`, pointing
at a throwaway commit.

The local worktree alone isn't enough to prevent collisions: `git worktree list` only
sees the **current clone**. Two agents working in separate clones that share only the
GitHub remote are mutually invisible — both could create a worktree for the same issue
and never know. The claim ref closes that gap with a server-authoritative signal.

The mechanism (`scripts/claim.js`, the staking block ≈ lines 776–806):

1. Fabricate a **unique** commit off the base tree with `git commit-tree` (kept *off*
   any working branch — it exists only to be the ref's target). A per-agent timestamp +
   pid makes it unique.
2. `git push origin <sha>:refs/claims/issue-N`.
3. Because the object is unique, a second clone pushing its *own* unique object to the
   same ref gets a **non-fast-forward reject** — that reject is the collision signal.
   (A plain same-base push would report "Everything up-to-date" and let *both* win,
   which is the bug a unique object avoids — spike #1018.)
4. `classifyClaimPushResult` → `claimPushAction` decides the outcome:
   - **CONFLICT** → roll back the worktree and `die` ("already claimed in another clone");
   - **TRANSIENT** (remote unreachable / auth) → warn and proceed, best-effort;
   - **OK** → the claim is ours.
   `--force` stakes the ref but never blocks.

So the ref is a **lock**, not history — nothing depends on it except the next claim of
the same issue.

## Lifecycle: staked at claim, deleted at close

- **Staked** by `npm run claim` (above).
- **Deleted** by `npm run close` via `deleteClaimRef` (`scripts/close.js` ≈ line 271),
  which runs exactly `git push origin :refs/claims/issue-N`. The same cleanup runs on
  close's already-landed recovery path, so a close can't leave the ref behind.

In the normal claim → work → close flow the ref appears and disappears invisibly.

## Why refs strand

A claim ref outlives its purpose only when **close never runs**:

- **A session dies before closing** — crash, kill, lost terminal, abandoned worktree.
  The worktree may also be orphaned locally (`npm run claim` warns about those
  separately via `warnOrphanedWorktrees`).
- **Pre-#1039 closes** — before #1039 added `deleteClaimRef`, closes didn't sweep the
  ref at all, so older issues can still carry one.

The ref then sits on the remote forever, because **nothing deletes it automatically** —
the tool deliberately *warns* rather than auto-sweeps (see "Why it's warn-only" below).

## How the tool decides a ref is stale

On every claim, `warnStaleClaimRefs` (`scripts/claim.js` ≈ lines 562–598) lists all
`refs/claims/*` and judges each with `claimRefIsStale` (≈ lines 521–530):

| Issue state | Verdict |
|-------------|---------|
| **CLOSED / MERGED** | **stale** — the claim outlived its issue; guaranteed cruft |
| **OPEN**, claim commit older than the TTL | **stale** — tasks cap at 60m, so a days-old claim is almost certainly a dead session |
| **OPEN**, claim within TTL | **not stale** — a live claim, left alone |
| unknown (gh offline / issue missing) | **not stale** — never sweep what can't be verified |

Only refs that pass this test get the warning. A live claim (OPEN, recent) is silent.

## Diagnosing before you sweep

```bash
# All claim refs currently on the remote:
git ls-remote origin 'refs/claims/*'

# Is the backing issue closed?
gh issue view N --json state -q .state

# Is anyone actively working it in this clone?
git worktree list | grep "issue-N"

# How old is the claim? (live-session sanity check for an OPEN issue)
git fetch --quiet origin refs/claims/issue-N
git log -1 --format='%ci  %s' FETCH_HEAD
```

If the issue is **CLOSED**, that's all the confirmation you need. If it's **OPEN**,
confirm the session is genuinely dead (old claim commit, no live worktree, the owning
agent isn't running) — not merely slow — before sweeping.

## Sweeping

```bash
git push origin :refs/claims/issue-N
```

This is a refspec deletion. It touches **only that one remote ref**: nothing on `main`,
no branches, no worktrees, no issue state, no commits. It is **idempotent** — deleting an
absent ref is a harmless no-op. The only effect for a CLOSED issue is to stop the warning
from re-printing on every future claim (the scan walks *all* `refs/claims/*` each run).

## What could go wrong

1. **Sweeping a live lock (the real hazard).** Deleting `refs/claims/issue-N` for an
   issue someone is *actively working in another clone* removes their lock. The next
   claimant no longer hits the collision reject → two agents both claim N → duplicate
   work and a merge collision. This defeats the entire reason the ref exists.
   **Mitigation:** only sweep refs the tool flagged stale, and never sweep an **OPEN**
   issue's ref without confirming the session is dead, not just slow.
2. **Wrong issue number.** Hand-typing the number can delete a *different* issue's
   (possibly live) lock — collapsing into hazard #1. Copy the number from the warning.
3. **Racing a finishing close.** If the original session happens to be closing right
   now, it also deletes the ref. Double-delete is idempotent — no harm.
4. **Auth / permission failure.** The delete-push just no-ops; the ref stays. No harm.

## Why it's warn-only (and the planned fix)

`warnStaleClaimRefs` warns rather than deletes by design — it mirrors the warn-only
`warnOrphanedWorktrees` default. Auto-deleting risks hazard #1 in the corner case where
the tool can't be 100% certain a ref is dead (e.g. gh briefly offline). The cost of that
caution is the manual housekeeping this doc describes. An opt-in **auto-sweep** is a
deferred follow-up tracked at **#1040**; until it lands, sweep stale refs by hand using
the rules above.

---

**Source of truth:** `scripts/claim.js` (`warnStaleClaimRefs`, `claimRefIsStale`, the
staking block) and `scripts/close.js` (`deleteClaimRef`). Line numbers above are
approximate — grep the function names if they've drifted.
