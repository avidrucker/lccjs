# TIL 2026-06-14 — GRAPE

**Context:** A readiness review of #1102 ("--explain forwarding in the LCC+ driver") that the owner then asked me to revise and implement. Started as a pure issue-review-skill pass (logged as review #1266, child of tracker #938), turned into a groom + a full DEV pickup that shipped #1102, split off #1273, and folded in #1232. The lessons below are mostly about *trusting evidence over the ticket text* and the non-obvious seams in the toolchain's `--explain` plumbing.

---

## 1. A ticket's blocker banner is a claim, not a fact — re-verify it in code

**What happened:** #1102's body (and my own earlier readiness-review comment, and a follow-up from another agent) all rested on one assertion: *"`grep explain src/core/interpreter.js` is empty — the runtime half is blocked-by #1100."* When I actually re-ran that grep during the re-review, it was **not** empty: the core interpreter now carried `DIV_BY_ZERO`, `UNKNOWN_OPCODE`, `EOF_ON_STDIN`, and the format keys. #1100, #1247, and #1245 had all **closed** since the banner was written. The entire "blocked / defer via PDD" disposition was stale.

**What I learned:** In a repo with many concurrent agents, a ticket's stated dependency state decays the moment a sibling closes the dep it references. The banner was *correct when written* and *wrong when read* — exactly the failure mode already filed as the meta-bug #1243 (f-a-o co-schedules dependency-coupled grooming; siblings close the referenced deps mid-execution). The recalled-memory caveat ("a memory naming a file/flag reflects what was true when written — verify it still exists") applies to ticket bodies too, not just my own memory files.

**The rule:** **Before accepting a ticket's "blocked-by #N" / "grep is empty" claim, re-run the grep and re-check #N's state — the body reflects the repo as it was when written, not as it is now.** Authority: #1243.

---

## 2. `--explain` has *two* render gates — an instance flag and a module-level flag

**What happened:** Forwarding `--explain` through `lccplus.js` looked like a one-liner mirror of the existing `-v`/`--verbose` forwarding. It wasn't. The assembler renders its `explain:` block from an **instance** property (`assembler.explainModeOn`, read in `formatAssemblerError`). But the interpreter's runtime/file-format error funnel renders via a **module-level** flag in `src/utils/cliExit.js`, flipped only by `setExplainMode(true)` and read by `maybeExplain`. Setting just `interpreter.explainModeOn = true` would have left every *runtime* error silently unexplained while the assembler errors worked — a half-working feature that a shallow smoke test (assembler error only) would have passed.

**What I learned:** The two gates exist because the assembler is mid-refactor toward a pure seam (instance state) while the interpreter's wrapper path still routes through the shared `cliExit` helpers (module state). `lcc.js` sets *both* (`assembler.explainModeOn = ...` **and** `setExplainMode(true)`); I had to mirror both in the plus driver.

**The rule:** **When forwarding `--explain` (or any cliExit-gated flag) into a driver, wire both the assembler's instance `explainModeOn` and the module-level `setExplainMode` — the assembler and the interpreter funnel read different switches.** Authority: code in `src/cli/lcc.js:407,475`; I added a clarifying note to #1102 AC #1.

---

## 3. "Shadowed by a plus override" is a concrete line number, not a vibe

**What happened:** CLAUDE.md warns that a core change can be "silently shadowed by a plus override." Here it was literal: the inherited runtime errors already carried `explainKey`s, but `InterpreterPlus.handleRuntimeError` (`interpreterplus.js:244`) built its `Runtime Error: <msg>` string and **dropped `error.explainKey` on the floor** — it never called `maybeExplain`. The base interpreter's funnel (`cliErrorExit(msg, 1, error.explainKey)`) forwarded the key; the plus subclass's hand-rolled funnel didn't. One added line (`maybeExplain(error && error.explainKey)`) was the whole runtime-half fix.

**What I learned:** When a subclass *re-implements* a funnel instead of delegating to `super`, it silently loses whatever the base funnel threads through. The gotcha doc's abstract warning ("check trap handlers / handleDirective / writeOutputFile") generalises to *any* overridden error/exit path, not just the three named methods.

**The rule:** **When a plus subclass re-implements an error/exit funnel, diff it against the base funnel's signature — anything the base forwards (explainKey, verboseContext) that the override doesn't is a silent regression.** Authority: sharpened the shadowing note in #1102 to cite the exact lines.

---

## 4. `velocity:log` needs `--from-main` for a no-worktree PM row

**What happened:** I logged the review row (#1266, a PM/review task with no worktree of its own) from the main checkout while other agents' worktrees existed. `velocity:log` refused: *"logging from main checkout while active worktrees exist."* The fix was the documented escape hatch it prints — `npm run velocity:log -- --from-main '{...}'` — because a review/triage row legitimately has no worktree to log from.

**What I learned:** The guard exists to stop a *worktree-bound* task from logging to the wrong CSV, but PM/review rows are exactly the case it can't assume — they're issueless-or-worktreeless by nature (cf. the existing "no-code work still logged" convention). The tool already knew this and offered `--from-main`; I just had to read its error.

**The rule:** **A PM/review/triage row with no worktree of its own logs via `velocity:log -- --from-main`; don't cd into someone else's worktree to satisfy the guard.**

---

## 5. A deferred-half `@todo` must point at a *live* follow-up, not the closing ticket

**What happened:** I scoped the file-format load-path explain keys out of #1102 (they need a base `Interpreter.error()` signature change). The tempting move was `@todo #1102:...` at the code site — but #1102 was about to **close**, which would leave a stale marker that `puzzle:status` flags the moment the issue closes. Instead I filed the follow-up #1273 *first*, then pointed the `@todo #1273` at it.

**What I learned:** A PDD puzzle's parent must outlive the commit that introduces it. Referencing the ticket you're closing in the same breath is self-invalidating. This is the same "stale marker" failure the claim/close tooling guards against, just from the authoring side.

**The rule:** **File the follow-up issue before writing the `@todo`, and reference the follow-up — never the ticket you're closing in this commit.** Authority: existing PDD / `puzzle:status` stale-marker convention.

---

## What landed

| Artifact | Change |
|---|---|
| `src/plus/lccplus.js` | Parse `--explain`; set assembler/interpreter `explainModeOn` + `setExplainMode` (#1102) |
| `src/plus/assemblerplus.js` | `REGISTER` key on `assembleRAND` "Missing register"; `UNDEFINED_LABEL` on `.start` (#1102) |
| `src/plus/interpreterplus.js` | `handleRuntimeError` forwards `error.explainKey` via `maybeExplain`; `@todo #1273` at load path (#1102) |
| `tests/new/lccplus.explain.e2e.spec.js` | New e2e: assembler + runtime halves, default-output-unchanged (#1102) |
| #1102 body | Groomed: refreshed stale deps, pinned AC #4, sharpened shadowing note |
| #1232 | Closed as folded-in (test AC now pinned in #1102) |
| #1273 | Filed: deferred file-format load-path explain keys |

## Open threads

- #1273 (deferred load-path keys) needs a base `Interpreter.error()` signature change — cross-cutting into core, hence its own ticket.
- The `--from-main` and two-gate-`--explain` facts may deserve a `docs/project-gotchas.md` entry; not filed yet.

## Related artifacts

- Review record: #1266 (child of tracker #938)
- Meta-bug for lesson 1: #1243
- Issue: #1102
