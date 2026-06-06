# lccjs issue lifecycle analysis

**Issue:** #838 · **Agent:** ELDERBERRY · **Date:** 2026-06-05 · **Role:** RESEARCH

> **Companion to** `repo-activity-analysis-838.md` (BANANA, same issue). BANANA covers commit types, agent throughput, role distribution, and the human-gate queue. This document covers the issue side: open/close flow, resolution time, open-issue age distribution, and C-estimate calibration trends.

---

## Data sources

| Source | Coverage |
|---|---|
| `gh issue list --state closed --limit 500` | 500 most-recent closed issues (June 1–6) |
| `gh issue list --state open --limit 200` | 61 currently open issues |
| `~/.lccjs/velocity.db` | 522 rows with `actual_min > 0` |

---

## 1. Issue flow — daily open/close balance

| Date | Opened | Closed | Net | Cumulative balance |
|---|---|---|---|---|
| 2026-06-01 | 14 | 9 | +5 | +5 |
| 2026-06-02 | 115 | 110 | +5 | +10 |
| 2026-06-03 | 84 | 81 | +3 | +13 |
| 2026-06-04 | 147 | 130 | +17 | +30 |
| 2026-06-05 | 108 | 132 | −24 | +6 |
| 2026-06-06 | 32 | 38 | −6 | 0 |

**Interpretation:** The queue is self-regulating at the week level — ~500 issues opened and ~500 closed in 6 days, ending near zero net. Day-to-day the system runs at slight surplus (more opened than closed) until a catch-up burst. June 4 was peak production (147 opened, 130 closed); June 5 was the biggest drawdown (−24 net). The system has not yet shown a runaway accumulation pattern.

---

## 2. Resolution time (500 closed issues)

| Percentile | Time |
|---|---|
| Median (p50) | 0.6 h |
| p90 | 11.9 h |
| p99 | 47.0 h |
| Mean | 3.5 h |
| Max | 82.3 h |

**Interpretation:** The vast majority of issues close within an hour of opening — a direct consequence of agents picking up and closing tickets within a single session. The long tail (p99 = 47h, max = 82h) represents issues that sat open overnight or across session boundaries before being picked up.

### Resolution time distribution

| Bucket | Count | Share |
|---|---|---|
| < 1 h | 321 | 64% |
| 1 h – 1 d | 166 | 33% |
| 1 – 3 days | 11 | 2% |
| 3 – 7 days | 2 | < 1% |
| > 1 week | 0 | 0% |

97% of closed issues resolved within 24 hours.

---

## 3. Resolution time by type and severity

### By severity label

| Severity | n | Median | Mean | p90 |
|---|---|---|---|---|
| severity:high | 7 | 0.8 h | 2.7 h | 14.3 h |
| severity:medium | 22 | 0.5 h | 3.5 h | 7.9 h |
| severity:low | 218 | 0.7 h | 4.6 h | 13.0 h |
| (unlabeled) | 253 | 0.5 h | 2.6 h | 7.3 h |

**Interpretation:** Severity labels are not predictive of resolution speed in this AI-agent context. `severity:high` has a *higher* p90 than `severity:low` (14.3h vs 13.0h), and all severity levels share a nearly identical median (~0.5–0.8h). Agents do not triage by severity — they process what is available. This suggests severity labels function as documentation for the human reader, not as a scheduling signal for agents.

### By type label

| Type | n | Median | Mean | p90 |
|---|---|---|---|---|
| bug | 49 | 0.7 h | 1.3 h | 3.5 h |
| documentation | 83 | 0.3 h | 2.3 h | 7.9 h |
| research | 67 | 0.6 h | 4.5 h | 13.2 h |
| enhancement | 72 | 0.7 h | 4.4 h | 13.2 h |

`bug` issues resolve fastest (mean 1.3h, p90 3.5h). `documentation` has the lowest median (0.3h) — doc edits close very quickly once started. `research` and `enhancement` share identical p90 (13.2h) — both require more exploration before closing.

---

## 4. Open issue age distribution

There are currently **61 open issues**, all filed within the past 11 days.

| Age bucket | Total | Blocked/decision |
|---|---|---|
| < 1 day | 35 | 9 (26%) |
| 1–7 days | 23 | 16 (70%) |
| 7–30 days | 2 | 2 (100%) |
| > 30 days | 0 | 0 |

**Age strongly predicts blocked status.** Issues that survive past 1 day are overwhelmingly blocked or awaiting a human decision (70%). Issues that survive past a week are *all* blocked. This is a healthy pattern: the unblocked work flows through quickly; the accumulation is structurally blocked, not just neglected.

### Oldest open issues (top 10)

