# Research: velocity-log storage under parallel-agent closes (#186)

**Spike, bounded.** Question: should `docs/puzzle-velocity.csv` move to SQLite (or
another store) to stop the rebase/merge-conflict churn that parallel agents hit
on every close? **Answer: no — keep the CSV; add one `.gitattributes` line
(`merge=union`) and stop storing a rebase-fragile commit SHA in the row.**

## The two pains (they are independent)

Closing a puzzle appends a row to a single append-only CSV. Under parallel
worktrees, several agents do this within minutes. That produces two *separate*
problems, and any fix must be evaluated against **both**:

- **Pain A — manual conflict resolution.** Both agents append a last line, so
  `git pull --rebase` stops with a content conflict that must be hand-resolved
  (plus the `grep -c '^<<<<<<<'` marker-guard — the reason skill 0.4.0 exists).
- **Pain B — `closed_commit` is rewritten by the rebase.** The row records the
  short SHA of the closing commit; rebasing replays that commit onto the new tip
  and **gives it a new SHA**, so the value just written is now an orphan and must
  be re-edited every rebase round. The #160 close cycled
  `5c811f8 → 45f2654 → ab80bbc`.

## Empirical result: `merge=union` fixes Pain A (and fires under rebase)

The one risky assumption — that the `union` merge driver runs during a *rebase*,
not just a *merge* — was tested in a throwaway repo:

```
log.csv has `merge=union` in .gitattributes.
  branch other: append "2,from-OTHER"   (simulates origin/main advancing)
  branch mine:  append "3,from-ME"       (my velocity row)
  git rebase other
→ rebase exit 0, ZERO conflict markers, log.csv contains BOTH row 2 and row 3.
```

`rebase` uses the 3-way-merge machinery per replayed commit, so custom merge
drivers including the built-in `union` apply. **Concurrent appends auto-union with
no manual step.** Pain A is gone for a single `.gitattributes` line.

Caveats, all acceptable for an append-only log:
- `union` concatenates both sides' added hunks; it does **not** dedup or order
  them. Rows may interleave by who-rebased-when rather than strict close order —
  fine for a log keyed by `ticket`+`started_iso`. **No row is ever lost.**
- Genuinely identical lines would collapse to one, but rows are unique (distinct
  ticket + timestamps), so this can't happen in practice.

## `merge=union` does NOT fix Pain B

The same test confirmed my commit's SHA changed (`79e238c → ca419d5`) across the
rebase. Auto-union resolves the *line*, but the closing commit still gets a new
SHA — and because `union` no longer stops the rebase, there's no longer a moment
to fix it, so the row would **silently ship a stale SHA**. Pain B must be solved
separately, or `merge=union` makes it *worse* (silent instead of loud).

### Fix for Pain B: stop storing a rebase-fragile self-reference

`closed_commit` is, by definition, "the commit that closed ticket #N" — and that
commit already carries `Closes #N` in its message. The SHA is therefore
**derivable, not authoritative**:

```bash
git log --grep "Closes #<N>" -1 --format=%h    # the closing commit, always correct
```

Recommendation: **don't capture/repair the SHA in the rebase-critical path.**
Log the row with `closed_commit` **empty**, and derive it after the fact (on
demand, or via a bulk backfill reconciler — a natural follow-up puzzle). This is
always correct (it reads final history) and never needs a manual fix.

This also unlocks a **single-commit close**: since the row no longer needs a
second commit to reference the first's SHA, marker-deletion + row-append can be
one commit. Fewer commits → less rebase surface. (Optional but recommended.)

## SQLite — rejected

A committed `.db` is **binary**: there is no `union` driver for it, so concurrent
commits conflict *worse* than the CSV (a binary conflict is whole-file and not
auto-resolvable); it is **undiffable** in PRs, losing the human-readable
calibration-review value the CSV provides; and it adds a dependency. "SQLite as a
local cache that exports to text on close" just reintroduces a committed text
file — i.e. back to the CSV, plus a DB to keep in sync. Net negative. Rejected.

## Migration / compatibility

Trivial. `merge=union` is one `.gitattributes` line; the **row format is
unchanged**, so `scripts/puzzle-status.js`, the positional `awk $1..$13` examples
in [`../puzzle-velocity.md`](../puzzle-velocity.md), and all ~50 existing rows are
untouched. The `closed_commit` change is additive (empty is already a legal
value; a derive/backfill helper is the only new tooling, and it's optional).

## Recommendation (applied in this ticket)

1. **Add** `.gitattributes`: `docs/puzzle-velocity.csv merge=union`. ← kills Pain A.
2. **Protocol:** single-commit close; leave `closed_commit` empty and derive via
   `git log --grep "Closes #N"`. ← kills Pain B (no SHA dance). Reflected in
   `docs/puzzle-velocity.md` and the `puzzle-velocity` skill.
3. **Follow-up puzzle (not here):** a small `closed_commit` backfill reconciler
   that fills empty SHAs from the git log, run alongside `puzzle:status`.

Cross-repo `closed_commit` (the sibling-repo SHA case) is out of scope here — it
stays with #161.
