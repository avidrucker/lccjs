# stats/ — puzzle-velocity analysis

A Python/Jupyter analysis of the velocity log for this project's Yegor-style
microtask workflow (dual **H**ard-cap / **C**alibrated estimates vs actuals).

**Data source:** `~/.lccjs/lccjs.db` (SQLite, local-only).
Seeded from [`docs/puzzle-velocity.csv`](../docs/puzzle-velocity.csv) via
`npm run velocity:seed`. New rows are appended via `npm run velocity:log`.
See [`docs/velocity-schema.md`](../docs/velocity-schema.md) for the full schema.

## Files

| File | What it is |
|---|---|
| `enrich.py` | Reads `~/.lccjs/lccjs.db`, adds three enrichment layers, writes `puzzle-velocity-enriched.csv` atomically |
| `puzzle-velocity-enriched.csv` | Generated dataset the notebook reads — **local-only, gitignored** (re-generate with `enrich.py` before running notebooks; see #286) |
| `week-NN-analysis.ipynb` | **Active series** — one weekly-cadence pass (NN = whole weeks since data logging began 2026-05-28). Committed **with** embedded outputs/plots → renders on GitHub |
| [`EXEC-SUMMARY.md`](./EXEC-SUMMARY.md) | **Plain-language headline** of the latest weekly notebook — the 3–5 takeaways for someone who just wants "what does the data say right now?" Refresh it when a new `week-NN` lands (#1520) |
| `archive/day-01..day-11-analysis.ipynb` | **Archived daily era** (2026-05-28 → 2026-06-08). The original ~daily passes; kept as historical record. `day-01` is the seed notebook, `day-02` adds the over-time axis, `day-03` adds the 3-day calibration trend + per-agent cut, etc. (day-08 never existed) |
| `requirements.txt` | Python deps (prefer the shared venv below) |

> **Cadence:** analysis switched from **daily** (`archive/day-NN`) to **weekly** (`week-NN`) as of 2026-06-14; `day-11` was the last daily pass. File one `week-NN` ticket per week going forward.

## Running it

The data-science toolchain is installed once, as a **single source of truth**, via the
dotfiles `datascience` section (a shared `~/.venvs/datasci` venv with `jupyter` on PATH):

```bash
~/dotfiles/install.sh datascience          # one-time (or to update tooling)
```

Then, from the repo root:

```bash
# 0. ensure the DB is seeded (one-time, or after git clean)
npm run velocity:seed          # imports docs/puzzle-velocity.csv → ~/.lccjs/lccjs.db

# 1. refresh the enriched dataset (reads SQLite; needs git + gh; degrades offline)
~/.venvs/datasci/bin/python stats/enrich.py

# 2. open the latest weekly notebook interactively (archived dailies live in stats/archive/)...
jupyter lab stats/week-03-analysis.ipynb

# ...or re-execute it headless (re-embeds all outputs in place)
jupyter nbconvert --to notebook --execute --inplace stats/week-03-analysis.ipynb

# ...or render a standalone HTML (gitignored)
jupyter nbconvert --to html stats/week-03-analysis.ipynb
```

(Standalone fallback without the shared venv: `python3 -m venv .venv && . .venv/bin/activate
&& pip install -r stats/requirements.txt`.)

## Enrichment layers (`enrich.py`)

The raw CSV has estimates, actuals, ISO timestamps, role, and free-text notes. `enrich.py`
adds three derived layers — this answers the "how can we enrich the data?" brainstorm:

1. **Git churn** — from each row's `closed_commit`: `insertions`, `deletions`,
   `files_changed`, `net_loc`, `total_loc`, `commit_date`.
   - *The "lines changed signals drift" idea.* Used as a **drift detector**, not an effort
     proxy: high-LOC / low-time rows are bulk generation; low-LOC / high-time rows are
     investigation-heavy. (Effort here is dominated by reading/verifying, not typing — the
     notebook shows LOC↔time correlation is weak.)
   - **Cross-repo flag:** six skill-authoring tickets close in `avidrucker/claude-config`,
     so their SHAs don't resolve locally → `cross_repo=True`, churn `NaN`. The flag is a
     signal in its own right.

2. **GitHub issue timestamps** — `issue_created` / `issue_closed` via `gh api`.
   - Gives **lead time** (`lead_min` = issue filed → work started = backlog wait) distinct
     from the hands-on **cycle time** (`actual_min`). Most tickets are just-in-time PDD
     puzzles (lead < 5 min); a few are genuine backlog.

3. **Notes-parsed flags + derived metrics** — `f_worktree`, `f_overrun`, `f_test_loop`,
   `f_retro_c` scraped from the notes column; plus `c_ratio = c_min/actual_min` (the
   over-pad factor everyone tracks), `h_ratio`, and `span_min` (wall-clock).

### Known limitations / future enrichment

- **Single-commit churn.** Only the row's final `closed_commit` is measured; multi-commit
  tickets (e.g. #162 spanned 4 worktree passes) undercount churn. *Fix:* map all commits
  whose message references `#N`.
- **Prose vs logic churn.** This is a doc-heavy repo; splitting comment/markdown churn from
  code churn would sharpen the LOC signal.
- **Blame age** (`git log --follow`) of touched lines → a true code-staleness/drift metric.
- **Idle/compaction detection** from `span_min − actual_min` to quantify session
  fragmentation (the notes flag that `actual_min` is summed hands-on, not wall-clock).

## Headline findings (as of the committed run)

> **For the current headline summary, see [`EXEC-SUMMARY.md`](./EXEC-SUMMARY.md)** (refreshed per weekly notebook). The findings below are from an earlier committed run and may lag the latest week.

- **Systematic over-padding:** median C-ratio ≈ **2.5x** (mean ≈ 3.0x) — calibrated
  estimates run ~2–3x the actual hands-on time, consistently, across all roles.
- **The only two overruns are both test-loop DEV tasks** (#135, #141) — the
  edit→assemble→run→diff loop is the one shape that reliably eats budget.
- **Research/ARC spikes are the most over-padded** (#146 at ~11x) — padding for unknowns
  that evaporate once context is warm.

### Day three (105 calibration rows, 3 HST working days, 4 agents)

- **The bias is now overwhelming:** **100/105** tasks finished faster than estimate
  (sign test p ≈ 2.5e-24); median C-ratio **3.21x** (95% CI 2.76–3.75x).
- **No learning curve yet:** per-day medians are flat/non-monotone (2.5x → 5.0x → 3.5x
  over 05-28→05-29→05-30); no evidence the over-pad is shrinking with experience.
- **Agents differ but it's confounded:** Kruskal-Wallis across the 4 agents is
  significant (p < 0.001; APPLE ~5.3x highest, CHERRY ~2.3x lowest), but the spread
  tracks each agent's RESEARCH/SPIKE share — not a clean skill ranking.
- **Data-quality finding:** the shared CSV had 3 rows with invalid backslash-escaping
  (`\"`/`\\` vs CSV `""`) + 1 accidental duplicate — enough to crash `enrich.py`. The
  day-three notebook repairs this **in-memory**; the source needs a CSV-escaping guard.
