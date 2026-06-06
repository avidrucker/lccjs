# Skill Inventory

This doc lists every Claude Code skill used in this project, what it does, and when to invoke it. Skills live globally at `~/.claude/skills/`.

---

## Project-specific

### `lccjs-assembly`
Write idiomatic, correct LCC assembly (`.a` files) for the lccjs toolchain — base ISA only. Encodes the calling-convention contract, register-role discipline, encoding-range gotchas, and branch-condition semantics that the ISA table alone doesn't convey.

**Invoke when:** writing, modifying, debugging, or explaining LCC `.a` programs.

**Notes from practice:**
- Output correctness is validated continuously by the oracle parity suite — no divergences traced to the skill's guidance.
- Agents rarely invoke it by name; the knowledge is applied implicitly. Consider making the invocation trigger more prominent for new agents.

### `lccplus-assembly`
Write idiomatic, correct LCC+ assembly (`.ap` files) — extended ISA with `.lccplus` directive and extras (`rand`/`srand`/`millis`/`nbain`/`clear`/`resetc`/`sleep`/`cursor`). Extends `lccjs-assembly`; read that skill too.

**Invoke when:** writing, modifying, debugging, or explaining LCC+ `.ap` programs.

**Notes from practice:**
- Coverage is narrower than `lccjs-assembly` (fewer oracle parity fixtures for plus programs). Gaps in extended-ISA instruction combinations may not be caught until a new program exercises them.

### `log-error`
Record significant agent errors into the lccjs errors table (`~/.lccjs/lccjs.db`) for retrospective analysis.

