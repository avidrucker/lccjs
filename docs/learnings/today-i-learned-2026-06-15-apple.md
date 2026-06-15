# TIL 2026-06-15 — APPLE

**Context:** A long session that started with one red e2e suite (#1328) and turned into a tour of the interpreter's architecture debt. Fixed the bug, filed an inheritance-vs-composition audit (#1345) and a dispatch-table spike (#1346), decoupled the interpreter-decomplect chain from a stale tier gate (#429), and — the big one — closed an over-scoped refactor (#255) the strict-yegor way, rescoping it to #1352 and closing its orphaned children #872/#873.

---

## 1. A regression's introducing commit can be 16 minutes old

**What happened:** #1328 said "runner.e2e fails on main… regression that landed after #1093." I almost took that framing at face value. Instead I ran `git log -L` on the failing region and the interpreter's echo lines, and traced the doubled output to `bc91977` — a commit from **the same day, ~16 minutes before the ticket was filed**, that refactored `runCase` from `spawnSync` (real piped stdin, no echo) to in-memory `executeBuffer({inputBuffer})` (the simulated path that *does* echo). The ticket author hadn't connected their own just-landed commit to the redness.

**What I learned:** "regression after [old PR]" is a hypothesis, not a fact. The actual cause was newer than the ticket's prime suspect and was hiding under a `test:`-typed commit. Git archaeology on the exact failing lines beat reasoning from the ticket narrative.

**The rule:** **When a test is "red on main," `git log -L` the failing region to its introducing commit — and check *same-day* commits — before trusting the ticket's stated cause.** (Reinforces do-this-not-that #1242.)

---

## 2. "Take the ticket" ≠ implement the ticket's literal body

**What happened:** Asked to "take #255" (group ~50 interpreter fields into `cpu/io/diag`, marked `45m/DEV`). Before claiming, I read the linked #388 contract — which had already **rescoped the work to ~225m across 5 buckets** and split it into a safe phase (#872, diag) and a deliberately-deferred *breaking* phase (#873, cpu/io). The `@todo #255` marker in code still described the naive all-at-once version. Implementing #255 literally would have executed the deferred breaking change, rippling through both subclasses, `lcc.js`, and the test-runner.

**What I learned:** the code marker and the issue body were both stale relative to the architect's contract. The ticket's own number was a trap; the truth was in the linked decision doc and the child tickets.

**The rule:** **Before coding a ticket, reconcile its body and code marker against any linked contract/decision doc and child tickets — a stale marker can point you straight at deferred breaking work.** (Reinforces `verify-prescribed-fix` + yegor-architect.)

---

## 3. Closing a pdd-tracked issue means neutralizing *every* marker — including doc mentions

**What happened:** Closing #255 cleanly meant retiring **three** `@todo #255` sites: the real one in `interpreter.js`, plus two in research docs (a prose instruction and a JSON example of pdd output). `npm run claim` even flipped one of the *doc* mentions to `@inprogress`. After a close, `puzzle:status` flags all of them as stale. The pre-push pdd scan only fails on *malformed* puzzles, so stale doc markers wouldn't block the push — they'd just rot silently in `puzzle:status` forever.

**What I learned:** the "delete the marker on close" discipline isn't only about the code site. `grep` finds markers anywhere, and docs that *quote* a marker count. Neutralize docs by breaking the `@todo #N` token without leaving a bare `@todo` (which pdd may flag as malformed).

**The rule:** **Before closing issue N, `grep "@todo #N"` across `src/` AND `docs/`, and neutralize every hit — code → remove/pointer, docs → break the token.** (Extends the puzzle-velocity marker rule to docs; candidate for do-this-not-that.)

---

## 4. The microtask cap is a *reason to close*, not just a reason to split

**What happened:** #255 was ~225m of cross-cutting work wearing a 45m label. Rather than grind it piecemeal through a half-baked decomposition, I closed it as a yegor-bdd complaint ("over-scoped, asking for too much") and filed a single rescope SPIKE (#1352) to decide a true ≤60m breakdown *or a defer/drop*. Then closed its orphaned children #872/#873, delegating their fate to #1352. Everything new this session was filed **design-first** (SPIKE/ARC #1346, #1352), never a pre-designed DEV ticket.

**What I learned:** an over-the-cap ticket is itself a defect in the backlog. The disciplined move is to reject-and-rescope, not to quietly start a multi-session slog under a microtask label. And when you reset a parent, its children need explicit disposition or they orphan.

**The rule:** **A ticket that can't fit the ≤60m cap is a complaint — close it with the scoping reason and file a rescope spike; explicitly dispose of any children.** (yegor-microtasks + yegor-bdd; reporter-closes exception applies.)

---

## 5. The orchestration guards work — and a guard-block is still loggable

**What happened:** Three safety nets fired in my favor: (a) FIG raced me on #1328 and the **claim guard** refused it ("already live in worktree apple/issue-1328"); (b) the **close.js keyword guard** caught my intentionally-paraphrased rescope close subject and made me pass `--skip-keyword-check`; (c) the **velocity `--from-main` guard** stopped a stray CSV export when I logged a PM row from main. I logged the close-guard block to the errors table even though it was working-as-designed.

**What I learned:** the guards are load-bearing, not theater. A guard firing is usually *you* doing something unusual (paraphrasing, racing, logging off-worktree) — sometimes legitimately. "By design" doesn't exempt a guard-block from the R021 error self-audit when it caused a retry.

**The rule:** **A guard block that forces a retry or an override flag gets an errors-table row, even when the guard was right.** (RULES.md R021.)

---

## What landed

| Artifact | Change |
|---|---|
| `src/core/interpreter.js`, `src/testrunner/runner.js` | #1328 fix — `echoInput` option (default on); autograder sets it false |
| `tests/new/lcc.test-mode.e2e.spec.js` | Corrected CLI tests that had encoded the doubled output as expected |
| `docs/research/inheritance-vs-composition-audit.md` | #1345 — audit of all `src/` `extends` sites + sequenced refactor plan |
| Issues filed | #1340 (agent patterns/anti-patterns), #1346 (trap-dispatch SPIKE), #1352 (rescope of #255) |
| Issues closed | #1328 (fix), #255 (over-scoped), #872 / #873 (rescope reset) |
| #429 | Sequencing comment decoupling the decomplect refactors from the #428 tier gate; unblocked #252/#255 (stale labels) |

## Open threads

- Lesson 3 (grep-docs-for-markers-on-close) is a good do-this-not-that candidate — not yet filed.
- The #429 tier-tracker structure (#428→#429→…) tends to bury actionable refactors behind unrelated gates; worth a future look at whether the tier trackers earn their coordination cost.

## Related artifacts

- Issues #1328, #1340, #1345, #1346, #1352, #429, #255, #872, #873
- `docs/research/inheritance-vs-composition-audit.md`, `docs/research/interpreter-state-grouping-contract.md` (#388)
