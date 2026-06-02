# DATA (M1): Velocity Data Integrity Audit

**Issue:** #424  
**Agent:** ELDERBERRY  
**Date:** 2026-06-01  
**Scope:** `~/.lccjs/velocity.db` vs `docs/puzzle-velocity.csv` — SQLite/CSV diff, orphaned SHA check, post-hoc C-estimate detection, delta sign consistency

---

## 1. SQLite / CSV Diff

**Method:** Compared all `id` values in the DB against all data rows in the CSV (skipping the 2-line header).

| Source | Row count |
|--------|-----------|
| SQLite (`~/.lccjs/velocity.db`) | 299 |
| CSV data rows | 297 |

**Rows in DB but not CSV: IDs 307 and 308**

| id | ticket | title | agent | started_iso |
|----|--------|-------|-------|-------------|
| 307 | 411 | assemblerplus.js: named constants for trap vectors | BANANA | 2026-06-01T15:51:55-1000 |
| 308 | 423 | DEV (N1b): disassembler.js exit seam — replace 6 bare process.exit with fatalExit | DRAGONFRUIT | 2026-06-01T15:52:16-1000 |

**Verdict:** Stale export — two rows logged after the last `velocity:export` run. No data loss; the DB is the canonical store.

**Action:** `npm run velocity:export` from any current checkout will sync.

---

## 2. Orphaned SHA Check

**Method:** Queried all non-null `closed_commit` values (62 rows), then ran `git cat-file -e <sha>^{commit}` against each in the lccjs repo.

**Result:** 6 SHAs do not resolve in lccjs git history.

| id | ticket | title | SHA |
|----|--------|-------|-----|
| 23 | 137 | Claude skill (1/4a) SKILL.md router + 4 inline pitfalls | 87f6405 |
| 24 | 138 | Claude skill (1/4b) isa-quickref + calling-convention references | 9d20e00 |
| 27 | 139 | Claude skill (1/4c) pitfalls + idioms-and-patterns references | 0cb31de |
| 29 | 140 | Claude skill (1/4d) house-style reference + README pointer | fa7043a |
| 35 | 148 | Skill: enumerate closed LCC trap set inline in SKILL.md | fafa31a |
| 36 | 149 | Skill: nl idiom callout + house-style scoping clarification | 497dc1a |

**Verdict:** Not true orphans. All 6 rows have notes explicitly documenting **"cross-repo close: SHA in avidrucker/claude-config"** — the work landed in the paired skill config repo, not lccjs. The SHAs are valid commits in `avidrucker/claude-config`. This is a documented pattern for cross-repo puzzle closes.

**Action:** No data fix needed. The existing `velocity-log-storage.md` notes this pattern (row 59). A future schema enhancement could add a `repo` field (defaulting to `lccjs`) to make cross-repo SHAs unambiguous to tooling.

---

## 3. Post-hoc C-estimate Detection

### 3a. Null / missing `c_min` (27 rows)

These rows have no C estimate at all. Two subgroups:

- **Early rows (IDs 1–5):** Five WRITER rows from tickets #119–123 (assembler.js term inventory). C-tracking predates these; null is expected.
- **Issueless PM rows and early session gaps:** Many PM/RESEARCH rows in IDs 62–248 range, mostly pre-C-tracking discipline. Examples: rows 62, 63 (DATA), 71, 73, 81, 84, 85 (PM), 88, 89, 98, 100, 101, 110, 159, 171, 211, 216, 221, 228, 231, 239, 248. Null C here is honest — the estimate wasn't captured.

**Verdict:** No retroactive manipulation detected. Null C is accurate for the eras and roles involved.

### 3b. `c_min == actual_min` exactly (2 rows)

| id | ticket | title | role | h_min | c_min | actual_min | agent |
|----|--------|-------|------|-------|-------|------------|-------|
| 108 | 227 | Fix: claim.js refuses an already-CLOSED issue | DEV | 20 | 15 | 15 | BANANA |
| 136 | — | PM: file #286 + #287 + comments on #277/#284 | PM | 10 | 5 | 5 | APPLE |

**Verdict:** Suspicious but not conclusive. A 15-minute estimate and a 15-minute actual for a DEV fix (row 108) is plausible — the estimate was tight and the task hit it. Row 136 (C=5, actual=5) is a PM row where 5-minute PM tasks are common. Neither has a note indicating the C was set retroactively. Flag for awareness; insufficient evidence to mark as post-hoc.

---

## 4. Delta Sign Convention Errors (bonus finding)

**Method:** Verified `delta_h_min == h_min - actual_min` and `delta_c_min == c_min - actual_min` for all rows with non-null values.

**2 rows with sign-flipped deltas** (both DRAGONFRUIT):

| id | ticket | h_min | actual_min | delta_h_min | correct |
|----|--------|-------|------------|-------------|---------|
| 303 | 412 | 20 | 3 | **-17** | +17 |
| 308 | 423 | 30 | 2 | **-28** | +28 |

| id | ticket | c_min | actual_min | delta_c_min | correct |
|----|--------|-------|------------|-------------|---------|
| 303 | 412 | 10 | 3 | **-7** | +7 |
| 308 | 423 | 10 | 2 | **-8** | +8 |

**Verdict:** The delta fields were computed as `actual_min - estimate` (i.e. actual overrun) rather than the schema convention `estimate - actual` (headroom remaining). Both rows are from DRAGONFRUIT in the same session. The sign flip makes these rows produce incorrect calibration math if delta fields are used directly.

**Action:** Correct in SQLite with UPDATE. The CSV will sync on next export.

```sql
UPDATE velocity SET delta_h_min = 17,  delta_c_min = 7  WHERE id = 303;
UPDATE velocity SET delta_h_min = 28,  delta_c_min = 8  WHERE id = 308;
```

---

## 5. Model Format — Status

All 299 rows in the DB use canonical short-form model names (`sonnet-4.6`, `opus-4.8`, etc.) or NULL. The `puzzle-velocity-csv.unit.spec.js` test failure seen in the #410 worktree was against a stale CSV export; the current CSV (as of this worktree) passes the model-format assertion.

---

## Summary

| Category | Severity | Count | Action |
|----------|----------|-------|--------|
| DB rows missing from CSV | Low | 2 | `npm run velocity:export` |
| Orphaned SHAs (cross-repo) | None | 6 | Document as expected; optional schema `repo` field |
| Null `c_min` | None | 27 | Expected for early/PM rows; no fix |
| `c_min == actual_min` (suspicious) | Low | 2 | Monitor; insufficient evidence for correction |
| Negative delta fields | Medium | 2 rows × 2 fields | UPDATE rows 303 and 308 in SQLite |
