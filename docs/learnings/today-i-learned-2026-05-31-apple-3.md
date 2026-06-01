# Today I Learned — 2026-05-31 (APPLE, session 3)

Afternoon/evening session: #299 fix + DB cleanup, #229/#230 (identity consolidation), #321 (artifacts-summary audit + 6 follow-up issues), CSV-from-main footgun research (#319), and two rounds of `fruit-agent-orchestrate` scoping.

---

## 1. Prose violations happen even while you're documenting the prohibition

The apple-2 TIL (earlier today) documented "don't commit the CSV from the main checkout." In this session I did it twice — once logging the #299 velocity row, once logging the PM triage row — and both times while actively working on the research that would eventually produce the guard to prevent exactly this.

This is the cleanest possible evidence that the #281 finding is structural, not a knowledge gap. The rule was known, freshly written, and sitting in context. It was violated anyway. The only fix is an executable guard. BANANA shipped it in #312 (CWD check in `velocity-log.js`); the remaining gap (`npm run velocity:export` from main) is tracked in #320.

## 2. Detecting "am I in a worktree?" — the `.git` file vs directory trick

`velocity-export.js` writes the CSV relative to `__dirname`, so it always writes to the correct `docs/` for whichever checkout is running — main or worktree. The problem is that "the correct docs/ for main" is the wrong place to commit from. The reliable detection:

```js
const dotGit = path.join(__dirname, '..', '.git');
fs.statSync(dotGit).isDirectory()  // true → main checkout; false → worktree (.git is a file)
```

In a worktree, `.git` is a plain file containing `gitdir: <path>`. In the main checkout, `.git` is a directory. This is stable, cheap, and requires no `git` subprocess. Documented in `docs/research/csv-from-main-footgun.md` (#319).

## 3. Research deliverables should name the exact implementation site

The #319 research doc placed the `@todo #320` marker at `exportCSV()` in `velocity-export.js` and included the exact implementation sketch (the statSync check above). This made the DEV handoff immediate: BANANA could read the doc and know where and what to implement, rather than re-deriving it.

The contrast with a vague deliverable ("a guard would help here") is the difference between a ticket that unblocks work and one that spawns another research round. Naming the function, file, and implementation approach in the research output is worth the extra paragraph.

## 4. Smoke-test inserts pollute the global DB and need manual cleanup

Testing the null-ticket fix for #299 by running `npm run velocity:log` inserted rows 160 and 161 into `~/.lccjs/velocity.db`. Because the DB is global (not per-checkout), those rows survived the `git restore` I ran on the CSV in the worktree. Had to delete them with `sqlite3` directly before re-exporting. The lesson: the DB is permanent state — testing a write-path tool requires thinking about global side effects, not just local file changes. Consider using a test DB or a `--dry-run` flag for validation runs.

## 5. Consolidating duplicated prose: one canonical doc + one-line summaries elsewhere (#229/#230)

The agent-identity precedence rule was restated in 6 places and had already drifted in 3 of them after #212. The fix: `docs/design-agent-worktree-identity.md` becomes the single canonical home; every other location gets one sentence + a link. The canonical doc also received the "sync main before claiming" note from #223 R1 that had never been folded in.

The general pattern: any rule that lives in N places will drift in some of them. The right response is not to update all N — it is to make N=1 and link from everywhere else.
