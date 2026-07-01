# Agent Patterns & Anti-Patterns

_Audience: AI agents, contributors · Tier: recommended_

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

### Pattern: Match the mechanism to the module's structure (don't copy a sibling verbatim)

- **What:** before reusing a sibling module's implementation approach, check whether the *property that made it work* holds in the new module; if not, pick the mechanism that fits the new structure.
- **Example:** the `--show-err-id` error-ID epic (#1480) was built three times. The assembler resolves an ID by **message-lookup in a registry** because it has ~100 error sites but only ~30 *clean, distinct* messages (#1553). The interpreter (#1554) and linker (#1555) are the opposite shape — ~11–16 *discrete* typed-error throws with messages that don't normalize (mid-string `"sin: …"`, front-interpolated filenames) and a real collision (`Invalid ${entryType} entry` renders `"Invalid S entry"`, which also exists as a literal). So those two carry the ID **inline** on the throw, with the registry demoted to record + validation + coverage. Copying the assembler's lookup into them would have been ambiguous and fragile.
- **Why it helps:** "reuse the pattern" silently assumes the pattern's fitness condition transfers. Site-count and message-shape — not the feature — decide the mechanism. Naming the fitness condition out loud (here: *many sites + clean wording*) tells you instantly whether the sibling's approach applies.

### Pattern: Split a prerequisite mechanism out of a backfill

- **What:** when a "backfill" ticket secretly requires building infrastructure a sibling module already had, lift that infrastructure into its own prerequisite ticket instead of smuggling it into the backfill.
- **Example:** #1553 (assembler backfill) was *just* a registry because #1552 had already built the `formatAssemblerError` seam + `--show-err-id` flag. The interpreter had no such seam (errors printed through shared `cliExit` with a parity-locked `Runtime Error:` wrapper), so "the interpreter backfill" actually contained a mechanism — split into #1562 (build the seam) → #1554 (the registry on top), mirroring the assembler's own #1552/#1553 split.
- **Why it helps:** asymmetry between modules ("the assembler already had X") is a decomposition signal. A backfill bundling a mechanism is two tickets; splitting keeps each one ≤60 min, reviewable, and independently verifiable.

### Pattern: Bidirectional coverage guard for source↔table sync

- **What:** any source-of-truth table that source code must stay in sync with gets a static-scan test asserting *both* directions (every source use resolves to a table entry, and every table entry is used) plus a planted-failure "teeth" check — shipped in the same change as the table.
- **Example:** each error-ID registry (#1553/#1554/#1555) got a `scripts/check-error-ids.js` scanner the spec drives; `murphy-jutsu` named "silent message-drift" as the top risk and this guard is its direct mitigation. The assembler scan even caught a false positive — a commented-out `// this.error(…)` line — until the scanner was made comment-aware.
- **Why it helps:** a registry without a guard rots silently (a reworded message, a typo'd id, a dead row). The bidirectional + teeth guard turns drift into a red CI run, which is the thing that actually delivers the "low rot" a registry promises.

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
