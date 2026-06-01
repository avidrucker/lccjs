# TIL — 2026-06-01 · CHERRY (session 2)

A decomplect-and-triage session in the interpreter/tooling area: closed **#172**
(extract + test the `picture.js` / `hexDisplay.js` pure helpers), **#256** (flatten
`disassembler.js` deep nesting), and **#251** (extract a pure `decode(ir)` from
`interpreter.step()`); filed **#378 / #381** (model-naming regression in the velocity
CSV), **#384** (disassembler crashes on `.o` input — for an architect), and **#388**
(interpreter state-grouping scope/contract — for an architect); cleaned up the stale
auto-named worktree branches behind **#386**.

Through-line: **the estimate on a decomplect ticket is a guess, not a contract.
Measure the blast radius before you claim — and let the measurement decide whether
it's a DEV task or an architect decision.**

## Lessons

1. **Two adjacent tickets, identical "~45m/DEV decomplect" framing, opposite
   reality — `grep` the consumers before trusting the estimate.** #255 (H4, "group
   constructor state into cpu/io/diag") *looked* like a mechanical 45m rename; a
   blast-radius count showed **~450 references across 18 files** plus an unresolved
   public-API decision (`result.output` / `interpreter.r` are read by tests and
   `lcc.js`), so it became a research+decision ticket (#388) for an architect.
   #251 (H1a, "extract pure `decode`") *looked* the same but the decoded fields are
   **purely internal** (tests: 0 references), so a clean local extraction was a real
   ~45m job. Same words on the ticket, wildly different scope — the only way to know
   is to measure who reads the fields, including the `plus` subclass and the
   interactive debugger.

2. **"No behavior change" earns a *mechanical* proof, not just a green suite.** For
   #256 I diffed the disassembler's output over an 84-file `.e`/`.o` corpus
   before/after; for #251 I checked `decode(ir)` against the original inline formulas
   for **all 65536 instruction words** (0 mismatches). A passing test suite tells you
   the covered paths still work; an exhaustive/corpus diff tells you the *uncovered*
   ones do too. Cheap to write, and it's the difference between "I believe" and
   "I proved."

3. **A refactor's verification diff is a bug detector — capture what it finds, don't
   fix it inline.** The #256 corpus diff surfaced a **pre-existing** uncaught crash
   (`disassembler.js` on a raw `.o` like `s2.o` — out-of-range branch target hits
   `assignLabel`). It wasn't mine and fixing it would have scope-crept a flatten-only
   task, so it became research/decision ticket #384. Normalizing stack-trace line
   numbers proved the diff was *only* the shifted crash, nothing behavioral.

4. **Learn to see the embedded architectural decision.** Both #384 (should the
   disassembler support `.o` at all, reject cleanly, or guard?) and #388 (does the
   interpreter's public field surface stay flat or break?) carry a *design/contract*
   choice, not a mechanical one. Those become `research` + `decision` tickets handed
   to an architect with the blast radius and options written up — not DEV puzzles
   force-fit into a 45m box. Recognizing the decision *is* the deliverable.

5. **The velocity logger has sharp edges that recur — and its own skill example is
   wrong.** `role` must come from the fixed set (`COMBO` for refactor+test, not
   "DEV+QA"); `model` must be canonical short-form (`opus-4.8`, **not**
   `claude-opus-4-8` — `puzzle-velocity-csv.unit.spec.js` enforces it, yet the skill's
   example row shows the long form); and the new `--from-main` guard (#312/#319) now
   *refuses* a no-worktree row unless you pass the flag **after** the JSON
   (`argv[2]` is parsed as the JSON, so `--from-main '{...}'` makes it try to parse
   the flag). The guard even landed on `main` mid-session, so behaviour changed under
   me — re-read the error rather than assuming.

6. **Use your assigned name, not the claim tool's auto fruit.** Earlier claims
   auto-named me `honeydew` (and another agent `lemon`), leaving orphaned
   `*/session` branches and `honeydew/CHERRY` strings in merged commit messages
   (#386 tracks the code fix). Claiming `--as cherry` — my assigned name — avoids it;
   cleanup was deleting the orphaned branches (0 commits ahead of `main`).

## Process note

The orchestrator's hand-off repeatedly attributed "fixed the interpreter hang #375"
to me; I never touched #375 (BANANA did — confirmed by their session-2 TIL). Flag
the drift in one line and proceed on the ticket's own merits — the assignment prose
is a starting point, the issue + code are the source of truth.
