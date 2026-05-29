# Today I Learned — 2026-05-29 (APPLE)

Date: 2026-05-29
Agent: APPLE
Context: A long build-and-close session. Shipped the agent-identity worktree
convention (**#179**, `npm run claim` + fruit branches), added the velocity
`agent` column (**#180**), ran a scope spike on the linker test-coverage epic
(**#171**) and closed all five children (**#181–185**, 19 new unit tests), then
wrote the multi-agent concurrency findings doc (**#188/#189**). Along the way I
hit a partial-push near-miss and repeated classifier outages — and watched
CHERRY land the *systemic* fix (**#186**) for the exact pain I was patching by
hand.

---

## 1. Never chain `rebase && push` — gate the push on a clean, completed rebase

Closing #185 I ran one compound command: `git rebase origin/main` then,
unconditionally, `git push origin HEAD:main`. The rebase **paused on a CSV
conflict** after applying the first of two commits. Because nothing gated the
push, it shipped a **partial state** — my test commit landed on `main` (cleanly;
it didn't touch the CSV) while the velocity-row commit sat stuck mid-rebase with
conflict markers in my local tree. Recovery was clean (the marker-guard caught
it, I resolved + corrected the orphaned `closed_commit` and re-pushed), but it
was a genuine near-miss.

**The rule:** a rebase can *pause*; a push must never assume it didn't. Gate the
push — refuse if a rebase is in progress (`git rev-parse --git-path
rebase-merge` exists) or any conflict marker remains. Two separate steps, not
`&&`.

## 2. A workaround you keep applying by hand is a signal to fix the system

My response to the CSV churn was a better *manual* dance: separate gated push,
hand-fix the orphaned `closed_commit` SHA each rebase. That treats the symptom.
The real fix was systemic and landed the same day in CHERRY's **#186**:
`merge=union` on the CSV (concurrent appends auto-union, even under rebase) +
stop storing `closed_commit` at all (log it empty, derive via `git log --grep
"Closes #N"`). My instinct to escalate the *pattern* into the **#188** findings
doc was right; the lesson is to escalate sooner.

**The rule:** when you find yourself hand-resolving the same conflict every
close, stop polishing the workaround and file the systemic fix. Repeated manual
recovery is the smell. (See CHERRY's TIL lesson 2 — "don't store a value the
rebase will rewrite" — the root cause my hand-fixes were chasing.)

## 3. Recover from a tool outage with a read-only verify, never a blind retry

The Opus auto-safety classifier went unavailable **four times**, each blocking
the velocity-append Bash call mid-close. The trap: blind-retrying an `>>` append
risks a double-append if the first one *had* partly run. It hadn't (the
classifier blocks before execution) — but the only safe way to know is to check.
Each time I `Read` the CSV tail (read-only ops don't need the classifier) to
confirm the row wasn't there, *then* retried.

**The rule:** when a write tool is blocked by an outage, the operation did not
happen — but verify with a read-only tool before retrying, because "probably
didn't happen" + a non-idempotent append = corruption.

## 4. When shared state shifts unexpectedly, prove what *your* commands could touch before alarming

Mid-session, another agent's worktree (`banana/issue-13`) and its branch
vanished between two of my commands. First instinct: "did my `git worktree
prune` destroy banana's work?" The discipline that answered it: enumerate
exactly what each command I ran could affect — my `worktree remove` / `branch
-D` only ever named `apple/*`; `git worktree prune` only clears records for
already-missing dirs and **cannot** delete branches or existing dirs. Confirmed
with `git fsck` (no dangling commits from today) and the fact that no command of
mine named banana's branch. It was banana re-scoping itself.

**The rule:** under concurrent agents, "the state changed and I'm nearby" is not
"I caused it." Prove the blast radius of your own commands before raising an
alarm — and never take corrective action on another agent's refs to "fix" a
mystery.

## 5. Dogfooding a coordination convention is how you find its bugs and earn its adoption

I built the fruit-identity worktree convention (#179) and immediately used it as
`apple`. The first real claim surfaced a bug the design review missed: the new
worktree path resolved against the *caller's* cwd, nesting worktrees inside each
other — only visible by actually running `npm run claim` from inside a worktree.
And within the same session, **banana and cherry both self-adopted** the
convention (`npm run claim --as <fruit>`), so by afternoon `git worktree list`
and `puzzle:status` were attributing live work to three named agents.

**The rule:** ship coordination tooling by using it yourself first — the first
real use is the best test, and visible self-adoption spreads a convention faster
than any doc. (CHERRY's lesson 3 is the flip side: use the *project's* claim
tool, not the generic harness worktree, or the naming convention other scripts
depend on silently breaks.)

## 6. "Shortest estimate first" is a tiebreak, not a law

#171's children #181 (45m) and #182 (30m) were both `severity:medium`; strict
Yegor priority would start the shorter #182. But #181 (`adjustExternalReferences`
relocation) was the *foundational* test whose scaffolding #182/#183 reused, so
foundational-first was the better order. I surfaced the nuance rather than
silently following the rule.

**The rule:** shortest-first breaks ties within a severity tier — it doesn't
override "this one unblocks/seeds the others." When a sibling establishes the
pattern, do it first and say why.

---

## What landed

| Artifact | Change |
|---|---|
| [#179](https://github.com/avidrucker/lccjs/issues/179) | **Closed** — `scripts/claim.js` (`npm run claim`) self-assigned fruit-identity worktrees; `puzzle-status.js` agent attribution; `docs/design-agent-worktree-identity.md`. Caught the path-nesting bug by dogfooding. |
| [#180](https://github.com/avidrucker/lccjs/issues/180) | **Closed** — added the `agent` column to `puzzle-velocity.csv` + docs + skill 0.5.0. |
| [#171](https://github.com/avidrucker/lccjs/issues/171) | **Closed** — scope spike validated the body's plan + 3 refinements; decomposed into #181–185. |
| [#181–185](https://github.com/avidrucker/lccjs/issues/181) | **All closed** — 19 linker unit tests (relocation math, A-table relocation, multi-module threading, abort-before-write guard, `createExecutable` byte format). Full `tests/new` suite 600 passed. |
| [#188](https://github.com/avidrucker/lccjs/issues/188) / [#189](https://github.com/avidrucker/lccjs/issues/189) | #189 **closed** (`docs/worktree-multi-agent-findings.md`, 7 failure modes); #188 **open** — the process puzzle. |

## Open threads for tomorrow

- **#188 is partially answered by #186.** CHERRY's `merge=union` + empty-`closed_commit`
  fix retires the CSV-conflict and SHA-orphan failure modes (#1, #2, #3 in the
  findings doc). The remaining #188 scope is the *push-gating* piece (lesson 1
  here — a pre-push hook that refuses to push mid-rebase) and the claim/marker
  cross-visibility gap. Worth re-scoping #188 down to those.
- The two-commit close pattern I used all session is now **superseded** by the
  0.6.0 single-commit close — future closes should follow the new protocol.

## Related artifacts

- `docs/worktree-multi-agent-findings.md` — the #188 failure-mode catalog (this
  session's pain, written up).
- [TIL 2026-05-29 (cherry)](./today-i-learned-2026-05-29-cherry.md) — the
  sibling session; its lessons 2 (derive-don't-store) and 3 (use the project's
  claim tool) are the root-cause and flip-side of my lessons 2 and 5.
- `docs/research/velocity-log-storage.md` — CHERRY's #186 spike that fixed the
  CSV pain I spent the session working around.
