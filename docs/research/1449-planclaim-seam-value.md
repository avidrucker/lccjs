# #1449 — Does extracting a pure `planClaim()` seam from `claim.js` `main()` add value?

**Agent:** BANANA · **Type:** RESEARCH spike (no production change) · **Parent:** #1196 (closed)

## TL;DR — recommendation: **drop it (middle-path fallback documented below)**

Do **not** extract a `planClaim(state, opts) → actions[]` seam to move the istanbul number.
The part of `main()` that a pure plan *could* cleanly model (the linear pre-staking guard
chain) is already (a) built from pure, individually unit-tested decision seams and (b)
covered **behaviorally end-to-end** by the 17-test #1196 e2e suite. The part where a plan
seam would add real value (the racy staking loop) is **genuinely I/O-entangled by design**
(TOCTOU re-scans) and resists a pure-plan extraction without a much larger effect-interpreter
refactor. So the extraction would buy ~one coverage number, not a new caught-bug class — the
"vanity metric" outcome the ticket explicitly worried about. Leave `claim.js` at ~34% line
coverage; that number reflects the repo's "wrappers aren't unit-tested" doctrine, not a real
gap. If a concrete ordering bug ever surfaces that the e2e suite can't localize, revisit the
narrow middle path (§5).

---

## 1. What `main()` actually does (map)

`main()` (`scripts/claim.js:602–827`) is ~225 lines in two distinct halves:

**Half A — the linear pre-staking guard chain (`:603–691`).** A straight sequence of
*gather-state → pure-predicate → die-or-proceed*:

| Step | State (I/O) | Decision seam (pure, exported, tested) | Action |
|------|-------------|----------------------------------------|--------|
| identity | `resolveIdentity` | `identity.source === 'auto'` | die |
| name notice | — | `checkIdentityName` ×1 | warn |
| CLOSED guard | `readIssue` (gh) | `shouldBlockClaim` | die |
| lane gate | (same `info`) | `shouldBlockUncategorized` | die |
| base ref | `git rev-parse` | (inline) | die |
| stale-main | `git fetch` + `rev-list` | `assessBaseStaleness` | die |
| orphan warn | worktree/ref scan | (inline) | warn |
| live-wt guard | `listWorktreeBranches` | `findLiveWorktreeForIssue` + `shouldBlockWorktreeGuard` | die/warn |

