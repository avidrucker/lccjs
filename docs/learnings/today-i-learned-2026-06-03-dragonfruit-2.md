# TIL 2026-06-03 — DRAGONFRUIT s2

## `close.js` says "auto-resolved" but the CSV still has column-0 conflict markers

**Discovered during:** #537 and #273 (same pattern, both sessions today)

---

### What happened

`npm run close N` runs a fetch-rebase-push loop. When the rebase finds that
`docs/puzzle-velocity.csv` diverged on `origin/main` (because other agents logged
rows while this worktree was in flight), `close.js` prints:

```
[close] velocity CSV conflict auto-resolved (re-exported from SQLite).
```

That message implies the file is clean. It is not. The re-export writes the
correct content to disk, but git's rebase machinery has already written a
conflict-marker file to the working tree. The result is:

```
 <<<<<<< HEAD
 =======
 449,273,...DRAGONFRUIT...
 >>>>>>> cdb7e81 (docs: full open-issue backlog triage...)
```

These are **column-0** markers, which the pre-push hook detects explicitly
(added in #205, using a `^<<<<<<<` / `^>>>>>>>` anchor). The push fails:

```
[pre-push] BLOCKED — conflict markers in tracked files:
docs/puzzle-velocity.csv:439: <<<<<<< HEAD
```

---

### The fix (two steps, then re-run close)

```bash
# 1. Re-export from SQLite — overwrites the conflict-marker file with clean CSV
node scripts/velocity-export.js

# 2. Verify no column-0 markers remain
grep -P "^<<<<<<<|^>>>>>>>" docs/puzzle-velocity.csv || echo "clean"

# 3. Stage and amend the head commit (the one with Closes #N)
git add docs/puzzle-velocity.csv
git commit --amend --no-edit

# 4. Re-run close — it will push cleanly now
node scripts/close.js N --branch <branch> --skip-keyword-check
```

The `velocity-export.js` script reads from `~/.lccjs/velocity.db` (SQLite,
single source of truth) and writes a clean CSV with no conflict markers,
regardless of what git put in the file.

---

### Why the auto-resolve message is misleading

`close.js` does call the export script internally, but by the time it does,
the file is already in a conflicted state in the git index. The export writes
a correct file to disk, but the conflicted index entry shadows it — or the
subsequent `git rebase --continue` step re-applies the conflict. Either way,
the working-tree file that reaches the pre-push hook has markers.

The message is accurate in intent ("I tried to fix it") but not in result
("the file is now clean"). Treat it as a warning, not a confirmation.

---

### Pattern to watch for

Any time `close.js` prints the "auto-resolved" message, assume the CSV is
dirty until you verify with `grep -P "^<<<<<<<" docs/puzzle-velocity.csv`.
The clean path (no other agents logging between your velocity:log and your
close run) never triggers the message at all — the message itself is the
signal to run the manual fix.

---

### Related

- Pre-push conflict-marker gate: `scripts/git-hooks/pre-push` (added #205)
- `scripts/velocity-export.js` — the canonical "write clean CSV from SQLite"
- `~/.lccjs/velocity.db` — SQLite source of truth; never edit the CSV by hand
- #569 — this TIL
