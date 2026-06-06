# Prioritization Alternatives to RICE for Solo/Passion/AI-PM Projects (#948)

**Date:** 2026-06-06  
**Agent:** APPLE  
**Parent:** #945  
**Scope:** Survey frameworks suited to lccjs's context (solo dev, small real user base, concurrent AI agents, experimentation lab) and produce a ranked recommendation.

---

## Context: where RICE fails in this project

The `stats/rice-notes.md` from #811 already diagnosed the concrete failure modes:

| Failure mode | Observed instance |
|---|---|
| Human-gating inflation | #798, #689 (RICE 19.2, 16.8) — cheap human decisions inflate RICE via low E |
| Reach compression for agent work | Most agent-actionable items share R=1–2, so R barely differentiates |
| No parallelism/collision signal | RICE says nothing about two agents touching the same files |
| No learning/experiment value | Tickets worth doing for system understanding don't surface in RICE |
| No chain-unblocking momentum | #677 (tracker) looks like a 1h task; it spawns many children |

RICE was designed for large product teams where Reach is the key differentiator. For this project, Reach is either pinned near 1 (agent-internal) or near 4 (public GitHub Pages) with little meaningful spread in between.

---

## Framework survey

### 1. ICE — Impact × Confidence / Ease

**Formula:** `ICE = I × C / E` (Ease = inverse of Effort; usually 1–10 scale)

**What it solves that RICE doesn't:** Drops the Reach dimension entirely. For a project with a small known user base, R adds noise rather than signal — it inflates anything with a public-facing browser component regardless of how impactful that component actually is. ICE is honest about this.

**What it requires:** The same I, C, E estimates already maintained for RICE. No new data. An "Ease" score on a 1–10 scale is more intuitive than converting H_min to decimal hours.

**Composition with Yegor priority + severity labels:** Direct. Severity labels already map roughly to Impact (severity:critical → I=3, severity:high → I=2, severity:low → I=0.5). ICE can reuse the existing label taxonomy as a fast heuristic.

**AI agent self-applicability:** High. Agents can read severity and complexity labels, estimate confidence from issue clarity, and produce an ICE score from the issue body alone. No Reach estimation requires understanding the user population, which agents cannot reliably assess.

**Verdict:** Drop-in replacement for RICE. Simpler, more honest for this project's context. Loses nothing meaningful.

---

### 2. WSJF — Weighted Shortest Job First (SAFe)

**Formula:** `WSJF = Cost of Delay / Job Size`  
Cost of Delay = Time Criticality + User/Business Value + Risk Reduction/Opportunity Enablement

**What it solves that RICE doesn't:** Surfaces urgent-but-small work that RICE over-penalizes via the Effort denominator. WSJF's Cost of Delay component explicitly models opportunity cost — the value lost each time period the work sits undone.

**What it requires:** Three separate CoD sub-scores per ticket (time criticality, user/business value, risk-reduction), each on a relative Fibonacci-like scale. This is SAFe PI Planning overhead — meaningful for coordinated product teams, expensive for a solo dev. The sub-scores are ordinal comparisons across the backlog, not independent per-issue assessments.

**Composition with Yegor priority + severity labels:** Awkward. Yegor priority is already a holistic ordinal that captures some of what WSJF measures. Maintaining both in parallel creates calibration work with no clear benefit over using Yegor priority directly.

**AI agent self-applicability:** Low. CoD requires relative ranking across the full backlog, which agents cannot do without reading all open issues. An agent picking up a single ticket cannot self-apply WSJF without an orchestrator pass.

**Verdict:** Not recommended. The overhead is unjustified for a solo-dev context; the CoD decomposition adds no signal beyond what Yegor priority + severity already capture intuitively.

---

### 3. MoSCoW — Must/Should/Could/Won't

**Formula:** Categorical: Must (MVP blocker), Should (important but not blocking), Could (nice-to-have if time allows), Won't (explicitly excluded).

**What it solves that RICE doesn't:** No cardinal score — just a triage gate. Eliminates the false precision of RICE's decimal output. Pairs naturally with labels and milestone gates.

