# TIL 2026-06-24 — BANANA

**Context:** A long session driving the lccjs → pmtools PM-harness migration: smoke-testing the harness (#1452), filing the go/no-go follow-ups (#1457 store blocker, #1458 status fidelity), designing a self-describing worktree/branch naming scheme (research #1460), then implementing it in pmtools (avidrucker/pmtools#17). The implementation is where the sharpest lessons came from.

---

## 1. A tool's own integration suite leaked test commits into my worktree

**What happened:** I was implementing the naming scheme in `pmtools` from a worktree (`banana/issue-17`). After a clean TDD cycle I ran `bash run-tests.sh` to check the integration stage — *from inside the worktree*. The unit stages passed; integration reported failures (expected — stale name assertions). But when I went to commit the next increment, `git log` showed **nine** `feat: add widget renderer` / `Closes #32` commits (`Author: tester`) interleaved with my real commits. `pmtools`'s `tests/integration.sh` is **not hermetic**: some of its `git commit`s ran against the ambient cwd repo instead of the per-test temp repo, so the test's own fixture commits landed on *my* branch.

**What I learned:** "The tests passed in CI" tells you nothing about whether the harness is safe to run *from your working repo*. A test suite that shells out to `git` is a write-capable program pointed at whatever cwd it inherits. My real commits were never lost and `main`/`origin` were untouched — the damage was contained to my branch — but I only noticed because I happened to read `git log` before pushing. Recovery was clean once I understood the shape: `git rebase --onto <last-good> <last-junk>` replays only my real top commit onto my real base, dropping the contiguous run of leaked commits in between (and their `.claude/orchestrate.json` pollution with them). I filed the harness bug as avidrucker/pmtools#20 with a suggested HEAD-unchanged exit guard.

**The rule:** **Don't run a tool's own `git`-mutating test suite from inside a live worktree of that tool — and after any surprising run, read `git log` before you push.** When history gets polluted by a contiguous run of junk commits, `git rebase --onto <base> <top-of-junk>` excises them surgically. (Authority: avidrucker/pmtools#20.)

---

## 2. The clean way past a blocker was to route around it, not to stop and fix it

**What happened:** #20 (the leaky harness) blocked the *last* piece of #17 — updating the integration tests — because finishing them means *running* the suite to verify, which is the exact thing that polluted my branch. My first instinct, which I pitched as the recommendation, was "stop the line: fix the harness first." When the human asked whether yegor-pm would actually endorse that, I re-examined it and had to walk it back: "stop the line" is a Lean idea I'd imported. yegor-pm (PDD + architect mode) says the opposite — when you hit a side-problem off your current deliverable, **file it and keep your momentum**; don't switch lanes to fix it (especially someone else's lane — the harness is GRAPE's). So I'd already done the yegor move by filing #20. The right next step was to **route around**: edit `integration.sh` in my worktree (editing files is harmless), but *verify* by running the suite in a throwaway `git clone` under the scratch dir, where any leak hits a disposable copy. It worked — 123/0 integration, branch unpolluted.

**What I learned:** I conflated a methodology I was explicitly invoking with a different methodology's reflex, and only caught it because the human pushed back with "is that *really* what yegor-pm says?" The honest re-read flipped my recommendation. Also: "isolate the blast radius" (disposable clone) is often cheaper and lower-coordination than "fix the shared hazard" — and it keeps you on your own deliverable instead of switching into a teammate's lane.

**The rule:** **When a blocker is off your deliverable (and in someone else's lane), file it and route around it — don't stop to fix it; and when you cite a methodology, check you're applying *that* one, not a same-sounding import.** (Authority: yegor-pm skill; blocker tracked in avidrucker/pmtools#20.)

---

## 3. "Preserve the token" wasn't enough for back-compat — the *anchor* mattered

**What happened:** The naming design (#1460) leaned on an invariant: keep the `issue-<N>` token in every name so the `issue` parsers keep working. When I wrote the failing test for the new scheme, `worktrees_with_issue` still failed — because its regex was `/\/issue-(\d+)/`, **slash-anchored**. The new branch `br-banana/lccjs-js-issue-1461` has `-issue-`, not `/issue-`, so the slash-anchored sites silently stopped matching while the bare `issue-(\d+)` sites kept working. The fix was `[-/]issue-(\d+)` — match either delimiter.

**What I learned:** "the token is preserved" is necessary but not sufficient; what a regex is *anchored on* around the token is the thing that actually breaks when a delimiter shifts. TDD caught this immediately — the failing fixture pointed straight at the slash-anchored parse the design summary had glossed as "preserved." Writing the test first turned a latent back-compat bug into a one-line fix before any code shipped. The same correction is queued for the lccjs consumer (`claim.js:114` uses the slash-anchored form too).

**The rule:** **When you change a delimiter, audit what every parser is *anchored on* around the surviving token — not just whether the token survives; let a failing test, not the design prose, tell you which sites break.** (Authority: avidrucker/pmtools#17 commits; carries over to avidrucker/lccjs#1461.)

---

## Open threads
- pmtools#17 is implemented and green in all three test stages (verified in an isolated clone), but rebasing it onto current main (`e1b9a1b`, GRAPE's status fix) will conflict in `status.js`/`status.py`/`integration.sh` — the two changes are complementary, so the landing is a coordinated merge, pending a decision.
- The `--skip-velocity-check` close flag exists for no-repo-change PM/triage closes (used it on #1460); worth remembering when a close legitimately has no velocity row.

## Related artifacts
- Research/design: #1460 (`docs/research/1460-worktree-naming-scheme.md`)
- Migration: #1456 (tracker), #1451 (go/no-go), #1452 (smoke-test), #1457, #1458
- pmtools: avidrucker/pmtools#17 (impl), #20 (hermeticity bug), #13 (design doc)
- Consumer: #1461 (lccjs adoption)
