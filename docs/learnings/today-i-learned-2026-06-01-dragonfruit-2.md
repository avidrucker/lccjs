# Today I Learned — 2026-06-01 (DRAGONFRUIT, session 2)

A data-layer session: velocity DB schema migrations (#372), model-value backfill
(#381), model-naming normalization (#378), and a timeout safety-net script (#376).
Closed four issues. Filed one (#379 — root fix for the getcwd cosmetic error).

---

## 1. `%:z` vs `%z` in bash `date` — the colon matters to SQLite

**What happened:** Issue #372 found 113–121 rows with compact timezone offsets like
`2026-05-31T09:00:00-1000`. SQLite 3.45.1's `datetime()` returns NULL for that form
— it requires RFC 3339 colon form (`-10:00`). All duration queries over those rows
silently produced NULLs with no error.

**The fix in bash:** swap `%z` for `%:z` in the capture command:
```bash
date '+%Y-%m-%dT%H:%M:%S%:z'   # outputs -10:00
date '+%Y-%m-%dT%H:%M:%S%z'    # outputs -1000 — breaks SQLite
```
The `%:z` flag is a GNU date extension (available on Linux, not macOS). The docs
and skill template now use `%:z`.

**Detection pattern for existing compact-offset rows:**
```sql
WHERE started_iso GLOB '*[+-][0-9][0-9][0-9][0-9]'
  AND length(started_iso) = 24
```
The `GLOB` matches a sign char followed by exactly four digits at the end; the
`length` check rules out already-correct `-10:00` form (25 chars).

## 2. An "id < N" migration cutoff is fragile — use a condition, not a boundary

**What happened:** Issue #372's original migration script used `WHERE id < 130` to
flip the delta sign convention. In practice, 134 rows up to id=207 had the wrong
sign — agents kept logging `actual - h` long after id 130 without realising the
convention had changed.

**Better approach:** express the *wrong state* directly:
```sql
WHERE ABS(delta_h_min - (actual_min - h_min)) < 0.01
```
This catches every row that stores `actual - h` regardless of id, and leaves rows
with the correct `h - actual` untouched. An id boundary is a proxy for the real
condition; the real condition is always more reliable.

**Lesson:** When a migration corrects a value that should equal a derivable
expression, filter on `stored_value ≈ wrong_expression` rather than on an
approximate row-number range.

## 3. Concurrent agents invalidate a DB fix before you can export it

**What happened:** During #378 I normalized all `claude-sonnet-4-6` → `sonnet-4.6`
in the DB and re-exported the CSV. The test still failed — two new rows with
`claude-sonnet-4-6` had landed from concurrent agents between my UPDATE and the
export.

**The pattern:** in a multi-agent repo, a DB normalization fix has a race window
between `UPDATE` and `velocity:export`. Agents keep writing with the old template
during that window. The fix for the *root cause* (template) closes the window
permanently; the DB sweep needs to run right before the final export, not earlier.

**Practical rule:** always run the normalization UPDATE immediately before
`npm run velocity:export` — not earlier in the commit pipeline — so the CSV
reflects the current DB state. And fix the source template so the race window
keeps shrinking over time.

## 4. `setsid` + `kill -- -PGID` for guaranteed process-tree kill

**What happened:** Issue #376 — a prior agent ran `node lcc.js halt.a` from `/tmp`
and it hung for 28 minutes at 99.9% CPU because the interpreter was blocked waiting
for user input that never came. `kill PID` only kills the top-level node process;
any grandchildren (spawned via `child_process`) survive as orphans.

**The solution in `lccrun.sh`:**
```bash
setsid "$@" &          # new session → new process group; PGID = child PID
CHILD_PGID="$CHILD_PID"
# watchdog:
kill -TERM -- -"$CHILD_PGID"  # sends SIGTERM to every process in the group
sleep 2
kill -KILL -- -"$CHILD_PGID"  # SIGKILL stragglers
```
`setsid` makes the child the leader of a new session, so PGID = child PID. Sending
to `-PGID` (negative PID syntax) signals the entire process group. All descendants
that didn't create their own process group are reaped.

**Flag-file for timeout detection:** because the watchdog runs in a subshell, it
can't set a variable in the parent. A temp file (`mktemp`, written by the watchdog,
read by the parent after `wait`) is the clean IPC mechanism:
```bash
FLAG=$(mktemp)
trap 'rm -f "$FLAG"' EXIT
# watchdog writes: printf '1' > "$FLAG"
# parent checks: [[ -s "$FLAG" ]] && exit 124
```
Exit code 124 matches `timeout(1)` convention for "killed by timeout."

---

## What went well

- **Four migrations in a row with no re-orientation overhead.** Having worked on
  the velocity DB in #381 and #378 before #372, the schema shape and tooling
  (`velocity:export`, `velocity:log`, the CSV test suite) were already warm.
- **The precise sign-flip condition was better than the prescribed one.** Catching
  134 wrong-sign rows instead of ~43 means the DB is actually clean now, not just
  "mostly clean."
- **`lccrun.sh` was fully tested before committing.** Verified all three cases
  (normal exit, non-zero exit passthrough, timeout + exit 124) against real Node
  processes before the commit.

## What didn't go well

- **Forgot the squash-before-close pattern once.** After #378 and #381 I already
  knew that velocity rows should be in the same commit as `Closes #N`, yet #372
  still needed a `git reset --soft HEAD~2`. The pattern should be automatic by now:
  log the velocity row, stage it, and `git commit "... Closes #N"` in one shot.
- **The `%:z` fix was in the issue description all along** — I re-derived it from
  first principles (checking SQLite docs) when I could have just followed the spec.
  Read the issue body more carefully before starting.
