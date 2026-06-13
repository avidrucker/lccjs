---
name: issue-review
description: Review a GitHub issue for quality, clarity, and agent-readiness before work begins. Use when a user asks to review, improve, critique, score, quality-check, or make a GitHub issue or ticket agent-ready, including bug, DEV, research, architecture, docs, refactor, and test tickets.
---

# Issue Review

Review a GitHub issue for quality, clarity, and agent-readiness before work begins. Produce a structured verdict: `READY`, `NEEDS WORK`, or `BLOCK`, with specific feedback keyed to the issue type.

## When To Use

Use this skill when the user asks whether a ticket is ready, asks to review or improve an issue, asks to make a ticket agent-ready, or is doing triage/backlog grooming. Do not use this for PR review or code review.

## Invocation

Use `$issue-review` in Codex when you want this review workflow explicitly. Codex can also surface the skill from `/skills` by matching the description.

## Workflow

### 1. Fetch And Classify

Fetch the issue body, labels, title, and comments when an issue number is available:

```bash
gh issue view <N> --json number,title,labels,body,comments --jq '.'
```

Identify the primary type from labels, role prefix, title, and body: `bug`, `dev`, `research`, `architect`, `docs`, `refactor`, or `test`. If multiple role tags appear, apply each relevant type rubric and flag cross-role scope concerns.

### 2. Score Universal Rubric

Score each dimension from 1 to 3, based only on what is written in the issue.

| Dimension | 1 | 2 | 3 |
| --- | --- | --- | --- |
| Scope clarity | unclear in/out of scope | scope implied | scope explicit; out-of-scope stated if useful |
| Success criteria | no done condition | vague criteria | machine-verifiable or behaviorally unambiguous |
| File/path specificity | no files named | some files or incomplete paths | affected paths named; lines where useful |
| Single deliverable | unrelated work bundled | tightly coupled bundle | exactly one deliverable |
| Context sufficiency | cannot start | needs 1-2 clarifications | enough to begin immediately |

Verdict thresholds: `READY` = 13-15, `NEEDS WORK` = 9-12, `BLOCK` = 5-8.

### 3. Apply Type Checks

Read only the matching section in `references/type-rubrics.md`. Type checks add targeted required changes and diagnostic questions; they do not override the universal score threshold.

### 4. Produce The Review

```markdown
## Issue Review: #<number> - <title>

**Type:** <type>
**Verdict:** READY | NEEDS WORK | BLOCK

### Universal Rubric
| Dimension | Score | Notes |
| --- | --- | --- |
| Scope clarity | N/3 | ... |
| Success criteria | N/3 | ... |
| File/path specificity | N/3 | ... |
| Single deliverable | N/3 | ... |
| Context sufficiency | N/3 | ... |
| **Total** | N/15 | |

### Type-Specific Checks
<pass/warn/fail results from the matching type rubric>

### What's Working
<1-3 specific strengths with evidence from the issue text>

### Required Changes
<only for NEEDS WORK or BLOCK; number each blocker and include the exact question an agent cannot answer>

### Suggested Improvements
<non-blocking improvements that reduce ambiguity>

### Rewrite Hints
<only for NEEDS WORK or BLOCK; 1-3 before -> after examples for the weakest sections>
```

End by asking whether the user wants a full rewrite incorporating the required changes.

## Review Principles

- Score content, not presumed intent.
- Name the missing information and the agent question it blocks.
- Prefer concrete rewrites over vague advice.
- Flag bundled deliverables and suggest the split.
- Treat research tickets as findings-only unless a separate implementation issue exists.
- Keep acceptance criteria machine-verifiable or behaviorally unambiguous.
