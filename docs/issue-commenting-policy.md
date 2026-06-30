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
- Must not open new issues without PM authorization **unless** the active workflow explicitly names issue-filing as a step — e.g., the "surface findings" rule in `claude_workflow.md` "While continuing", or the `yegor-bdd` spike → puzzle pipeline. **A ticket's own acceptance criteria prescribing child-filing is *not* this exception** — proactively ask for an explicit human go-ahead first (see "Acceptance criteria are not authorization", #1448).

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

### Acceptance criteria are not authorization (#1448)

A ticket whose **acceptance criteria** prescribe filing child / DEV / follow-up
tickets (e.g. a spike whose acceptance reads *"file the DEV puzzles for each
sub-item"*) does **not** thereby authorize `gh issue create`. The auto-mode
classifier does not read a ticket's acceptance criteria as a grant — and, by
deliberate project choice, it **should not**: issue creation stays approval-gated
on purpose (see "Do not add `gh issue create *`" above; same classifier behavior
as #623 for comments and #1181 for `AskUserQuestion` options).

So when a solo agent reaches a prescribed filing step, the acceptance criteria
make the filing **in scope** but do not replace the human grant. The agent must:

1. **Proactively ask the human for an explicit, free-text go-ahead** before
   creating the issue — state what it intends to file and why. (A prior
   `AskUserQuestion` answer does **not** count as authorization in the
   classifier's eyes, #1181 — the go-ahead must be the human's own free-text
   words.)
2. Only then run `gh issue create`.

This recurring prompt is the **intended deliberate checkpoint**, not an
annoyance to engineer away — the owner has chosen to keep issue creation
approval-gated rather than allowlist it. The "active workflow explicitly names
issue-filing as a step" exception under *Solo vs orchestrator contexts* above is
the narrow case where an **orchestrator** has documented a filing phase (the
authorization is the documented phase, granted by the human running the
orchestrator) — a solo agent's reading of its **own** ticket's AC is not that.
