# TIL 2026-06-05 — FIG session 2 — guided human decision

**Context:** This session addressed issue #851 — a `humans-only, decision` ticket requiring a human ruling on 7 architectural questions across M1 (#625, `claim.js` label filter) and M2 (#626, `fruit-agent-orchestrate` label filter). The agent's role was to surface context, translate options analyses into a scannable brief, and execute once the human chose. The session also resolved M8 (#632) as a side effect, creating and applying the `waiting-on-external` label.

---

## 1. The "guided human decision" pattern is a distinct interaction mode

**What happened:** The user said "let's address together #851 — give me the context, options, recommendation, and why." They didn't want action — they wanted a briefing first. Only after the briefing and their "go with all 7 recommended options" did execution begin.

**What I learned:** This is a recognisable interaction mode with a specific shape: (1) agent loads context from existing research, (2) agent presents options + recommendation in a scannable format, (3) human rules, (4) agent executes and records. The agent is functioning as a *decision clerk* — not a researcher (that was ELDERBERRY's prior work on #689) and not an autonomous actor. The human stays in the loop exactly once, at the right moment.

**The rule:** For `decision`/`humans-only` tickets with pre-existing options analyses, the pattern is: context brief → scannable options table → recommendation with rationale → wait for ruling → execute cleanly.

---

## 2. Claim vs orchestrator label-set asymmetry is load-bearing

**What happened:** The most non-obvious part of the M1/M2 ruling was why M1 (`claim.js`) should *not* block `decision` tickets while M2 (`fruit-agent-orchestrate`) *should* skip them.

**What I learned:** A label can mean "agent can research this if directed" AND "orchestrator should not auto-assign this" simultaneously. These are not contradictory — they reflect different callers with different risk profiles. `claim.js` is invoked when a human explicitly directs an agent at a ticket; the orchestrator assigns without direct human supervision. Flattening the asymmetry (same block-set everywhere) would prevent a whole class of useful directed-research work — ELDERBERRY's options analysis on #689 was itself done by claiming a `decision` ticket.

**The rule:** When designing label-filter systems, distinguish "directed claim" (human says go) from "auto-assignment" (orchestrator picks for you) — they warrant different block-sets even for the same label.

---

## 3. Side-dependencies that are trivially resolvable should be landed now, not hedged

**What happened:** The ruling comments I posted said "once M8 creates the `waiting-on-external` label." The user immediately redirected: "add the label now and update your rulings." M8 (#632) was a `decision` ticket itself — but the label name was already resolved in ELDERBERRY's analysis. Executing it took ~2 minutes.

**What I learned:** Writing "once X happens" in a ruling comment is worse than just doing X when X is trivial and the decision is already made. A non-existent label that would have been created in the same session anyway is not a real dependency — hedging it signals false caution and creates follow-up noise.

**The rule:** If a side-dependency is ≤5 minutes and the decision is already made, land it now and remove the conditional clause. Don't write "once X happens" when X is within current scope.

---

## 4. Creating a new label requires an immediate sweep for candidates

**What happened:** After creating `waiting-on-external`, the user said "add it to the tickets that need it." I ran a keyword scan across open issue bodies and titles (`charlie`, `dos reis`, `external`, `waiting on`, `reply from`). That surfaced #159 (waiting on Prof. Dos Reis's reply on `sext` semantics) and #40 (upstream `mov`/`mvi` tracker, also waiting on his response to a filed bug report).

**What I learned:** A new label only has value if it's applied. The creation step and the application sweep are a single atomic action — one is meaningless without the other. A scan is cheap and catches cases that wouldn't surface from memory alone.

**The rule:** When creating a new label, immediately sweep open issues for immediate candidates. Don't leave the label orphaned on the label list.

---

## What landed

| Artifact | Change |
|---|---|
| GitHub label | `waiting-on-external` created |
| #159 | `waiting-on-external` label applied |
| #40 | `waiting-on-external` label applied |
| #625 | Ruling comment + addendum posted |
| #626 | Ruling comment + addendum posted |
| #632 (M8) | Closed — label created |
| #851 | Closed — all 7 rulings confirmed |

## Open threads

- **#866** — review and improve the `guide-human-decision` skill using this session as evidence. The skill now appears in the skill inventory; this TIL is the primary evidence doc for improving it.
- `claude_workflow.md` label-conventions section could document `waiting-on-external` vs `blocked` distinction; no ticket filed yet.

## Related artifacts

- Issues #625, #626, #632, #851, #866
- `guide-human-decision` skill (new, in skill inventory)
- [TIL 2026-06-05 FIG](./today-i-learned-2026-06-05-fig.md) — same-day earlier session (parallel-agent write-safety)
