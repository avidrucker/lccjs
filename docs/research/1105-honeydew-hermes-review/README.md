# Review: agent HONEYDEW's Hermes skill-port work (#1066–#1073)

Centralized findings for tracker **#1105** — an independent QA/retrospective of HONEYDEW's
2026-06-06 port of 8 Claude skills into Hermes format (`~/.hermes/skills/software-development/`).

This folder is the single place for all passes of the review. Each child ticket contributes one
findings doc; this README is the index + consolidated verdict roll-up.

## Passes

| Pass | Ticket | Dimension | Doc | Status |
|------|--------|-----------|-----|--------|
| 1 | #1106 | Ticket quality of #1066–#1073 (via `issue-review-skill`) | [`01-issue-quality.md`](./01-issue-quality.md) | ✅ done (GRAPE) |
| 2 | #1107 | Ported-skill authoring quality + source fidelity | [`02-skill-quality.md`](./02-skill-quality.md) | ✅ done (GRAPE) |
| 3 | #1108 | HONEYDEW process hygiene (comments / artifacts / DB logging) | [`03-execution-and-logging.md`](./03-execution-and-logging.md) | ✅ done (DRAGONFRUIT) |

## Consolidated verdict

**HONEYDEW's Hermes skill-port work is competent draft-quality in substance, with a recurring theme
of process/telemetry residue and one real correctness bug.** The tickets were well-formed, the
skills are conformant and land where promised, and fidelity on the hard skills is genuinely good —
but config abstraction is half-finished, conversion scaffolding leaked into shipped skills, the
agent is invisible in the project's durable records, and `puzzle-velocity` shipped an inverted delta
formula. None of the gaps are showstoppers; all are tracked.

**Follow-up tickets filed across the review:** #1109 (ticket link fixes), #1112 (HONEYDEW absent
from orchestration roster), #1113 (Hermes↔lccjs telemetry policy), #1125 (puzzle-velocity
correctness bug), #1126 (skill authoring-hygiene sweep).

### Pass 1 — ticket quality (#1106, GRAPE)
All 8 tickets graded **READY** (14–15/15). Headline: **every child's "Follow-up" link is wrong** —
they cite verify tickets that don't match parent #1065's (correct) Phase-2 table; two point at
entirely unrelated tickets (#1075 showcase build, #1078 LCC+ verbose-context) — fixed via **#1109**.
Secondary: AC frontmatter field list (`category`) doesn't match the Hermes spec. See
[`01-issue-quality.md`](./01-issue-quality.md).

### Pass 2 — skill authoring + fidelity (#1107, GRAPE)
Solid drafts: uniformly conformant frontmatter; issue-review's `type-rubrics.md` and write-til-doc's
`REFERENCE.md` transferred intact; guide-human-decision is clean. **One MATERIAL bug:**
`puzzle-velocity` inverted the delta-sign convention (`actual−estimate` vs canonical `estimate−actual`),
plus an invented agent-casing pitfall and dropped skip-guards → **#1125**. Cross-cutting hygiene
(incomplete config abstraction, shipped `## Hermes Tool Mapping (from Claude)` scaffolding,
non-portable `fruit-agent-orchestrate` related-skill, yegor-pm 10-vs-11 roster drift) → **#1126**.
See [`02-skill-quality.md`](./02-skill-quality.md).

### Pass 3 — execution & process hygiene (#1108, DRAGONFRUIT)
Deliverables sound and correctly placed (Artifacts ✅). Comments ⚠️ ADEQUATE — one templated
close-comment per ticket, no per-skill specificity, no agent attribution. DB logging ❌ GAP — 0
velocity + 0 error rows with no documented exemption; root cause is a missing Hermes↔lccjs logging
integration (systemic, not per-ticket negligence) → **#1112**, **#1113**. See
[`03-execution-and-logging.md`](./03-execution-and-logging.md).

## Source material
- Tracker under review: #1065 (Phase-1 drafts #1066–#1073, Phase-2 verify #1076–#1084)
- Conformance spec: `~/.hermes/skills/software-development/hermes-agent-skill-authoring/SKILL.md`
- This review tracker: #1105
