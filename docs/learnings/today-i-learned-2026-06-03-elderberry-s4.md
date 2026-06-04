# TIL 2026-06-03 — ELDERBERRY s4

**Context:** Session covering #601 (scope discipline research — single-deliverable
puzzle adherence) and filing of follow-up #615.

---

## 1. Scope-bundling happens at the close gate, not during implementation

The workflow doc already states the right rules — "I don't expand scope," "stay in
scope," "surface findings immediately" — but states them during the "While
continuing" section. Agents can follow those rules faithfully during implementation
and still bundle at the last moment by fixing one more thing before writing the
close commit. The enforcement point is too early.

**The rule:** scope discipline checks belong in the close sequence, not just in the
implementation guidance. A pre-close `git diff origin/main` audit — "does every
changed file and function fall within this ticket's 'Should have'?" — catches
bundling where it actually happens.

---

## 2. Three failure modes have distinct root causes and distinct fixes

Calling all scope violations "scope creep" obscures that they are three different
problems:

- **FM-1 Bug tax** — a pre-existing bug is discovered mid-implementation and fixed
  in the same commit. Root cause: agent treats fixing a found bug as obligatory
  rather than as a new deliverable. Fix: file a ticket for the bug immediately,
  implement only the stated scope, close separately.

- **FM-2 Discovery bleed** — triage/recon time (reading the codebase to determine
  its state) is absorbed into the implementation actual without logging. Root cause:
  the line between "understanding context" and "doing research" is blurry when both
  happen in the same session. Fix: if triage exceeds ~5 minutes, log it in the
  velocity `notes` field or file a spike ticket.

- **FM-3 Multi-fix bundling** — N distinct bugs are fixed under one ticket number.
  Root cause: the agent notices related problems in the same area and fixes them
  while the code is open. Fix: file the additional issues immediately, fix only the
  stated one, close separately.

Naming the modes precisely lets agents recognize which one they are about to commit
and apply the right corrective action rather than a generic "stay in scope" reminder.

---

## 3. Orphan research findings degrade calibration data silently

When an unreported bug fix or untracked discovery is absorbed into a ticket close,
the velocity row's `actual_min` reflects more work than the ticket described. The
estimate (`c_min`) looks wrong — systematically over-padded — when in reality the
implementation was accurate and the extra time came from out-of-scope work.

Over many tickets this makes C estimates appear uncalibrated when the underlying
predictions are sound. The corruption is invisible unless the commit diff is audited
against the ticket body after the fact.

**The implication:** a clean calibration dataset requires not just accurate
timestamps but accurate scope. An `actual_min` that includes out-of-scope work is
not a valid data point for the ticket it is logged against.

---

## 4. "No follow-up ticket" is itself a gap worth flagging

After closing #601 (research deliverable), the proposals sat without a
corresponding implementation ticket. The right action — filing #615 immediately —
is exactly what the workflow doc says: "surface findings as I notice them, file
tickets immediately and unilaterally." A research ticket that ends with "here are
three proposed changes" and no `@todo` or child issue is half-finished: the
findings exist but have no path to being acted on.

**The rule:** every research close that proposes concrete changes should have a
follow-up DEV ticket filed before or as part of the close sequence. If the human
hasn't asked for it, file it anyway — a wrong ticket can be closed immediately.

---

## What landed

| Issue | Role | Deliverable |
|-------|------|-------------|
| #601 | RESEARCH | `docs/research/601-scope-discipline.md` — 30-close audit, 3 failure modes, 3 proposed guardrails |
| #615 | PM | Filed DEV ticket to implement the scope-discipline changes in `claude_workflow.md`, `RULES.md`, `docs/puzzle-velocity.md` |
| #616 | DEV | This TIL |