Every *decision* here is **already a pure exported function with dedicated unit tests**
(`claim.unit.spec.js` + `claim.issue-state.spec.js` = 130 tests per #1196). What `main()`
adds is only the *wiring*: read the state, pass it to the predicate, act on the verdict.

**Half B — the staking loop (`:721–824`).** For each candidate fruit: `git worktree add`
→ **re-scan** for a same-fruit race (`:743`) → **re-scan** for a same-issue collision
(`:767`, `findSameIssueCollision`) → `commit-tree` + `push` the claim ref → classify the
push result (`classifyClaimPushResult` → `claimPushAction`) → **roll back** worktree+branch
and die on conflict, else `flipMarker` + `report`.

## 2. What `planClaim()` would look like (prototype sketch)

```js
// PURE: decide the action sequence from already-gathered state. No git/gh I/O.
function planClaim(state, opts) {
  const actions = [];
  if (state.identity.source === 'auto') return [die('no identity')];
  if (shouldBlockClaim(state.info, opts.force))          return [die('CLOSED')];
  if (shouldBlockUncategorized(state.info, opts.allowUncategorized)) return [die('uncategorized')];
  if (!state.baseResolves)                                return [die('bad base')];
  if (assessBaseStaleness(opts.base, state.behind).stale) return [die('stale main')];
  if (shouldBlockWorktreeGuard(state.existingWt, opts))  return [die('live worktree')];
  actions.push({ type: 'STAKE', fruit: state.candidates[0], /* … */ });
  return actions;
}
```

This is clean and testable **for Half A** — and that is exactly the problem: it is a thin
re-expression of predicates that are *already* pure and tested. The interesting output is a
single `STAKE` token; everything before it is a `die`.

**Half B cannot be expressed this way.** The rollback decisions at `:744`, `:769`, `:797`
each consume the *result of the side effect immediately preceding them* — the post-`worktree
add` re-scan, the non-fast-forward reject from the `push`. A pure `planClaim()` would have to
receive those results as *inputs*, which means the caller must interleave `plan → do → plan →
do`. That is not "plan then execute"; it is an **effect interpreter** (return an action, run
it, feed the result back, ask for the next action). Building that is a substantially larger
and riskier refactor of the most race-sensitive code in the repo (#629, #1010, #1017, #1038),
and it fights — rather than fits — the existing architecture.

**Entanglement verdict:** Half A is *separable but not worth separating*; Half B is
*genuinely entangled* (decision depends on git state produced by the previous side effect).

## 3. Testability delta vs the #1196 e2e suite

`tests/new/claim.e2e.spec.js` (17 hermetic subprocess tests) already drives real `main()`
and asserts observable outcomes for **every guard and the happy-path staking**:

- usage / unknown-flag / no-identity dies
- happy path: worktree + branch + slug + **cross-clone claim ref** staked
- `@todo`→`@inprogress` marker flip; `.env` copy; gh-offline best-effort
- `--dry-run` stakes nothing
- CLOSED guard (+`--force`), lane gate (+`--allow-uncategorized`), live-worktree guard
  (+`--force`), base-ref guard, stale-main guard (+`--allow-stale-main`)

So the concrete question — *what bug class would in-process `planClaim()` unit tests catch
that the subprocess suite misses?*

- **Half A:** essentially **nothing new behaviorally.** The e2e suite already exercises each
  guard's wired outcome, including "wrong arg / wrong order" regressions (a mis-wired guard
  changes the observable exit/banner, which an e2e test asserts). `planClaim()` tests would
  be *faster and finer-grained* (assert the exact `die` reason without spawning a subprocess),
  but they catch the same class of defect. Marginal.
- **Half B:** `planClaim()` **can't model it** (see §2), so no gain — the racy rollback
  permutations remain the domain of the e2e/integration tests (and `classifyClaimPushResult`
  / `claimPushAction`, already unit-tested pure seams).

Net: the delta is **the coverage number**, not a new caught-bug class.

## 4. Cost

- **Regression risk** on a heavily-guarded, race-sensitive script — Half B is the crown
  jewels (#1017 same-issue rollback, #1038 cross-clone ref, #629 live-wt guard, #1010 TOCTOU).
- **Indirection** for Half A: a `plan[]` + executor where today there is a readable linear
  chain.
- **Doctrine conflict.** `CLAUDE.md` ("pure seams vs CLI wrappers") states wrappers are *not*
  meant to be unit-tested; `main()` is the wrapper. Extracting `planClaim()` to raise the
  wrapper's line-coverage extends unit-testing *into* the layer the doctrine deliberately
  excludes. Chasing the metric here is the doctrine's exact anti-pattern.

## 5. Recommendation

**Drop the coverage-driven extraction.** Keep the #1196 e2e suite as the orchestration safety
net (it is behavioral coverage valuable independent of istanbul — already agreed out-of-scope
to remove). Accept `claim.js` ≈34% line coverage as **doctrine-consistent, not a gap**; the
uncovered span is a behaviorally-tested wrapper. Consider a one-line note near the coverage
config (or in `docs/do-this-not-that.md`) recording *why* this file is intentionally
low-line-coverage, so the number doesn't re-provoke this question every audit.

**Narrow middle path — only if a real need appears.** If a specific *ordering* bug in Half A
ever surfaces that the e2e suite can't localize quickly, extract **only** the linear
pre-staking guard chain into a `planPreStake(state, opts) → verdict` seam (the part with no
I/O entanglement) and leave the racy staking loop in `main()`. Do **not** attempt to pull the
staking loop into a pure plan without committing to a full effect-interpreter design — that is
a separate, larger, and independently-justified proposal, not a coverage exercise.

**If the recommendation is ever overridden to "ship":** file a separate `refactor(claim)`
implementation ticket scoped to Half A only, with the e2e suite as the regression gate. This
ticket (#1449) requires no production change.

---

*Method: read `scripts/claim.js:500–827` (full `main()` + the warn/stale helpers) and
`tests/new/claim.e2e.spec.js` (17 describe/it blocks) in a throwaway worktree; no code was
changed. Grounded in the #1196 body and the `CLAUDE.md` "pure seams vs CLI wrappers" doctrine.*
