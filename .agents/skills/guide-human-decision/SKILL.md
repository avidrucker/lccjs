---
name: guide-human-decision
description: Guides a human-decision ticket from context gathering through ruling and follow-through. Use when a ticket is labeled humans-only or human-decision-required, when the user asks to walk through a decision issue, or when sign-off is needed before implementation can proceed.
---

# Guide Human Decision

## Quick Start

Use this skill for decision tickets that need a human ruling before the work can continue.
Invoke it explicitly with `$guide-human-decision` when Codex should load it by name.

1. Fetch the issue and any linked comments or sibling tickets that already analyze options.
2. Reformat the problem into a short brief with one section per decision point.
3. For each point, state the options, the recommended ruling, and the reason.
4. Present the brief to the human and wait for the ruling.
5. After the ruling, execute the follow-through: post rulings on affected tickets, land trivial side-deps immediately, file implementation tickets, and close the coordination parent once all dependent work is resolved.

## Workflow

### 1. Gather Context

- Read the issue body first.
- Read all comments that contain prior options analysis, constraints, or decisions.
- Check sibling or parent tickets if the decision spans more than one issue.
- Treat the issue body as the source of truth when it conflicts with commentary.

### 2. Write The Decision Brief

Keep the brief scannable:

- `Decision point`
- `Current state`
- `Options`
- `Recommendation`
- `Why this is the best next step`

Use one decision point per subsection. Do not bundle unrelated rulings into one paragraph.

### 3. Ask For The Ruling

- Ask only for the decision the human needs to make now.
- Surface unresolved tradeoffs explicitly.
- If the human has already answered in comments, quote the ruling back in concise form before acting on it.

### 4. Execute The Follow-Through

After the ruling:

- Post the ruling on every affected ticket.
- Land trivial side-deps immediately, such as label creation or a small issue sweep.
- File implementation tickets for any non-trivial follow-up.
- Leave the coordination parent open until the dependent work is fully resolved, then close it.

## Notes

- This skill is for routing and ruling, not for broad PM decomposition.
- If the ticket still needs deeper scoping, route it through `yegor-pm` first.
- If the issue can be assigned directly without a human ruling, do not use this skill.
