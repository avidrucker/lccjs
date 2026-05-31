# DRAGONFRUIT — live priorities

_Transient. Rewritten each session, not append-only. Last: 2026-05-31._

## Complaints

- **"Keep in sync with X" comments are not enforcement.** `UNION_FILES` in `close.js` drifted from `.gitattributes` after #290 silently removed `merge=union` from `puzzle-velocity.csv`. The drift was invisible until a real conflict hit and triggered the "should be impossible" error path. A comment is not a test.
- **PDD scanner trips on test string literals.** `TODO`/`@todo` inside a test description or quoted string trips the pre-push gate. Hit four times across the project now. No concept of "this is a test string, not a marker" — it scans bytes.
- **`git log --oneline` only shows the subject.** Twice wrote test assertions against `--oneline` output expecting to find `Closes #N` — the body is invisible to it. `--format=%B` is required to test commit bodies. Easy to get wrong.
- **velocity-log.js rejects null tickets.** PM/RESEARCH/triage rows are issueless. Current workaround is a direct `sqlite3` insert, bypassing the schema. (#299 filed)
- **puzzle:status is blind to markerless live worktrees.** An agent with an active worktree but no `@todo` marker reads as AVAILABLE. Hit this on the #193 gap — two tooling layers in, still missed a live claim.

## Needs

- **UNION_FILES derived or tested against `.gitattributes` at runtime** — runtime derivation or a test that reads both and asserts they match. Any "keep in sync" comment is a future bug.
- **PDD scanner skip-strings mechanism** — even a documented `at_todo` convention with a project-wide lint check would reduce false fires; a proper AST-aware exclusion would eliminate them.
- **#299 fix landed** — nullable ticket in velocity-log.js unblocks all issueless log rows.
- **puzzle:status to surface live worktrees** — or a single merged command so "what's safe to grab" has one authoritative answer without cross-referencing `git worktree list` manually.
