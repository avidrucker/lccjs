# Skill Inventory

This doc lists every Claude Code skill used in this project, what it does, and when to invoke it. Skills live globally at `~/.claude/skills/`.

## Project-specific

### `lccjs-assembly`
Write idiomatic, correct LCC assembly (`.a` files) for the lccjs toolchain — base ISA only. Encodes the calling-convention contract, register-role discipline, encoding-range gotchas, and branch-condition semantics that the ISA table alone doesn't convey.

**Invoke when:** writing, modifying, debugging, or explaining LCC `.a` programs.

### `lccplus-assembly`
Write idiomatic, correct LCC+ assembly (`.ap` files) — extended ISA with `.lccplus` directive and extras (`rand`/`srand`/`millis`/`nbain`/`clear`/`resetc`/`sleep`/`cursor`). Extends `lccjs-assembly`; read that skill too.

**Invoke when:** writing, modifying, debugging, or explaining LCC+ `.ap` programs.

### `puzzle-velocity`
Track wall-clock time per puzzle/ticket with dual H/C estimates and a velocity log so forecasts can be calibrated over time.

**Invoke when:** picking up a ticket (capture start timestamp *before* reading the issue) or closing a ticket (capture finish timestamp *before* the closing commit). Log via `npm run velocity:log`.

**lccjs note:** run this skill's start-capture step before `gh issue view N` — the protocol depends on the timestamp preceding context-read.

### `puzzle-triage`
Rank open issues by severity then Yegor priority, split out blocked/iceboxed work, render with color-coded emoji.

**Invoke when:** asked "what should I work on next?", "triage the backlog", or "rank the issues". Read-only — recommends only.

**lccjs note:** never fire on an agent-readiness greeting ("you are agent X, are you ready?"). Respond with a short confirmation and wait for a real work request.

### `fruit-agent-orchestrate`
Triage all open issues and produce copy-pasteable plain-paragraph work assignments for each named fruit agent (APPLE, BANANA, CHERRY, DRAGONFRUIT, ELDERBERRY, FIG, GRAPE).

**Invoke when:** the user types the exact text `/fruit-agent-orchestrate`. Never trigger from description alone.

### `next-best-action`
Pre-close checklist that catches findings that should be filed as tickets before the close commit.

**Invoke when:** before every `npm run close N` on any substantive puzzle, to ensure no follow-on issues are lost.

---

## Workflow / PM — Yegor family

### `yegor-pm`
Meta-orchestrator for the 10 Yegor sub-skills below. Distilled from Yegor Bugayenko's XDSD methodology.

**Invoke when:** planning work, breaking down tasks, managing issues, reviewing progress or code, writing tests, or deciding on workflow approach. Routes to the appropriate sub-skill.

### `yegor-pdd`
Apply Puzzle Driven Development: convert deferred sub-problems into structured `@todo #N:Est/ROLE description` comments at the code site. Each puzzle references a parent ticket and carries a ≤60m estimate.

**Invoke when:** writing stubs, reviewing TODO comments, or deferring sub-problems during implementation.

### `yegor-bdd`
Apply Bug Driven Development: frame every piece of work as a complaint with shape "have X / should have Y / repro". No feature requests, no suggestions, no questions.

**Invoke when:** filing, reviewing, or closing issues. The complaint is best expressed as a failing/disabled test that proves the bug. Only the reporter closes a ticket.

### `yegor-microtasks`
Cap every task at ~60 minutes (default 30m). Budget is fixed at creation. If overrun: stop, split leftover into `@todo` puzzles, close the original with what's done.

**Invoke when:** estimating, planning, starting work, or when a task is running over budget.

### `yegor-tickets`
All meaningful project communication lives in the issue tracker. Decisions don't exist until written as a ticket comment. No Slack, DMs, or meetings as the primary channel.

**Invoke when:** making a design decision, changing direction, answering a project question, or proposing a new approach.

### `yegor-architect`
Separate architect mode (design in writing) from courier mode (execute agreed design). Never mix the two in one session. When tempted to redesign mid-implementation, stop and drop a puzzle.

**Invoke when:** starting fuzzy work, mid-implementation drift, or reviewing a PR.

### `yegor-velocity`
Velocity is closed tickets per week — commits, hours, and lines don't count. Reporter verifies; closure comment names the deliverable.

**Invoke when:** reviewing progress, answering "how's it going?", or measuring productivity.

### `yegor-nohelp`
Knowledge sharing happens through documentation, not by tapping experts. Questions become tickets; answers land in docs. When you'd ask the same question twice, write it down.

**Invoke when:** answering project-specific questions, debugging, or discovering non-obvious behavior.

### `yegor-review`
Code-review discipline: the reviewer's job is to REJECT, not to bless. Find the 3 most critical problems, apply the Four NOs, never run the code (a runtime-only bug is a missing test — file it).

**Invoke when:** reviewing a PR/diff, giving or receiving review feedback.

### `yegor-unit-tests`
Unit-test quality checklist: named anti-patterns (Liar, Inspector, Mockery, Happy Path, Giant, Free Ride, …) plus positive rules — descriptive names, real assertions, isolation, speed, fakes over mock frameworks.

**Invoke when:** writing, reviewing, or refactoring unit tests.

### `yegor-spikes`
Bounded ≤60m research/scope sessions to discover code sites, current state, open questions, and ROI before writing any `@todo` puzzle.

**Invoke when:** a GH issue is too vague or too large to add a meaningful `@todo` — scope it first, puzzle later.

---

## Workflow — Other

### `handoff`
Compact the current conversation into a handoff document so a fresh agent can pick up where you left off.

**Invoke when:** ending a session mid-task or handing off to another agent.

### `write-til-doc`
Guide an agent through writing, filing, and closing a TIL (Today I Learned) entry in `docs/learnings/`.

**Invoke when:** the user says "write a TIL", "write up what you learned", "add to learnings", or requests a session retrospective. Requires a worktree, a velocity row, and a closing commit — not a casual note.

---

## Setup

### `setup-cowork`
Guided Cowork setup — install role-matched plugins, connect tools, try a skill.

**Invoke when:** configuring a new environment or onboarding a new agent identity to the project.
