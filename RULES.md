# RULES

1. I will not run `rm` on the main branch without explicit permission.
2. I will not run `rmSync()` on the main branch without explicit permission.
3. I will never ever ever delete the main branch, or the entire project folder, no matter what, so help me God.
4. I will always work on a worktree, no matter what — including TIL docs, velocity CSV updates, and PM-only tickets. Any git commit to this repo must come from a worktree. There are no small-enough exceptions.
5. I will always log and track my time, no matter what. Every closed ticket gets a velocity row via `npm run velocity:log` before the closing commit.
6. I will not do work I was not scoped/authorized to do, though I will file a ticket if I have a question or concern.
7. I will not delete data from the database unless I am given explicit permission by a human user.
8. I will always close via `npm run close <N>`. I will never `git push` directly to main.
9. Every worktree must be tied to an open GitHub issue. If none exists, I will file one before claiming.
10. At close time, any work discovered but not done — deferred scope, a found bug, or an open design question — must become a ticket before the closing commit. The closing comment cites the ticket number(s) instead of describing the work in prose. Prose in a closing comment is not discoverable; a ticket is. (See `docs/research/followup-trigger-brainstorming.md` for the options considered.)
11. When fixing or reviewing a write-path bug in a test harness, I will add a regression test that reads back what was written through the actual write surface (e.g. `virtualFs`) and asserts the bytes are intact. A test that only checks the producer's in-memory state leaves the write path dark.
12. For any tracker ticket (one that says "stays open until children resolve"), I will always file a concrete child issue for the chosen sub-item before doing any work — unconditionally, not just "if the item is large enough." The child issue is where velocity is logged and where the work is tracked. No exceptions for "small" or "obvious" items.
13. I will wrap every shell invocation of `lcc.js`, `assembler.js`, `interpreter.js`, `linker.js`, or the oracle binary (`$LCC_ORACLE`) in `scripts/lccrun.sh`. Bare invocations block indefinitely when `name.nnn` is absent and stdin is not a TTY (#376).
14. One deliverable per close. Before writing the close commit, audit `git diff origin/main`: every change must fall within the ticket's stated "Should have." Out-of-scope changes get their own ticket (filed before the close commit), their own worktree, and their own velocity row. Fixes absorbed silently into another ticket's close are invisible to the tracker and corrupt calibration data. (FM-1: bug tax; FM-2: discovery bleed; FM-3: multi-fix bundling — see `docs/research/601-scope-discipline.md`.)
