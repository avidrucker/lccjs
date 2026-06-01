# Today I Learned — 2026-05-31 (BANANA s3)

A dev-heavy session: closed #268 (docs), designed the close-time guards (#301, filed #310/#311),
implemented CSV conflict auto-resolve in `close.js` (#313), added a CWD guard to `velocity-log.js`
(#312), and wrote the `/fruit-agent-orchestrate` skill.

---

## 1. Put the guard before the mutation, never after

The CWD guard in #312 was initially placed after the DB insert — the row was already in the DB when
the error fired. The right rule: fail before any state mutation so there is nothing to clean up.
Applies universally: guards that come after a write leave the system in a partial state that has to be
reasoned about and rolled back. Front-load all validation.

## 2. A hard failure with a named escape hatch beats a warning

The `--from-main` flag in `velocity-log.js` is the pattern: die loudly by default, give an explicit
opt-out for the one legitimate exception (PM rows when no worktree exists for the task). A warning
gets ignored. A hard failure gets noticed. The escape hatch prevents the guard from being a blocker
for valid use cases — but the agent has to consciously invoke it, which is the point.

## 3. Guard 1's "all rows must match" contract is too strict for full-file exports

Guard 1 (#310) checks whether any added CSV row has a ticket that doesn't match the closing issue.
This fires a false positive when a concurrent agent's row rides along in a full-file export — their
ticket is in the diff, Guard 1 sees a mismatch, and blocks a legitimate close. The correct contract
is "the closing issue's ticket must be present," not "no other tickets may be present." Already filed
as #346 (DRAGONFRUIT). Worth remembering: when a guard is designed against append-only diffs, a
full-file export changes the shape of what "added rows" means.

## 4. The CSV auto-resolve from #313 rewrites the SHA that close.js uses for teardown gating

`close.js` captures `sha = headSha()` once at the start of `main()`. When the CSV conflict
auto-resolve runs `git rebase --continue`, the commit is rewritten — the stored SHA is now stale.
The teardown gate (`onOriginMain(sha)`) checks for the pre-rebase SHA, which is gone from
`origin/main`. The work lands correctly and cleanup happened anyway in the observed case, but
the error message fired and the exact path is unclear. Filed as #350 for research.
The lesson: any fix that introduces a `rebase --continue` mid-loop must also re-read HEAD
after the loop completes.

## 5. SQLite migration made the DB write safe — but did not make the CSV export path safe

The `velocity-csv-two-checkouts` memory says the CSV-from-wrong-checkout risk is "moot" since
SQLite. That is wrong. The DB write goes to `~/.lccjs/velocity.db` globally (safe). But
`velocity-export.js` still resolves the CSV path via `__dirname`, which tracks wherever the
script file is. Running `npm run velocity:log` from the main checkout always exports to the
main checkout's `docs/` — regardless of which worktree you should be in. The memory is stale
and should be updated.

## 6. `npm run claim` without `--as` auto-assigns the wrong fruit identity

Ran `npm run claim 301` without `--as banana` and got `agent: apple (auto)`. The claim tool
infers identity from recent branch context, not from who you are in this session. Always
pass `--as <fruit>` explicitly. Recovering from a mis-claim means: remove the worktree,
delete the branch, and re-claim with the correct flag — three steps that a single flag
would have prevented.

## 7. Stubs make a skill shippable before it is complete

The `/fruit-agent-orchestrate` skill has three clearly-marked `## STUB` sections:
agent-state detection from worktrees, pasted-message context gathering, and dynamic
roster. Writing the stubs made the skill shippable today (it works for the current four
agents) without pretending those gaps don't exist. A skill that documents its own gaps
is more useful than one that silently skips cases — future agents know exactly what to
add and where.
