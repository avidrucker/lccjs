# Velocity Analytics Batch — Q4, Q17, Q18, Q28, Q29

**Ticket:** #701 · **Parent:** #427 · **Date:** 2026-06-04 · **Agent:** GRAPE  
**Dataset:** 579 rows total, 494 with `actual_min`, 8 agents, from `~/.lccjs/velocity.db`

---

## Q4 — Wall-clock per puzzle size class

**Question:** What is the actual wall-clock overhead per H-size class (H≤15m vs. 15–60m)?

| H class | n   | mean actual_min | median | std  |
|---------|-----|-----------------|--------|------|
| ≤15m    | 101 | 3.17m           | 2.0m   | 3.90 |
| 16–60m  | 370 | 6.93m           | 4.0m   | 7.36 |
| >60m    |   7 | 7.14m           | 7.0m   | 3.53 |

**Finding:** AI wall-clock is roughly 2× higher for H 16–60m puzzles than ≤15m ones (3.2m vs. 6.9m mean), but medians are closer (2m vs. 4m), with the mean inflated by outliers. The H cap structurally over-estimates AI cost at all tiers — the longest puzzles in the 16–60m bucket still finish in under 10m median. The >60m class is too sparse (n=7) to interpret.

---

## Q17 — H-estimate tightness vs. delta_c_min variance

**Question:** Do agents working tighter H estimates (H≤15m) have lower `delta_c_min` variance than H=60m agents?

| H class | n   | delta_c_min std | mean delta_c |
|---------|-----|-----------------|--------------|
| ≤15m    |  89 | 4.22            | 4.28         |
| 16–60m  | 340 | 8.30            | 11.13        |
| >60m    |   7 | 19.73           | 42.14        |

Mann-Whitney test (≤15m vs. 16–60m): U=6042, **p<0.001**

**Finding:** Yes — tighter H puzzles have significantly lower C-estimate variance. The ≤15m bucket shows std=4.2 vs. std=8.3 for 16–60m (2× difference), and the difference is highly significant. This suggests that smaller puzzles are more predictable for the AI, not just shorter. The mean delta_c growing with H class also indicates systematic under-C-estimation on larger tasks.

---

## Q18 — Predicting H-estimate overshoot from row features

**Question:** Can role/h_min/agent/model predict whether a puzzle will exceed its H estimate?

**Base rate:** Only 5/478 puzzles with actuals exceeded their H estimate (1.0%). WRITER leads at 2.5%, DEV at 1.3%; all other roles have 0% overshoots.

Point-biserial r(h_min, exceeded_h) = −0.056, p=0.224 (not significant).

**Finding:** The dataset is essentially unclassifiable for this question — the base rate is too low (1%) for any predictor to beat majority-class guessing. AI agents almost never exceed the H estimate; the H cap is so conservative relative to actual AI speed that overshoot is a rare event. This makes Q18 unanswerable with the current corpus: there is not enough positive-class data. The more interesting version of this question is predicting C overshoot (actual > c_min), which has a higher base rate.

---

## Q28 — Per-agent learning curves (C accuracy over time)

**Question:** Is there evidence of per-agent learning curves — improving C accuracy over successive sessions?

Spearman correlation between row order (time) and |delta_c_min| per agent:

| Agent       | n  | Spearman r | p     | Trend     |
|-------------|----|------------|-------|-----------|
| APPLE       | 80 | −0.183     | 0.104 | flat      |
| CHERRY      | 75 | +0.067     | 0.568 | flat      |
| ELDERBERRY  | 71 | +0.245     | 0.040 | degrading |
| BANANA      | 65 | −0.014     | 0.913 | flat      |
| DRAGONFRUIT | 51 | −0.293     | 0.037 | improving |
| FIG         | 37 | −0.261     | 0.119 | flat      |
| GRAPE       | 10 | −0.256     | 0.475 | too few   |

**Finding:** Only DRAGONFRUIT shows a statistically significant improvement trend (r=−0.29, p=0.04); ELDERBERRY shows a significant degradation trend (r=+0.25, p=0.04). All others are flat. These are weak effects and the significance threshold is not corrected for multiple comparisons (7 agents tested). Overall the data does not strongly support the "agents get better at estimation over time" hypothesis — most agents appear stationary in their C calibration. The ELDERBERRY degradation warrants inspection: it may reflect assignment of progressively harder/longer puzzles over time rather than true calibration drift.

---

## Q29 — Statistical power to detect a 10% reduction in actual_min

**Question:** What is the statistical power of the dataset to detect a 10% reduction in actual_min from a protocol change?

Dataset: n=478 rows with actuals; mean actual_min=6.14m; std=6.90m.

To detect a 10% reduction (Δ=0.61m) with 80% power (α=0.05, two-sided t-test):

**n needed per group = 1,982**

Current corpus split two ways: ~239 per group.

**Finding:** The dataset is substantially underpowered for detecting a 10% change in mean actual_min. The high coefficient of variation (std/mean ≈ 1.12) makes the signal hard to see against the noise — AI task durations vary widely across puzzle types, roles, and agents. To run a properly powered A/B experiment on a protocol change, the corpus would need roughly 4× growth (to ~4,000 rows with actuals). A 20% effect size would be detectable at ~500 per group (~1,000 rows total), which is achievable within ~2–3 months at current velocity. Alternatively, restricting the analysis to a single role (e.g., DEV-only rows, n=155) or single agent reduces variance but also reduces power.

---

## Summary table

| Q  | Finding | Actionable? |
|----|---------|-------------|
| Q4  | AI wall-clock: 3.2m median (≤15m H) vs. 4.0m (16–60m H) — H cap is 5–15× AI actual | Yes: calibrate C estimates downward |
| Q17 | ≤15m puzzles have 2× lower C-variance than 16–60m (p<0.001) — smaller = more predictable | Yes: decompose more aggressively |
| Q18 | H-overshoot base rate is 1% — unclassifiable; consider C-overshoot instead | File follow-on for C-overshoot analysis |
| Q28 | No consistent learning curves; DRAGONFRUIT improving (p=0.04), ELDERBERRY degrading (p=0.04) | Inspect ELDERBERRY puzzle-type distribution |
| Q29 | Dataset needs 4× growth to detect 10% effect; 20% effect detectable at ~1,000 rows | Resume power analysis at 1,000 actuals |
