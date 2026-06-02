# Follow-up Ticket Trigger — Rule Brainstorm

**Context:** When closing issue #476, the agent named deferred work ("parity/workflow subpages out of scope") in the closing comment prose but filed no ticket. The work was effectively lost until the human noticed. This document records the three rule options considered and the rationale for the chosen one.

---

## Motivating example

Closing comment for #476 contained:

> **Out of scope for this PR (possible follow-up):**
> Virtual `/docs/parity/` and `/docs/workflow/` groupings — those docs live in `docs/` root, not subfolders; would need either a folder reorganization or explicit file-list config in the build script.

No ticket was filed at close time. The deferred work was invisible until the human explicitly asked about it.

---

## Option A — Tight trigger (deferred scope only)

**Rule:** If the closing comment uses language like "out of scope", "follow-up", "can be added later", or "left for later", a ticket must be filed before the close commit. The closing comment cites the ticket number instead of prose.

**Pros:**
- Low false-positive rate — only fires on explicit deferrals.
- Easy to teach; the trigger words are recognizable.

**Cons:**
- Keyword-dependent; an agent can accidentally circumvent it by rewording ("this is not covered here" instead of "out of scope").
- Doesn't catch discovered bugs, unanswered design questions, or new risks found during implementation — only named scope deferrals.

---

## Option B — Broad trigger (any discovered work) ✅ CHOSEN

**Rule:** At close time, any work discovered but not done — whether deferred scope, a new bug found, or an unanswered design question — must become a ticket before the close commit. The closing comment cites the ticket numbers instead of describing the work in prose.

**Rationale:** The tracker is the source of truth. If something is worth mentioning in a closing comment, it is worth tracking. Prose in a closing comment is not discoverable by future agents or by `puzzle:status`; a ticket is.

**Mechanic:**
1. Draft the closing comment.
2. Scan it for any sentence describing work that isn't done or a question that isn't answered.
3. Each one becomes a ticket (filed before the closing commit). Assign the appropriate role: RESEARCH for "we should investigate", ARCHITECT for "design decision needed", DEV for a missing behavior or bug.
4. The closing comment replaces the prose with `#N` references.

**Pros:**
- Captures the full class of discovered-but-deferred work, not just named scope.
- Self-enforcing: if it can't be a ticket, it shouldn't be in the closing comment.
- Keeps the tracker as the canonical backlog.

**Cons:**
- Higher overhead per close — requires filing a ticket even for minor "nice to have" observations.
- Risk of ticket sprawl if applied too broadly; judgment is still needed on whether something warrants tracking at all.

---

## Option C — Typed trigger (role-coded)

**Rule:** Any closing comment prose describing deferred work must be converted to a ticket of the appropriate role before the close commit: RESEARCH for investigations, ARCHITECT for design decisions, DEV for bugs or missing behaviors. No role assignable → no ticket needed.

**Pros:**
- Forces the agent to categorize the work, producing cleaner role-tagged tickets.
- The role assignment step is a natural forcing function (if you can't assign a role, maybe it's not worth tracking).

**Cons:**
- Adds friction: the agent must determine the role before filing, which can block the close sequence.
- In practice, Option B already implies role assignment; the explicit typing step adds overhead without adding much constraint.
- "No role → no ticket" creates an escape hatch that options A and B don't have.

---

## Decision

**Option B** adopted as Rule 10 in `RULES.md`. Options A and C are preserved here as alternatives in case the rule needs refinement based on experience (e.g., if ticket sprawl becomes a problem, Option A's tighter trigger may be worth revisiting).
