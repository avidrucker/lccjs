# TIL 2026-06-14 — FIG (session 2)

**Context:** The day's second session. The human asked me to run `issue-review-skill` on #1273 (deferred from #1102: thread `--explain` keys through `InterpreterPlus`'s file-format load errors so a corrupt `.ep` renders a `NOT_LCC_FORMAT` / `BAD_EXE_HEADER` explanation under `--explain`). After reading the assessment they said "revise it, then take it." Reviewed → redlined → implemented → closed in `05e4ad9`.

**A note on scope:** most of what this session *could* teach was already filed today by other agents working the same parent (#1102). [GRAPE 2026-06-14](./today-i-learned-2026-06-14-grape.md) already captured the `--explain` two-render-gates and that `InterpreterPlus.handleRuntimeError` rebuilt the funnel and dropped `error.explainKey` (#1102), plus the `velocity:log --from-main` PM-row recipe (#1266). [ELDERBERRY 2026-06-14](./today-i-learned-2026-06-14-elderberry.md) already captured "redline don't rewrite, even on tickets you're closing." My own [morning session](./today-i-learned-2026-06-14-fig.md) captured "a review READY verdict certifies clarity, not that the prescribed fix is correct." This TIL records only the **one genuinely new technical wrinkle** and the **meta-lesson** about that overlap — padding it with re-statements of the above would be noise.

---

## 1. `raiseRuntimeError` throws — so the *caller* is part of the change surface, not just the error sites

**What happened:** #1273's fix was "convert the six bare `this.error('…')` sites in `InterpreterPlus.loadExecutableBuffer` to the typed `raiseRuntimeError` contract." The six sites were the obvious work. The non-obvious work was one level up: `raiseRuntimeError` ends in `throw error` (`interpreter.js:1864`), whereas the old `this.error(msg)` just sets `running = false` and returns. The core interpreter's caller already knows this — it wraps its `loadExecutableBuffer` call in a `try/catch` that forwards `error.explainKey` (`interpreter.js:555-561`). The plus caller did **not**: `interpreterplus.js:165` called `loadExecutableBuffer(realBuffer, 'p')` bare. Converting the six sites without wrapping that call would have shipped a throw with nothing to catch it.

I caught this during the *review* (not the implementation) by reading the sibling core path the ticket claimed to mirror and comparing the two callers — the gap was right there. The fix became a small `try/catch` routing through the existing `handleRuntimeError`, plus deleting the now-dead `return;` after each throw.

**What I learned:** `this.error(msg)` and `this.raiseRuntimeError(...)` have *opposite* control-flow contracts (return vs throw). Swapping one for the other is never a local edit — it changes how control leaves the function, so the callers are inside the blast radius. Reasoning about the six sites in isolation would have missed the only part that could break.

**The rule:** **Before swapping a flag-setting error call (`this.error`, returns) for a throwing one (`raiseRuntimeError`), audit the call chain for a catcher — a throw with no catch is a regression, not a fix.** (Added to `docs/project-gotchas.md` §8 for durability.)

---

## 2. When the day's agents share a parent ticket, grep the TILs *before* writing yours

**What happened:** Drafting this TIL, my first instinct was a five-lesson retrospective: review-surfaces-traps, the either/or fork, redline-don't-rewrite, the throw contract, and the `git diff origin/main` stale-base scare. Then I grepped `docs/learnings/` for today's date and found four of the five already filed — by GRAPE, ELDERBERRY, and my own morning session — because we were all working children of #1102/#1238 in parallel. The stale-base diff artifact was even filed back on 2026-06-07 (GRAPE #1145, DRAGONFRUIT). Only lesson 1 above was genuinely unfiled.

**What I learned:** In a multi-agent repo, the learnings corpus is shared and *fast-moving* — same-day siblings working a common parent will independently surface the same insights. A TIL that re-states them isn't a contribution; it's duplication that makes the index harder to skim. The discipline is the same one GRAPE wrote for memory ("grep `MEMORY.md` before writing a memory — update the canonical entry, don't duplicate"): grep the TILs, keep what's new, cross-link the rest.

**The rule:** **Before writing a TIL, grep `docs/learnings/` for today's date and the parent ticket — write only what siblings haven't already filed, and link to theirs for the overlap.** (Reinforces the "update canonical, don't duplicate" discipline already in the corpus.)

---

## What landed

| Artifact | Change |
|---|---|
| `src/plus/interpreterplus.js` | Six `this.error()` load-path sites → `raiseRuntimeError(new InvalidExecutableFormatError(msg, {explainKey}))`; wrapped the `:165` caller in try/catch via `handleRuntimeError` (#1273) |
| `tests/new/lccplus.explain.e2e.spec.js` | Two e2e tests: corrupt `.ep` header with/without `--explain` (#1273) |
| `docs/project-gotchas.md` | §8 — the `error` vs `raiseRuntimeError` control-flow contract |
| #1273 | Reviewed (READY 13/15), redlined body + decision comment, implemented, closed |

## Related artifacts

- Sibling TILs (the overlap this one deliberately doesn't repeat): [GRAPE 2026-06-14](./today-i-learned-2026-06-14-grape.md), [ELDERBERRY 2026-06-14](./today-i-learned-2026-06-14-elderberry.md), [FIG 2026-06-14 (morning)](./today-i-learned-2026-06-14-fig.md)
- Issue #1273, parent #1042, split-from #1102
