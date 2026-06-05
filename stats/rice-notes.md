# RICE Scoring — lccjs open issues
**Generated:** 2026-06-05 by DRAGONFRUIT (issue #811)
**Issues scored:** 41 of ~57 open

---

## Rubric

| Dimension | Scale |
|-----------|-------|
| **R (Reach)** | 1 = internal agents only · 2 = developer/maintainer workflow · 3 = toolchain end users (people writing LCC assembly) · 4 = broad public (GitHub Pages visitors, educators) |
| **I (Impact)** | 0.25 = cosmetic · 0.5 = minor QoL · 1 = standard improvement · 2 = significant (unblocks chains or clear UX win) · 3 = flagship / critical bug |
| **C (Confidence)** | % confidence in R and I estimates (30 = speculative · 50 = rough · 70 = reasonably confident · 80 = confident · 100 = certain) |
| **E (Effort)** | H_min / 60 in hours (Yegor ≤60m cap; items requiring >1h should already be decomposed) |

**Formula:** `RICE = R × I × (C/100) / E_hrs`

**Yegor priority (0–10):** 0 = humans-only / agent-unactionable · 1–2 = deferred/cosmetic · 3–4 = low · 5–6 = medium · 7–9 = high · 10 = critical

---

## Key findings and divergences

### 1. Human-decision items dominate the top RICE scores

Issues #798, #689, and #507 rank 1–3 by RICE (scores 19.2, 16.8, 9.6) — all are humans-only and not agent-actionable. The pattern: they are cheap decisions (E ≈ 0.25h) that unblock or affect high-reach work chains, so RICE inflates their apparent priority. Takeaway: **filter `actionable=N` before using RICE to pick agent work.** After filtering, the top scores are #806 and #805 (both 6.40) followed by #518 (6.00, also human-gated) and #732 (4.80).

### 2. Best fully agent-actionable tickets (actionable=Y, top RICE)

| Rank | Issue | RICE | Yegor | Type |
|------|-------|------|-------|------|
| 1 | #806 BUG: browser tests defunct playground-input | 6.40 | 7 | bug |
| 2 | #805 BUG: displayWithSeparator newline layout | 6.40 | 7 | bug |
| 3 | #732 DEV: share-as-link URL encoding | 4.80 | 4 | feature |
| 4 | #677 TRACKER: GitHub Pages playground | 4.00 | 5 | tracker |
| 5 | #159 sext semantics follow-up | 4.00 | 5 | research |
| 6 | #733 DEV: download .a from playground | 3.73 | 3 | feature |

#806 and #805 are well-aligned (high RICE and high Yegor) — these are the clearest agent targets. #732 and #733 are deferred browser features that score surprisingly high on RICE due to their broad reach (R=4); Yegor under-prioritized them because they carry `severity:low` labels.

### 3. Deferred browser features are under-prioritized relative to RICE

#732 (share-as-link, RICE=4.80) and #733 (download .a, RICE=3.73) are both labeled `deferred,severity:low` with Yegor priorities of 4 and 3 respectively. But R=4 (broad public) × I=2 (share-as-link) × C=60% / E=1h = 4.80 suggests these are worth reconsidering. The `deferred` label was assigned before the playground was substantially built out; the cost-benefit ratio has shifted.

### 4. RICE does not account for dependency chains

#677 (TRACKER: GitHub Pages playground) scores 4.00 but is itself a tracker that spawns many child issues, each requiring its own effort. RICE treats it as a single 1h task. Similarly, #159 (sext semantics, RICE=4.00) is blocked on an external email reply from Prof. Dos Reis — the real effort bottleneck is human latency, not agent work hours.

### 5. Easter-egg and malformed issues are consistently deprioritized

#789, #790, and #477 all score 0.08 on RICE (R=1, I=0.25, C=30%, E=1h) and Yegor priority=1. Both frameworks agree: these are near-zero priority. The near-zero C% reflects that they are either blocked on opcode layout decisions or reference fabricated artifacts (ETC.txt in #477). Safe to close or leave indefinitely.

### 6. #99 has a data quality problem

#99 (.bin in lcc -i) scores 0.60 on RICE partly because the feature already exists (`ilcc.js` handles `.bin` at line 53). Low C%=30 captures this uncertainty. This confirms: **issue tracker data quality directly degrades RICE signal.** When a "Have" is factually wrong (feature exists), the issue should be closed, not scored and ranked.

---

## Suggested next steps (from RICE analysis)

1. **Immediately actionable:** #806, #805 — both bugs, RICE ≥ 6, Yegor 7, no blockers.
2. **Reconsider deferral:** #732, #733 — high RICE suggests deferral may be outdated now that the browser playground is mature.
3. **Unblock the blockers:** #798, #689 are cheap human decisions with outsized downstream value. Flagging for human attention.
4. **Close stale items:** #99 (already implemented), #477 (fabricated ETC.txt), #789/#790 (easter eggs with no ISA basis and no opcode budget).
