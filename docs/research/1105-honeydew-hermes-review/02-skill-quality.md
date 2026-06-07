# Pass 2 — Authoring quality + source fidelity of the 8 ported Hermes skills

**Tracker:** #1105 · **Child:** #1107 · **Reviewer:** agent GRAPE · **Date:** 2026-06-06
**Method:** static authoring + source-fidelity review against the Hermes conformance spec
(`~/.hermes/skills/software-development/hermes-agent-skill-authoring/SKILL.md`) and the Claude
sources, using `skill-creator`'s description/structure criteria as the quality rubric. One review
subagent per skill (read both sides + diff); all MATERIAL findings re-verified by hand.

> **Scope constraint (per #1105):** this is an authoring/fidelity review. Claude cannot execute
> skills in the Hermes runtime, so behavioral end-to-end checks remain with HONEYDEW/Hermes
> (#1076–#1084). Findings here are about the *artifacts*, not runtime behavior.

---

## Verdict roll-up

| Skill | Frontmatter | Structure | Tool rewrites | Config abstraction | Source fidelity | Verdict |
|-------|:--:|:--:|:--:|:--:|:--:|:--:|
| issue-review | ✅ | ✅ | ◑ | ✅ n/a | ✅ (type-rubrics.md transferred) | **MINOR** |
| next-best-action | ✅ | ✅ | ✅ | ⚠️ `npm run close` hardcoded | ✅ | **MINOR** |
| guide-human-decision | ✅ | ✅ | ✅ | ✅ (dynamic repo detection) | ✅ | **CLEAN** |
| log-error | ✅ | ◑ (`## Triggers` not `When to Use`) | ◑ | ⚠️ partial (residual hardcodes) | ✅ (error_type vocab intact) | **MINOR** |
| write-til-doc | ✅ | ✅ | ◑ | ⚠️ claim cmd + CSV path not abstracted | ✅ (REFERENCE.md transferred) | **MINOR** |
| yegor-pm | ✅ | ✅ | ✅ | ⚠️ lccjs cmds hardcoded | ⚠️ 10→11 roster drift | **MINOR** |
| puzzle-velocity | ✅ | ✅ | ✅ | ✅ | ✅ **RESOLVED #1125** (was: delta sign inverted + invented rules) | **MATERIAL → fixed** |
| puzzle-triage | ✅ | ◑ (ships scaffolding section) | ✅ | ⚠️ `npm run puzzle:status` hardcoded | ⚠️ dropped Locked partition | **MINOR**¹ |

¹ Subagent graded puzzle-triage MATERIAL on "bash fences"; downgraded to MINOR after hand-check —
the fences wrap legit `gh`/`git` commands that run fine in `terminal`, so it's cosmetic. The real
issues (related_skills, dropped partition, scaffolding) are quality/fidelity, not correctness.

**Bottom line:** the ports are **solid drafts**. Frontmatter is uniformly conformant (all 8 carry
the full peer-matched block, even exceeding the spec with a `platforms` key), and fidelity on the
*hard* skills is genuinely good — issue-review's 216-line `type-rubrics.md` and write-til-doc's
`REFERENCE.md` both transferred intact, and guide-human-decision is clean end-to-end. But the set
shares two systemic authoring smells, and **one skill has a real correctness bug.**

---

## ⭐ MATERIAL finding — puzzle-velocity inverted the delta sign convention

The single correctness defect in the batch. Verified by hand against both the canonical source and
the live lccjs DB convention.

- **Canonical source** (`~/.claude/skills/puzzle-velocity/SKILL.md` and the live skill):
  `delta_h_min = h_min − actual_min`, `delta_c_min = c_min − actual_min`.
  **Positive = finished early / over-estimated.** Negatives are valid calibration signal.
- **Hermes port** (`puzzle-velocity/SKILL.md` lines 65–66):
  `delta_h_min = actual_min − h_min`, `delta_c_min = actual_min − c_min` ("forecast error").
  The One-Shot Recipe (lines 209–210) hardcodes the inversion: `$((ACTUAL - 30))`.

This flips the sign of every delta the skill produces, **inverting the meaning of the calibration
column** and contradicting the data already in `~/.lccjs/lccjs.db`. Anyone following the port would
write `delta` values opposite to the existing 980+ rows.

Two more accuracy defects in the same skill:
1. **Invented pitfall** — Pitfall #2 claims the canonical agent name is *lowercase* (`honeydew`,
   not `HONEYDEW`). The actual convention logs the **terminal's given uppercase name** (see the
   `terminal-agent-name-vs-fruit` convention). Following this produces wrong `agent` values.
