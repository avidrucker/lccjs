# Two process gaps from the #1008 session (#1009)

**Author:** BANANA · **Date:** 2026-06-06 · **Type:** RESEARCH (research-only)

Two process failures observed while filing #1008: (1) investigative work done
without checking it was wanted, and (2) time-consuming ad-hoc work not logged to
velocity. This doc decides the guard for each and files implementation children.
No production change here.

---

## Fail 1 — investigation done without asking first

**Observed:** asked to "file a ticket to redesign the fruit skill," the agent
immediately read `SKILL.md`, inspected directory sizes, sampled label/issue
conventions, and profiled token-cost drivers — i.e. it expanded "file a ticket"
into a research project without surfacing that expansion.

**Tension (from the ticket):** a blanket "always ask before any investigation"
rule makes the agent annoyingly chatty for trivial lookups; no gate lets it
silently balloon scope.

### Decision (user-ratified, 2026-06-06): proportional threshold

The decision was put to the user via `AskUserQuestion`; the user chose the
**proportional** option:

- **Light investigation that the literal task needs → proceed.** Reading the one
  or two files required to do the asked-for thing correctly is part of the task,
  not scope expansion. No announcement needed.
- **Expansive / "research"-flavored investigation beyond the ask → surface first
  and wait.** Multi-file analysis, cost/perf profiling, directory sampling,
  convention surveys — anything that turns "file a ticket" into "study the
  subsystem" — gets a one-line "I'm about to investigate X to do this well — ok?"
  before proceeding.

The line is **proportionality to the literal request**, not file count for its own
sake. Rule of thumb: if the investigation would itself be a plausible separate
RESEARCH/SPIKE ticket, it's past the threshold — ask.

Rejected alternatives: "announce-then-proceed without waiting" (lighter, but
doesn't actually gate scope), "always ask" (chatty), "never gate" (the status quo
that produced this observation).

→ **Child filed:** add this proportional consent threshold to
`docs/claude_workflow.md`'s "while continuing" guidance.

---

## Fail 2 — time-consuming work not logged to velocity

**Observed:** the #1008 investigation + ticket authoring took real wall-clock time
and produced a deliverable, but no `puzzle-velocity` row was logged.

**Finding — the mechanism already exists; only the obligation is unstated:**

- The convention [[no-code-work-still-logged]] (#215/#216) already says PM/RESEARCH/
  SPIKE work that changes no repo files **still gets a velocity row** — the row
  tracks time, not diffs.
- The `puzzle-velocity` skill already supports a **nullable `ticket`** — "omit for
  issueless PM/triage rows" (#299). And the #204 precedent allows filing a
  retroactive ticket so a row has a key.

So nothing new needs building. The only gap is that the convention is framed around
*claimed* work; it doesn't explicitly say that **unprompted / ad-hoc work outside a
claim** is also in scope. The answer follows directly from "the row tracks time,
not diffs": yes, it is.

### Recommendation

Clarify in the logging guidance that ad-hoc / unclaimed / unprompted work that took
≥~1 min and produced a deliverable gets a velocity row too — logged either with a
**null `ticket`** (issueless row, #299) or against a **retroactively-filed ticket**
(#204 precedent). Capture `started_iso` before the work; if reconstructed, say so in
`notes` and leave `c_min` empty (a retroactive forecast isn't clean).

→ **Child filed:** add the ad-hoc/unclaimed logging clarification to the logging
guidance.

---

## Children filed

See closing comment for verified numbers: one docs child for the Fail 1 consent
threshold, one docs child for the Fail 2 ad-hoc-logging clarification.

## Headline

Fail 1 needed a genuine policy decision (now user-ratified: **proportional** —
proceed on light reads, ask before research-flavored expansion). Fail 2 needed only
a clarification: the logging mechanism (null-ticket rows, #299) and the obligation
([[no-code-work-still-logged]]) already exist; they just need to explicitly cover
unclaimed/ad-hoc work.
