# SQLite Velocity Schema — Open Questions

Deferred during initial schema design (2026-05-31, BANANA RESEARCH session).
File a follow-up ticket to work through these before the schema is considered stable.

---

## Q1: Generated vs plain columns for `delta_h_min` / `delta_c_min`

**Current decision:** Plain columns (copied from CSV at seed time, computed by append script at write time).

**Alternative:** `GENERATED ALWAYS AS (h_min - actual_min) STORED` — delta is always mathematically consistent; INSERT cannot include delta values, seed script must strip them and let SQLite recompute.

**Questions to resolve:**
- Were any historical CSV delta values hand-corrected (i.e. intentionally differ from `h_min - actual_min`)? If yes, plain columns preserve those corrections; generated columns silently overwrite them.
- Does any stats/ query depend on the distinction between explicit-NULL delta and computed-NULL delta (both cases: `actual_min IS NULL`)?
- Is SQLite 3.31+ guaranteed in all environments this project runs in?

**Recommendation when revisiting:** audit the CSV for rows where `delta_h_min != h_min - actual_min` (excluding NULL rows). If none found, switch to generated columns for consistency guarantees.

---

## Q2: Should `ticket` be NOT NULL?

**Current decision:** Deferred — field is declared without explicit NOT NULL.

**Rationale for NOT NULL:** All existing rows have ticket numbers; protocol says file the ticket before starting work. Enforcing at DB level prevents "I'll file it later" drift.

**Rationale for nullable:** Ad-hoc sessions that precede a ticket (e.g., an exploratory chat that turns into a filed issue retroactively). Historical precedent: #204/#216 filed retroactive tickets.

**Recommendation when revisiting:** add NOT NULL if the "file first" discipline holds for 30+ consecutive rows without exception.

---

## Q3: Should `role` have a CHECK constraint?

**Current decision:** Unconstrained TEXT — valid values documented but not enforced.

**Valid values as of 2026-05-31:** `DEV`, `TEST`, `WRITER`, `RESEARCH`, `SPIKE`, `ARC`, `PM`, `COMBO`

**Tension:** CHECK constraint catches typos at insert time but blocks new role codes without a schema migration. Given the user intends to expand the schema over time, a constraint may be too rigid early.

**Recommendation when revisiting:** add CHECK once the role taxonomy has been stable for ~60 rows and no new codes have been added for a full sprint.

---

## Q4: `closed_commit` — is it worth keeping?

**Context:** Per protocol, `closed_commit` is always left NULL at close time because `git pull --rebase` rewrites the SHA. It is derived on demand via `git log --grep "Closes #N" -1 --format=%h`. The field currently carries no information in the DB.

**Question:** Should the column be dropped from SQLite (it's always NULL), or kept for future use (e.g., if close tooling is ever refactored to capture the SHA post-push in a second step)?

**Recommendation when revisiting:** keep the column for now (cheap), but audit after 20 post-migration rows — if it remains uniformly NULL, consider dropping or repurposing it.

---

## Q5: `started_iso` / `finished_iso` storage format

**Current decision:** ISO 8601 TEXT (e.g. `2026-05-31T08:03:23-1000`).

**Question:** SQLite's built-in `datetime()` and `julianday()` functions expect UTC or offset-normalized ISO strings. The project uses HST (`-1000`) timestamps. Do the stats queries need to normalize to UTC, or is wall-clock HST sufficient?

**Recommendation when revisiting:** add a migration to store UTC-normalized timestamps alongside the original HST strings, OR document that all time queries must use `datetime(started_iso)` which SQLite handles correctly for offset strings.

---

<!-- @todo #284:45m/RESEARCH resolve SQLite schema open questions — see 5 questions above; priority order: Q1 (generated cols), Q5 (timestamp tz), Q2 (NOT NULL), Q3 (CHECK), Q4 (closed_commit). None block migration. -->