**What it requires:** A human or orchestrator decides the category per ticket. Cheap to assign, but categories must be revisited as the project evolves (a "Won't" today may become a "Must" after a user request).

**Composition with Yegor priority + severity labels:** This is already partially in place. `severity:critical` ≈ Must, `severity:high` ≈ Should, `severity:low` ≈ Could, `deferred` ≈ Won't. Adding explicit MoSCoW as a separate label would be duplication.

**AI agent self-applicability:** Moderate. Agents can classify based on severity labels, but the categorical decision ("is this truly blocking?") often requires human context about external dependencies.

**Verdict:** Already implemented implicitly via severity labels. No new adoption needed; naming it "MoSCoW" adds documentation clarity but no functional gain.

---

### 4. Dependency-first / unblocking priority

**Formula:** `Unblock Score = count of open issues blocked behind this ticket`

**What it solves that RICE doesn't:** Captures chain value. A ticket that directly unblocks 5 others has leverage RICE cannot see — RICE only measures the ticket's own impact. #677 (tracker, RICE=4.0) is a weak example; #798/#689 (human rulings that unblock agent chains) are strong ones.

**What it requires:** A dependency graph: for each open issue, which other issues reference it as a blocker (e.g., via "blocked by #N" in the body)? The lccjs issue tracker has inconsistent use of blocking language. Automating this requires either structured "blocked by #N" fields or a parsing pass over issue bodies.

**Composition with Yegor priority + severity labels:** Natural as a tie-breaker or multiplier, not a replacement. `unblock_score × yegor_priority` preserves the existing ordinal while surfacing bottleneck tickets.

**AI agent self-applicability:** Low to medium. An agent picking up a single ticket cannot know the downstream dependency graph without an orchestrator pass that reads all open issues. But an orchestrator can compute `unblock_score` cheaply and stamp it on each issue as a label or comment.

**Verdict:** Valuable as an augmentation, not a replacement. Most useful when applied by the orchestrator during triage, not by individual agents at claim time.

---

### 5. Learning value dimension

**Formula:** Additive weight: `learning_value ∈ {0, 1, 2}` applied as `score × (1 + 0.2 × learning_value)`

**What it solves that RICE doesn't:** Recognizes that some tickets are worth doing because they produce understanding — about the assembler's edge cases, about AI PM discipline, about the ISA. A pure RICE or ICE score treats all work as interchangeable output; for an experimentation lab, "teaches something new" is a first-class priority signal.

**What it requires:** A subjective 0–2 weight assigned per ticket: 0 = routine/mechanical, 1 = reveals something about the system, 2 = advances AI-PM or ISA methodology understanding. Cheap to assign when filing; hard to audit after the fact.

**Composition with Yegor priority + severity labels:** Additive. Works cleanly as a multiplier on top of any cardinal score (RICE, ICE) without restructuring the existing taxonomy. Could also be implemented as a `priority:learning-spike` label.

**AI agent self-applicability:** Moderate. Agents can identify research/spike tickets and apply a default learning_value=1, leaving the human to override to 2 for methodology-advancing work.