2. **Dropped "Skip when" guards** — the source's skip conditions (don't log pure tracker/epic rows
   = double-count; skip sub-minute work; skip no-repo-file work) were dropped entirely, so the
   ported skill will over-fire and double-count tracker rows.

→ **Filed as its own ticket** (see "Filed tickets"). Cross-reference its verify ticket #1083.

---

## Cross-cutting findings

### CC-1 — Incomplete config abstraction (5 of 8 skills)
Config abstraction was the explicit goal for log-error, write-til-doc, puzzle-velocity. Two of
those (log-error, write-til-doc) added a proper `## Configuration` section but left **residual
hardcodes** the abstraction missed; puzzle-velocity's abstraction is complete. The two
*non*-config-flagged skills (next-best-action, yegor-pm) bake lccjs commands straight in.

| Skill | Has `## Configuration`? | Residual hardcoded lccjs values |
|-------|:--:|--|
| next-best-action | ❌ | `npm run close N` (7×), `docs/claude_workflow.md`, routing names (`Charlie`, `Prof. Dos Reis`), `severity:medium` labels |
| log-error | ✅ | error_type table rows (`npm run error:log`, `velocity:log`, `npm run claim`), Claude tool names `Read/Write/Edit` in `FILE_FAIL`/`EDIT_PRECOND`, **stale default `~/.lccjs/velocity.db`** (canonical is `lccjs.db`) |
| write-til-doc | ✅ | `npm run claim …` (no `$CLAIM_CMD`), `docs/puzzle-velocity.csv` (no `$VELOCITY_CSV`), hardcoded worktree path in recipe |
| yegor-pm | ❌ | `npm run velocity:log`/`close`/`test`, `sqlite3 ~/.lccjs/lccjs.db`, `docs/skills.md` as "authoritative source" |
| puzzle-triage | ❌ | `npm run puzzle:status`, `docs/learnings/…-dragonfruit.md §3`, `docs/skills.md` |

Severity low — these are user-local drafts and most residue is in example blocks — but the spec's
own config-abstraction rule (pitfall #8) is only partially met.

### CC-2 — Conversion scaffolding shipped as skill content (6 of 8 skills)
issue-review, next-best-action, guide-human-decision, yegor-pm, puzzle-velocity, and puzzle-triage
all ship a `## Hermes Tool Mapping (from Claude)` section. That's *conversion-process* metadata
("from Claude") leaking into the shipped skill body — it documents the rewrite instead of just
applying it. Harmless to a reader but it's authoring residue that should be trimmed (or demoted to
`references/`).

### CC-3 — Description convention (all 8, minor)
The spec's checklist says descriptions should *start* with "Use when …". None of the 8 do — they
all lead with the behavior, then include a "Use when …" trigger clause. By `skill-creator`'s
guidance (description = what it does AND when to trigger) this is actually fine/preferable, but it's
a uniform deviation from the Hermes spec's own stated rule. No action needed; noted for consistency.

### CC-4 — Non-portable `related_skills` (puzzle-triage)
`puzzle-triage` lists `fruit-agent-orchestrate` in `related_skills` — an lccjs-specific 7-agent
slash-skill that won't resolve for other Hermes users (spec pitfall #7). Should be dropped/replaced.

