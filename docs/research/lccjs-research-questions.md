# lccjs Research Questions, Hypotheses & Murphy Jutsu
*A deep-dive brainstorm grounded in the lccjs codebase*

---

## Preamble: What lccjs Is

lccjs is a 16-bit educational assembler/linker/interpreter toolchain in JavaScript — a faithful reimplementation of a real academic ISA (the "LCC" from Prof. Dos Reis's `cuh` package). What makes it *exceptionally unusual* as a research target is that it is **actively developed by multiple AI agents in parallel**, with:

- A **Puzzle-Driven Development** (PDD) discipline (bounded tickets, worktrees-per-task)
- Per-agent fruit identities (APPLE, BANANA, CHERRY, DRAGONFRUIT, ELDERBERRY…)
- A **velocity tracking system** (`puzzle-velocity.csv` / SQLite) capturing H and C estimates vs. actuals
- Oracle-parity differential testing against the original `cuh63` binary
- 200+ closed puzzles across roles: DEV, TEST, ARC, WRITER, PM, DATA, RESEARCH, SPIKE
- Git commit-quality enforcement via hooks and a 98.3% Conventional Commits compliance rate
- Documented failure modes from real multi-agent sessions (CSV append races, rebased orphan SHAs, classifier outages)

This isn't just a codebase. It is a **living laboratory of agentic software development**.

---

## I. Agent Orchestration

### Hypotheses

**H1 — Worktree isolation is necessary but not sufficient for concurrency safety.**
The lccjs multi-agent findings (`docs/worktree-multi-agent-findings.md`) show that git branch isolation doesn't prevent CSV append conflicts on shared state files. The hypothesis: any append-only coordination file will hit pathological conflict rates above ~3 concurrent agents.

**H2 — Agent identity stability (fruit names, `CLAUDE_AGENT_NAME`) reduces coordination errors.**
Agents with a fixed identity scoped to a session make fewer "orphan claim" errors than agents in `auto` mode, because self-knowledge enables better state attribution.

**H3 — The "C estimate before reading the ticket" protocol is a leading indicator of calibration quality, not just process hygiene.**
If C is set after reading, the prediction is post-hoc. Process-adherence self-audits show this is systemically missed. The hypothesis: agents that cheat on C produce misleading delta_c_min distributions, flattening the calibration signal.

**H4 — Classifier outages are the biggest single-point-of-failure in agentic close sequences.**
The multi-agent findings show 4+ classifier outages in one session blocked the Bash call mid-close. These are invisible to the agent until failure — unlike rebase races which produce explicit errors.

**H5 — Trunk-based development with agent worktrees requires a merge-window or lock protocol to avoid O(n²) rebase costs as n agents scale.**
Each agent must rebase before push; as n grows, the last agent in a batch faces n-1 rebases' worth of drift.

### Questions

1. At what agent concurrency (n=2, 3, 4…) does the CSV append conflict rate exceed 50% per close? Is there a phase transition?
2. Does assigning fruit identities at session start (vs. `auto`) measurably reduce orphaned worktrees or double-claimed tickets?
3. Can an orchestrator agent detect mid-close classifier outages via output inspection and auto-retry, and what's the success rate?
4. What is the actual wall-clock overhead of the claim→work→close cycle per puzzle size class (H≤15m vs. 15–60m)?
5. Is there a signal in `puzzle-velocity.csv` that predicts "this agent will conflict on push" before it happens?
6. How does the pre-push conflict-marker guard (`scripts/git-hooks/pre-push`) affect mean close time vs. near-miss prevention rate?
7. Can two agents simultaneously close tickets on the same file (e.g. `TODOS.md`) without coordination, and what's the blast radius?
8. What's the minimum viable coordination substrate? SQLite beats CSV — but does it beat a single-row-per-file append pattern?

---

## II. Code Quality Preservation & Enhancement

### Hypotheses

**H9 — Code quality degrades predictably at architectural seam boundaries.**
The codebase quality hotspot analysis shows that `disassembler.js` has max indent depth 28 and 18 CLI leaks — the worst in the codebase. The hypothesis: files that straddle the "pure API / CLI wrapper" boundary have higher defect rates than purely one-sided files.

**H10 — Inheritance-based extension (assemblerplus subclasses assembler) is a hidden technical debt amplifier.**
The `CLAUDE.md` contains the standing warning: "a core change can silently break LCC+." This is measurable. The hypothesis: the ratio of `plus`-layer bugs to `core`-layer bugs exceeds the ratio of plus code to core code, because the shadow pattern hides regressions.

**H11 — Switch-statement density correlates with time-to-understand for AI agents.**
The assembler has 92 `case` labels and `handleInstruction` runs 172 lines. The hypothesis: an agent asked to add a new instruction to the switch takes >2× longer than an agent working on a data-driven mnemonic table, and makes more errors.

**H12 — The "pure seam" refactoring pattern (no console.*, no process.exit in core) is associated with higher test density at those sites.**
Files with low CLI leak counts should have more unit tests per 100 LOC. If not, the pure seam promise is unfulfilled.

**H13 — Conventional Commits compliance alone doesn't predict commit quality; description informativeness matters independently.**
98.3% CC format compliance doesn't mean the descriptions are informative. The hypothesis: you can sort commits by "informativeness" independent of format compliance, and the correlation between the two is low.

### Questions

9. Do files with high CLI leak counts (`console.*` / `process.exit`) have statistically higher bug density in the open_bugs.md tracker?
10. Can you measure "shadow hazard risk" — instances where a core method change is silently overridden by the plus subclass — by static analysis? How many currently exist?
11. What's the refactoring ROI for replacing the mnemonic switch with a data table? Measure: lines changed per new-instruction addition, before vs. after.
12. Is there a measurable relationship between a file's max indent depth and the number of open bugs attributed to it?
13. What percentage of `@todo` puzzles in the codebase have been open >30 days? Does age predict complexity (H estimate)?
14. Can an agent reliably detect when a proposed edit will hit the "plus subclass shadows core" trap, and preemptively warn?
15. What does "code quality preserved" even mean when the oracle IS the spec? If lccjs diverges from oracle intentionally (`docs/parity_deviations.md`), how do you distinguish intentional divergence from regression?

---

## III. Agentic Code Maintenance

### Hypotheses

**H16 — Scope creep ("while I'm here…") is the dominant failure mode for agentic maintenance tasks, not implementation errors.**
The workflow explicitly forbids expanding scope. The hypothesis: most agent near-misses in the git history involve out-of-scope edits, not wrong implementations of in-scope work.

**H17 — The "C estimate" is a better predictor of agent reliability than the "actual_min."**
An agent that consistently sets C close to actual (low |delta_c_min|) is better calibrated and makes fewer surprise-cost edits than one with high variance, regardless of whether actual times are long or short.

**H18 — Agents that skip the `@inprogress` flip (as APPLE systemically did) cause more double-claim incidents per session than agents who do it.**
The `puzzle:status` script infers claims from worktrees, but `@todo` markers on `main` signal "available." The hypothesis: the vestigial marker flip still matters if any agent reads source-of-truth from `main` rather than `puzzle:status`.

**H19 — "Redline, don't rewrite" (the yegor-tickets convention for correcting issue descriptions) reduces information loss across agent sessions.**
If a sibling issue's description is silently overwritten, the original rationale is lost. The hypothesis: repos using additive correction (strikethrough + comment) have lower "why was this done?" confusion overhead in subsequent agent sessions.

**H20 — Multi-model sessions (Sonnet for closes, Opus for architecture) produce higher output quality per token cost than single-model sessions.**
The velocity CSV now tracks `model`. The hypothesis: SPIKE and ARC tasks show higher H→C→actual accuracy under Opus; DEV and WRITER tasks are comparably accurate under Sonnet at lower cost.

### Questions

16. What's the ratio of in-scope to out-of-scope edits per agent session, and does it correlate with puzzle complexity class?
17. Do agents with tighter H estimates (H≤15m) have lower delta_c_min variance than agents working H=60m puzzles?
18. Can you predict from velocity row features (role, h_min, agent, model) whether a given puzzle will exceed its H estimate?
19. Is there a "maintenance entropy" curve for lccjs — as the codebase ages, does mean actual_min per puzzle grow?
20. What fraction of RESEARCH-role tickets result in actionable follow-up DEV/TEST tickets vs. being dead ends?
21. How does the `closed_commit` orphan problem (SHA rewritten by rebase) affect downstream auditability? Can you reconstruct causal chains from puzzle-velocity.csv + git log reliably?
22. Does the "tool-failure discipline" (re-read before git add after any error) reduce bad-commit frequency measurably compared to sessions without it?

---

## IV. Conducting Effective Data Experiments with Agents

### Hypotheses

**H23 — The oracle-parity differential test suite is the most valuable experimental instrument in lccjs for detecting regression.**
Any change to core assembler or interpreter can be validated cheaply by re-running oracle tests. The hypothesis: oracle tests catch regressions that unit tests miss at >2× the rate.

**H24 — Golden-file test caches with manual refresh (`GOLDEN_AUTO_UPDATE=1`) provide better change-signal than auto-updating goldens.**
Auto-refreshed goldens hide drift. The hypothesis: manual-only golden refresh means every unexpected diff surfaces, and the false-negative rate for silent behavioral regression is near zero.

**H25 — The `puzzle-velocity.csv` dataset, though small (n≈200 rows), already has enough signal to fit a useful per-role estimation model.**
The stats notebooks (`stats/day-four-analysis.ipynb`) attempt this. The hypothesis: a simple linear model (role + h_min → actual_min) already outperforms the raw H estimate as a predictor.

**H26 — Data experiments that track intermediate states (not just final output) produce more replicable results for agentic workflows.**
The `started_iso` / `finished_iso` pair enables wall-clock analysis, but intermediate state (when did the agent first edit a file? when did tests first pass?) is not tracked. The hypothesis: adding one intermediate timestamp ("tests green") would cut delta_c_min variance by >30%.

### Questions

23. What's the oracle test false-negative rate for silent miscompile bugs (the `cuh63-ldr-str-silent-miscompile-bug-report.md` class)?
24. Can you build a confound-controlled experiment for agent estimation accuracy by holding role constant and varying only model (Sonnet vs. Opus vs. Haiku)?
25. What's the minimum viable experiment for testing "does the mnemonic-switch → data-table refactor improve agent edit accuracy"? What would a null result look like?
26. The velocity CSV has 200+ rows but many empty `c_min` values. Does imputing missing C values (via model prediction) improve or degrade the calibration analysis?
27. Can you design an A/B test for "does the claim/close protocol reduce merge conflicts" — what would the control condition look like in a repo with no PDD discipline?
28. Is there evidence in the velocity data of "learning curves" — do specific agents (apple, banana…) improve their C accuracy over successive sessions?
29. What's the statistical power of the current velocity dataset to detect a 10% reduction in actual_min from a proposed protocol change?

---

## V. Additional Questions This Codebase Uniquely Enables

### On ISA Design & Correctness

30. Can an LLM agent, given only the lcc-isa.md spec and no source code, write a conformant assembler from scratch? What's the defect rate vs. lccjs?
31. What fraction of the oracle parity deviations (`parity_deviations.md`) are "the oracle is wrong" vs. "lccjs is wrong" vs. "both are defensible"?
32. Is the 16-bit ISA's instruction encoding space fully covered by the test suite? What's the opcode coverage %?

### On Documentation as a Research Signal

33. Does the ratio of WRITER-role tickets to DEV-role tickets predict codebase maintainability metrics (test coverage, CLI leak count)?
34. Do TIL (Today-I-Learned) entries cluster around specific subsystems? What does the TIL heatmap reveal about where agents get surprised?
35. Can you use the glossary growth rate as a proxy for conceptual complexity added per unit time?

### On Educational Effectiveness

36. Do agents that read the textbook_demos (ch03–ch19) before attempting puzzle work make fewer ISA-level errors?
37. Can the demos (demoA.a through demoZ.a) be sorted by "conceptual difficulty" using only static analysis of the assembly source?

---

## VI. Murphy Jutsu: What Could Go Wrong

*Think like a NASA FMEA engineer. Enumerate failure modes at macro level, estimate severity × likelihood, then ask what question or safeguard addresses each.*

---

### M1 — The Velocity Data Is Already Corrupt and Nobody Knows It

**The failure:** `closed_commit` values are orphaned by rebases. `c_min` is systemically set post-hoc (APPLE's self-audit finding). Multiple agents appended conflicting rows that were resolved inconsistently. The SQLite DB and the CSV export may have diverged. The `model` and `agent` columns have sparse coverage for early rows.

**Severity:** CRITICAL for any research using the velocity data as ground truth. Every regression, calibration model, or learning-curve analysis built on this data inherits the corruption.

**The questions that protect you:**
- What's the internal consistency check between the SQLite DB and the CSV export? Run it.
- For each row with `c_min` populated, can you verify from git timestamps that the C estimate predates the first file read in that session?
- What fraction of `closed_commit` SHAs are actually reachable from current HEAD?

---

### M2 — Oracle-Parity Tests Are a False Safety Net

**The failure:** The oracle binary (`cuh63/lcc`) is a black box. `parity_deviations.md` documents *known* intentional divergences — but unknown divergences accumulate silently because the golden cache is only refreshed manually. Worse, the oracle isn't run in CI (it requires a local binary path via `.env`). So every agent in a cloud-based session is flying blind on oracle parity.

**Severity:** HIGH. An agent could introduce a silent miscompile regression (exactly the class described in the bug reports) and it would not be caught until a human runs the oracle suite locally.

**The questions that protect you:**
- What's the false-negative rate of the non-oracle test suite for the exact bug classes documented in `cuh63-ldr-str-silent-miscompile-bug-report.md`?
- Can the oracle be containerized or mocked, so oracle-parity tests run in CI without the binary?
- Is there a way to detect "this change touches instruction encoding" and automatically flag it for oracle review?

---

### M3 — Multi-Agent Coordination Creates a Coherence Illusion

**The failure:** Each agent sees only its own worktree. The shared "state of the codebase" is a fiction — at any moment, 3 agents may have 3 divergent versions of `assembler.js` in-flight. An agent that does a `git pull --ff-only origin main` gets a snapshot that's already stale by the time it finishes reading. The `puzzle:status` script infers claimed state from worktrees — but worktrees are local. A remote agent has no visibility into another agent's worktree.

**Severity:** HIGH. What looks like a coherent codebase to any single agent is actually a quantum superposition of states. Decisions made on stale reads compound across agent turns.

**The questions that protect you:**
- What's the mean staleness (in minutes) of a `git pull` snapshot at the moment an agent begins editing, given observed session concurrency?
- Can a "heartbeat" commit (e.g., updating a per-agent status file every N minutes) provide enough cross-agent visibility without creating new merge conflicts?
- Is there a class of edits (e.g., to `src/utils/errors.js`) that are so central that any two concurrent agents touching them will always conflict?

---

### M4 — The Conventional Commits Audit Is Measuring the Wrong Thing

**The failure:** 98.3% CC format compliance sounds great. But the audit measures *format*, not *content*. A commit titled `fix: fix things` is 100% CC-compliant and 0% informative. Worse, the commit-msg hook enforces the format syntactically but not semantically. The "one type per commit" rule is enforced, but "does this description actually describe the change?" is not.

**Severity:** MEDIUM. Future agents (and humans) reading the history to understand a regression will be misled by well-formatted but content-empty messages.

**The questions that protect you:**
- What's the distribution of description word count in the CC era? Is there a lower tail of suspiciously short descriptions?
- Can you define an "informativeness score" for commit messages (e.g., presence of a file name, a function name, a behavior description) and audit the CC era against it?
- Does commit informativeness correlate with puzzle role (WRITER commits more informative than DEV commits)?

---

### M5 — The Puzzle-Driven Development Discipline Itself Is a Source of Technical Debt

**The failure:** PDD imposes a ≤60m hard cap (Yegor rule). This is a feature — it forces scope discipline. But it also means large refactors (like the mnemonic-switch → data-table rewrite, explicitly flagged as "do NOT attempt in one 60m task") are indefinitely deferred. The pile of "file as ARC sub-spike, then ≥2 puzzles" items in the quality hotspot doc is unbounded. Each deferred refactor compounds the "shadow hazard" risk it was meant to fix.

**Severity:** MEDIUM-HIGH. The system that prevents chaos in the short term may entrench architectural debt in the long term.

**The questions that protect you:**
- What's the current ratio of "deferred architectural work" (ARC/SPIKE tickets filed but not yet DEV-implemented) to "active implementation" tickets?
- Is there a measurable relationship between puzzle-age and implementation complexity (H estimate) for ARC-gated tickets?
- Can you model the compound interest rate of unaddressed hotspots — if H1 (`interpreter.js step()`) stays unrefactored for 6 months, what's the expected cost increase per DEV ticket that touches it?

---

### M6 — Agent Self-Audits Are Systematically Optimistic

**The failure:** The process-adherence self-audit (issue #203, agent APPLE) was honest and well-structured. But it was written *by the agent being audited, auditing itself*. The audit found "systemic misses" but also found its own "strengths." Any agent has a structural incentive to find fewer violations than actually exist — not from deception, but because it can only audit what it can observe, and the worst violations may be the least observable ones.

**Severity:** MEDIUM. The calibration data and process compliance metrics are partially self-reported. Self-reported metrics drift toward flattery over time.

**The questions that protect you:**
- Can cross-agent audits (BANANA audits APPLE's session) catch violations that self-audits miss? What's the delta?
- Is there a ground truth for "did the agent actually set C before reading the ticket" independent of the agent's own report? (Answer: yes — compare git timestamps of the `date` call vs. the `gh issue view` call in bash history.)
- What does the distribution of "self-audit severity ratings" look like vs. human reviewer ratings of the same sessions?

---

### M7 — The LCC+ Inheritance Architecture Will Cause a Catastrophic Regression Before the Data-Table Refactor Ships

**The failure:** The `CLAUDE.md` standing warning about plus-subclass shadowing has existed for the entire CC era. The quality hotspot analysis names it as H2 — the second-most-critical architectural issue. The fix is "large — file as an ARC sub-spike, then ≥2 puzzles." Every day this stays unrefactored, every agent touching `assembler.js` is one `default: super.handleInstruction()` call away from introducing a silent behavioral regression in LCC+ that the core tests won't catch.

**Severity:** HIGH. The probability of this failure increases monotonically with codebase activity.

**The questions that protect you:**
- Can you write a static analysis check that fires on any new `case` added to `handleInstruction` or `handleDirective` in core, prompting an agent to verify plus-subclass behavior?
- What's the smallest version of the data-table refactor that eliminates the shadow hazard without requiring the full rewrite? (Is there a "safety ratchet" available?)
- How many open bugs in `open_bugs.md` can be traced back to the plus-subclass shadow pattern?

---

### M8 — The Research Itself Changes the System Being Studied

**The failure:** This is the Observer Effect at the meta level. Every research ticket filed, every self-audit written, every learning documented changes the protocol the agents follow. The velocity data from the first 100 puzzles was collected under different norms than the last 100. Comparing them as if they were drawn from the same distribution is a statistical error. Worse, as this research document gets committed to the repo, future agents will read it and alter their behavior in response to it — making the "pre-document" and "post-document" agent populations non-comparable.

**Severity:** MEDIUM. Every finding you publish into the repo becomes a confound in subsequent data collection.

**The questions that protect you:**
- Can you construct a "stable measurement window" in the velocity data — a contiguous span where the protocol was documented and enforced consistently — and restrict all statistical analysis to that window?
- Is there a way to run "blind" experiments in this repo — where agents are given a modified protocol without being told it's experimental — to avoid Hawthorne effects?
- What would a pre-registration look like for lccjs experiments? (Specify hypothesis, measurement, and analysis plan before any agent touches the relevant code.)

---

## VII. Summary: The Meta-Question

All of the above converges on one question this codebase is uniquely positioned to answer:

> **Can a multi-agent AI development system maintain coherence, quality, and measurable calibration improvement over time — and if so, what are the minimal necessary conditions?**

lccjs currently has:
- ✅ Identity (fruit names, worktree ownership)
- ✅ Protocol (PDD, conventional commits, velocity logging)
- ✅ Ground truth (oracle parity tests)
- ✅ Self-reflection (self-audits, TILs, learnings)
- ⚠️ Partial data integrity (orphaned SHAs, post-hoc C estimates)
- ❌ Cross-agent observability (no heartbeat, no shared live state)
- ❌ Pre-registered experiments (all research is retrospective)

The opportunity is to close those last three gaps — and this codebase has exactly the right scale, instrumentation, and institutional memory to do it.

---

*Generated from direct codebase analysis of github.com/avidrucker/lccjs — commit history, velocity CSV (207 rows), workflow docs, quality hotspot analysis, multi-agent findings, and self-audit reports. June 2026.*
