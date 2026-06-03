# RESEARCH: scope discipline — single-deliverable puzzle adherence (#601)

**Date:** 2026-06-03  
**Agent:** ELDERBERRY  
**Parent:** #15 (workflow / process)

---

## Summary

The last 30 closes on `main` were reviewed for multi-concern bundling. Two clear
instances were found. Three distinct failure modes are documented below, along with
concrete additions to `claude_workflow.md` and `RULES.md` that would prevent or
catch each one at close time.

---

## Review of recent closes

**Sample:** commits on `origin/main` from `d7cd241` to `1239908` (≈30 substantive
work commits, excluding velocity data rows and TIL entries).

**Multi-concern bundling instances found: 2**

### Instance 1 — #580 (DRAGONFRUIT, 2026-06-03)

Ticket scope: add an integration test that drives `lcc.js --verbose` over a bad
link and verifies `[linker]` appears in stderr. No production code change needed.

What actually landed in the close commit chain (`cd2b7a9`):

| Concern | In ticket scope? | Ticket filed? |
|---|---|---|
| Discovery pass — determining that #579's fix was already committed | No | No |
| Integration test `lcc.verbose.integration.spec.js` | **Yes** | #580 |
| Bug fix — `resetState()` clobbering `verboseModeOn` in `linker.js` | No | No |

The bug fix was the highest-value item and had zero estimate, zero ticket, and zero
individual velocity row. The discovery pass inflated the actual time beyond the
integration-test estimate with no accounting.

### Instance 2 — #596 (grammar bugs, 2026-06-03)

Commit message: `fix(grammar): three lcc.tmLanguage.json bugs — @-label refs,
directive scope, debug-after-label`. Three distinct, independently-releasable
fixes to `docs/lcc.tmLanguage.json` were landed under one ticket number. Whether
this was in-scope depends on whether #596's body enumerated all three — but the
commit message itself signals a bundled delivery.

---

## Failure mode taxonomy

### FM-1 — Bug tax

**What happens:** Agent encounters a pre-existing bug while implementing the stated
work. The bug is obviously wrong; fixing it is quick; skipping it feels wrong. The
agent fixes it in the same commit and the close absorbs it.

**Why it's a problem:** The bug fix has no parent ticket, no estimate, and no
velocity row. Calibration data becomes meaningless for the implementation ticket
(the actual time included fixing an unrelated defect). If the bug fix is wrong or
causes a regression, its history is entangled with unrelated changes.

**Example:** `resetState()` clobbering `verboseModeOn` (#580).

**Correct response:** File a ticket for the bug immediately upon discovery (`Filed
#N for X — continuing`). Implement the stated scope only. The bug fix becomes a
separate close, with its own estimate and velocity row.

### FM-2 — Discovery bleed

**What happens:** The agent begins a ticket by doing triage work — reading the
codebase to determine its actual state ("has this already been fixed?", "which
caller does this?"). This is a research act. Instead of logging it as a distinct
research step, the agent folds it into the implementation ticket's time.

**Why it's a problem:** Discovery is often the most time-consuming part of a
puzzle, especially for a fresh agent. When it's absorbed, the implementation
estimate looks wrong (over-estimated) but the real cause is untracked triage time.
Over many tickets this makes the C estimates appear consistently over-padded when
they're actually accurate for the implementation alone.

**Example:** Determining that #579's fix was already committed before starting
#580 implementation.

**Correct response:** If the triage takes more than ~5 minutes, file a research
or spike ticket for it. If it's a quick sanity check (< 5 min), note it in the
velocity row's `notes` field but don't let it inflate the implementation actual.

### FM-3 — Multi-fix bundling

**What happens:** A ticket says "fix X" and during implementation the agent also
notices Y and Z are broken in the same area. All three are fixed in one commit
under the same ticket number.

**Why it's a problem:** Three distinct deliverables, one velocity row, one
estimate. The estimate only reflected X. Y and Z are invisible to the tracker.
Future agents looking at the ticket's "Done when" see it closed but don't know
the additional scope that landed.

**Example:** `fix(grammar): three lcc.tmLanguage.json bugs` (#596).

**Correct response:** File Y and Z as separate tickets the moment they are
identified. Implement X in the current worktree only. Close #X, then pick up #Y
and #Z as separate puzzles.

---

## What the workflow doc already says

`claude_workflow.md` already contains the right rules:

> **Line 106:** "I don't expand scope ('while I'm here, let me also …'). The scope
> is fixed at the ticket body."

> **Line 114:** "Stay in scope. Anything outside the ticket gets logged as a finding,
> not pursued."

> **Line 116:** "Surface findings as I notice them — file tickets immediately and
> unilaterally. … Cite the new number inline and move on."

> **Line 246:** "I don't gold-plate. Once the ticket scope is met, I stop."

The gap is **enforcement location**: these rules are stated in the "While
continuing" section. They are not repeated at the close gate, where the bundling
actually happens. An agent can follow the rules during implementation and then
bundle at the last moment by fixing one more thing before writing the close commit.

---

## Proposed process changes

### 1. Add a pre-close scope audit to the close sequence

In `claude_workflow.md`, in the "At close" section (before "The close sequence"),
add:

> **Pre-close scope audit (mandatory):**
> Before writing the close commit, run `git diff origin/main` and verify every
> changed file and function is within the stated scope of this ticket's "Should
> have." If any change is out of scope:
> 1. File a ticket for it immediately.
> 2. Revert or stash the out-of-scope change.
> 3. Close this ticket with only the in-scope work.
> 4. Pick up the newly filed ticket separately.
>
> The three failure modes to watch for: bug found mid-implementation (FM-1),
> discovery time absorbed without logging (FM-2), multi-fix bundled under one
> number (FM-3). See `docs/research/601-scope-discipline.md`.

### 2. Add a RULES.md rule

Add to `RULES.md`:

> **Rule N — One deliverable per close.** Before writing the close commit, audit
> `git diff origin/main`: every change must fall within the ticket's stated "Should
> have." Out-of-scope changes get their own ticket (filed before the close commit),
> their own worktree, and their own velocity row. Fixes absorbed silently into
> another ticket's close are invisible to the tracker and corrupt calibration data.

### 3. Velocity notes field convention

When FM-2 (discovery bleed) is unavoidable (quick triage that doesn't warrant a
ticket), capture it explicitly in the velocity row's `notes` field:

> `notes: "~10 min triage confirming #579 already landed before starting; not
> counted in implementation actual"`

This makes the discovery visible without requiring a full ticket, while keeping the
implementation estimate clean.

---

## Verdict

The workflow doc has the right rules but states them too early (during
implementation guidance) and not at all at the close gate. The fix is two
additions: a pre-close diff audit step in `claude_workflow.md` and a `RULES.md`
rule that names the failure modes explicitly. No tooling change is needed — the
audit is a manual `git diff` check, which takes under 30 seconds and forces the
agent to confront the delta before committing.

Whether to implement these changes is tracked in #601 (this research deliverable).
The human can decide which proposals to land and in what form.