**Verdict:** Lightweight and honest. Formalizes something the project already does informally (research tickets get filed even when RICE doesn't justify them). Worth adding as a label convention rather than a score modifier.

---

### 6. Collision risk score

**Formula:** `collision_risk ∈ {low, medium, high}` based on which hot-path files the ticket touches.

**What it solves that RICE doesn't:** Multi-agent scheduling. Two agents picking the two highest-ICE tickets that both modify `src/core/assembler.js` and `docs/puzzle-velocity.csv` will race and produce a rebase conflict. RICE ignores this entirely. Collision risk makes file contention a first-class scheduling signal.

**Hot-path files** (high baseline collision risk — frequently modified across agents):
- `src/core/assembler.js` — core logic, touched by most DEV tickets
- `src/core/interpreter.js` — parallel hot-path
- `docs/puzzle-velocity.csv` — every agent writes a row on close (mitigated by SQLite re-export, but still races)
- `docs/learnings/README.md` — written by WRITER on close
- `TODOS.md` — written by PM on filing

**What it requires:** An orchestrator labels each ticket `collision:low/medium/high` based on which files the issue's code sites touch. Agent worktree claims (`npm run claim`) already capture the branch; a post-claim diff of recent commits touching the same files could automate this signal.

**Composition with Yegor priority + severity labels:** Orthogonal — it is a scheduling constraint, not a priority modifier. "Don't assign two `collision:high` tickets to concurrent agents touching the same file" is a scheduling rule, not a priority re-ranking.

**AI agent self-applicability:** High for medium/low risk; orchestrator handles high-risk labeling before waves are composed. Individual agents cannot know what other agents are currently doing without checking `git worktree list` and the branch names.

**Verdict:** Uniquely relevant for this project's multi-agent worktree model. No other framework addresses this. Low implementation cost (label convention + orchestrator pre-check). High ROI.

---

## Recommendation

### Primary: Replace RICE with ICE

Drop R from scoring. The Reach dimension adds no meaningful differentiation for this project — it inflates browser-facing features (R=4) and compresses agent-internal work (R=1) without improving selection quality. ICE reuses all existing I, C, E estimates and is simpler to maintain.

Practical mapping from existing RICE rubric:
- Keep I (Impact) and C (Confidence) scales unchanged
- Convert E from decimal hours to an Ease scale 1–10 (10 = trivial, 1 = very hard), where `Ease = 10 / (H_min / 6)` approximately maps the ≤60m Yegor cap to 1–10
- Filter `actionable=N` before using ICE to rank agent picks (same discipline as RICE)

This is a one-pass migration: re-score the open backlog with ICE, archive the RICE columns in `stats/rice-notes.md`, and update the rubric doc.

### Secondary augmentation: Collision risk label

Add `collision:low/medium/high` as a label convention. The orchestrator applies it during wave composition based on which files the ticket's code sites touch. The wave-composition protocol (`docs/research/827-second-wave-protocol-2026-06-05.md`) already avoids scheduling hot-path conflicts by inspection; formalizing it as a label makes the constraint legible to agents and auditable after the fact.

This addresses the one failure mode that no scoring formula can capture: two agents picking top-ranked tickets that race on the same files.

### What to skip

- **WSJF**: SAFe overhead, no gain over existing Yegor priority for a solo-dev workflow.
- **MoSCoW as a new system**: Already implemented via severity labels; renaming it adds documentation noise.
- **Dependency-first as a primary metric**: Valuable but requires orchestrator-level computation. Use unblock count as a Yegor priority input during triage, not a standalone formula.
- **Learning value as a score modifier**: Use a label (`priority:learning-spike`) rather than a multiplicative weight. Avoids score inflation and keeps the formula clean.

---

## Composability summary

| Framework | Replace RICE? | Compose with Yegor? | Agent self-applicable? | Implementation cost |
|---|---|---|---|---|
| ICE | Yes — recommended | Direct (same dimensions minus R) | High | Low (rescore existing data) |
| WSJF | No | Awkward | Low | High |
| MoSCoW | No (already done) | Yes (severity labels) | Moderate | Zero (already in place) |
| Dependency-first | No (augmentation) | Yes (Yegor input) | Low | Medium (orchestrator pass) |
| Learning value | No (label only) | Yes (additive label) | Moderate | Low (label convention) |
| Collision risk | No (scheduling constraint) | Orthogonal | High | Low (label + orchestrator pre-check) |

---

## Suggested next steps

1. **File a ticket to replace RICE scoring with ICE** — rescore open backlog, archive RICE columns, update the rubric. One-time migration, ≤30m agent work.
2. **Add `collision:low/medium/high` to the label taxonomy** — update label docs and wave-composition protocol. No scoring changes needed.
3. **Document `priority:learning-spike`** as a label convention — tag research/methodology tickets that should survive low ICE scores.
