# SQLite Velocity Schema — Open Questions

Deferred during initial schema design (2026-05-31, BANANA RESEARCH session).
Resolved 2026-06-01 by BANANA (#284). All five questions answered below.

---

## Q1: Generated vs plain columns for `delta_h_min` / `delta_c_min`

**Resolution: Defer generated columns — fix sign inconsistency first (DEV child #372).**

Audit of the live DB (233 rows, 2026-06-01):

- Rows id ≤ ~129 store `actual_min − h_min` (negative = under budget).
- Rows id > 129 store `h_min − actual_min` (positive = under budget — matches schema doc).
- 43 `delta_h_min` rows and 41 `delta_c_min` rows deviate from the current convention; all are pure sign flips, not hand-corrections.

No hand-corrections found. The sign convention changed around id 130; both halves are internally self-consistent. Before switching to `GENERATED ALWAYS AS`, a normalization migration must flip the old rows. SQLite 3.31+ required for generated columns (installed: 3.45.1 ✓). Filed as DEV child ticket #372.

---

## Q2: Should `ticket` be NOT NULL?

**Resolution: Keep nullable — PM/triage rows legitimately have no ticket.**

As of 2026-06-01: 233 total rows, 10 null-ticket rows (ids 119, 131, 136, 151, 154, 155, 171, 189, 190, 191). All are PM or triage sessions that predate or don't correspond to a specific issue. The "file-first" discipline governs puzzle work, not all PM activity. No trend toward consistently filling in tickets for these sessions.

Decision: Do not add NOT NULL.

---

## Q3: Should `role` have a CHECK constraint?

**Resolution: No CHECK constraint — taxonomy still evolving. Added CHORE and DATA to docs/VALID_ROLES.**

Roles found in the live DB (2026-06-01): WRITER (70), DEV (55), RESEARCH (34), PM (28), TEST (16), DATA (11), ARC (9), COMBO (5), SPIKE (4), CHORE (1).

`DATA` was in `velocity-log.js` VALID_ROLES but missing from `velocity-schema.md`. `CHORE` (used once, DRAGONFRUIT ticket #356 — chore: remove tracking comment) was absent from both. Both codes added to schema doc and VALID_ROLES in this commit.

A CHECK constraint would block valid future roles without a schema migration. Given 2 new codes surfaced in this single audit, the taxonomy is still evolving — constraint deferred indefinitely.

---

## Q4: `closed_commit` — worth keeping?

**Resolution: Keep the column.**

As of 2026-06-01: 60 non-NULL rows (ids 1–66, seeded from CSV where SHAs were captured historically), 173 NULL rows (post-migration protocol). The column holds real historical data for the 60 seeded rows; dropping it would lose those SHAs. Column is cheap.

---

## Q5: `started_iso` / `finished_iso` storage format

**Resolution: Document substr() workaround; migrate compact-offset rows (DEV child #372); use `%:z` for new captures.**

SQLite 3.45.1 audit:

| Format | `datetime()` / `julianday()` | Example |
|---|---|---|
| `-10:00` (RFC 3339, colon) | ✓ Parses, returns UTC value | 105 rows in DB |
| `-1000` (compact, no colon) | ✗ Returns NULL silently | 93 rows in DB |

For duration queries on existing data, strip the offset (safe because all timestamps are HST — consistent offset):

```sql
SELECT (julianday(substr(finished_iso, 1, 19)) - julianday(substr(started_iso, 1, 19))) * 1440
  AS actual_min_derived
FROM velocity WHERE started_iso IS NOT NULL AND finished_iso IS NOT NULL;
```

For new rows, change timestamp capture to use the colon form:

```bash
date '+%Y-%m-%dT%H:%M:%S%:z'   # gives -10:00 instead of -1000
```

Migration SQL for the 93 compact-offset rows is in DEV child ticket #372.
