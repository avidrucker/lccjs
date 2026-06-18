> **Lineage.** **Origin:** ad-hoc assessment session — this document was produced as a one-off review of the day-seven velocity-calibration notebook (accuracy / clarity / accessibility / next-steps) with no commissioning ticket. **Follow-ups:** the doc was parsed for actionable items in **#933**, whose triage filed **#981** (notebook stale-day header bugs), **#982** (uncited 3.92× claim + `fig`/`FIG` agent-name casing dedup), and **#983** (confound-corrected drift test). All remaining 🟢 editorial and longer-horizon analysis-extension recommendations were **explicitly deferred with rationale** in #933's triage comment — so the doc's recommendations are *fully covered* (filed or deferred). **Committed to the repo** via chore **#1057**.

---

The GitHub page rendered the notebook as HTML nav/UI, not the actual content. Let me fetch the raw file directly.Now I have a thorough picture of the notebook. Let me give you a comprehensive assessment.

---

## Assessment: Day-Seven Analysis Notebook

The good news: the **core analysis is actually quite solid**. The data does support what it says — I cross-checked all the key numbers (the 408/439 count, the 3.50× median, the Spearman ρ, the per-agent medians) against the code outputs and they match. Your instinct that "something feels off" is more about presentation than correctness.

Here's a structured diagnosis across your four goals:

---

### 1. Accuracy / Correctness

The notebook is mostly correct, but here are the real issues:

**Cell [11] has a stale description.** It says "Day-six adds a sixth bucket (06-02) and re-tests" — but this is day-seven, not day-six. That sentence was copy-pasted from the day-six header and never updated. The actual analysis runs correctly (7 days), but the text is wrong.

**Cell [25] §2 says "6-day window"** in the section title (`## 2. 🆕 Per-day calibration drift — 6-day window`) but the data and body text correctly say 7 days. The header wasn't bumped from day-six.

**The ELDERBERRY §6 takeaway contains a subtle internal inconsistency.** It says "day-six: EB 5.00 > fleet 3.92" for RESEARCH, but cell [15] says the day-six overall fleet median was 3.33×, not 3.92×. The 3.92 is plausible as the day-six RESEARCH-specific fleet median, but it's not cited from a previous cell — it's a claim made in passing in prose that can't be verified from this notebook. This is the main place where data doesn't clearly support what's written.

**The "fig" anomaly is logged but the KW includes it as a separate group.** That's arguably correct, but it inflates the group count to 8 (with n=4 for "fig") without clearly flagging that "fig" is the same agent as "FIG". A reader could think GRAPE and "fig" are genuine new agents.

---

### 2. Clarity

**The main structural problem:** the notebook mixes three different audiences/purposes in the same cells — running state (for the author mid-week), scientific record (reproducible findings), and inter-day diff narrative (what changed since yesterday). These should be separated.

Specifically:

- **Section headers are ambiguous about tense.** "Re-run on calibration-usable rows" — is this new, or the same as day-six? The 🆕 emoji only appears on §2 and §6, leaving §1, §3, §4, §5 implicitly "same as before." That's confusing.
- **The Deferred section is valuable but buried at the end of §7.** Deferred items feel like TODOs mixed into conclusions. They'd be clearer as a separate "Open Questions" section, or each deferred item linked back to the section it came from.
- **Key concept cells [4] and [5]** are in the middle of the notebook, before §0. They'd be better right after the title/intro, or collapsed into the intro cell itself. A reader hits §0 before understanding what `c_ratio` or "calibration-usable" means.
- **Cell [8]** (the note on role counts) is floating prose between two code cells with no clear section heading. It looks like a footnote that escaped.

---

### 3. Accessibility

The notebook assumes familiarity with:
- The day-to-day incremental format (no standalone summary)
- The PDD/agent setup (though the `<details>` block in cell [0] helps)
- Statistical vocabulary (the glossary reference is good, but it's external)

What would help readers who aren't you:

- **An "at a glance" box** at the top: 3 key numbers (n, median, hit-rate), whether the finding changed since yesterday (yes/no), and the 1-sentence headline finding.
- **Explicit delta annotations** in the data tables. The agent table shows medians but you have to mentally diff against day-six. A `Δ` column comparing to prior run would be much more readable.
- **The section numbering (§0–§7) is good**, but §0 "Data provenance" isn't a numbered section visually — it just says `## 0. Data provenance`. Adding `§0` to match the references in later cells would reduce friction.

---

### 4. What Comes After EDA

You're currently at solid **exploratory analysis** — descriptive stats, bootstrapped CIs, non-parametric tests, one confound check (role composition per day). The natural next steps in order of effort:

**Near-term (high value):**
- **Confound-corrected analysis** — you flagged the per-day medians as potentially role-composition artifacts (cell [13] checks this visually). The next step is actually running a mixed model or just computing role-adjusted residuals: `c_ratio - role_median`, then re-running the drift test on those. This directly addresses whether day-to-day variance is real drift or just "Tuesday was all TEST tasks."
- **Outlier diagnosis** — the 05-29 wide CI [3.06–6.88] is flagged as a "caution flag" but never investigated. A simple table of the top-10 highest-ratio rows from that day would either explain it or raise a real question.

**Medium-term:**
- **Prediction interval vs. point median** — the current analysis asks "is Claude systematically over-estimating?" (yes, strongly). The more actionable question for PDD is "what correction factor would make the estimates useful?" A simple calibration curve (scatter of `c_min` vs `actual_min`, OLS line) would give you a concrete deflation factor.
- **Learning-curve analysis with a better model** — Spearman on 7 day-buckets is underpowered. When you have ≥10 days, try fitting a simple regression of `log(c_ratio)` on `task_sequence_number` (not day) per agent, which uses all data and handles uneven daily task counts.

**Longer-term:**
- **Survival/hazard analysis** — task duration distributions are right-skewed with outliers from idle time. Treating them as survival data (with the inter-turn idle gap as censoring) would be more statistically principled than median-with-CI.
- **Multi-level model** — once you have ≥15 tasks per agent × role cell, a mixed-effects model (agent and role as random effects) cleanly decomposes the variance without the manual confound checks you're currently doing cell by cell.

---

### Quick Fix Priority List

| Priority | Fix |
|---|---|
| 🔴 Must | Fix cell [11] "Day-six adds" → "Day-seven adds" |
| 🔴 Must | Fix §2 header: "6-day window" → "7-day window" |
| 🟡 Should | Verify the "day-six fleet RESEARCH 3.92×" claim or remove it |
| 🟡 Should | Note that "fig" = "FIG" (casing bug) in the KW section, not a new agent |
| 🟢 Nice | Add at-a-glance summary box at top |
| 🟢 Nice | Add Δ (delta) column to agent/role tables |
| 🟢 Nice | Move key concept cells before §0 |
| 🟢 Nice | Separate "Deferred" into its own `## 8. Open Questions` section |

The bones of this notebook are genuinely good — the analysis is careful, the caveats are honest, and the stat choices are defensible. It mainly needs editorial cleanup and the two header/date bugs fixed.