### CC-5 (positive) — Frontmatter + hard-skill fidelity are strong
Worth recording: all 8 frontmatters are conformant and consistent; the two skills with reference
files (issue-review → `type-rubrics.md`, write-til-doc → `REFERENCE.md`→`references/til-content-spec.md`)
transferred them intact; log-error's full 16-code `error_type` vocabulary survived verbatim; and
guide-human-decision even improved on the source with dynamic repo detection
(`gh repo view --json nameWithOwner`). This is above-average port quality.

---

## Per-skill notes (concise)

- **issue-review — MINOR.** Cleanest of the rubric-logic skills. `type-rubrics.md` transferred whole
  (all 7 type sections + compound detection). Nits: `## Hermes Tool Mapping` scaffolding; checklist
  has a leftover conversion-time item ("Skill itself loads … confirmed in conversion session");
  `### Verification Checklist` is H3 not H2.
- **next-best-action — MINOR.** Faithful checklist logic. Config not abstracted (CC-1). One altered
  quoted user-utterance ("pls file a tracker" → "pls create a tracker") — quotes should be verbatim.
- **guide-human-decision — CLEAN.** Two-path walkthrough intact, dynamic repo detection, no hardcodes.
  Only cosmetic nits (blank line before closing `---`).
- **log-error — MINOR.** `error_type` vocab perfect; `## Configuration` present but abstraction
  incomplete (CC-1) and **stale `velocity.db` default** carried from source. `## Triggers` used
  instead of `## When to Use`. Claude tool names linger in two table rows.
- **write-til-doc — MINOR.** `REFERENCE.md` transferred. Config section present but `claim` cmd and
  CSV path not abstracted (CC-1); a couple of source ticket-citations dropped in genericization.
- **yegor-pm — MINOR.** XDSD represented faithfully, but roster drift: source/`docs/skills.md` say
  **10** sub-skills, the port encodes **11** (adds `io-layer-testing` across frontmatter + body).
  io-layer-testing is a real skill, so this may be an intentional enhancement — but it diverges from
  the documented source and matches the same "11" error flagged in ticket #1071 (pass 1). Worth a
  ruling: intended addition, or correct back to 10? lccjs commands not abstracted (CC-1).
- **puzzle-velocity — MATERIAL.** See spotlight above.
- **puzzle-triage — MINOR (notable drift).** Ranking + read-only constraint preserved. But ships
  scaffolding (CC-2), `fruit-agent-orchestrate` related-skill (CC-4), and drops the `🔒 Locked`
  (derived cluster-lock) partition — replacing it with invented `🔵 In-Flight` / `⏳ Sequenced`
  partitions not in the documented source. The substitution is defensible but is undocumented drift.

---

## Filed tickets (per #1105 close protocol / Rule 10)

- **#1125** ✅ **RESOLVED** — `fix(skills)`: puzzle-velocity correctness defects (inverted delta sign,
  invented lowercase-agent pitfall, dropped "Skip when" guards — the MATERIAL finding). All three
  corrected in the Hermes port (`delta = estimate − actual`, uppercase terminal-name pitfall,
  restored "Skip when"). Note: the dropped-guard list above mentioned "skip no-repo-file work", but
  the canonical source carries no such guard and project convention (#215/#216) logs no-repo-file
  work — so the restored section matches the canonical's three bullets and explicitly excludes that
  non-guard.
- **#1126** — `chore(skills)`: authoring-hygiene sweep across the ported skills (config abstraction
  CC-1, remove `## Hermes Tool Mapping (from Claude)` scaffolding CC-2, drop `fruit-agent-orchestrate`
  from puzzle-triage related_skills CC-4, resolve the yegor-pm 10-vs-11 roster question, rule on the
  puzzle-triage dropped-partition drift).

CC-3 (description style) and CC-5 (positives) need no action. The puzzle-triage dropped-partition
drift is folded into the hygiene sweep as a fidelity item to rule on.
