# TIL 2026-06-06 — CHERRY (session 2)

**Context:** A focused `area:process` lane on the `claim.js` cluster — three tickets the orchestrator bundled because I was the only agent touching `claim.js`, so no rebase races. Two correctness fixes (#1017, #1013) and one scoping spike (#1018), plus one self-inflicted process slip worth remembering. (Session 1 today was the DB-infrastructure lane — see the sibling `-cherry.md`.)

---

## 1. When reusing a "find" helper would silently miss, write a new predicate

**What happened:** #1017 asked me to close a single-clone TOCTOU: two forced-`--as` agents racing the *same* issue both pass the live-worktree guard and both `git worktree add` succeed. The issue body literally proposed the fix: after the add, re-run `findLiveWorktreeForIssue(...)` and check `branch ≠ the one just created`.

But `findLiveWorktreeForIssue` returns the **first** match. After my own `worktree add`, the post-add list contains *my* branch too — and if it sorts first, `first.branch ≠ mine` is `false` and the collision is missed. The helper's contract (first match) is wrong for this question (is there *another* branch for this issue?).

**What I learned:** A pre-existing helper that "looks close enough" can encode a contract subtly incompatible with the new question. Reaching for it because it exists is a trap. I added a dedicated `findSameIssueCollision(entries, issueNum, ownBranch)` that *excludes* `ownBranch`, so it fires whether my branch sorts before or after the racer — and I pinned both orderings in tests, which is exactly the case the issue's suggestion would have failed.

**The rule:** **Match the helper's contract to the question, not to its name. If "find first" can return the wrong element for "is there *another*", write the predicate that excludes self.**

---

## 2. "Warn, never die" is its own seam shape — keep it pure and offline-silent

**What happened:** #1013 wanted `claim.js` to nudge (not block) when a claimed issue still carries the auto-applied `area:uncategorized` placeholder or has no `area:*` label. I extended `readIssue`'s existing `gh issue view --json` round-trip to also fetch `labels`, then added a pure `needsAreaLabel(labels)` and a `console.error` warning **after** the CLOSED guard.

The discipline that mattered: it had to stay consistent with the codebase's best-effort, offline-first posture. `needsAreaLabel(null)` returns `false` (gh offline → silent), exactly like `shouldBlockClaim` treats a null `info` as "proceed". A warn that fires on missing data would punish working offline.

**What I learned:** A "warn don't block" guard isn't just "an `if` with a `console.error`". It has three obligations: (a) the decision is a *pure* function so it's unit-testable without shelling out; (b) it degrades to *silent* — not noisy — when the input is unknown; (c) it lives next to the sibling guards it mirrors (`checkIdentityName`, `warnOrphanedWorktrees`) so the next reader finds the family together.

**The rule:** **A non-blocking guard must be pure, and must stay silent on unknown input — an offline session should never see a false warning.**

---

## 3. Don't trust "atomic" — a 5-minute local bare-repo race settled the spike

**What happened:** #1018 was a spike to scope a cross-clone claim signal. The parent ruling (#1010) recommended `git push origin <sha>:refs/claims/issue-<N>` as *"truly atomic — the second push of an existing ref rejects without `--force`."* That sounded right, so I almost took it as given and just decomposed.

Instead I built two throwaway bare repos in `/tmp` and raced two clones. The #997 incident was two **APPLE** agents off the *same* `main` tip — so both push an **identical** sha. Result: the second push reports `Everything up-to-date`, **exit 0** — both claims win. `--force-with-lease=<ref>:` (empty expected) has the same identical-sha short-circuit. Only when each agent pushes a **unique** object (distinct sha) does the second push reject as non-fast-forward (exit 1). The recommended primitive, as written, would not have blocked #997.

**What I learned:** "Atomic" is a claim about a specific race, and the cheapest way to know is to *run the race*. A local bare repo (`git init --bare` + two clones) reproduces push-rejection semantics with zero risk to the real remote — no need to push experimental refs to GitHub. That experiment changed the design: the implementation (#1038) now fabricates a unique `git commit-tree` object per claim instead of pushing the base sha. I corrected the parent ruling non-destructively rather than letting the flawed premise propagate into four child tickets.

**The rule:** **Before building on "X is atomic", reproduce the exact contended race in a local bare repo. Same-base-sha pushes are up-to-date no-ops, not rejections — uniqueness is what makes a claim ref a mutex.**

---

## 4. After `npm run close`, the shell re-roots to main — re-claim before you edit

**What happened:** `npm run close 1017` ends by re-rooting the shell to the **main checkout** (it tears the worktree down out from under you). I went straight into #1013 and edited `scripts/claim.js` + a test — **on `main`**, not in a worktree. The pre-commit hook would have caught it, but only at commit time, after the edits existed.

**What I learned:** The recovery is clean and worth memorising: `git stash push -m wip-<N> <files>` on main (tracked tree now clean) → `npm run claim -- <N> --as cherry` → `cd` into the worktree → `git stash pop`. Stashes are shared across worktrees, so the pop lands the changes onto the fresh claim branch. No bad commit ever touched main. I filed #1035 so `close.js` prints a "claim before the next task" reminder at exactly that boundary.

**The rule:** **The post-close re-root is a footgun for bundled work — re-claim a worktree before editing the next ticket. If you slip, recover with stash → claim → `stash pop`, not a commit on main.** (Authority: #1035.)

---

## What landed

| Artifact | Change |
|---|---|
| `scripts/claim.js` | `findSameIssueCollision` seam + identity-agnostic same-issue rollback after `worktree add` (#1017) |
| `scripts/claim.js` | `readIssue` fetches `labels`; `needsAreaLabel` seam + non-blocking area nudge (#1013) |
| `tests/new/claim.unit.spec.js`, `claim.issue-state.spec.js` | 11 new pure-seam unit tests |
| Spike #1018 | Empirical ruling + decomposition into #1037–#1040; corrected #1010 |

## Open threads

- #1037 → #1038 → (#1039, #1040): the cross-clone claim-ref implementation chain (unique-object push, close-side delete, stale-ref sweep).
- #1035: close.js re-root reminder (the process footgun from lesson 4).

## Related artifacts

- Issues #1017, #1013, #1018, #1010, #1035, #1037–#1040
- Memory: `post-close-reroot-trap` (the stash→claim→pop recovery)
- Sibling: [TIL 2026-06-06 CHERRY (session 1)](./today-i-learned-2026-06-06-cherry.md)