| # | Age | Status |
|---|---|---|
| #40 | 10.7 d | Track upstream: cuh63 6.3 mov/mvi sign handling |
| #159 | 8.0 d | Act on Prof Dos Reis's reply re: sext semantics |
| #252 | 6.5 d | Decomplect (H1b): lift trace display out of interpreter |
| #255 | 6.5 d | Decomplect (H4): group interpreter constructor state |
| #428 | 4.3 d | Tracker: Tier 3 — N2 trap constants cluster |
| #429 | 4.3 d | Tracker: Tier 4 — interpreter decomplect cluster |
| #430 | 4.3 d | Tracker: Tier 5 — aspirational research cluster |
| #450 | 4.1 d | No in-browser LCC highlighting without separate extension |
| #507 | 3.4 d | PM: send long-line report to Prof Dos Reis |
| #517 | 3.4 d | Architect: follow-up decisions for shift-count masking |

The two oldest issues (#40, #159) are waiting on Prof Dos Reis — an external dependency. #252 and #255 are decomplect work deferred by architectural scope decisions. The Tier 3–5 trackers (#428–#430) are umbrella issues with no unblocked children.

---

## 5. C-estimate calibration — velocity.db trend

### By role (since June 1)

| Role | n | Avg actual | Avg C | C/actual ratio | % on-time |
|---|---|---|---|---|---|
| DEV | 185 | 8.1 min | — | 3.6× | 97% |
| WRITER | 127 | 4.5 min | — | 4.2× | 96% |
| RESEARCH | 102 | 6.6 min | — | 5.7× | 96% |
| DATA | 29 | 8.1 min | — | 3.4× | 97% |
| PM | 28 | 3.6 min | — | 4.5× | 100% |
| ARC | 15 | 8.5 min | — | 4.5× | 100% |
| SPIKE | 12 | 11.0 min | — | 4.8× | 100% |
| CHORE | 6 | 4.7 min | — | 2.0× | — |

RESEARCH has the highest overestimate ratio (5.7×) — agents pad uncertainty-heavy work most aggressively. CHORE and COMBO are closest to calibrated (2.0–2.4×). DEV (3.6×) and WRITER (4.2×) are the highest-volume roles and both run ~3.5–4× over-estimated.

### Daily calibration trend (rows with both actual_min and c_min)

| Date | n | Avg actual | Avg C | Ratio |
|---|---|---|---|---|
| Pre-June (null date) | 432 | 6.8 min | 15.5 min | 4.2× |
| 2026-06-01 | 40 | 6.7 | 15.6 | 3.7× |
| 2026-06-02 | 20 | 5.0 | 19.0 | 6.2× |
| 2026-06-03 | 10 | 4.3 | 24.3 | 8.1× |
| 2026-06-04 | 5 | 14.2 | 18.0 | 1.3× |
| 2026-06-05 | 12 | 3.8 | 11.6 | 4.7× |

**No consistent improvement trend yet.** The ratio fluctuates 1.3×–8.1× day-to-day. Sample sizes per day are small (5–40), making day-level trends noisy. The pre-June baseline of 4.2× is close to the June 1 figure (3.7×), suggesting no step-change from the new agent wave.

---

## 6. Key signals

1. **The queue is self-balancing at the week level.** ~500 opened, ~500 closed over 6 days — ending near zero net. Day-to-day fluctuations of ±17 to −24 are within normal variation.

2. **97% of issues close within 24 hours.** The median is 36 minutes. This is an artifact of the AI-agent workflow: issues are written, assigned, and closed within a single session. The long tail (p99 = 47h) represents multi-session work or human-gate delays.

3. **Age predicts blockedness, not neglect.** Open issues older than 1 day are 70% blocked. Issues surviving past 7 days are 100% blocked. The backlog accumulation is structural (external dependencies, deferred architecture) not a processing failure.

4. **Severity labels don't drive agent scheduling.** All severity levels resolve at roughly the same speed (~0.6h median). If priority scheduling is ever needed, it would require an explicit agent-visible signal beyond the current label set.

5. **C estimates run 3.5–5.7× high by role, with no downward trend yet.** The pre-June baseline (4.2×) and June 1 figure (3.7×) are nearly identical. Per the `c_min_priors_by_role` memory, the recommended fix is to anchor C to median actual (not H/2): DEV→5m, WRITER→3m, RESEARCH→7m.

---

## Appendix: reproducing this analysis

```bash
# Closed issue resolution times
gh issue list --state closed --limit 500 --json number,createdAt,closedAt,labels

# Open issue age distribution
gh issue list --state open --limit 200 --json number,title,createdAt,labels

# Daily velocity and calibration ratios
sqlite3 ~/.lccjs/velocity.db "
  SELECT DATE(finished_iso), COUNT(*), AVG(actual_min), AVG(c_min),
         AVG(c_min * 1.0 / actual_min)
  FROM velocity WHERE actual_min > 0 AND c_min > 0
  GROUP BY DATE(finished_iso) ORDER BY 1"
```
