# Today I Learned — 2026-06-01 (APPLE)

Full-day session on close.js hardening and PDD scan infrastructure. Closed: #352,
#354, #359, #365, #367, #248, #370, #173. Also filed #360 (cosmetic getcwd bug),
#367 (pddignore follow-on), #370 (puzzle-status gap).

---

## 1. `process.chdir()` moves the Node process, not the parent shell

`close.js` calls `process.chdir(root)` before removing the worktree, which is
correct — it means subsequent `execSync` calls run from the right directory. But
the **parent bash process** still has its CWD set to the deleted path. When Node
exits, the shell tries to resolve its CWD for the next prompt and prints a cryptic
`getcwd: cannot access parent directories` error. The close itself was successful;
only the shell's cleanup step was confused.

**Takeaway:** `process.chdir()` is process-local. The calling shell's CWD is
untouched. If a script removes its own working directory, the parent shell will
notice on the next prompt and it's cosmetic — but it looks like a failure.

---

## 2. Capture `headSha()` AFTER the push loop, not before

`close.js` captured `const sha = headSha()` at the top of `main()`, before the
push/rebase loop. When the CSV auto-resolve path inside `tryLand()` called
`git rebase --continue`, the commit SHA was rewritten. The gate check then looked
for the original SHA on `origin/main`, found nothing, and refused teardown — even
though the close had landed cleanly under the new SHA (#354).

**Takeaway:** any value derived from `HEAD` before a loop that might rebase is
stale after the loop. Re-read it once the loop confirms success.

---

## 3. `.pddignore` and `puzzle-status.js` are two independent scanners

Adding `tests/**/*.spec.js` to `.pddignore` (in #367) silenced the `pdd` gem —
but `scripts/puzzle-status.js` has its own `git grep` scan and never consults
`.pddignore`. The result: after restoring plain `@todo` literals in spec files,
`puzzle:status` immediately flagged 7 stale markers that the `pdd` gem now
correctly ignored. Two scanners, two configs, one policy gap (#370).

**Takeaway:** when you exclude a file pattern from one tool, check whether other
project tools have independent scanning logic. Here the fix was a three-liner in
`puzzle-status.js` to match `.pddignore`'s entry.

---

## 4. Pre-flight guards in `close.js` fire before `--dry-run` short-circuits

When two new pre-flight checks were added to `close.js` (#359), every existing
e2e test that used `--dry-run` started failing — because the new guards run in the
pre-flight block, which executes before the `if (opts.dryRun) { return; }` check.
All test fixtures needed `--skip-velocity-check --skip-marker-check` added, even
for dry-run cases.

**Takeaway:** if a close.js pre-flight guard runs regardless of `--dry-run`, every
test that expects a dry-run to succeed must explicitly bypass the new check or
satisfy it. The ordering is: pre-flight → dry-run short-circuit → push loop.

---

## 5. `velocity-log.js` reads `argv[2]` as the JSON — flags must come after

The `--from-main` bypass flag is checked via `process.argv.includes('--from-main')`,
but the JSON is read as `process.argv[2]` specifically. Passing `--from-main` as
the first argument made `rawArg = '--from-main'` and `JSON.parse` failed with a
cryptic "No number after minus sign" error. Took three attempts.

**Takeaway:** scripts that use `argv[N]` for a positional plus `argv.includes()`
for flags depend on positional order. When in doubt, put the positional arg first
and flags after.

---

## What went well

- **Close.js hardening chain was methodical.** Each ticket (#352 → #354 → #359) built directly on the previous; hitting the stale-SHA bug during #352's own close turned it into #354 before it burned anyone else.
- **The research-then-implement pattern for PDD scanning worked.** #365 research produced a concrete recommendation; #367 executed it cleanly; #248 and #370 completed the picture. Each step was bounded and clear.
- **Pre-push gate iteration was fast.** Even with multiple PDD scanner false-fires during #359, each iteration was a single `git push` diagnosis cycle, not a rebuild.
- **Six agents ran without stepping on each other.** Parallel worktrees, multiple closes landing in a hot-main window, and only one manual rebase conflict all session.

## What didn't go well

- **The `@inprogress` marker for #173 wasn't deleted in the closing commit.** Noticed only via the system reminder after close. Required a follow-up direct-to-main cleanup commit.
- **#367 created new stale markers immediately.** After adding `tests/**/*.spec.js` to `.pddignore` and reverting split-concat, `puzzle:status` flagged 7 false stale markers that same turn. Should have run `npm run puzzle:status` to verify the full effect of #367 before closing — not just `npm run puzzles`.
- **The split-concat workaround in #359 was the wrong level of fix.** The workaround addressed the symptom (PDD scanner fires in test files) rather than the root (spec files shouldn't be scanned). Three follow-on tickets (#365, #367, #370) were needed to get to the right answer.
