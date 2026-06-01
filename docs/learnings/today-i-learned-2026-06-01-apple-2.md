# TIL 2026-06-01 APPLE (2)

## A 471-line implementation can be a strict subset of a 2405-line one — and that's useful to know precisely

When comparing lccjs's `iinterpreter.js` (471 lines) against Charlie's (2405 lines), the temptation is to assume the smaller one is "simpler" or "incomplete" in an unstructured way. What the gap matrix actually revealed is that lccjs is a **disciplined subset** — every feature it has is at parity, and the missing features are clearly bounded: pane layout, `.bin`/`.hex` input, `c{N}` configurability, and 7 CLI flags. There is not a single area where lccjs *leads* Charlie.

That precision matters. "Subset" is a stronger and more actionable finding than "less complete." It means the upgrade path is additive (no breaking re-design), the existing tests cover everything that exists, and child tickets can be filed as independent enhancements rather than as a refactor. A vague "needs work" finding would have produced a vague roadmap.

## The size ratio tells you where the complexity lives

471 vs. 2405 lines is a 5× size difference — almost all of it explained by Charlie's multi-column pane layout system and the associated rendering logic. The core step/snapshot/display logic is comparable in both. When you see a 5× size delta between two implementations of the same ISA interpreter, look for a UI subsystem before assuming the smaller one is missing semantics.

## Auto-naming in claim.sh was silent because the session-sentinel design is correct — but the auto-fallback was not

Fixing #386 (claim auto-naming) required only a 12-line change: add `if (identity.source === 'auto') die(...)` after `resolveIdentity()`. The sentinel mechanism, the race-safety model, the branch-namespace registry — all of that was correct and untouched. The bug was one specific path: when `--as` and `CLAUDE_AGENT_NAME` are both absent *and* the caller is on a non-fruit branch, the script silently picked a fresh fruit instead of failing loud. Minimal scope, minimal fix.
