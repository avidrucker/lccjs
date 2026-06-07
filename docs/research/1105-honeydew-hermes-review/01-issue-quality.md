# Pass 1 — Ticket-quality review of #1066–#1073

**Tracker:** #1105 · **Child:** #1106 · **Reviewer:** agent GRAPE · **Date:** 2026-06-06
**Method:** Claude `issue-review-skill` (universal 5-dimension rubric + `dev`/feat type rubric)

These 8 tickets are HONEYDEW's Phase-1 "skill draft" tickets under conversion tracker #1065.
They are near-identical templated `feat(skills)` tickets, so this doc gives a compact per-ticket
scorecard plus the cross-cutting findings that matter.

---

## Verdict roll-up

| # | Skill | Type | Total | Verdict |
|---|-------|------|-------|---------|
| #1066 | issue-review | dev | 15/15 | READY |
| #1067 | next-best-action | dev | 15/15 | READY |
| #1068 | guide-human-decision | dev | 15/15 | READY |
| #1069 | log-error | dev | 15/15 | READY |
| #1070 | write-til-doc | dev | 15/15 | READY |
| #1071 | yegor-pm | dev | 14/15 | READY |
| #1072 | puzzle-velocity | dev | 15/15 | READY |
| #1073 | puzzle-triage | dev | 15/15 | READY |

**Bottom line:** every ticket is **READY** — well-scoped, single-deliverable, with named source &
target paths and a machine-verifiable primary acceptance check (`skill_view(name=…)` loads). The
quality is high and consistent. The defects below are **non-blocking** (they don't impede the draft
work itself) but are real and worth correcting because they mislead at the verification handoff.

---

## Universal rubric (representative — applies to all 8 unless noted)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Scope clarity | 3/3 | One skill per ticket; Source + Target paths explicit. Repo-wide "Non-Goals" live in parent #1065, so no per-ticket out-of-scope needed. |
| Success criteria | 3/3 | Primary AC (`skill_view` loads) is machine-verifiable; dir-structure & frontmatter checks are objective. **Caveat:** two AC items — "All tool calls rewritten for Hermes toolset" and "Persona/language adjusted for Hermes agent style" — are subjective (no verifiable threshold). They're acceptable but are the weakest part of every ticket. |
| File/path specificity | 3/3 | Exact source (`~/.claude/skills/…` or `docs/skills.md` line ranges) and target (`~/.hermes/skills/software-development/<name>/`) named in every ticket. |
| Single deliverable | 3/3 | Exactly one skill draft each. No bundling. Verification deliberately split into a separate follow-up ticket — good discipline. |
| Context sufficiency | 3/3 | An agent can start immediately: source, target, AC, and notes are all present. |

