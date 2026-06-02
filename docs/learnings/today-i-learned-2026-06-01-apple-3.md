# Today I Learned — 2026-06-01 (APPLE, session 3)

Tickets: #419 (linker resetState — already done), #434 (filed), #435 (jest forceExit), #414 (linker rename).
Theme: two fixes that look like subprocess problems but are actually parent-process problems.

---

## 1. A subprocess's `cd` can't save the parent

`close.sh` (#379) fixed the `getcwd` error for **bash**: it captures the branch, then
`cd "$main_root"` before forking node. Bash's CWD is main_root throughout and at exit —
bash is fine. Node's CWD is also main_root (inherited from bash after the cd) — node is
fine. But `npm run close` was launched from the **worktree** (where `package.json` lives),
so npm's own process set its CWD to the worktree at step 1. Nothing a child process does
can change a parent's CWD. After teardown, npm's internal `process.cwd()` call fails on
the deleted path and npm exits 1, printing the `getcwd` error.

**Lesson:** when a subprocess `cd`s, only that subprocess's CWD changes. The parent's CWD
is frozen at launch. To truly fix this, npm itself needs to start from a path that
survives teardown — e.g. invoke `node scripts/close.js` directly (no npm wrapper) so the
process that calls `process.chdir(root)` is the same one that stays alive. Filed as #434.

---

## 2. jest never exits when an external process holds stdin open

`assess.bb` spawns `npm test` via `babashka.process/process`. By default that keeps the
stdin pipe open; the pipe's write-end is held by the caller. Jest finishes every test but
never calls `process.exit()` because the event loop won't drain while an open handle
exists — and the stdin pipe counts as an open handle. Both sides wait forever: jest waits
for the event loop, the caller waits for jest.

One line breaks the deadlock: `forceExit: true` in `jest.config.js`. This makes jest call
`process.exit()` after all tests complete, regardless of open handles.

**Lesson:** when jest hangs after tests complete (not during), the first thing to check is
whether the invoking process left an open handle — most commonly stdin or a child_process
the test suite spawned. `--detectOpenHandles` will name the culprit; `forceExit: true`
terminates cleanly regardless.

---

## 3. Read the code before closing a "bug" in an already-refactored module

Issues #419 and #405 both described the same fix: make `linker.js` constructor delegate
to `resetState()`. The fix was already in `fc2b10e` (landed under #254). Both issues were
filed by ARC research that read the code at a point in time before the fix landed.

The right close sequence when a ticket describes already-done work: (1) verify the
acceptance criteria directly in code, (2) run the tests, (3) post a comment citing the
commit that landed the fix, (4) close the duplicate(s). Do not reland the same change.
