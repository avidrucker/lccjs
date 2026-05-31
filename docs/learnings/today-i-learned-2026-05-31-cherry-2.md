# Today I Learned — 2026-05-31 (CHERRY, #2)

Afternoon session: implemented the #269 parity fix (assembler resolves the author
name before writing the `.o`, so a name failure aborts atomically), then a chain
of process learnings around the close and a follow-up convention (#300).

## 1. Search the tracker before filing — the issue (and its drift) may already exist

I was about to file "make `npm run close` the canonical close." **#268 already
existed** for exactly that — a duplicate averted only by searching first. Bonus:
#268 was itself mis-blocked on a wrong ref (`depends on #257`; the real dependency
was #266/#267). **Takeaway:** `gh issue list --search` before `gh issue create`;
the no-dup rule and the "is this still accurate?" check are the same habit.

## 2. Docs that teach the unhardened path route fresh agents straight to it

Closing #269 I hand-pushed `git push origin HEAD:main` because every close-time
surface (the puzzle-velocity skill, CLAUDE.md, my own memory) still teaches the
manual chain — I only found `npm run close` *afterward*, hunting for a teardown
script. The hardened tool (#266/#267) existed; the docs just didn't route to it.
The push won its race, so it was safe by timing, not structure — one lost race
from the #200 incident. **Takeaway:** when a hardened tool supersedes a manual
recipe, the *docs are the fix surface*, not just the tool. I closed #300 via
`npm run close` end-to-end — applying the lesson within the same session.

## 3. Correct an issue description by redlining, not rewriting

I fixed #268's stale `#257` ref by **rewriting the body in place** — destroying the
audit trail and overwriting the author's text. The user established the better
rule: strikethrough the error in place + a `SEE COMMENTS FOR CORRECTIONS` banner +
the fix as a comment (#300). Encoded canonically in the `yegor-tickets` skill
(v0.2.0) with thin pointers from the lccjs docs — deliberately *one* source of
truth to avoid the "many unsynced surfaces" drift (#230) that bit #268 in #1
above. Dogfooded on #268. **Takeaway:** edits to shared, authored artifacts should
be additive and reversible — a redline, not a silent overwrite.

## 4. The shared main checkout is concurrent — a rebase conflict appeared mid-commit

Committing this very TIL, a `git pull --rebase` collided with APPLE's
concurrently-pushed velocity rows on `docs/puzzle-velocity.csv`, leaving the
checkout mid-rebase; it resolved (another agent's `UNION_FILES` fix, `e85c64e`) but
my uncommitted file was lost and had to be recreated. **Takeaway:** the main
checkout is shared ground — uncommitted work there is exposed to other agents'
pushes. Commit narrowly (the one file), and don't trust working-tree state across
a concurrent window.
