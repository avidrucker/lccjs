# stats/ — puzzle-velocity analysis

A Python/Jupyter analysis of [`docs/puzzle-velocity.csv`](../docs/puzzle-velocity.csv),
the per-ticket time log for this project's Yegor-style microtask workflow (dual
**H**ard-cap / **C**alibrated estimates vs actuals). See the
[puzzle-velocity skill](../.claude) for how the CSV is produced.

## Files

| File | What it is |
|---|---|
| `enrich.py` | Reads the raw CSV, adds three enrichment layers, writes `puzzle-velocity-enriched.csv` |
| `puzzle-velocity-enriched.csv` | Generated dataset the notebook reads (committed so the notebook renders without a rebuild) |
| `puzzle_velocity_analysis.ipynb` | The analysis notebook (committed **with** embedded outputs/plots → renders on GitHub) |
| `requirements.txt` | Python deps (prefer the shared venv below) |

## Running it

The data-science toolchain is installed once, as a **single source of truth**, via the
dotfiles `datascience` section (a shared `~/.venvs/datasci` venv with `jupyter` on PATH):

```bash
~/dotfiles/install.sh datascience          # one-time (or to update tooling)
```

Then, from the repo root:

```bash
# 1. refresh the enriched dataset (needs git + gh; degrades gracefully offline)
~/.venvs/datasci/bin/python stats/enrich.py

# 2. open the notebook interactively...
jupyter lab stats/puzzle_velocity_analysis.ipynb

# ...or re-execute it headless (re-embeds all outputs in place)
jupyter nbconvert --to notebook --execute --inplace stats/puzzle_velocity_analysis.ipynb

# ...or render a standalone HTML (gitignored)
jupyter nbconvert --to html stats/puzzle_velocity_analysis.ipynb
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

- **Systematic over-padding:** median C-ratio ≈ **2.5x** (mean ≈ 3.0x) — calibrated
  estimates run ~2–3x the actual hands-on time, consistently, across all roles.
- **The only two overruns are both test-loop DEV tasks** (#135, #141) — the
  edit→assemble→run→diff loop is the one shape that reliably eats budget.
- **Research/ARC spikes are the most over-padded** (#146 at ~11x) — padding for unknowns
  that evaporate once context is warm.
