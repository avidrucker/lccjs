# Regression-testing the worktree-teardown contract — both paths

**Ticket:** #317 · **Role:** RESEARCH (design spike) · **Agent:** CHERRY · **Date:** 2026-06-01
**Related:** #316 (serial-tool-use / "close is terminal"), #266 (verify-then-cleanup gate), #309/#304 (where the cwd-removal side effect surfaced), #352 (chdir+ff-pull mitigation, already on main)

---

## The question

`scripts/close.js` owns a teardown contract with two paths that both matter and could regress in
opposite directions while the suite stays green:

- **Success:** commit lands on `origin/main` → worktree is *removed* (and branch deleted, prune run).
- **Failure:** push rejected / hook block / race exhausted → worktree must be *preserved* so work isn't lost.

How do we lock in **both** directions without flakiness, given the #266 finding that the real
behaviour depends on a live `git push` through the real hook and pure unit tests miss it?

---

## What is already tested (inventory)

| Layer | File | Covers | Path |
|---|---|---|---|
| Unit (pure seams) | `tests/new/close.unit.spec.js` | `classifyPushError` (race vs rejected-other, incl. null/empty), `shouldCleanup` (gate decision: only `=== true` cleans up), `classifyRebaseConflict` | decision logic, both directions |
| E2e | `close.e2e.spec.js` "clean close" (9001) | commit on `origin/main` **AND** worktree dir gone **AND** branch deleted | **success → teardown** ✅ |
| E2e | `close.e2e.spec.js` "--keep" (9002) | commit lands, worktree **survives** | success → no-teardown ✅ |
| E2e | `close.e2e.spec.js` "lost-race retry" (9003) | pre-receive rejects push #1 (race signature) then stands aside → retries, lands, tears down | **transient** failure → recovery ✅ |
| E2e | `close.e2e.spec.js` pre-flight (9004–9008) | dry-run, no `Closes #N`, run-from-main, issue/branch mismatch, no-mutation dry-run | pre-flight refusals ✅ |

**Read of the inventory:** the *success* path teardown is locked in (9001), and the pure *decision*
seams are exhaustively unit-tested. This is precisely the #266 trap restated — the decision logic
(`shouldCleanup`, `classifyPushError`) is green, but the **wiring of a terminal failure to real git
I/O, asserting the worktree survives, is never exercised end-to-end.** 9003 proves recovery from a
*transient* failure; nothing proves preservation on a *terminal* one.

---

## Q1 — Success-path test: covered, one minor gap

Test 9001 already is the success-path lock-in (`close.e2e.spec.js:82`): asserts the commit on
`origin/main`, the worktree directory gone (`fs.existsSync(wtPath) === false`), and the branch
deleted. Nothing material is missing for "on success, teardown happens."

**Minor gap (optional):** since #352, a successful close also `process.chdir(root)`s and runs
`git pull --ff-only origin main` on the *main checkout*, printing a `Shell re-root:` hint
(`close.js:528`, `:543`, `:552`). 9001 does not assert the main checkout was fast-forwarded. Worth a
one-line assertion (main checkout `HEAD` now equals `origin/main`) so the #352 behaviour can't
silently regress — but this is a nicety, not the contract's load-bearing edge.

## Q2 — Failure-path test: the real gap, and it is cleanly injectable

The terminal-failure path (worktree **preserved**) has no e2e coverage. The good news: the injection
technique is **already proven by 9003** — a `pre-receive` hook on the temp bare remote. The failure
variants are *strictly simpler* than 9003 (no counter file; the hook just always fails), so they are
deterministic and serial-safe by construction (each test owns its own tmpdir + bare remote, the suite
is `--runInBand`). Two variants close the gap:

**(a) `rejected-other` terminal failure → worktree preserved.**
A `pre-receive` hook that *always* exits non-zero. When a pre-receive hook rejects, git prints
`! [remote rejected] main -> main (pre-receive hook declined)`. Note this is classified
**`rejected-other`, not `race`** — the RACE regex `/\[rejected\]/` does **not** match the substring
`[remote rejected]` (the `[` precedes "remote", not "rejected"), and none of the other race patterns
(`cannot lock ref`, `non-fast-forward`, `fetch first`, `tip … behind`) appear. So `close.js` dies on
attempt 1 *before the gate* (`close.js:488`), no retry loop — fast and deterministic.
*Assert:* `ok === false`; output matches `/non-racy reason/`; `fs.existsSync(wtPath) === true`; the
branch still exists; the worktree `HEAD` is the original close commit; `origin/main` does **not**
contain it.

