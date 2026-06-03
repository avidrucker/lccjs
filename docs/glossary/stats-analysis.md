# Stats-analysis glossary

Vocabulary used in the `stats/` notebooks. Aimed at readers who understand
the lccjs velocity dataset but have not studied non-parametric statistics.

Each entry answers four questions:
- **What it is** — plain-language one-liner
- **Why it's used here** — why it fits this particular dataset
- **How to read the output** — what the numbers mean and what conclusions they license
- **Caveats** — when to distrust the result or withhold conclusions

---

## Dataset concepts

### c_ratio

The ratio of Claude's pre-task time prediction to the actual wall-clock time:
`c_ratio = c_min / actual_min`. A value greater than 1 means the estimate was
higher than reality (Claude finished faster than predicted); a value below 1
means it ran over. The median `c_ratio` is the primary calibration metric
across all analysis sections.

**Why it's used here:** It separates two distinct quantities — the human's
budget (H, enforces Yegor's ≤60 m cap) and Claude's own forward-looking
prediction (C) — so that systematic over-estimation can be measured and
corrected over time.

**How to read the output:** A median of 3× means that, across the dataset,
Claude completes tasks in roughly one-third of the time it predicted. The
distribution is right-skewed (a few very-high-ratio outliers), so the median
is more representative than the mean.

**Caveats:** `actual_min` is wall-clock elapsed time from `started_iso` to
`finished_iso`. For multi-turn tasks with human idle gaps between turns, the
measured time includes that idle time, making `c_ratio` an upper bound on true
agent wall-clock. Rows missing either `c_min` or `actual_min` are excluded
from all ratio analysis (the "calibration-usable" subset).

**Notebook location:** Defined and explained in the "Key concept: c_ratio"
cell; used in §1 (global), §2 (per-day), §3 (per-agent), §4 (per-role),
§5 (per-model), §6 (ELDERBERRY drill-down).

**See also:** [calibration-usable subset], [underpowered]

---

### calibration-usable subset

The subset of velocity rows that have both a populated `c_min` (Claude's
pre-task estimate) and an `actual_min > 0` (measured elapsed time). All ratio
analysis operates on this subset; counts and distributions in §0 cover all
rows.

**Why rows are excluded:** Rows logged before the C-estimate protocol was
introduced have no `c_min`; spontaneous PM/triage turns often start without a
prediction and are logged retroactively. Excluding them keeps ratio statistics
honest — a missing estimate is not the same as a zero estimate.

**Notebook location:** §0 prints both totals and explains the drop.

**See also:** [c_ratio]

---

## Statistical tests

### sign test (binomial test)

A non-parametric test that asks: ignoring magnitudes, are more observations on
one side of a threshold than the other? Here it tests whether significantly
more than 50% of tasks completed with `c_ratio > 1` (ran faster than
predicted). The null hypothesis is a fair coin (50/50 split).

**Why it's used here:** The dataset is heavily right-skewed and non-normal.
The sign test makes no distributional assumptions — it only counts which side
of the threshold each observation falls on — making it ideal when the
distribution shape is unknown or irregular.

**How to read the output:** A very small p-value (e.g. 8.69×10⁻⁶³) means the
observed split (e.g. 293/314) is astronomically unlikely under the null.
`stats.binomtest(n_over, n, 0.5, alternative='greater')` in SciPy performs
this test one-sided (asking whether the proportion is *greater* than 0.5).

**Caveats:** The sign test discards magnitude information. It can produce a
significant result even when most `c_ratio` values are only slightly above 1.
Always report the median alongside the p-value to convey effect size.

**Notebook location:** §1 (global over-estimation finding).

**See also:** [c_ratio], [bootstrap CI]

---

### bootstrap CI

A confidence interval estimated by resampling. The procedure draws `n` random
samples with replacement from the observed data 10,000 times, computes the
median of each resample, then takes the 2.5th and 97.5th percentiles of those
10,000 medians as the 95% CI.

**Why it's used here:** Bootstrap CIs make no normality assumption and are
valid for any statistic (here: medians) on small, skewed samples. The dataset
is right-skewed and too small in most per-group slices (per-agent, per-day)
for analytical CIs to be reliable.

**How to read the output:** A CI of [3.00–3.75] means the true median
`c_ratio` is estimated to lie in that range with 95% confidence — if the
sampling process were repeated many times, 95% of the resulting CIs would
contain the true value. Wider CIs reflect more uncertainty (fewer rows or
higher variance).

**Caveats:** Bootstrap CIs inherit the biases of the underlying sample. If the
sample is not representative (e.g. RESEARCH-heavy on one particular day), the
CI reflects that skew. A wide CI is a signal to withhold strong conclusions,
not to ignore the estimate entirely.

**Notebook location:** §1 (global median), §3 (per-day medians via bar
chart error bars).

**See also:** [sign test], [underpowered]

---

### Spearman ρ (Spearman rank correlation)

A non-parametric correlation coefficient that measures the strength of a
*monotone* (consistently increasing or decreasing) relationship between two
variables. Here it tests whether the per-day median `c_ratio` changes
consistently over the six-day window — i.e., whether calibration is trending
in one direction over time.

**Why it's used here:** Day-buckets are ordinal (time-ordered) but the medians
are not normally distributed. Spearman ρ measures monotone trend without
assuming linearity or normality. A positive ρ means medians tend to rise over
time; negative means they fall.

**How to read the output:** ρ ranges from −1 to +1. A p-value ≥ 0.05 means
the observed trend is not statistically significant — it could easily arise by
chance. In the notebooks this consistently yields p ≈ 0.46 across 6 day-
buckets, meaning "no detectable learning curve yet."

**Caveats:** With only 6 day-buckets, Spearman has very low statistical power.
The test can only reliably detect a *perfect or near-perfect* monotone (all six
buckets in ascending order). Non-detection is not evidence of no trend — it is
evidence that the sample size is too small. The notebooks note "revisit at
n_days ≥ 10."

**Notebook location:** §2 (per-day calibration drift).

**See also:** [bootstrap CI], [underpowered]

---

### Kruskal-Wallis (KW)

A non-parametric test for whether two or more independent groups have the same
distribution. It is the rank-based analogue of a one-way ANOVA. Here it tests
whether `c_ratio` distributions differ across agents (§3) or models (§5).

**Why it's used here:** The groups (agents, models) have different sample
sizes, and `c_ratio` is right-skewed and non-normal. Kruskal-Wallis tests for
any distributional difference without assuming normality or equal variance.
Singletons (n = 1) are excluded because a single observation provides no
within-group spread.

**How to read the output:** The H statistic is analogous to an F-statistic —
larger values indicate greater between-group divergence relative to within-
group spread. The p-value tests whether H is larger than expected by chance
under the null (all groups drawn from the same distribution). A non-significant
result (p ≥ 0.05) means the observed differences could plausibly arise from
sampling variation alone.

**Caveats:** Kruskal-Wallis is sensitive to *any* distributional difference,
not just differences in median. A significant result does not identify *which*
groups differ — post-hoc pairwise tests (e.g. Dunn's test) are needed for
that. In the notebooks the test is consistently non-significant (p ≈ 0.62–
0.72 for agents), which is partly a power issue: with 6 groups each at
n = 29–73, detecting moderate effect sizes requires more data.

**Notebook location:** §3 (per-agent, stored as `agent_kw`), §5 (per-model,
stored as `model_kw`).

**See also:** [Mann-Whitney U], [underpowered]

---

### Mann-Whitney U (MWU)

A non-parametric test for whether two independent groups tend to produce
different values. It counts how many times an observation from group A exceeds
an observation from group B across all pairs, producing a U statistic; the
p-value tests whether the observed U is unlikely under the null that both
groups are drawn from the same distribution. The two-sided variant tests for
any directional difference.

**Why it's used here:** §6 compares ELDERBERRY's `c_ratio` to the fleet's
within each role — a series of two-group comparisons. MWU is the natural
follow-on to KW when the question narrows to exactly two groups. Like KW, it
makes no normality assumption and handles the skewed, small-n per-role slices
better than a t-test.

**How to read the output:** The `U` column is the raw Mann-Whitney statistic
(higher U means group A tended to exceed group B more often). The `p_mwu`
column is the two-sided p-value: small values (e.g. < 0.05) indicate the
groups differ significantly; large values (e.g. 0.19–0.72) mean the observed
gap could easily be sampling noise. An underpowered row (n < 5 in either
group) shows `U` and `p_mwu` as `NaN` — the test is not run because the
result would be unreliable.

**Caveats:** MWU tests for stochastic dominance (does one group tend to produce
higher values?), not specifically for differences in medians, though it is
often interpreted that way. Small n makes the p-value conservative — the test
may miss a real difference. In §6 none of the per-role p-values cross 0.05,
consistent with the roles being individually underpowered even when the overall
ELDERBERRY–fleet gap looks substantial.

**Notebook location:** §6 (ELDERBERRY vs. fleet per-role comparison, `p_mwu`
column).

**See also:** [Kruskal-Wallis], [underpowered]

---

### underpowered

A test or estimate is underpowered when the sample size is too small to
reliably detect a real effect of the expected magnitude. In these notebooks the
term appears as a binary flag (`underpowered = True`) on any per-role MWU
comparison where either group has fewer than 5 observations.

**Why the threshold is n < 5:** With fewer than 5 observations in a group, the
minimum achievable p-value from a MWU test (even with a perfect rank
separation) cannot reach 0.05 for a two-sided test. The test is structurally
unable to produce a significant result regardless of how large the true effect
is. Running and reporting it would create a false sense of precision.

**How to interpret underpowered results:** A non-significant result from an
underpowered comparison does *not* mean the groups are the same — it means
"we do not have enough data to tell." Treat such rows as directional
observations only. If the effect is important, collect more data before
drawing conclusions.

**Caveats:** The n < 5 cutoff used in §6 is a practical rule of thumb, not a
universal standard. Some analyses use n < 10 or n < 20 as the threshold for
caution. The notebooks also flag small-n roles in §4 with a dynamic threshold
of n ≤ 6 (`small_n = True`), which is a related but separate concept (it
signals that a *descriptive* estimate, not a test, is based on few
observations).

**Notebook location:** §4 (`small_n` flag per role), §6 (`underpowered` column
in the MWU table).

**See also:** [Kruskal-Wallis], [Mann-Whitney U], [bootstrap CI]
