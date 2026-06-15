---
name: fruit-agent-orchestrate
description: Triage all open issues and produce copy-pasteable plain-paragraph work assignments for each named fruit agent (APPLE, BANANA, CHERRY, DRAGONFRUIT, ELDERBERRY, FIG, GRAPE, HONEYDEW, JACKFRUIT, KIWI).
---

# Fruit Agent Orchestrate

Use this skill when the user explicitly asks for `/fruit-agent-orchestrate` or wants a full assignment broadcast for the current backlog. This is a read-only orchestration skill: it ranks work, routes human-only tickets separately, and writes copy-pasteable assignments. It does not claim, relabel, close, or mutate issues.

## Quick Start

1. Gather the current queue and worktree state.
2. Split issues into actionable, blocked, iceboxed, and human-routing groups.
3. Rank actionable work by ICE score (`stats/ice-scores.csv`), then severity, then issue number.
4. Exclude tickets already in-flight in another agent's worktree, then assign the rest to fruit-agent lanes without overlapping code areas.
5. Render the final broadcast in scannable sections with one paragraph per agent.

## Sources Of Truth

Read these before synthesizing assignments:

- `docs/skills.md` for the live inventory entry and repo-specific notes
- `docs/claude_workflow.md` for claim, close, and routing conventions
- `docs/research/1008-fruit-orchestrate-redesign.md` for the token-cost redesign baseline
- `docs/research/827-second-wave-protocol-2026-06-05.md` for second-wave assignment behavior
- `docs/research/832-wave-composition-quality.md` for lane composition and load-balancing guidance

## Inputs To Gather

Use the smallest set of live state needed to make the broadcast accurate:

- open issues, labels, and current state
- local worktrees and claimed branches
- any sequencing or dependency markers that affect assignment
- existing human-routing labels such as `humans-only`, `decision`, and `human-decision-required`

Prefer reusable project helpers where possible. `puzzle-triage` owns the ranking logic — it ranks by **ICE score** (`stats/ice-scores.csv`, Impact × Confidence × Ease) then severity; reuse that order here. `guide-human-decision` owns human-routing tickets. Reuse those mental models instead of re-deriving them from scratch. (Full composition of `puzzle-triage` — so this skill inherits ICE automatically rather than re-stating it — is tracked in #1047.)

## Routing Rules

### 1. Skip Tickets Already In-Flight

Before assigning, exclude every ticket another agent is **actively working in a live worktree** — never double-book the same issue across two agents.

- From the `git worktree list` output gathered above, each non-main entry's branch is `<fruit>/issue-N-…`. The component before `/issue-` is the **busy agent**; issue `N` is **in-flight**.
- Drop every in-flight issue `N` from the assignable pool and mark that agent busy (don't assign it more work this cycle).
- **Surface, don't hide:** show in-flight work in the broadcast as `🔵 <FRUIT> — in-flight on #N, skip this cycle`, rather than silently omitting it, so the human can see *why* an agent was skipped and override if needed.

> Why parse `git worktree list` inline rather than call a tool: the data is already in the Step-1 output, so no extra subprocess is needed (#630 ruling, Q1 = A; Q2 = surface). The eventual cleaner home is the `puzzle:status --json` redesign (#1046), which reports `CLAIMED`/`IN-PROGRESS` directly. Origin repro: #1335.

### 2. Human-Routing First

Tickets labeled `humans-only`, `decision`, or `human-decision-required` do not belong in agent assignments. Put them in a separate human-routing section and leave them unassigned.

### 3. Preserve Lane Separation

Keep actionable tickets in non-overlapping lanes. Use `area:*` labels when they exist, and avoid assigning two fruit agents to the same code area in the same broadcast.

### 4. Keep Sequencing Explicit

If a ticket must wait on another ticket, surface that dependency in the assignment text. Do not hide sequencing constraints in prose elsewhere.

### 5. Keep Output Copy-Pasteable

Write short, direct paragraphs the receiving agent can act on immediately. Each paragraph should name:

- the ticket number
- the lane or area
- the reason it was assigned there
- any blocking dependency or human-routing note

## Output Shape

Render the broadcast with clear sections:

- `## Ranked work`
- `## 🧑 Requires human routing`
- one assignment paragraph per named fruit agent

Keep the tone factual and actionable. The user should be able to copy the paragraph into the next agent handoff without editing.

## Notes

- The redesign analysis in #1008 is the reference for reducing token cost, but the skill itself should preserve the established output contract.
- If a future pass needs to change the ranking algorithm or output shape, file a follow-up ticket rather than silently changing this skill.
