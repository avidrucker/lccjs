# Agent Patterns & Anti-Patterns

Working-practice wisdom for AI agents in this repo: **patterns that have worked well for us, and anti-patterns that have bitten us** — each with a concrete example and a one-line "why." Scan this before starting work; it is meant to be browsable, not exhaustive.

**Scope:** *how to approach work* at a working-practice altitude — not specific tool/command choices (those live in [`do-this-not-that.md`](./do-this-not-that.md)), not multi-agent orchestration failures (those live in [`research/orchestration-failure-modes.md`](./research/orchestration-failure-modes.md)), and not raw per-session lessons (those live in [`learnings/`](./learnings/)). This doc is the *distillation* of `learnings/` into a paired pattern↔anti-pattern reference, not a duplicate. When a TIL lesson generalises, promote it here — the same promotion model `do-this-not-that.md` uses.

Each entry follows a fixed shape so the doc stays scannable:

> **Pattern / Anti-pattern: \<short name\>**
> - **What:** one-sentence description of the practice.
> - **Example:** a concrete instance (issue #, commit, or session).
> - **Why it (helps / hurts):** the mechanism — what it buys us or what it costs.

---

## Patterns (worked well)

### Pattern: Root-cause before fix

- **What:** trace a regression to the commit that introduced it before editing anything.
- **Example:** #1328 ("fails on main") was a vague output mismatch until the regression was bisected to commit `bc91977`, which turned a one-line guess into a precise cause.
- **Why it helps:** a fix aimed at a confirmed root cause is verifiable and minimal; a fix aimed at a symptom tends to paper over the real defect, leave a latent bug, or spawn a second regression. The trace also produces the evidence you need to write an honest close comment.

### Pattern: Surface design forks to the human

- **What:** when a fix or design has materially different *valid* resolutions, present the options plus a recommendation rather than silently picking one.
- **Example:** #1238's ticket prescribed "add the field to `resetAssemblyState()`" — but probing that fix revealed it would have broken the CLI `-l` path. Surfacing the fork (the prescribed fix vs. the alternative that preserved `-l`) let the human pick the correct resolution instead of shipping a plausible-but-wrong one. #1328 did the same with an explicit Option A/B/C.
- **Why it helps:** the agent rarely holds the full intent behind a ticket. A unilateral pick on a genuine fork risks optimising for the wrong constraint; a named set of options + recommendation keeps the decision with whoever owns it while still moving the work forward. (See also `verify-prescribed-fix-not-just-bug`: a ticket's prescribed fix can be wrong even when the bug is real.)

### Pattern: Search closed issues before filing

- **What:** run `gh issue list --state all` for the topic before filing a new ticket, and treat live state that contradicts the request as a signal the work may already be done.
- **Example:** #1146 (syntax-highlighting flicker) was filed without checking history; it was a duplicate of the already-shipped-and-closed #1137. The work existed; the new ticket was noise.
- **Why it helps:** closed issues are the cheapest source of "already solved" and "tried, rejected, here's why." Skipping the search burns a claim cycle re-deriving a decision, or files a duplicate that an orchestrator then has to reconcile.

---

## Anti-patterns (bit us)

### Anti-pattern: Mislabeled commit type that hides a behavior change

- **What:** typing a commit with a low-signal type (`test` / `chore` / `docs`) when it actually changes production behavior.
- **Example:** `bc91977` was typed `test(test-runner): add lcc --test e2e coverage`, but it also refactored `runCase` from `spawnSync` (real piped stdin) to in-memory `executeBuffer({inputBuffer})` — a runtime-behavior change that introduced the #1328 regression.
- **Why it hurts:** reviewers and `git log` archaeology trust the type. A behavior change wearing a `test:` label is invisible to anyone scanning history for "what could have changed the output," which is exactly how #1328's root cause stayed hidden. Type a commit by its *dominant behavioral impact* (`fix`/`refactor`/`feat`) and call out behavior changes in the body.

### Anti-pattern: Tests that codify a bug as the expected value

- **What:** writing/snapshotting expected values from *observed* program output without verifying the output is *correct* ("golden-as-truth" / rubber-stamping).
- **Example:** `bc91977`'s CLI e2e cases asserted `actual: "hello world\nhello world"` (the doubled output) as the pass condition for an echo program — baking the regression into the suite so it "passed" while encoding wrong behavior.
- **Why it hurts:** the test suite stops being an independent oracle and instead locks in whatever the code currently does, including bugs. Derive expected values from the *spec / intended behavior* (an echo of `hello world` is `hello world`), not from what the runner happens to print.

---

*Seeded from #1340. This doc grows by promotion: when a `docs/learnings/` TIL or an errors-table entry generalises into a reusable working-practice lesson, add it here in the shape above.*
