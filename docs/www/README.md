# docs/www/ — What Went Wrong

Post-session error logs. Each file records what went wrong during a session, the cost of each mistake, and a concrete prevention recommendation.

## Purpose

WWW docs are a structured retrospective — not a diary and not a blame record. The goal is to convert session errors into prevention actions: memory entries, doc edits, skill updates, script fixes, or new tickets. The WWW doc is the *input* to those follow-ups, not the output.

## When to write one

At the end of any session where at least one non-trivial error occurred. Encouraged but not mandatory — a session of purely routine work with no mistakes doesn't need one. If you're unsure, a short doc is better than no doc.

## Naming convention

```
YYYY-MM-DD-<agent>-<issue>.md
```

- `YYYY-MM-DD` — date of the session (not the filing date)
- `<agent>` — lowercase agent name (e.g. `banana`, `grape`)
- `<issue>` — the primary issue number the session was working on

Example: `2026-06-04-banana-791.md`

## Format

Each file follows this structure:

```
# WWW — <AGENT> session <DATE> (#<issue> short title)

## What went wrong

### 1. <Short error title>
**What happened:** ...
**Cost:** ...
**Prevention:** ...

### 2. ...

---

## Root-cause themes
| Theme | Count |
|---|---|
| ... | N |

---

## Recommendations
### Immediate (memory / docs)
- ...
### Medium-term (skill / docs)
- ...

---
*Agent: <AGENT> · Model: <model> · Date: <date>*
```

Number errors sequentially. Each error gets: what happened, its cost (iterations, wasted time, downstream impact), and a concrete prevention action. The root-cause theme table groups errors so patterns are visible across sessions.

## What happens next

Findings in the Recommendations section are expected to produce follow-up work. Typical outputs:

- **Memory entries** — immediate, in-session (e.g. `codemirror6-cdn-fix.md`)
- **`docs/do-this-not-that.md` entries** — for patterns that affect all agents
- **Skill updates** — for recurring workflow mistakes
- **Script fixes** — for tooling that made the error easy or uncatchable
- **New tickets** — for anything requiring a separate worktree (file via `gh issue create`)

A WWW doc with no follow-up actions is incomplete. If a mistake has no prevention path, say so explicitly.

## Relation to other docs

| Doc | Purpose |
|---|---|
| `docs/www/` | *What went wrong this session* — post-mortem input |
| `docs/learnings/` | *TIL entries* — distilled facts promoted from sessions |
| `docs/do-this-not-that.md` | *Evergreen do/don't pairs* — generalised from learnings and WWW findings |
| `docs/pitfalls.md` | *Assembly-level surprises* — ISA-specific gotchas, not workflow errors |