**Invoke when:** a tool call fails with work impact, `npm run claim` fails, a git/gh/DB operation fails, or a hook blocks a commit. Log via `npm run error:log`. Full column reference: [`docs/errors-schema.md`](./errors-schema.md). Current vocabulary: 15 `error_type` codes (added `GIT_STATE`, `GH_INFO`, `EDIT_PRECOND` in #936/#954).

**lccjs note:** error logging is a **manual, deliberate step** — not hook-triggered. Log once per significant error; skip transient retries that resolve immediately.

### `puzzle-velocity`
Track wall-clock time per puzzle/ticket with dual H/C estimates and a velocity log so forecasts can be calibrated over time.

**Invoke when:** picking up a ticket (capture start timestamp *before* reading the issue) or closing a ticket (capture finish timestamp *before* the closing commit). Log via `npm run velocity:log`.

**lccjs note:** run this skill's start-capture step before `gh issue view N` — the protocol depends on the timestamp preceding context-read.

**Notes from practice:**
- Foundational — 100% close coverage (every closed ticket logs a row). H/C dual-estimate discipline is followed consistently.
- CSV rebase conflicts are a recurring failure mode in parallel-agent sessions: the close script's auto-reexport can produce nested conflict markers. Manual resolution required ~3 times in the first two weeks.
- Timestamp discipline slipped for ~2 agents early on (started timestamp captured retroactively). Pre-flight capture is now in `do-this-not-that.md`.

### `puzzle-triage`
Rank open issues by severity then Yegor priority, split out blocked/iceboxed work, render with color-coded emoji.

**Invoke when:** asked "what should I work on next?", "triage the backlog", or "rank the issues". Read-only — recommends only.

**lccjs note:** never fire on an agent-readiness greeting ("you are agent X, are you ready?"). Respond with a short confirmation and wait for a real work request.

**Notes from practice:**
- Misfired on agent-readiness greetings before the lccjs note was added (#377). Stable since fix — zero recurrences reported.
- Works well for ranking and identifying blocked work, but cannot distinguish `humans-only` tickets from agent-grabbable ones without label awareness.

### `fruit-agent-orchestrate`
Triage all open issues and produce copy-pasteable plain-paragraph work assignments for each named fruit agent (APPLE, BANANA, CHERRY, DRAGONFRUIT, ELDERBERRY, FIG, GRAPE).

**Invoke when:** the user types the exact text `/fruit-agent-orchestrate`. Never trigger from description alone.

**Notes from practice:**
- Successfully orchestrated 7 concurrent agents on 2026-06-04 with no merge conflicts when cluster-separation rules were followed.
- Filters out tickets labeled `humans-only`, `decision`, or `human-decision-required` before assignment (fixed #888). These appear in a separate `## 🧑 Requires human routing` section in the output so the human is aware; no agent is assigned. The `guide-human-decision` skill handles them when a human explicitly routes one.
- Area-aware lane assignment added in #961: Step 5 now groups actionable issues by `area:*` label before assigning agents, so no two agents are assigned to the same code area. Issues without an `area:*` label are treated as wildcards and distributed to the lightest-loaded agents; each agent's assignment paragraph names their area lane explicitly.
- STUB sections in the output are intentional — the orchestrator identifies gaps it cannot fill.

### `guide-human-decision`
Walk the human through a decision ticket — fetch context (including pre-existing options analyses in issue comments), reformat into a scannable brief with per-question recommendations, receive the ruling, then execute: post rulings on affected tickets, land trivial side-deps immediately (label creation + issue sweep), file implementation tickets, close the coordination parent once fully resolved.

**Invoke when:** a ticket is labeled `humans-only` or `human-decision-required`, when the user says "let's address together" or "walk me through" a decision issue, or when any ticket requires human sign-off before implementation can proceed.

**lccjs note:** `decision` tickets are appropriate for this skill when a human *directs* an agent at them. The orchestrator (`fruit-agent-orchestrate`) correctly skips `decision` tickets from auto-assignment — these are intentionally asymmetric behaviors.

**Notes from practice:**
- First full deployment was #798 (R2/R6 ratification, 2026-06-05) — structured walkthrough of six decisions across related issues. The scan-and-brief pattern worked well; the human could rule quickly because options were pre-loaded.
- Skill added to this inventory late (2026-06-05 in #887), though it was in use earlier. Gap: no lccjs-specific guidance on what "trivial side-deps" look like in this project's context (label creation is low-cost; issue filing is higher).

### `next-best-action`
Pre-close checklist that catches findings that should be filed as tickets before the close commit.

**Invoke when:** before every `npm run close N` — no exceptions — to ensure no follow-on issues are lost at close time.

**Notes from practice:**
- The underlying checklist (C-1/C-2/C-3 failure modes from `docs/research/orchestration-failure-modes.md`) is sound and has been manually applied, but agents do not consistently invoke the skill itself before closing.
- Gap: `next-best-action` is documented in `claude_workflow.md` but not wired as a mandatory close step in RULES.md. The checklist produces the most value on RESEARCH and ARCHITECT closes, where findings are most likely to disappear without follow-on tickets. See #886/#887 for context.

---

## Workflow / PM — Yegor family

### `yegor-pm`
Meta-orchestrator for the 10 Yegor sub-skills below. Distilled from Yegor Bugayenko's XDSD methodology.

**Invoke when:** planning work, breaking down tasks, managing issues, reviewing progress or code, writing tests, or deciding on workflow approach. Routes to the appropriate sub-skill.

**Notes from practice:**
- Rarely invoked directly — agents tend to invoke the specific sub-skill they need. Useful for orientation in a new session but not a day-to-day touchpoint.

### `yegor-pdd`
Apply Puzzle Driven Development: convert deferred sub-problems into structured `@todo #N:Est/ROLE description` comments at the code site. Each puzzle references a parent ticket and carries a ≤60m estimate.

**Invoke when:** writing stubs, reviewing TODO comments, or deferring sub-problems during implementation.

**Notes from practice:**
- Foundational — adopted from project start. Marker format and scan coverage are stable.
- One early incident: BANANA left a stale `@todo` marker after closing #449, which clarified the delete-on-close rule now in `claude_workflow.md`. The `@inprogress` flip convention was also refined from practice.
- The `at_todo` lowercase placeholder rule (for docs mentioning the marker concept) was discovered late and is now documented in `claude_workflow.md` PDD scan section.

### `yegor-bdd`
Apply Bug Driven Development: frame every piece of work as a complaint with shape "have X / should have Y / repro". No feature requests, no suggestions, no questions.

**Invoke when:** filing, reviewing, or closing issues. The complaint is best expressed as a failing/disabled test that proves the bug. Only the reporter closes a ticket.

**Notes from practice:**
- The "deferred work → ticket immediately" rule (Rule 10, RULES.md) propagated widely across agents within days of being codified (#490). Strong adoption.
- Less consistently applied to pure docs/WRITER tickets where the "repro" framing is awkward. Agents sometimes write feature-request framing for doc tickets. No major harm, but worth noting.

### `yegor-microtasks`
Cap every task at ~60 minutes (default 30m). Budget is fixed at creation. If overrun: stop, split leftover into `@todo` puzzles, close the original with what's done.

**Invoke when:** estimating, planning, starting work, or when a task is running over budget.

**Notes from practice:**
- The 60m cap is respected structurally (estimates in issue bodies) but Claude agents rarely actually hit the cap — most ARC/WRITER closes land under 10 minutes wall-clock. H estimates are for human-effort discipline; C estimates are the calibration target for agents.

### `yegor-tickets`
All meaningful project communication lives in the issue tracker. Decisions don't exist until written as a ticket comment. No Slack, DMs, or meetings as the primary channel.

**Invoke when:** making a design decision, changing direction, answering a project question, or proposing a new approach.

**Notes from practice:**
- Well-followed. The "file unilaterally, don't ask permission" rule (#511) is the highest-impact single rule derived from this skill's philosophy.

### `improve-codebase-architecture`
Surface architectural friction and propose "deepening opportunities" — refactors that turn shallow modules into deep ones. Uses a consistent vocabulary (Module, Interface, Implementation, Depth, Seam, Adapter, Leverage) applied to any codebase CONTEXT.md and ADR docs.

**Invoke when:** a broad architectural review is needed across multiple modules at once, or when the work is cross-cutting enough that `yegor-architect` (which governs a single in-session design decision) is the wrong tool.

**Prefer `yegor-architect` over this skill when:** you're making a scoped design ruling for one in-flight ticket. `yegor-architect` governs architect-mode vs courier-mode discipline for a single task. `improve-codebase-architecture` is a fleet-wide sweep that identifies the next round of deepening work — best used after a stable sprint to generate ARC backlog, not during active feature work.

---

### `yegor-architect`
Separate architect mode (design in writing) from courier mode (execute agreed design). Never mix the two in one session. When tempted to redesign mid-implementation, stop and drop a puzzle.

**Invoke when:** starting fuzzy work, mid-implementation drift, or reviewing a PR.

**Notes from practice:**
- No reported architect/courier confusion incidents. The mode-separation discipline appears to be working — ARC tickets produce comment rulings, DEV tickets execute against them.

### `yegor-velocity`
Velocity is closed tickets per week — commits, hours, and lines don't count. Reporter verifies; closure comment names the deliverable.

**Invoke when:** reviewing progress, answering "how's it going?", or measuring productivity.

**Notes from practice:**
- The SQLite-backed velocity log is the authoritative source; the CSV export is read-only. CSV integrity is gate-tested on push.
- Known open issue: agent identity casing in the velocity log was inconsistent (#669) — the canonical form is lowercase fruit name (e.g. `grape`, not `GRAPE`) in the DB `agent` column. Fixed in the schema; old rows are inconsistent.

### `yegor-nohelp`
Knowledge sharing happens through documentation, not by tapping experts. Questions become tickets; answers land in docs. When you'd ask the same question twice, write it down.

**Invoke when:** answering project-specific questions, debugging, or discovering non-obvious behavior.

**Notes from practice:**
- The TIL / `docs/learnings/` infrastructure is the concrete embodiment of this skill — 61+ entries in the first 10 days of parallel-agent operation.

### `yegor-review`
Code-review discipline: the reviewer's job is to REJECT, not to bless. Find the 3 most critical problems, apply the Four NOs, never run the code (a runtime-only bug is a missing test — file it).

**Invoke when:** reviewing a PR/diff, giving or receiving review feedback.

**Notes from practice:**
- Paired with the built-in `/code-review` slash command. The two complement each other: `yegor-review` gives the discipline, `/code-review` gives the automation.

### `yegor-unit-tests`
Unit-test quality checklist: named anti-patterns (Liar, Inspector, Mockery, Happy Path, Giant, Free Ride, …) plus positive rules — descriptive names, real assertions, isolation, speed, fakes over mock frameworks.

**Invoke when:** writing, reviewing, or refactoring unit tests.

**Notes from practice:**
- Anti-pattern vocabulary (especially "Happy Path" and "Inspector") has been useful in review comments. Oracle parity tests are the main test surface and mostly avoid these patterns.

### `io-layer-testing`
Protocol-based IO-layer testing: stand-in implementations for fast development cycles, real-resource integration tests with availability guards, and pattern discipline for testing anything that touches an external system.

**Invoke when:** writing tests for interpreter trap handlers (stdin, stdout, file traps), testing the pure-API / CLI-wrapper boundary, or adding integration tests for any external-resource call (DB, filesystem, subprocess).

**lccjs note:** the "IO layer" in lccjs is the `src/utils/` boundary — pure seams like `executeBuffer()` own no I/O; CLI wrappers own all of it. This skill's protocol-abstraction pattern maps directly to writing tests that verify the seam: inject a fake transport, assert the pure function's behavior, then confirm the wrapper wires it correctly. Particularly relevant for trap-handler tests in `interpreter.integration.spec.js` and for any new trap that reads from stdin.

---

### `yegor-spikes`
Bounded ≤60m research/scope sessions to discover code sites, current state, open questions, and ROI before writing any `@todo` puzzle.

**Invoke when:** a GH issue is too vague or too large to add a meaningful `@todo` — scope it first, puzzle later.

**Notes from practice:**
- Strong adoption — spike → child tickets → implementation is the standard pattern for any fuzzy feature area. The `docs/research/` directory holds most spike outputs.

---

## Workflow — Other

### `handoff`
Compact the current conversation into a handoff document so a fresh agent can pick up where you left off.

**Invoke when:** ending a session **mid-task** — when a puzzle is still open and another agent (or a future session) must continue. The output is a dense context dump: current state, blockers, next step. Not a permanent record — it expires when the task is done.

**Do NOT use for:** end-of-session retrospectives or documenting lessons. That is `write-til-doc`.

**Notes from practice:**
- Little evidence of invocation in TIL docs — agents tend to commit WIP and leave the issue in progress rather than writing a handoff. Potentially underused; may be most valuable in long debugging sessions where context is dense.

### `write-til-doc`
Guide an agent through writing, filing, and closing a TIL (Today I Learned) entry in `docs/learnings/`.

**Invoke when:** the **session is ending** (or a puzzle is closed) and a non-obvious lesson emerged — process friction, a tooling gotcha, a workflow fix. The output is a permanent learning entry. Requires a worktree, a velocity row, and a closing commit — not a casual note.

**Do NOT use for:** mid-task handoffs. That is `handoff`. Write-TIL is end-of-session only.

**Notes from practice:**
- High adoption: 61+ TIL entries across all agents in the first 10 days of parallel operation.
- `docs/learnings/README.md` index lag was a recurring gap — new TILs were written but not indexed (synthesis 2026-06-04 N-4). README hygiene is a known maintenance burden.
- Human-approval gate removed in #921 (2026-06-05): Step 1 now proceeds directly from draft to file-issue → claim → commit without pausing. Corrections go in a follow-up, not a mid-close round-trip.

---

## Setup

### `setup-cowork`
Guided Cowork setup — install role-matched plugins, connect tools, try a skill.

**Invoke when:** configuring a new environment or onboarding a new agent identity to the project.

---

## Skills adopted organically (added late)

These skills were not in `docs/skills.md` when lccjs started. Each was adopted after a concrete friction point made the gap visible.

| Skill | When adopted | Trigger |
|-------|-------------|---------|
| `puzzle-triage` | 2026-05-28 | Agents were grabbing wrong tickets without a priority signal |
| `write-til-doc` | ~2026-05-29 | TIL writing became routine but the filing workflow was inconsistent |
| `fruit-agent-orchestrate` | 2026-05-31 | First 7-agent parallel session needed structured assignment output |
| `next-best-action` | 2026-06-03 | CHERRY's close of #610 left follow-on proposals un-ticketed; checklist codified |
| `guide-human-decision` | 2026-06-05 | #726 (FIG blocked on a routine action) and #798 (R2/R6 session needing a structured walkthrough) showed human-gating decisions need their own pattern |

---

## Untried / worth trying from global registry

Skills available globally that have not been formally used in lccjs, with a one-line assessment:

| Skill | Try? | Rationale |
|-------|------|-----------|
| `superpowers:systematic-debugging` | **Yes** | Oracle parity debugging sessions are complex; a structured approach would reduce thrash |
| `superpowers:test-driven-development` | **Yes** | Complements `yegor-unit-tests` for feature work; TDD discipline is already practiced but not skill-guided |
| `deep-research` | **Yes** | Useful for RESEARCH-role tickets like #886; provides a structured multi-source sweep |
| `decomplect` | **Yes (spike first)** | Vocabulary matches the #246 hotspot family; verify the skill's framing aligns with lccjs usage before adding to inventory |
| `diagnose` | Maybe | Useful for complex failures; overlap with `superpowers:systematic-debugging` is unclear — read both before deciding |
| `guardrails` | Maybe | Scope/safety discipline; partially covered by `yegor-microtasks` + `claude_workflow.md` already |
| `improve-codebase-architecture` | **Promoted** — see active inventory entry | Added in #976; prefer over `yegor-architect` for fleet-wide sweeps |
| `handoff-archive` | Skip for now | `handoff` is already underused; adding archive variant before the base skill is established adds complexity |
| `clojure` / `fulcro` family | Skip | Not applicable — lccjs is a JavaScript project |

---

## What's next

Concrete improvement candidates, in rough priority order:

1. **Wire `next-best-action` into the mandatory close sequence.** Currently documented but not enforced. A one-line addition to RULES.md or `claude_workflow.md`'s "At close" section would prevent findings from evaporating at close time. (#886 research may refine this recommendation.)

2. ~~**Fix `fruit-agent-orchestrate` to skip `humans-only` and `decision` tickets.**~~ Fixed in #888 — the skill now partitions these labels into a `## 🧑 Requires human routing` section and omits them from agent assignments.

3. ~~**Trial `io-layer-testing` and add it to this doc if useful.**~~ Added in #975 — see the `io-layer-testing` entry under Workflow / Yegor family.

4. **Add `superpowers:systematic-debugging` to this inventory.** Oracle parity debugging is the hardest category of work in this project; structured debugging guidance would reduce multi-turn thrash.

5. **Spike `decomplect` skill alignment.** The `decomplect` ticket family (#246, #252, #255) uses this word deliberately — check whether the global skill's framing matches and whether it should be added to this inventory.

6. **Improve `lccplus-assembly` coverage.** The LCC+ parity fixture set is thinner than the core set. Filing a SPIKE for coverage gaps would help ensure the skill's guidance is validated against real programs.
