---
name: puzzle-triage
description: Ranks open issues into actionable, blocked, iceboxed, and human-routing groups. Use when asked what to work on next, to triage the backlog, or to rank issues without mutating tickets.
---

# Puzzle Triage

## Quick Start

Use this skill when Codex should recommend the next issue to work on.
Invoke it explicitly with `$puzzle-triage` when Codex should load it by name.
Do not auto-trigger it from a readiness greeting like "you are agent X, are you ready?".

1. Read the open issues, the ICE scores (`stats/ice-scores.csv`), and any supporting state that affects ranking.
2. Partition issues into actionable, blocked, iceboxed, and human-routing groups.
3. Rank actionable issues by ICE score first, then severity, then issue number.
4. Render the result in a scannable summary for the human.
5. Do not assign, close, relabel, or otherwise mutate tickets.

## Workflow

### 1. Gather Inputs

- Read the issue list or backlog view.
- Read the ICE scores from `stats/ice-scores.csv` (the committed, DB-derived export from `ice-score.js`). Join to issues by number. This is the ranking spine.
- Check labels and related context that affect routing.
- Include any supporting state needed to explain why an issue is blocked or iceboxed.

### 2. Partition The Queue

- `Actionable`: issues a Codex agent can pick up now.
- `Blocked`: issues waiting on an explicit dependency.
- `Iceboxed`: issues that are intentionally not next.
- `Human routing`: `humans-only`, `human-decision-required`, or similar tickets that need human sign-off first.

### 3. Rank Actionable Work

Sort actionable items by:

1. **Override tier** — `priority:critical` then `priority:elevated` always come first (these are the explicit "do before the normal queue" labels).
2. **ICE score** (`ice_score` from `stats/ice-scores.csv`), highest first. ICE = Impact × Confidence × Ease, so it already folds in severity (Impact is derived from it) plus confidence and ease — it is the holistic priority number.
3. **Severity** as a secondary tiebreaker when ICE is equal or missing.
4. **Issue number** as the final stable tiebreaker.

Show each row's ICE score so the ordering is legible. **Unscored** issues (no row in `stats/ice-scores.csv`) sort **last**, flagged as "needs ICE scoring" — never drop them. Keep the ordering explicit so the human can see why one ticket comes before another.

### 4. Render The Triage

Show a short, readable output with separate sections for:

- actionable work
- blocked work
- iceboxed work
- human-routing work

Call out the highest-priority next step first.

## Notes

- This skill is read-only.
- If the user just asks a readiness question, respond briefly and wait for a real work request instead of running triage.
- If the issue needs a human ruling before assignment, route it to `guide-human-decision`.
- If the user wants a full assignment broadcast, use `fruit-agent-orchestrate` instead.
