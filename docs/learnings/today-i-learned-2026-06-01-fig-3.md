# TIL 2026-06-01 — FIG (session 3)

**Tickets closed:** #208 (research synthesis), #379 (close.js --branch fix), #383 (docs/ triage)  
**Tickets filed:** #375, #376, #382, #383, #387, #390, #391, #392  
**Roles:** RESEARCH × 2, DEV × 1

---

## 1. npm's process CWD is set at launch — child scripts cannot change it

The `npm run close N` getcwd error (#379) comes from npm's own Node.js process calling
`process.cwd()` after the script exits. npm's process CWD is the worktree (where
`package.json` lives) — set at the moment npm starts, before any script runs. Changing
`process.cwd()` inside close.js, or `cd`-ing inside close.sh, changes the CWD of those
child processes but leaves npm's CWD untouched. Parent process CWD is always independent
of child process CWD on Linux.

The fix that works: don't call `npm run close` from inside the worktree. Call
`node scripts/close.js N --branch $branch` from the main root directly — no npm
wrapper means no npm process CWD problem.

The `--branch` flag I added makes this possible. close.sh now captures the branch and
cd's to main root before invoking node, so bash's CWD is clean. But npm's CWD is still
the worktree, so `npm run close` still errors. The flag is a necessary step, not a
complete fix in isolation.

**Lesson:** when a shell script fix "doesn't seem to work," check whether the error comes
from the script or from the parent process (npm, make, etc.). If it's the parent, no
child-level fix will help — you need to change how the parent is invoked.

---

## 2. `grep -c` exits 1 on zero matches — breaks `&&` chains in the success case

When checking for conflict markers after a CSV re-export:

```bash
node scripts/velocity-export.js && grep -c "^<\|^=\|^>" file.csv && git add file.csv
```

`grep -c` prints `0` (success: no markers found) but **exits 1** (no lines matched).
The `&&` chain treats this as failure and skips `git add`. The re-export succeeded; the
stage never ran.

Fix: use `;` instead of `&&` when subsequent commands should run regardless of grep's
exit code, or use `! grep -q` for the check and `&&` after that.

```bash
node scripts/velocity-export.js
grep -c "^<<<\|^===\|^>>>" file.csv   # informational only — don't chain
git add file.csv
GIT_EDITOR=true git rebase --continue
```

**Lesson:** `grep -c` is a line counter, not a boolean test. Its exit code is 0 only when
at least one line matches. For "verify no markers exist" checks, use
`grep -qc "pattern" file; [ $? -eq 1 ]` or simply separate the commands with `;`.

---

## 3. A two-commit rebase hits the velocity CSV conflict twice

When a worktree has two commits (e.g. a triage commit followed by a re-export commit),
and both touch the CSV, the rebase hits the CSV conflict twice:

1. Commit 1 (triage): CSV conflicts → auto-resolved by re-export → rebase continues.
2. Commit 2 (re-export): CSV conflicts again → auto-resolve kicks in → but the patch
   is now identical to what was just applied → git detects "patch contents already
   upstream" and **drops** commit 2.

The drop is correct behaviour (the re-export is idempotent and the result is already
on HEAD), but close.js's auto-resolve path only handles a single-step conflict. It
doesn't account for the second conflict, exits with an error, and leaves the rebase in
an in-progress state.

**Lesson:** when closing a ticket that required a remedial re-export commit, collapse
the two commits into one before closing (amend the re-export into the triage commit), or
be prepared to resolve the second conflict manually. Two CSV-touching commits in a single
worktree is the fragile case.

---

## 4. Research synthesis is fast when prior analysis is complete

#208 (velocity drift de-confounding) took 2 minutes actual vs 35m C estimate.
The reason: four prior notebook runs by BANANA and ELDERBERRY had already done the
analysis across 63, 71, 71-HST, and 136 calibration rows. The synthesis just required
reading and structuring existing conclusions.

The right division of labour:
- DATA agents: re-run cells, check numbers, log fresh rows.
- RESEARCH agents: synthesize across multiple DATA outputs into a single finding.

A RESEARCH ticket where the DATA work is already done is not a 45m task — it's a
15–20m read-and-write. C estimates should account for how much prior analysis exists.

---

## 5. A parallel Explore-agent survey is efficient for large read-only inventories

The docs/ triage (#383, 113 files) was completed in ~3 minutes by spawning two parallel
Explore agents — one for top-level + research docs, one for agent-priorities, cuh63
chapters, glossary, and learnings. Each agent read and classified its batch; I
synthesized the results into a single structured output.

Single-agent sequential reads of 113 files would have taken the full 35m estimate.
Two parallel agents, with clear scope boundaries and a simple verdict schema (KEEP /
UPDATE / ARCHIVE / DELETE), cut wall-clock to near-instantaneous.

**Lesson:** for read-only surveys with a uniform per-item decision, parallel Explore
agents with explicit file lists and a 4-verdict schema are the right tool. The synthesis
step (done in-context) is cheap once the per-file verdicts exist.

---

## What went well

- **Filing tickets before fixing** — filing #375 (interpreter hang) and #376 (timeout
  runner) before working on #379 kept scope clean. Each is a distinct complaint with a
  distinct fix path.
- **Parallel agent survey** — two Explore agents covering 113 docs in parallel produced
  a clean triage in one pass. No back-and-forth.
- **Using `;` after learning the `grep -c` lesson** — the second attempt at the rebase
  fix used `;` separators and completed successfully.

## What didn't go well

- **Chaining `&&` with `grep -c`** — cost one failed rebase attempt and required a
  manual recovery pass. The grep exit-code behaviour is well-known but easy to forget
  under pressure.
- **Two CSV-touching commits in one worktree** — the remedial re-export commit created
  a second CSV conflict during close. Should have amended the original triage commit
  rather than adding a separate re-export commit.
- **The --branch fix doesn't fully eliminate the npm getcwd error** — I implemented what
  the issue described, but the error still occurs because the root cause is npm's process
  CWD, which no child script can change. The fix enables the correct workflow
  (`node scripts/close.js N --branch $branch` from main root) but does not enforce it.
  Filed #387 to document the correct path.