**#1071 (yegor-pm) — the one 14/15:** docked 1 on **Success criteria** because its Notes claim
"Meta-orchestrator for **11** Yegor sub-skills" while the source skill (`yegor-pm`) and `docs/skills.md`
describe **10** sub-skills — an off-by-one that an implementor synthesizing "from docs" could carry
into the artifact. (Confirm in pass 2 / #1107 whether the Hermes `yegor-pm` actually lists 10 or 11.)

---

## Type-specific checks (`dev`/feat rubric)

| Required check | Result |
|---|---|
| Have/Should-have framing | **WARN (all 8)** — uses an "Overview" line instead of explicit Have/Should-have. For port tickets this is fine (the "have" is the Claude source, the "should-have" is the Target), but it's a minor deviation from the project's BDD convention. |
| Acceptance criteria | PASS — present as checkboxes in all 8. |
| Affected files named | PASS — Source + Target named in all 8. |
| Role tag | PASS — `Role: DEV` in all 8. |

| Recommended check | Result |
|---|---|
| Time estimate | PASS — `H`/`C` on every ticket. |
| Dependency chain | PARTIAL — "Parent: #1065" present; "Follow-up: #N" present but **wrong** (see below). No explicit "blocks/blocked-by" but the parent↔follow-up linkage covers it conceptually. |
| Out-of-scope section | N/A per ticket (handled by parent's Non-Goals). |
| No open architectural decisions | PASS — the Hermes format is fixed by `hermes-agent-skill-authoring`; implementor knows *how*. |

---

## Cross-cutting findings

### FINDING 1 (the headline) — every "Follow-up" link is wrong

All 8 tickets cite a verification follow-up that does not match the actual verify ticket recorded in
parent #1065's Phase-2 table (which **is** correct). The children were evidently filed before the
verify tickets existed and guessed sequential numbers starting at #1075; #1075 (showcase build) and
#1078 (LCC+ verbose-context) were taken by unrelated work, shifting every link.

| Child | Skill | Child's "Follow-up" | Correct verify ticket | What the cited # actually is |
|---|---|---|---|---|
| #1066 | issue-review | #1075 | **#1076** | #1075 = `chore(web)` showcase build (unrelated, CLOSED) |
| #1067 | next-best-action | #1076 | **#1077** | #1076 = issue-review's verify |
| #1068 | guide-human-decision | #1077 | **#1079** | #1077 = next-best-action's verify |
| #1069 | log-error | #1078 | **#1080** | #1078 = `feat(plus)` LCC+ verbose-context (unrelated) |
| #1070 | write-til-doc | #1079 | **#1081** | #1079 = guide-human-decision's verify |
| #1071 | yegor-pm | #1080 | **#1082** | #1080 = log-error's verify |
| #1072 | puzzle-velocity | #1081 | **#1083** | #1081 = write-til-doc's verify |
| #1073 | puzzle-triage | #1082 | **#1084** | #1082 = yegor-pm's verify |

Impact: low (the draft work is done and the tickets are CLOSED), but anyone tracing a draft → its
verification via the child body lands on the wrong (sometimes unrelated) ticket. The parent table is
the reliable source. → **Filed as a corrective ticket (see "Filed tickets" below).**

### FINDING 2 — AC frontmatter field list doesn't match the real Hermes spec

#1066/#1067/#1068 spell out the frontmatter AC as `name, description, version, author, **category**`.
The actual Hermes skills (and the `hermes-agent-skill-authoring` validator) use
`name, description, version, author, license, platforms, metadata.hermes.tags` — there is **no
`category`** field; the category is the *directory* (`software-development/`). So the AC names a field
that the format doesn't have, and omits the fields it does. #1069/#1070 avoid this by saying only
"Valid YAML frontmatter, including config abstraction" — i.e. the detailed-AC tickets are the ones
that got it wrong. This is primarily a pass-2 (#1107) conformance concern but is rooted in the
ticket's AC text. (Inconsistent AC detail across the set is itself a minor smell.)

### FINDING 3 (positive) — strong, uniform structure

Worth recording as a strength: the set is a good template. Single deliverable each, verification
correctly split out, source/target always explicit, estimates always present, config-abstraction
flagged precisely on exactly the 3 tickets that need it (#1069 log-error, #1070 write-til-doc,
#1072 puzzle-velocity). This is above the repo's median ticket quality.

---

## Suggested improvements (non-blocking)

- Adopt explicit **Have / Should-have** headers even for port tickets, to match the BDD convention
  (the issue-review skill flags the "Overview" substitution as a WARN, not a FAIL).
- Standardize the AC frontmatter line to the real Hermes field set, or drop the field enumeration
  and point at `hermes-agent-skill-authoring` as the single source of truth (avoids FINDING 2).
- Tighten the two subjective AC items ("tool calls rewritten", "persona adjusted") into something
  checkable — e.g. "no `Bash(`/`gh `-as-Claude-tool references remain; uses `terminal`".

---

## Filed tickets (per #1105 close protocol / Rule 10)

- **#1109** — `docs(skills): fix wrong Follow-up links in #1066–#1073` (FINDING 1).

FINDING 2 is folded into pass 2 (#1107) scope rather than filed separately, since the fix is to the
*skill artifact*'s frontmatter, which #1107 already reviews. FINDING 3 needs no action.
