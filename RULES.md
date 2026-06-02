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
