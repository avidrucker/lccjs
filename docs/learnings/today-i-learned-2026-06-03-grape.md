# Today I Learned — 2026-06-03 (GRAPE)

Date: 2026-06-03
Context: Session covering #659 (day-six prose corrections), #662 (execution verification),
#667 (day-seven notebook creation).

---

## 1. Velocity notebooks are point-in-time snapshots — re-executing them against a grown DB silently corrupts the analysis

`stats/day-six-analysis.ipynb` loads all rows from `~/.lccjs/velocity.db` with no date filter:

```python
df = pd.read_sql("SELECT * FROM velocity ORDER BY id", con)
```

When originally run on 06-02, this returned ~400 rows. Re-executing it on 06-03 returned 531
rows — pulling in a full day of new work and adding a seventh day-bucket the day-six prose had
no knowledge of. All the §7 takeaways (row counts, medians, per-day table) became stale again
the moment the kernel ran.

**What made this hard to catch:** the notebook executed cleanly with no errors or warnings. The
only signal was that the summary printed "Total rows: 531 (day-5 was 339)" instead of the
expected 400.

**The fix for new notebooks:** add a date ceiling in the SQL at creation time:

```python
df = pd.read_sql(
    "SELECT * FROM velocity "
    "WHERE finished_iso IS NULL OR substr(finished_iso,1,10) <= '2026-06-03' "
    "ORDER BY id",
    con
)
```

The ceiling makes re-execution idempotent — the notebook always analyses the same window
regardless of when it is next run. Without it, the "day-N analysis" label is a lie as soon as
day N+1 starts.

---

## 2. `hst_day` is a derived column — it does not exist in the DB

The notebook computes `hst_day` in-memory after loading:

```python
df["hst_day"] = df["finished"].dt.tz_convert("Etc/GMT+10").dt.date.astype(str)
```

Attempting to filter on it in the SQL query:

```sql
WHERE hst_day <= '2026-06-03'   -- OperationalError: no such column: hst_day
```

The correct approach is to filter on the raw `finished_iso` text column using `substr`:

```sql
WHERE finished_iso IS NULL OR substr(finished_iso,1,10) <= '2026-06-03'
```

The `IS NULL` guard keeps rows that lack a finish timestamp (date-ambiguous but still
valid calibration rows) from being dropped by the ceiling.

---

## 3. "Day six" and "06-03" are not the same thing — check the clock before naming a notebook

The day-six notebook was named for the day it was first run (06-02 in HST). When GRAPE
re-ran it on 06-03, the natural instinct was "this must be wrong — I'm on day six." But
today *was* 06-03. The re-execution was not a mistake; it was producing the correct
day-seven analysis. The error was discarding it.

**Lesson:** before concluding that a notebook execution is wrong, check `date` in HST.
If the DB has grown past the notebook's coverage window, the notebook is not broken —
it's stale. The right response is to create the next notebook, not to revert.

---

## 4. Agent name casing in the DB is load-bearing

The velocity DB has no uniqueness constraint on the `agent` column value. Four rows were
logged with `agent = 'fig'` (lowercase) instead of `'FIG'`. Because the per-agent analysis
groups by the raw string, "fig" and "FIG" appear as separate agents in the output:

```
FIG    41    2.50×
fig     4    4.38×   ← casing anomaly; should be FIG
```

This inflates the agent count and produces a spurious "fig" entry in the heatmap. Filed
as #669 for a DB correction (requires explicit human go-ahead per Rule 7).

**Lesson:** log the `agent` field carefully — it is never normalised after write.

---

## What landed

| Ticket | Change |
|---|---|
| #659 | Corrected 16 stale numbers in `day-six-analysis.ipynb` §7 takeaways |
| #662 | Verified execution; discovered missing date ceiling; filed #664 |
| #667 | Created `stats/day-seven-analysis.ipynb` with date ceiling + full §7 takeaways |
| #664 | (open) Add date ceiling to day-six notebook |
| #669 | (open) Correct "fig" → "FIG" casing in DB (Rule 7 gate) |
