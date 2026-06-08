---
name: next-best-action
description: Use before declaring an lccjs ticket complete or running `npm run close N` to catch follow-up tickets, missing close steps, deferred decisions, and unlogged errors that would otherwise evaporate at close time.
---

# Next Best Action

Run a short pre-close checklist before you say the work is done. This Codex skill is repo-local and version-controlled with the lccjs repository.

## When To Use

Use this skill:

- before every substantive `npm run close N`
- before saying a ticket is complete
- when deciding whether a session is truly ready to close
- after research, spike, docs, PM, or code work that may have produced follow-up findings

Skip only for pure velocity-log-only closes or sub-minute clarification turns with no deliverable.

## Sources Of Truth

Read these repo docs instead of relying on memory:

- `RULES.md` for the mandatory close and follow-up-ticket rules
- `docs/claude_workflow.md` for the full close sequence and the detailed wording of the pre-close audits
- `docs/skills.md` for the local skill inventory and project-specific invocation note
- `docs/research/orchestration-failure-modes.md` when naming recurring process failures

Use companion skills instead of re-deriving their rules:

- `log-error` when this checklist finds an error that still needs a row
- `puzzle-velocity` when preparing the velocity row and final close sequence

## Inputs To Check

Read these before answering the checklist:

1. `git diff origin/main` to see what actually changed
2. `gh issue view <N> --comments` to re-check the ticket scope, parent links, and issue state
3. Your session notes and pending closing summary

## Checklist

Answer every question. For every `yes`, take the action before you close.

### 1. Bug Or Regression

Did you encounter a bug, parity deviation, or regression that is outside this ticket's stated scope?

- Yes: file a follow-up bug ticket now.
- No: continue.

### 2. Process Recurrence

Did a known workflow failure recur this session, or did you state an intent such as "I'll file a ticket" or "I'll update the doc" and then fail to do it?

- Yes: file a process ticket now. Name the recurring failure mode if a known one applies.
- No: continue.

### 3. Doc Or Ticket Contradiction

Does this work contradict, correct, or extend an existing doc, TIL, glossary entry, or open ticket?

- Yes: file a WRITER follow-up or post the needed correction comment before closing.
- No: continue.

### 4. Closing Loop

Is any required close-time linkage still missing?

Check for:

- a missing closing comment on the issue
- a child ticket that should include `**Parent:** #<N>` but does not
- a referenced follow-up ticket that has not actually been filed

If anything is missing, fix it before closing.

### 5. Deferred Decision Or External Routing

Did you defer a technical/process decision, or is there a question for a human or maintainer that has no tracking ticket yet?

- Yes: file the decision or routing ticket now.
- No: continue.

For research or spike tickets: if the findings propose concrete implementation work, each distinct proposal needs its own follow-up ticket before close.

### 6. Error Self-Audit

Re-read the session from claim to now. Did any tool call, shell command, Git operation, `gh` command, claim/close step, permission request, or validation check fail, even if you retried and recovered?

- Yes: confirm each has an `errors` row or log it now with `log-error`.
- No: continue.

Your closing comment must state one explicit outcome:

- `error self-audit: N row(s) logged`
- `error self-audit: no loggable errors this session`

## Decision Rule

Only proceed to the close sequence when every checklist item is either:

- `no`
- already fixed
- or backed by a newly filed ticket

If not, the next best action is not `npm run close N`; it is the missing filing, comment, or correction.

## Output Format

Use one of these summaries:

```text
GREEN - ready to close.
```

```text
AMBER - do this before closing:
- Q1: <finding> -> file <ticket type/title stub>
- Q4: <missing close linkage>
```

Do not call the ticket complete until the result is `GREEN`.

## Guardrails

- Keep this skill focused on close-readiness. Do not duplicate the entire velocity or close protocol here.
- Filing a follow-up ticket is mandatory when the checklist finds deferred scope or a missing decision path.
- Repo-local Codex skills live under `.agents/skills/...` and are committed normally in lccjs.
