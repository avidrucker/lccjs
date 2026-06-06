# TIL 2026-06-05 — BANANA

**Context:** Three tickets this session: #860 (add same-line label examples to
`tests/fixtures/benchmark_isa.a`), #838 (repo activity analysis from velocity.db + GitHub API),
and #903 (diagnose 19 failing tests across 9 suites — 7 root-cause clusters,
7 child tickets filed).

---

## 1. The Read tool rejects `.a` files as "binary"

**What happened:** On issue #860, the first step was to read
`tests/fixtures/benchmark_isa.a` to understand its structure before editing.
The `Read` tool returned a hard error: "This tool cannot read binary files. The
file appears to be a binary .a file." The file is plaintext assembly source —
nothing binary about it.

**What I learned:** The `Read` tool classifies files by extension, not content.
`.a` is the Unix static-library extension, so the tool assumes binary regardless
of what's actually in the file. The correct workaround is `Bash` with `cat -n`
or `sed -n` to view, and Python `open().read()` / `.write()` for multi-line
edits that span lines (avoids the sed multi-line quoting maze).

**The rule:** For `.a` files (and any extension the Read tool misidentifies),
use Bash or a short Python script — never fight the tool by renaming the file.

---

## 2. `git worktree remove` must run from the main checkout, not from inside the worktree being removed

**What happened:** Starting the #903 task, I tried to remove the stale
`banana-issue-838` worktree from within the worktree itself. The shell's `cwd`
was inside the path being removed, so `getcwd` failed:
`pwd: error retrieving current directory: getcwd: cannot access parent
directories: No such file or directory`. Re-running the command from the main
checkout path also failed with `fatal: '.claude/worktrees/banana-issue-838' is
not a working tree` — because `npm run close` had already cleaned it up
automatically.

**What I learned:** Two things. First, never run `git worktree remove <path>`
from inside `<path>`. Second, `npm run close` (which runs `close.js`) already
handles worktree cleanup when it pushes and closes the issue — so by the time
the orchestrator tells me to manually remove it, the path is often already gone.
`git worktree prune` is the safe fallback: it removes references to paths that
no longer exist on disk.

**The rule:** Always `cd` to the main checkout before `git worktree remove`;
if the path is already gone, `git worktree prune` is enough.

---

## 3. Diagnose-then-ticket discipline: cluster before filing

**What happened:** Issue #903 described 11 test failures across 8 suites. By
the time I ran `npm test`, the count had grown to 19 failures across 9 suites.
The temptation is to fix the easy ones immediately — but the task was "diagnose
and file child tickets, don't fix."

Forcing myself to cluster first revealed that 8 of the 19 failures share a
single root cause (missing `@lezer/lr` package — one `npm install` fixes them
all), and 3 more share another (missing `.hex` fixture files). Filing one ticket
per cluster rather than one per failing test kept the backlog clean: 7 clusters
→ 7 child tickets, not 19.

**What I learned:** Running the full suite first and grouping failures by
symptom before touching any source is worth the extra step. Failures that look
unrelated often share a root cause that would be obscured if you started fixing
the first one you saw.

**The rule:** Before filing any fix ticket from a failing test, run the full
suite, group failures by root cause, and file one child per cluster — not one
per test.

---

## 4. A devDependency in `package.json` is not the same as an installed package

**What happened:** All 8 `lezer-grammar.unit.spec.js` tests crashed with
`ERR_MODULE_NOT_FOUND: Cannot find package '@lezer/lr'`. The package is listed
in `devDependencies` in `package.json`. But `node_modules/@lezer/` doesn't
exist — `npm install` was never run after the dependency was added.

**What I learned:** In this project, `npm install` is a one-time setup step
(documented in CLAUDE.md). When a new devDependency is added to `package.json`
in a commit, any checkout that was last installed before that commit will be
missing the package. Worktrees inherit the main checkout's `node_modules/` by
symlink or proximity, so a fresh `npm install` in the main checkout is needed
when devDependencies change.

**The rule:** If a full test suite crashes with `ERR_MODULE_NOT_FOUND` on a
package that IS in `package.json`, the fix is `npm install` — not a code change.

---

## 5. Velocity report reveals: human-gate is the throughput bottleneck

**What happened:** Issue #838 asked for a repo activity analysis. Running
`npm run report` (implemented in #858) and ad-hoc SQLite queries against
`~/.lccjs/velocity.db` produced the full picture. The headline finding: 16 open
human-decision items, some months old, while agent throughput surged 5× in one
week (109 → 550 tickets/week) when ELDERBERRY, FIG, and GRAPE came online the
week of June 1.

**What I learned:** The bottleneck is not agent capacity — it's human decisions.
The M1–M13 orchestrate-tooling cluster (#625–#636) alone accounts for 6 of the
16 human-gate items and is fully actionable by the user whenever they have
15 minutes. Surfacing this via data is more persuasive than flagging it
anecdotally in a PR comment.

**The rule:** When agent throughput is high but visible progress feels slow,
check the human-gate queue first — it's the invisible bottleneck that data
makes visible.

---

## What landed

| Artifact | Change |
|---|---|
| `tests/fixtures/benchmark_isa.a` | 4 branch-target labels converted to same-line style (#860) |
| `docs/research/repo-activity-analysis-838.md` | Repo activity analysis: commits, throughput, C accuracy, human-gate (#838) |
| `docs/research/test-failure-analysis-903.md` | 7-cluster failure diagnosis with child tickets #908–#914 (#903) |

## Open threads

- #908–#914: 7 child fix/data/ops tickets filed from #903 diagnosis — none started yet, all grabbable
