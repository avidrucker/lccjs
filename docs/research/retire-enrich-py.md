# Research: retire enrich.py — SQL VIEW vs Jupyter-direct vs keep (#288)

**Status:** Decision reached. Keep `enrich.py`. See verdict below.

**Condition met:** 438+ rows now in `~/.lccjs/velocity.db` (threshold was ~30).

---

## What enrich.py actually does

Three enrichment layers, each with different implementation constraints:

| Layer | Columns added | Mechanism | SQL-portable? |
|---|---|---|---|
| 1. Git churn | `insertions`, `deletions`, `files_changed`, `net_loc`, `total_loc`, `commit_date`, `cross_repo` (7 cols) | `git show --numstat` subprocess | ❌ No |
| 2. GitHub issue times | `issue_created`, `issue_closed` (2 cols) | `gh api` subprocess | ❌ No |
| 3. Notes flags + ratios | `f_worktree`, `f_overrun`, `f_test_loop`, `f_retro_c`, `f_crossrepo_note`, `c_ratio`, `h_ratio`, `span_min`, `lead_min` (9 cols) | Python regex + arithmetic | Partial |

Layer 3 breakdown:
- `c_ratio`, `h_ratio`, `span_min` — pure arithmetic on existing columns → ✅ trivially a SQL VIEW
- `lead_min` — `started_iso − issue_created`; depends on layer 2's `issue_created` → ❌ needs GitHub data first
- Notes flags — regex scraping (`re.compile`); SQLite has no built-in `REGEXP` without a loadable extension → ❌ in standard SQLite

**Of 18 enriched columns, at most 3 can be expressed as a SQL VIEW** (`c_ratio`, `h_ratio`, `span_min`) without external data or regex support.

---

## Option evaluation

### Option A: SQL VIEW

Only feasible for `c_ratio`, `h_ratio`, `span_min` — the 3 pure-arithmetic columns. The remaining 15 columns (git churn, GitHub times, notes flags, `lead_min`) require subprocesses or regex that SQL cannot express.

**Verdict: Not viable as a replacement.** Could be a useful *complement* (see recommendation).

### Option B: Jupyter notebooks query SQLite directly

Would require each notebook to re-implement the `git show` and `gh api` subprocess logic, or import it from a shared helper. That helper would essentially be `enrich.py` under a different name. Notes flags (regex) and ratio calculations are trivial pandas operations but are already centralized.

Notebooks also become harder to run headlessly (CI, `nbconvert`) if they spawn subprocesses.

**Verdict: Not viable.** Moves complexity *into* notebooks without removing it. The "shared helper" path reconverges on the current architecture.

### Option C: Keep `enrich.py` (current post-migration state)

`enrich.py` already reads from SQLite (post-migration rewrite, #277). The two-step pipeline (SQLite → `enrich.py` → enriched CSV → notebooks) is appropriate: the subprocess-heavy enrichment (git, gh) belongs in a dedicated Python script, not SQL or notebook cells.

The enrichment is also growing more complex over time (the known-limitations list in `stats/README.md` includes multi-commit churn, prose-vs-logic churn split, blame age) — all Python-tier work.

**Verdict: Keep `enrich.py`. It is already the right architecture.**

---

## Recommendation

**Keep `enrich.py` as-is.** No retirement warranted.

Optional low-cost complement (not a blocker): add a SQL VIEW in the schema for the 3 pure-arithmetic columns (`c_ratio`, `h_ratio`, `span_min`) so they're always available to any SQLite client without running `enrich.py` first. This is additive and doesn't change the enrichment pipeline.

```sql
CREATE VIEW IF NOT EXISTS velocity_enriched AS
SELECT *,
  CASE WHEN c_min IS NOT NULL AND actual_min > 0
       THEN ROUND(CAST(c_min AS REAL) / actual_min, 3) END AS c_ratio,
  CASE WHEN h_min IS NOT NULL AND actual_min > 0
       THEN ROUND(CAST(h_min AS REAL) / actual_min, 3) END AS h_ratio,
  CASE WHEN started_iso IS NOT NULL AND finished_iso IS NOT NULL
       THEN ROUND(
         (julianday(finished_iso) - julianday(started_iso)) * 1440.0, 2
       ) END AS span_min
FROM velocity;
```

This VIEW is purely additive — it doesn't replace `enrich.py`'s git/gh/regex layers.
Filing the VIEW addition as a separate issue is appropriate if wanted; it's out of scope here.

---

## Audit note

No existing rows violate anything. `enrich.py` handles all 438 rows cleanly; the
cross-repo flag correctly marks the 6 skill-authoring tickets that close in
`avidrucker/claude-config`.