**(b) Race exhausted → worktree preserved.**
A `pre-receive` hook that *always* emits a race signature (`cannot lock ref`, exactly as 9003 does)
and exits 1, invoked with `--max 2`. `close.js` retries twice, both classify `race`, the loop
exhausts, and it dies "lost the race N times … Worktree left intact" (`close.js:495`). `--max 2`
keeps it to two fast failures.
*Assert:* same preservation invariants as (a); output matches `/lost the race/`.

**(c) The gate itself (push "ok" but commit not on `origin/main`) — do NOT e2e-test.**
`shouldCleanup({onOriginMain:false})` is a *defensive* check for a "can't normally happen" state
(`close.js:503`). Reaching it e2e would require corrupting git so a push exits 0 yet the ref doesn't
move — inherently contrived and flaky. It is already locked by the pure unit tests
(`close.unit.spec.js:69` covers `false`/`undefined`/`null`/`{}` → blocked). **Recommendation:
document it as defensive-only; rely on the unit test.** This is the correct division of labour the
#266 TIL points to: unit-test the *decision*, e2e-test the *wiring of the reachable paths*.

## Q3 — The cwd side effect: document + guard, do **not** test destruction

On success, teardown destroys the caller's shell cwd (the worktree dir vanishes under it); during
#309/#304 close-out this cancelled every command chained after the close.

**Recommendation: document + guard, not test.** Reasons:
1. **Not observable from Jest.** The e2e harness invokes `close.js` as a *subprocess*
   (`shCapture(wtPath, …)`). A subprocess `chdir`/dir-removal cannot change the test runner's cwd, so
   "the caller's cwd was destroyed" is structurally unassertable from within the suite. The side
   effect lives in the *interactive shell/agent context*, which is a process-discipline concern, not
   a git-state one.
2. **The guard already largely landed (#352).** `close.js` now `chdir`s to the main root before
   removal and ff-pulls main there, then prints `Shell re-root: cd "<root>"` (`close.js:528`,
   `:539-552`) — so a chained `git pull` no longer explodes on a deleted cwd.
3. **It ties to #316 rule #1.** The durable mitigation is the documented rule "**close is terminal —
   issue nothing after `npm run close` in the same turn/context**", which is the serial-tool-use
   discipline #316 is converting from prose toward an executable `PostToolBatch` guard. Testing the
   destruction would duplicate, at high flakiness cost, a rule better enforced at the harness layer.

What *can* be cheaply locked in (and belongs in the success-path test, not a new one) is the
*guard's* observable output: assert the success run prints the `Shell re-root:` hint, i.e. that the
tool advertises its terminal-ness. That documents the contract in an executable assertion without
trying to observe the unobservable.

---

## Deliverable — ONE grounded DEV puzzle (≤45m)

> **DEV: e2e-test the close.js failure-path teardown contract — assert the worktree is *preserved*
> on terminal push failure (≤45m).** In `tests/new/close.e2e.spec.js`, add a small helper that writes
> an always-failing `pre-receive` hook to the temp bare remote (reuse the `makeRepo`/hook pattern from
> the existing 9003 test, minus the counter), then two tests: **(a)** always-reject hook ⇒
> `close.js` dies `rejected-other` on attempt 1 and the worktree dir + branch + close commit all
> survive while `origin/main` lacks the commit; **(b)** always-`cannot-lock-ref` hook + `--max 2` ⇒
> dies "lost the race", same preservation invariants. Optionally extend the existing 9001 success
> test with one assertion that the main checkout fast-forwarded and the `Shell re-root:` hint printed
> (#352 lock-in). Do **not** add a gate-bypass (push-ok-but-not-on-main) e2e test — it is covered by
> `shouldCleanup` unit tests and is defensive-only. Acceptance: both new tests pass under
> `--runInBand`, are self-contained (own tmpdir + bare remote), and fail if a future edit makes
> teardown run on a non-landed push.

Scope note: this is additive test-only work against an interface (`close.js` CLI + exit code + fs
state) that is stable and already has a working harness — hence the sub-45m estimate. The two
failure tests are simpler than the 9003 retry test that already exists.

| # | Title | Role | Est |
|---|---|---|---|
| TBD | DEV: e2e failure-path teardown tests — worktree preserved on terminal push failure | DEV | 45m |
