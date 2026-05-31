# Today I Learned — 2026-05-31 (APPLE)

Context: commit-quality sprint — CC audit (#280), commit conventions in CLAUDE.md
(#282), commit-msg hook (#283), setup docs (#285), gitignore enriched CSV (#286),
artifacts-summary.md (#287). A PM-heavy session with no production-code changes.

## 1. The `at_todo` trap bites shell script *example strings*, not just markers

Writing the `commit-msg` hook, I put a realistic example in an `echo` line:

```bash
echo "  Fix: research: graduate @todo (#208)"
```

The PDD scanner (`pdd` gem) tripped on the literal substring in that string at
push time — same parse-error it gives for a malformed marker. Previous agents
documented the trap for code comments (CHERRY s3 #2) and CSV data (DRAGONFRUIT).
This is the third surface: **any tracked file**, including shell scripts, can carry
the forbidden string inside a string literal or echo argument.

**Takeaway:** before committing any file that references the puzzle marker keyword
— even in an example, a comment, or an echo — de-literalize it (rename the example,
break the word, or rephrase). The scanner is textual; context doesn't protect you.

## 2. Parallel issue filing breaks cross-links — file sequentially when numbers matter

I filed #282 (WRITER) and #283 (DEV) in one parallel tool call to save a turn.
Because I didn't know the resulting issue numbers in advance, the body of #283
referenced `#281` (wrong) as the sibling. Had to `gh issue edit` to fix it after
the fact — an extra round-trip that cost more than the "saved" turn.

**Takeaway:** when two issues need to cross-reference each other, file them
sequentially. The second filing can name the first's number correctly. Parallel
filing is fine when issues are independent; it's a hazard when they're siblings.

## 3. Git worktree `.git` is a file — hook installers must use `--git-common-dir`

`scripts/setup-hooks.sh` initially assumed `.git/hooks/` is always a directory
(the normal clone case). In a worktree, `.git` is a file containing a `gitdir:`
pointer to the real git directory elsewhere. The first run of `npm run setup` from
a worktree failed: `ln: failed to access '.git/hooks/commit-msg': Not a directory`.

The fix: use `git rev-parse --git-common-dir` to locate the shared hooks directory,
then resolve it to an absolute path (because git returns it relative in normal
clones). That one call works from both regular clones and worktrees.

**Takeaway:** any script that assumes `.git` is a directory will silently or
loudly break in a worktree. Use `--git-common-dir` (shared state) or `--git-dir`
(worktree-local state) depending on which you actually need.

## 4. Committed derived artifacts create two failure modes: silent staleness and crash risk

`stats/puzzle-velocity-enriched.csv` was committed to make notebooks "render without
a rebuild." In practice it created two problems: (a) it silently went stale whenever
new rows landed in `puzzle-velocity.csv` and `enrich.py` wasn't re-run, and (b)
`enrich.py`'s non-idempotent write (truncate-on-crash, #277) could ship a
half-written artifact to main.

The fix was mechanical — add to `.gitignore`, `git rm --cached` — but the root
question is the right one to ask upfront: **is this file authored by a human or
produced by running a command?** If the latter, it's a derived artifact and belongs
in `.gitignore` by default.

**Takeaway:** "committed so it renders without a rebuild" is almost always the
wrong trade-off. Regenerate at analysis time; document the regeneration command
clearly; keep the repo free of stale snapshots.

## 5. Two-tier coverage prevents artifact catalogs from becoming file-tree dumps

For `docs/artifacts-summary.md`, the first instinct was to enumerate every file
in `docs/learnings/`, `docs/research/`, etc. That would produce a hundred-row
table that goes stale on every new TIL and adds zero value over `ls`.

The right cut: **generated/derived artifacts get a full row** (producer, committed
status, value, staleness) because those details aren't self-documenting from the
filename. **Authored doc families get one pattern-level row** (e.g.
`today-i-learned-*.md`) because the naming convention already communicates purpose
and the index in `README.md` is the right place for per-file detail.

**Takeaway:** when cataloging a repo's artifacts, ask "does the reader need to
know *how this specific file is produced and when it goes stale*?" If yes, full
row. If the filename and directory already answer that, a pattern row is enough.

## 6. Understand *why* a workaround exists before the thing it compensates for changes

The `puzzle-velocity.csv` entry in `artifacts-summary.md` called out `merge=union`
in `.gitattributes` as the mechanism that lets parallel agents append rows without
conflicts. Noting the SQLite migration (#284) in the same breath made the connection
obvious: `merge=union` is a workaround for a CSV backing store, not a permanent
feature. When the store changes, the workaround evaporates.

The user confirmed this, and we posted a forward note on #287 to update the doc
once the migration lands.

**Takeaway:** document *why* a technique is in place, not just *that* it's in
place. "Why" tells the next agent whether it's load-bearing or compensatory — and
compensatory techniques have a defined retirement condition.
