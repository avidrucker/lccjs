# Research: CSV-from-main footgun — root cause and winning guard

Tracker: [#319](https://github.com/avidrucker/lccjs/issues/319)
Related: #312 (CWD guard in velocity-log.js), #313 (recovery-side fix in close.js), #320 (DEV: implement the guard)

---

## Failure path

1. Agent runs `npm run velocity:log` from the **main checkout** (not a worktree) — e.g. to log an issueless PM row, or a velocity row right after closing a worktree.
2. `velocity-log.js` inserts the row into `~/.lccjs/velocity.db` (correct — DB is global).
3. `velocity-log.js` calls `exportCSV()` unconditionally.
4. `velocity-export.js` writes `docs/puzzle-velocity.csv` relative to `__dirname` — which resolves to the **main checkout's** `docs/` directory.
5. The main checkout now has a dirty `docs/puzzle-velocity.csv`.
6. Agent commits it (`git add docs/puzzle-velocity.csv && git commit`) and pushes.
7. Meanwhile a worktree close by another agent has also exported and pushed a CSV update.
8. The two commits share a common ancestor but differ in the CSV (both appended new rows). `git pull --rebase` produces a content conflict.
9. The conflict must be resolved by re-exporting from the DB — extra friction, and a learning tax every time.

**Observed instances this session (2026-05-31):**
- APPLE logged the #299 velocity row from main → conflict on push (resolved by rebase + re-export)
- APPLE logged the PM triage row from main → conflict on push (resolved by rebase + re-export)

This is the third+ occurrence of the pattern in the week; it is not random — it fires whenever the rule "only export from closing worktree" is violated, which prose-only rules reliably are (#281 finding: 8/8 prose violations, 0/8 guard misses).

---

## Guard candidates evaluated

### A. Skip export in `exportCSV()` when running from the main checkout ✅ RECOMMENDED

**Implementation:** In `velocity-export.js`, before writing the CSV, detect whether the script is running from a worktree or the main checkout. The cheapest reliable signal: check whether `.git` at the repo root is a **file** (worktree, contains `gitdir: ...`) or a **directory** (main checkout). Skip the export and print a notice if it is a directory.

```js
const dotGit = path.join(__dirname, '..', '.git');
const stat = fs.statSync(dotGit);
if (stat.isDirectory()) {
  console.log('Skipping CSV export (running from main checkout — export will happen at next worktree close)');
  return;
}
```

**Why this location:** `exportCSV()` is the single chokepoint for all CSV writes. The guard here covers both `velocity-log.js` (automatic post-INSERT call) and `npm run velocity:export` (direct CLI call). A guard only in `velocity-log.js` would miss a manual `velocity:export` run from main.

**Cost:** ~6 lines in one function. No new deps.

**Enforceability:** HIGH — code path, not prose. Consistent with the #281 finding that executable guards work and prose rules don't.

**DB row still inserted:** The guard only skips the file write. The `~/.lccjs/velocity.db` INSERT has already completed. The row will be included in the next export triggered from a worktree close. Zero data loss.

**Edge case — no worktrees open:** If an agent closes their last worktree and then wants to run `velocity:export` from main to regenerate the CSV (e.g. after seeding), the guard would block it. Mitigation: provide an explicit `--force` flag to bypass, or rely on `npm run velocity:seed` + a seed-time export. This is a rare flow and `--force` is an acceptable escape hatch.

---

### B. Pre-commit hook rejecting staged CSV commits from main ❌ REJECTED

A `pre-commit` hook could detect `docs/puzzle-velocity.csv` in the staging area while on `main` branch and reject the commit.

**Why rejected:** Too late. The CSV has already been written and the export has already happened. The hook prevents the commit but leaves a dirty file on disk — the agent must then either `git restore` it (discarding the export) or address it some other way. The guard in `exportCSV()` (option A) prevents the write entirely, which is strictly better.

---

### C. Documentation/skill-only rule ❌ RULED OUT

Strengthening the wording in `docs/claude_workflow.md`, `docs/puzzle-velocity.md`, or the `puzzle-velocity` skill.

**Why ruled out:** #281 confirmed prose rules are violated reliably (8/8 instances). APPLE violated this rule even while actively trying to follow it. Prose is not the right layer for enforcement.

---

## Interaction with related tickets

| Ticket | What it does | Relationship |
|--------|-------------|-------------|
| **#313** (BANANA, closed) | `close.js` `tryLand()` auto-resolves a CSV-only rebase conflict by re-exporting from SQLite | **Recovery-side** fix. Complements the guard: if the guard is skipped or bypassed, `tryLand()` recovers automatically. Both are needed. |
| **#312** | "velocity-log.js has no CWD guard" | **Same root cause.** The fix recommended here (guard in `exportCSV()`) fully resolves #312 as a side-effect — the guard lives one call deeper than `velocity-log.js` but covers its trigger. #312 can be closed when #320 ships. |
| **#320** | DEV: implement the guard (blocked on this research) | **Implement option A.** The @todo marker for #320 belongs at the `exportCSV()` function in `scripts/velocity-export.js`. |

---

## Recommendation

**Implement option A in `scripts/velocity-export.js`** — add a worktree check at the top of `exportCSV()` that skips the file write when running from the main checkout, with a console notice directing the agent to let the next worktree close pick up the export. Optionally add `--force` flag to `npm run velocity:export` for the rare case where a manual export from main is genuinely needed.

This single change closes #319 (research), unblocks and specifies #320 (DEV), and resolves the root cause of #312 as a side-effect.

**@todo placement for #320:** `scripts/velocity-export.js`, at the `exportCSV()` function definition.
