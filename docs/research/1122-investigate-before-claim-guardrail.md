# #1122 — Guardrail for "investigate-before-claim / research-before-evidence"

**Ticket:** #1122 · **Author:** agent GRAPE (opus-4.8) · **Date:** 2026-06-06 · **Role:** RESEARCH
**Method:** read the existing evidence (per the very lesson of this ticket) rather than re-deriving —
#1121's authoritative findings doc, the #1122 body, error row id=59, `docs/claude_workflow.md`,
`scripts/preflight.js`, and `RULES.md`. No re-investigation of HONEYDEW's #1076 work.

## The process bug (what happened)

On 2026-06-06 an agent (CLAUDE/opus-4.8) was asked to *"file a ticket to investigate HONEYDEW's
work on #1076."* It instead performed the **full investigation inline on `main`** — `gh`/`git`
forensics, formed conclusions — and filed #1121, **before claiming any ticket**, **before capturing
a start timestamp**, and **before reading the evidence that already existed**
(`docs/logs/1076-honeydew-ticket-work-log.md`). Logged as **error row id=59** (`OTHER`, ticket #1121).

Two distinct failures, which is why one guardrail isn't enough:

- **(A) Work-before-claim.** A research/"file-a-ticket" request was treated as pre-work exempt from
  the claim → start-timestamp → work sequence. No worktree, no `started_iso`.
- **(B) Research-before-evidence.** Conclusions were published from `git`/`gh` archaeology alone; the
  primary source — a captured work log under `docs/logs/` — was never opened.

**Consequence:** #1121 shipped two wrong findings, both later corrected in
`docs/research/1121-research-findings-honeydew-review.md`:
1. A **stale-HEAD ordering bug** (close-comment hash captured by `git rev-parse HEAD` *before* the
   close commit existed) was mischaracterized as a *"confabulation."*
2. *"No review artifact was ever produced"* — false; the work log shows a full, well-formed rubric
   review (lines 34–148). It was real, merely **never persisted** to an auditable location.

The evidence the agent skipped contained the correct answer to both. That is the whole case for (B).

## Where should the guardrail live? (the investigation)

The ticket offers three candidate homes (RULES/workflow, memory, pre-flight) and invites "one or
more." Evaluated against where each failure is best *prevented*:

| Candidate | Fits (A) work-before-claim? | Fits (B) evidence sweep? | Decision |
|---|---|---|---|
| **`RULES.md`** | Partially — but already implied by Rule 4 (worktree) + Rule 6 (no unscoped work). | No — research-method guidance, which RULES explicitly relocates to `docs/`. | **Reject.** RULES is kept deliberately lean ("violating it on a *random* task is both plausible and harmful"); no commit was even made here, so Rule 4 wasn't literally breached. A new rule would dilute the file. |
| **`docs/claude_workflow.md`** ("At start") | ✅ Yes — this is where the claim→timestamp→work sequence and "what I do *not* do at start" already live. | ✅ Yes — slots in as a reading-sequence step alongside "read referenced docs" and "verify the repro." | **Adopt.** The durable, all-agents home. |
| **Memory (`feedback`)** | ✅ Directly reaches future *Claude* sessions — and this was a Claude lapse. | ✅ Same. | **Adopt.** Behavioral prevention for the agent that made the error. |
| **`scripts/preflight.js`** (enforced) | N/A (preflight runs *after* you decide to claim). | ✅ High-leverage — could auto-surface `docs/logs/*M*` / `docs/research/*M*` for any `#M` the issue references, at point-of-action. | **Defer to a follow-up DEV ticket.** It's a code+test change; bundling it into this RESEARCH ticket would violate one-deliverable-per-close (Rule 12). Filed separately. |

**Chosen placement: `docs/claude_workflow.md` + a `feedback` memory now; `preflight.js` automation as a filed follow-up.**

## What was added (this ticket's deliverable)

1. **`docs/claude_workflow.md` → "At start"** — two additions:
   - A callout reframing investigation/research/"file-a-ticket" requests as *claimable work*:
     scope or claim before producing findings; the moment you start producing findings, that's
     claimable work. (Carve-out: if the request is genuinely just "file the issue" with no findings
     yet, filing without a claim is fine.)
   - A new reading-sequence step: **sweep existing in-repo evidence** (`docs/logs/*`, `docs/research/*`,
     the subject's GitHub comments, any artifact it produced) for the subject ticket *before*
     reconstructing from `git`/`gh`. A captured work log / prior findings doc is primary source;
     git archaeology is the fallback.
2. **`feedback` memory** (`feedback_investigate_before_claim`) — same lesson, with the "why" and
   "how to apply," linked to [[process-adherence-fixes]] and [[deliberate-tool-pacing]].

## Follow-up filed

- **#1131** — `feat(scripts)`: have `npm run preflight <issue>` auto-surface existing evidence
  (`docs/logs/*M*`, `docs/research/*M*`) for every `#M` the issue body references, so the evidence
  sweep is enforced at point-of-action, not just documented.

## Cross-references
- #1121 (the inaccurate ticket this bug produced; corrected in its findings doc) · error row id=59
- #1105 / #1108 (HONEYDEW process audit) — the work this investigation was *about*, not the bug itself
