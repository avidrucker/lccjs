# Retro 2026-06-13 — Process vs. Progress

**Scope:** a multi-day APPLE working session (2026-06-07 → 06-13) that started as a
`fruit-agent-orchestrate` round and turned into a deep pass on the project's own
*process*. First entry in the `docs/retros/` cadence — a project-level retrospective
(vs. the session-level `docs/learnings/` TILs). Companion to #1221 (the ratio *metric*);
this is the *narrative*.

---

## By the numbers (from `~/.lccjs/lccjs.db`)

| | Count | Detail |
|---|---|---|
| **Tickets closed** | 5 | #1125, #1145, #1151, #1159 (DEV), #1190 (TIL) |
| **Tickets filed (still open)** | 9 | #1200, #1201, #1211, #1213, #1217, #1221, #1227, #1228, #1229 |
| **Feature tickets moved** | **0** | every close was process/infra; zero toolchain / LCC+ / `ilcc` / web |
| **Errors logged** | 10 | rows #71–76, #89, #103–105 |
| **Net backlog** | **+4** | filed 9 − closed 5; and the 9 filed are 100% process |

**The headline:** *feature velocity this session was zero.* All five closes were
infrastructure about *how we work* (the puzzle-velocity skill, `close.js`, `claim.js`,
the `fruit-agent-orchestrate` skill), and all nine new tickets are process too. The
project's own machinery improved; the product (the LCC toolchain) did not move.

---

## What genuinely progressed

Not nothing — the closes were real hardening of the multi-agent machinery:

- **#1145** — `close.js` scope audit now diffs `merge-base..HEAD`, killing the phantom-deletion
  footgun (self-verified live on its own close).
- **#1151** — `claim` hard-blocks uncategorized lanes (`--allow-uncategorized` bypass).
- **#1159** — `fruit-agent-orchestrate` freshness contract (triage-timestamp banner + re-validate),
  implemented boilerplate-free to stay consistent with #1200/#1201.
- **#1125** — corrected the puzzle-velocity Hermes port (inverted delta sign + 2 accuracy defects).

These compounded: #1145's fix cleaned up #1151's and #1159's own close audits. Good infra work —
just *all* infra.

## The drift

- **Architect-heavy, courier-light.** Most of the session was *designing* process — orderings,
  taxonomies, trackers, rubrics, this very retro. By yegor-architect, design and execution should be
  temporally separated; we stayed in architect mode and rarely switched to courier (just-close-it).
- **Process tickets bred process tickets.** #1200→#1201 (legibility→rubric), #1211 (cluster tracker),
  #1213 (recommend-orderings), #1217 (epics)→its 952-refresh spike, #1221 (ratio), #1227/#1228/#1229
  (this retro + rules + glossary pointer). Each was individually reasonable; together they grew the
  backlog while no product shipped.
- **Two "highest-priority" tickets were phantoms.** #1061 (an orchestration assignment) was already
  CLOSED ~10h before hand-out (→ #1159). #1214 (a "red build") was already green on verify. Both are
  the same lesson: verify the repro / re-validate OPEN before acting.

## Error patterns (10 logged — the honest part)

Several were *behavioral*, not technical, and recurred:

- **`EDIT_PRECOND` ×3** (#72, #75, #76) — edited files inspected via Bash without the Read tool.
  Twice in one session → saved memory `read-tool-before-edit`.
- **Skipped the pre-close error self-audit** (#74), then a `TOOL_DENIED` *after* the audit window
  went unlogged until prompted (#103) — the human had to ask "did you log your errors?" **twice**
  (after #1125 and #1159). → saved memory `log-errors-at-moment-of-failure`.
- **Confabulation** (#105) — invented a `--dry-run` flag for `error:log` that doesn't exist, and
  spliced the experiment onto a real command, writing junk row #104 (preserved as evidence).

The discipline mostly *caught* these (audits, memories, the user's prompts), but the table
under-reported until asked — the recurring failure mode is logging-at-moment vs. logging-at-audit.

## yegor-pm diagnosis

> Velocity = closed tickets/week — and *which* tickets. By that measure, product velocity = 0.

The machinery is sound; the **allocation** drifted. yegor's prescriptions, now in flight:
- **Switch to courier mode** — execute agreed designs, stop redesigning.
- **Epics are dumb umbrellas** — never worked as a unit; only their ≤60m children are (the #1217 model).
- **Gate fuzzy work with spikes** — #1217's "refresh 952" and #1206's review must be bounded ≤60m first.

## Course-corrections (tracked, not just narrated)

| Correction | Ticket |
|---|---|
| Measure & target the feature:process ratio (don't let process starve product) | **#1221** |
| Ratify 3 decomposition rules (decompose-before-claim, spike-before-fuzzy, epics-are-umbrellas) | **#1228** (decision) |
| This retro cadence (`docs/retros/`) | **#1227** |
| Pointer from lccjs → the existing yegor `GLOSSARY.md` | **#1229** |

**The commitment that matters:** the next ticket after this retro is a **feature** ticket
(toolchain / LCC+ / `ilcc` / web), not a tenth process ticket. A retro about process-overload that
spawns only more process has failed its own thesis.

## Open process-ticket inventory (so the pile is visible)

`#1200 #1201 #1211 #1213 #1217 #1221 #1228 #1229` (+ this, #1227) — nine. Several should be
*closed-or-killed* in a grooming pass before more are filed; #1213 is already `deferred`. The
discipline going forward: **one ratio to watch (#1221), a short in-flight list, and a feature
floor — don't open process ticket #11 until a feature ticket closes.**
