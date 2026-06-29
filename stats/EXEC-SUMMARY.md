# Data analysis — executive summary

**Source:** [`week-04-analysis.ipynb`](./week-04-analysis.ipynb) · **Data as of:** 2026-06-29 (weeks 1–5) · **1,040 calibration-usable rows**

Plain-language headline of the latest velocity / errors / ICE analysis. For methods, charts, and
the full breakdown, open the notebook. **Refresh this file whenever a new `week-NN` notebook lands.**

## Headlines

- **Agents over-estimate ~2.7×.** Across 1,040 timed tasks, 886 (85%) finished *faster* than the
  agent's own estimate; a typical task takes about a third of the predicted time (rock-solid,
  p ≈ 10⁻¹²⁶). Use the factor to *plan*, not to *pressure* — a "30-min" budget is really ~11 min.

- **The "learning curve" is a step-down-and-plateau, not a steady decline.** Over-padding fell hard
  through week 3 (wk1 3.6× → wk3 1.3×) but rebounded and levelled at ~2× in weeks 4–5. The
  day-by-day trend is still significantly downward (ρ = −0.58, p = 0.003) and survives correcting
  for task-type mix — but the recent (thin) weeks read as "settled ~2×," not "still falling."

- **Roles drive the spread.** Investigation-heavy work over-pads most (RESEARCH ~4×, ARC ~3.9×);
  routine work least (CHORE/REVIEW ~1.1–1.3×). DEV (~2.5×) and WRITER (~2.7×) are the high-volume middle.

- **Model gap — better-powered, still confounded.** opus-4.8 (n = 280) runs ~2.0× vs sonnet-4.6
  ~3.3× (n = 604) — a robust gap, but still tangled with which roles/agents ran each model.

- **Errors corpus is growing** (390 rows over 15 days, up from 138) — still descriptive, no conclusions yet.

- **Prioritization is now ICE** (Impact × Confidence × Ease; RICE retired in #1519). 161 actionable
  issues, median ICE 2.0; scores are driven mostly by *Ease* (mean Impact 0.7 · Confidence 0.7 · Ease 5.1).

## Caveats

Weeks 4–5 are thin (n = 11, 32) and bracket logging gaps (06-08→06-11, 06-18→06-22). The
issue-lifecycle section needs live GitHub data and is skipped in headless runs. Treat the plateau as young.
