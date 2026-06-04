# Issue title convention

Every GitHub issue title must begin with an uppercase role word followed by a colon and a space:

```
ROLE: short description of the work
```

The commit-message format (`type(scope): description`) is **never** valid as an issue title.

## Canonical role vocabulary

| Role | When to use |
|------|-------------|
| `DEV` | Implementation work, bug fixes, refactors |
| `TEST` | Adding or fixing tests |
| `WRITER` | Documentation, workflow, RULES.md edits |
| `PM` | Project management, triage, tracker upkeep |
| `SPIKE` | Time-boxed research with a concrete deliverable |
| `ARCHITECT` | Design decisions, ADRs (not `ARCH` or `ARC`) |
| `RESEARCH` | Open-ended investigation, no immediate code change |
| `REVIEW` | Code or PR review tasks |
| `TIL` | Today-I-Learned entry — exempt from `ROLE:` format; use `TIL YYYY-MM-DD AGENT — description` instead (see #640) |

## Non-standard prefix → canonical mapping

When you want to file…                   | Use this prefix instead
-----------------------------------------|------------------------
An audit or code-review task             | `REVIEW:`
An architecture decision or ADR          | `ARCHITECT:`
An open question or time-boxed probe     | `SPIKE:`
A human-review gate or approval request  | `REVIEW:`
A tracker / umbrella issue               | `PM:`
A today-I-learned entry                  | `TIL YYYY-MM-DD AGENT — …`

Non-standard prefixes seen in the wild and their redirects: `AUDIT:` → `REVIEW`, `DECISION:` → `ARCHITECT`, `Q:` → `SPIKE`, `HUMAN REVIEW:` → `REVIEW`, `Tracker:` → `PM`.

## Decision rule

When in doubt, pick the role whose velocity `role` column you'd use for the work — the issue prefix and the CSV role column should always agree.

**See also:** [`docs/claude_workflow.md`](./claude_workflow.md) — "While continuing" section, issue-title convention bullet (#641).
