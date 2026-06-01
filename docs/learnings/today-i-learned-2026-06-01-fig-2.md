# TIL 2026-06-01 — FIG (session 2)

**Research:** #208 — De-confound velocity over-time drift (HST day-bucketing + per-role correction constants)  
**Data basis:** 4 notebook runs across 63, 71, 71 (HST-fixed), and 136 calibration rows; 4 HST working days.

---

## 1. A tz fix can sharpen the signal it was supposed to remove

The working hypothesis for #208 was: UTC day-bucketing manufactured a spurious third day
(UTC 05-30 was really the 05-29 HST evening), and merging it back into day-2 would weaken
or kill the apparent over-time trend.

The fix (done in #210) did the opposite. Day-level comparison *sharpened*:

| | UTC (before) | HST (after) |
|---|---|---|
| days clearing n≥5 | 3 | 2 |
| per-day median ratio | 2.42→3.33→5.00× | 2.41→5.00× |
| day-1-vs-rest CI | [−0.08, +0.70] → no clear change | [+0.23, +1.15] → "worsening" |

Why: the continuous Spearman test ranks **absolute timestamps**, not calendar buckets — it
is bucketing-invariant. HST day-2 happens to absorb the most-over-padded cluster (TEST/SPIKE
rows from the evening session), so the two-day gap looks wider in HST than the three-day
spread in UTC.

**Lesson:** when a confound and a signal share the same axis (time), correcting the confound
can *increase* measured effect size rather than decrease it, because both sides shift.
The direction of the correction tells you nothing about whether the signal is real — you
need a different axis (within-role) to actually de-confound it.

---

## 2. The decisive de-confound was within-role, not the timezone fix

The within-WRITER check across all data cuts:

| Cut (cal rows) | Within-WRITER ρ | p |
|---|---|---|
| 63 (UTC, pre-fix) | +0.076 | 0.743 |
| 71 (HST-fixed) | +0.076 | 0.743 |
| 136 (day-4 run) | +0.198 | 0.364 |

Flat every time. Day-2 (HST) is the TEST/SPIKE/RESEARCH-heavy bucket. Load those roles into
day-2 and the day-level medians diverge; look *within* WRITER and you see nothing.

Meanwhile, the headline continuous trend weakened monotonically as data grew:

| Cut | Spearman ρ | p |
|---|---|---|
| 63-cal | +0.299 | 0.017 (significant) |
| 71-cal | +0.215 | 0.072 (marginal) |
| 136-cal | −0.40 | 0.60 (non-monotone, n.s.) |

By day-4 the signal reversed sign and lost significance entirely. **Conclusion: the apparent
"drift" is role-mix composition, not a learning curve or skill change.**

**Lesson:** for a confounded metric, correct first with a covariate (role), not a binning
fix (tz). If the effect disappears within any stratum, the aggregate trend is composition.

---

## 3. Per-role correction constants are statistically supported

Three roles reached n≥5 and can now be distinguished (Mann-Whitney):

| Role | n | Median C-ratio | vs TEST | vs WRITER |
|---|---|---|---|---|
| TEST | 10 | ~7.5× | — | p=0.004 |
| WRITER | 23 | ~3.00× | p=0.004 | — |
| DEV | 21 | ~2.76× | p=0.001–0.002 | p=0.549 |

DEV and WRITER are indistinguishable (p=0.549); TEST is a distinct population.

Actionable: **two correction constants**, not one. Rough priors:
- TEST: divide C by ~7–8 when calibrating estimates
- DEV + WRITER: divide C by ~2.5–3

The previous single global 0.33× factor (÷3) was a role-mix average that systematically
over-corrects for WRITER/DEV and under-corrects for TEST.

---

## 4. Within-role drift remains underpowered — and that's fine

To test drift *within* a role, you need ≥2 genuine working days with ≥8 rows each, within
that role. At day-4:

- WRITER: spans all 4 HST days but n=1 on day-4 — underpowered at the tail
- DEV: only 2 days clearly populated
- TEST: concentrated in a single day

A within-WRITER drift test needs ≥1 more genuine working day before it has power. Given
that the headline trend reversed sign (and the within-WRITER check never moved), the most
defensible call at current n is:

> **No learning curve detected. Apparent drift is composition. Revisit at n≥200 or when
> per-turn gap-tagging lands.**

The inter-turn gap confound (#284) is uncontrolled: `actual_min` includes human-idle time
between turns. True agent wall-clock is lower than measured, and idle-gap magnitude varies
by day. This further muddies any per-day comparison until rows are tagged.

---

## What went well

- **Prior analysis was complete.** Four ELDERBERRY/BANANA comments on #208 had done the
  heavy lifting; synthesis required reading, not re-running. This is the right division of
  labour: DATA agents re-run cells, RESEARCH agents synthesize.
- **The within-role check was the right axis.** Identifying it early (in the #210 comment)
  meant every subsequent cut answered the same test, making the trend across cuts legible.

## What didn't go well

- The issue's "Should have" section predicted the tz fix would *weaken* the signal —
  it didn't. A cleaner hypothesis would have noted the bucketing-invariance of continuous
  Spearman and predicted *only* that the day-level median table would change, not the
  headline trend. The surprise was predictable from first principles.
