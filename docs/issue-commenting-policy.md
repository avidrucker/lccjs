# Issue Commenting Policy

Governs when agents may, must, and must not post GitHub issue comments or open new issues.

Canonical reference — link here from workflow docs and skills. See also: `docs/claude_workflow.md` "close sequence" (required closing comment) and "While continuing" (correcting issue bodies).

Motivated by: #726 (FIG blocked by auto-classifier on a routine closing comment), #848 (this policy).

---

## Required — must post

| Situation | What to post |
|-----------|-------------|
| **Closing a puzzle** | One closing comment summarising what landed, posted after `npm run close` succeeds. See "After the push" step 3 in `claude_workflow.md`. Use past-tense headings ("What was done:", "What changed:") so readers can distinguish retrospective from prescription. |
| **Correcting an issue body** | `~~strikethrough~~` the wrong text in place + `> ⚠️ **SEE COMMENTS FOR CORRECTIONS**` banner at top + correction comment. Never silently rewrite the body. Full convention: `yegor-tickets` skill, `claude_workflow.md` "While continuing". |
| **Blocking discovery** | If you discover the issue is blocked by something not described in the body, post once naming the blocker and stop work. Do not attempt to route it yourself — surface it for human triage. |

## Permitted — may post, not required

| Situation | What to post |
|-----------|-------------|
| **Research or spike finding** | A comment that directly answers an open question stated in the issue body. One comment; do not thread. |
| **Deliberate scope exclusion** | "X was out of scope; filed #N." One sentence, no elaboration. |

## Prohibited — must not post

- Progress updates ("I'm working on this now", "halfway done", "just started step 2")
- Intermediate findings that don't change the issue's status or scope
- Restating what the issue body already says
- Anything whose content belongs in the commit message or PR description — don't duplicate it as a comment
- Agent-chatter: any comment that would be redundant if another concurrent agent posted first

## Solo vs orchestrator contexts

**Solo agents** (single agent assigned to a ticket):
- May post when required or permitted (above).
- Must not open new issues without PM authorization **unless** the active workflow explicitly names issue-filing as a step — e.g., the "surface findings" rule in `claude_workflow.md` "While continuing", or the `yegor-bdd` spike → puzzle pipeline.

**Orchestrator agents** (directing sub-agents across a multi-phase workflow):
- May explicitly authorize sub-agents to comment or open issues as part of a defined workflow phase.
- Must document which phases carry that authorization in the workflow script — a one-line comment is sufficient: `// Phase 2: sub-agents may post a blocking-discovery comment if applicable`.
- Must not issue blanket session-wide authorization ("agents may comment whenever"). Authorization is per-phase.
- In orchestrated runs, designate one phase as the comment-poster when multiple sub-agents would otherwise each decide independently to comment on the same event.

## Authorization surface

The project `.claude/settings.json` pre-authorizes `gh issue comment *` — routine closing comments do not require a per-session human grant, and the auto-classifier will not block them.

`gh issue create` is **not** in the allowlist. Opening a new issue requires either:
1. A per-session explicit human grant (the auto-classifier will prompt), or
2. Orchestrator authorization documented as a named workflow phase.

**Do not add `gh issue create *` to the project allowlist.** Creating issues is a permanent public action; the prompt serves as a deliberate checkpoint, not an annoyance. Pre-authorizing it removes the only gate between a runaway agent and a flooded tracker.

The correct default split:
- Comment on existing issue → pre-authorized (low-risk, routine)
- Open a new issue → requires intentional authorization (permanent record, public)
