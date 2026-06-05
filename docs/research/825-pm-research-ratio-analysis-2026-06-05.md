# PM/Research Ratio Analysis — Orchestration Cycle Health

**Issue:** #825  
**Date:** 2026-06-05  
**Agent:** FIG  
**Role:** RESEARCH + DATA

---

## Question

The 2026-06-05 `/fruit-agent-orchestrate` session produced 10 actionable tickets, 4 of which were PM or RESEARCH type — leaving only 6 code/docs tasks for 7 agents. Is this ratio a genuine problem? Where does it come from, and what (if anything) should change?

---

## Data

Source: `~/.lccjs/velocity.db`, 712 rows, 2026-05-28 through 2026-06-05.

### Overall role distribution (all closed tickets)

| Role | Count | % of total |
|------|-------|-----------|
| DEV | 232 | 32.6% |
| WRITER | 175 | 24.6% |
| RESEARCH | 128 | 18.0% |
| PM | 57 | 8.0% |
| DATA | 39 | 5.5% |
| TEST | 24 | 3.4% |
| ARC | 19 | 2.7% |
| SPIKE | 12 | 1.7% |
| CHORE | 11 | 1.5% |
| COMBO | 10 | 1.4% |
| REVIEW | 5 | 0.7% |

PM + RESEARCH + DATA + SPIKE combined: **33.2%** of all closed rows.

### Daily PM+research vs code/docs rows (broad definition)

PM/research = PM, RESEARCH, DATA, SPIKE. Code/docs = everything else.

| Day | PM/research | Code/docs | Total | PM/research % |
|-----|------------|-----------|-------|--------------|
| 2026-05-28 | 0 | 41 | 41 | 0.0% |
| 2026-05-29 | 13 | 23 | 36 | 36.1% |
| 2026-05-30 | 25 | 23 | 48 | 52.1% |
| 2026-05-31 | 25 | 37 | 62 | 40.3% |
| 2026-06-01 | 47 | 77 | 124 | 37.9% |
| 2026-06-02 | 12 | 34 | 46 | 26.1% |
| 2026-06-03 | 48 | 107 | 155 | 31.0% |
| 2026-06-04 | 36 | 78 | 114 | 31.6% |
| 2026-06-05 (partial) | 11 | 15 | 26 | 42.3% |

Median (excl. bootstrap day): **~36–38%**. The 2026-06-05 orchestration session's 40% actionable ratio is within the historical range, not an outlier.

### Average actual_min by role

| Role | n | avg actual (min) | avg H (min) |
|------|---|-----------------|------------|
| REVIEW | 4 | 10.3 | 26.3 |
| SPIKE | 11 | 9.9 | 51.0 |
| DATA | 37 | 8.4 | 30.3 |
| DEV | 195 | 7.7 | 36.3 |
| ARC | 18 | 7.5 | 44.4 |
| RESEARCH | 107 | 7.0 | 43.0 |
| TEST | 24 | 5.8 | 36.7 |
| WRITER | 154 | 4.4 | 24.4 |
| PM | 48 | 3.5 | 17.0 |

PM is the fastest role to close (3.5m actual), faster than WRITER (4.4m) and far faster than DEV (7.7m). RESEARCH averages 7.0m — comparable to DEV. PM tasks are not a throughput bottleneck.

---

## Findings

### Finding 1: The 40% ratio is within historical norms

The complaint is partly a false alarm. The 40% PM/research fraction in the 2026-06-05 actionable pool matches the project's historical median (36–38%). No anomaly.

The exception is 2026-05-30 at 52% — that day was a process-improvement sprint triggered by the SQLite migration (PM and RESEARCH heavy by design). Normal operating range appears to be **30–42%**.

### Finding 2: Thin actionable pools are caused by human-gated issues, not PM filing rate

On 2026-06-05, only 10 of ~55 open issues were agent-actionable. The breakdown of the other 45:

- **Blocked** (14): not about PM filing rate
- **Human-decision-required / humans-only / decision** (15+): the largest single category
- **Iceboxed / proposal** (4): intentionally parked
- **Deferred** (4): lower priority
- **In-flight** (2): already claimed

Even if every PM/research ticket were removed from the open backlog, the actionable pool would barely grow — the constraint is human-gated issues, not PM density.

### Finding 3: PM tickets actually replenish the code pipeline

PM tasks (RICE analysis, triage, tracker audits) surface new actionable DEV and WRITER tickets. The 2026-06-05 RICE analysis (#820) and orchestrator WWW audit (#819) are upstream of at least 4-6 future code tickets. Suppressing PM ticket filing to improve the ratio would shrink the future code pipeline, not help it.

### Finding 4: The fleet size is sometimes larger than the actionable supply

The project runs 7 concurrent agents. When the actionable pool is ≤10 tickets, 7 agents means ≤1.4 tickets per agent on average — with coordination overhead, some agents get 1 ticket and some get none. This is a fleet-sizing problem, not a PM/research-ratio problem.

---

## Root cause

The thin actionable pool in the 2026-06-05 cycle has one root cause: **14+ tickets are gated on human decisions** that have not been resolved. Every orchestration cycle that runs without a prior human-decision review session will hit the same wall regardless of PM/research ratio.

---

## Recommendations

### R1 — Schedule a human-decision review before each orchestration cycle (high impact, low effort)

Before running `/fruit-agent-orchestrate`, the human owner should spend 5–10 minutes resolving the oldest 2–3 `human-decision-required` issues. Each resolved gate typically unblocks 1–3 downstream tickets. This directly addresses the actionable-pool constraint.

**Measurable target:** actionable pool ≥ 14 tickets (2 per agent) before a 7-agent orchestration run.

### R2 — Do not cap PM/research ticket filing (counter-recommendation)

The data shows PM/research tasks close faster than code tasks and replenish the code pipeline. The ~35% steady-state ratio is healthy. Imposing a filing cap would deplete future code work without solving the actual constraint (human-gated issues).

### R3 — Scale fleet to actionable supply, not maximum capacity

When the actionable pool is ≤10 tickets, activate 5 agents and keep 2 on standby. The standby agents pick up tickets as others close. This prevents forcing 7 agents into a pool of 10 tickets where role-fit compromises (a RESEARCH agent doing WRITER work) degrade quality.

**Heuristic:** `fleet_size = min(7, floor(actionable_pool * 0.7))` — leave a 30% buffer for rapid handoffs as tickets close.

---

## Summary

| Question | Answer |
|----------|--------|
| Is 40% PM/research unusual? | No — within historical 30–42% range |
| Why do PM tasks pile up? | They don't; the actionable pool shrinks because human-gated issues accumulate |
| Should PM filing be rate-limited? | No — PM tasks replenish the code pipeline |
| What actually fixes thin cycles? | Human-decision reviews before orchestration + fleet-size matching |

Closes #825
