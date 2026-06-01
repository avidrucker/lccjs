# Today I Learned — 2026-05-31 (CHERRY, #3)

Evening session: closed out the #309 footgun spikes — decomposed #309 into #315/#316,
built **Guard 1** (#310, velocity-row ticket-match in `close.js`), then ran the #316
serial-tool-use enforcement spike, filing #349 and corroborating #350. The throughline
is uncomfortable and useful: I kept committing the *exact* footgun I was building a guard
against, and the only thing that reliably stopped it was structure, not resolve.

## 1. I hit the batching footgun *while building its guard* — structure beat willpower

Across #304/#309/#310 I lost an implementation to a batched `git reset --hard`, fired an
11-call batch with a **fabricated SHA**, and nearly posted a comment full of confabulated
numbers — every instance the same shape (`deliberate-tool-pacing` in memory, violated
anyway). The user caught me twice. What finally held was **plan-mode with a binding
one-tool-call-per-step list**: "issue one call, READ its result, decide, next." Every clean
stretch happened under that discipline; every lapse was a "let me just batch the verify"
reflex. **Takeaway:** this is the #281 enforcement-asymmetry lesson lived from the inside —
a known prose rule does not survive self-directed multi-step work; an external forcing
function (plan mode, or a guard) does. That firsthand failure *is* the primary evidence for
#316, and the reason its recommended fix is a `PostToolBatch` hook, not a sharper rule.

## 2. My own Guard 1 caught my own closing commits — twice, correctly

`close.js` re-exports the velocity CSV from shared SQLite, which sweeps in *other* agents'
rows when my base is stale; my commit then "adds" rows for tickets I'm not closing. Guard 1
(#310) blocked the close on both #310 and #316 with "the CSV row(s) record ticket #X, but
you are closing #Y." Both times the right move was **sync + re-export, never `--skip`** — the
guard was correct, my base was stale. **Takeaway:** a guard that fires on its author's own
work two tasks after shipping is the strongest possible validation; and a guard-block means
*fix the precondition*, not bypass — the same "stop, don't circumvent" rule that the close
sequence already taught, now enforced by code I wrote.

## 3. Adversarially verify a load-bearing research claim against the *primary* source

The #316 deliverable hinged on whether a `PostToolBatch` hook exists. Two sub-agents said
yes; one "confirmed" it while emitting a ~30-item hook list I judged hallucinated and even
flagged a prompt-injection in its own results. I trusted **neither** and `WebFetch`ed the
official docs myself — which confirmed *both* the (genuinely large) hook list **and**
`PostToolBatch`. I was half-wrong: my skepticism correctly *triggered* but the claim was
true. **Takeaway:** for a ticket literally about confabulation, the method has to match the
message — verify the one fact the recommendation rests on against the source of truth, and
write down the gap you *couldn't* close (the truncated `tool_calls[]` schema) as a hand-off
to the DEV puzzle rather than asserting it.

## 4. The success route is the dangerous one — `close.js` mutates its own cwd, and the SHA gate mis-fires

Two distinct "it worked, therefore it broke" cases. (a) `npm run close` *succeeds* by
removing its worktree, which kills the shell's cwd and cancels anything I chained after it —
so close must be the **lone last call** in its block. (b) On #316, `close.js` stored
`sha = headSha()` before its push loop, but the loop rebased (a 1-behind race) and pushed a
**rewritten** SHA; the teardown gate then checked the stale pre-rebase SHA, found it absent,
and refused teardown — even though the issue closed fine. That's #350, reproduced; my case
*left the worktree behind* (the gate `die()`s → teardown unreachable) where #312's
*tore it down anyway*, which makes #312 the real anomaly. **Takeaway:** verify a destructive
tool's effect against ground truth, not its exit message — a success can be the failure, and
a captured identifier (a SHA) goes stale the instant the tool rebases under you.
