# Today I Learned — 2026-05-30 (BANANA)

Date: 2026-05-30
Agent: BANANA
Context: A long session that arced from process tooling into test coverage. Shipped
the human-directed claim identity (#212 `CLAUDE_AGENT_NAME`), fixed the velocity
data it touched (#217 dedup of a double-logged #210 row + an LF/no-dup integrity
guard), re-ran the velocity notebook on the cleaned data (#213 → fed #208), then —
at the user's direction — ran the **whole `src/plus`+`src/extra` 0%-coverage region
(#166 children #196–#200) one ticket at a time**. Filed four RESEARCH follow-ups
along the way (#225 double-logging policy; #240/#241 two non-interactive CLI bugs;
#242 a close-sequence hardening after a real near-miss).

---

## 1. A coverage ticket that names a bug usually wants a regression *pin*, not a *repro* — check the fix status first

Every one of the five OB sites the #166 children cited — OB-002 (mvi imm9 mask),
OB-009 (double-exit), OB-011 (dead `instructionsCap`), OB-013 (arg-shadowing),
OB-017 (V-table overflow) — was **already fixed on `main`**, each with a resolution
commit. `open_bugs.md` still read "open" only because the #170 reconciliation
lagged. So the work wasn't "reproduce the bug"; it was "convert *fixed-but-unverified*
into *fixed-and-pinned*." And OB-009 was subtler still: it was **dead-code removal**
(a redundant `fatalExit` after an `error()` that already terminates), so its
*observable* behavior never changed — there is no before/after to demonstrate.

**The rule:** before writing a "repro" for a cited bug, grep its fix commit (the
#170 commit-map) and read the current code. You're often writing a regression that
locks in a fix, not a failing test. And when the "bug" was dead-code cleanup, pin
the **contract that's actually observable** (here: a malformed `rand` yields exactly
one error) — don't fabricate a behavior delta that the fix didn't create.

## 2. Testability pressure is a bug detector — "hard to test" *was* the finding, twice

Two latent toolchain bugs surfaced **only because testing forced non-interactive
execution**: `interpreterplus.js` crashes off-TTY (`process.stdin.setRawMode is not
a function`, #240), and the assembler **prompts on stdin for an author name** when
writing a `.o`, exiting non-zero with no stdin (#241). Interactive use never reveals
either — a human always has a TTY and types the name. The test harness doesn't, so
the resistance to being tested *was* the defect.

**The rule:** when a unit refuses to run under the harness, treat that resistance as
data, not an obstacle. It usually means a hidden environment assumption (a TTY,
interactive stdin, a real clock) that the interactive happy path silently satisfies.
"I can't test this without a terminal" is a finding worth filing.

## 3. When the named path is blocked, drop to the pure seam underneath — it's often higher-signal

#198 asked for a subprocess determinism *smoke*; the off-TTY crash (lesson 2)
blocked it, so I drove the pure `executeSrand`/`executeRand` LCG methods directly and
pinned the exact seed-0 **golden sequence** — stronger than a smoke would have been.
#199's run path crashes the same way, so I stubbed `InterpreterPlus.prototype.main`
and tested the *orchestration wiring* (which file each stage receives) instead of the
runtime. Both times the blocked integration path had a cleaner method beneath it.

**The rule:** a blocked CLI/integration path isn't a dead end — the pure method under
it usually tests faster and asserts more precisely. The ticket names an *approach*;
the code offers a *seam*. When they disagree, follow the seam and say why.

## 4. Cleanup must be gated on a *confirmed* push — a newline is not an `&&`

Closing #200, my close ran as newline-separated statements: `git push origin
HEAD:main` then `git worktree remove` + `git branch -D`. The push **lost a
parallel-agent race** (`remote rejected … cannot lock ref … is at f6a9c24 but
expected b23acbff` — another agent pushed in my rebase→push window). Because the
statements weren't `&&`-gated, **cleanup ran anyway and deleted the branch holding
the only ref to the still-unpushed commit.** It survived purely as a dangling object,
recoverable only because `git branch -D` printed `(was 59b9d4d)`; I re-staked a
worktree at that SHA, rebased onto the new `origin/main`, and re-pushed.

This is the cleanup-side twin of APPLE's 2026-05-29 #1 ("never chain `rebase &&
push`"): single-shot push is inherently racy here, and *unconditional* cleanup turns
a recoverable race into near data-loss.

**The rule:** never remove a worktree/branch until the commit is **confirmed** on
`origin/main` (`git branch -r --contains HEAD` shows it). Gate with `&&` or a
separate verified step — never a bare newline chain after `git push`. Filed **#242**
for the durable fix: a symmetric `close`/`unstake` tool that loops fetch/rebase/push
on a race and only then cleans up.

## 5. `puzzle:status` only sees marker-backed work — read `git worktree list` for the real board

Asked to verify what DRAGONFRUIT was doing, I found **#222 actively claimed** (its
`dragonfruit/issue-222-…` worktree branch) while `npm run puzzle:status` reported
*everything* AVAILABLE. The reconciler keys off in-code `@todo` markers; a markerless
GitHub issue with a live worktree is **invisible** to it. (Ironically, that exact gap
is what #222's WIP-lock spike targets.) Cross-checking `git worktree list` is what let
me see the live coordination cluster and deliberately pick work *orthogonal* to it
(the #166 test children) instead of clobbering another agent's files.

**The rule:** `puzzle:status` answers "what marker-backed work is safe to grab";
`git worktree list` answers "who is actually in the repo right now." They are
different questions — for "what's safe to start" under concurrency, you need both.

---

## What landed

| Artifact | Change |
|---|---|
| [#212](https://github.com/avidrucker/lccjs/issues/212) | **Closed (DEV)** — `CLAUDE_AGENT_NAME`: human-directed claim identity (`--as` > env > auto), pure `resolveIdentity()` seam + 9 unit tests. |
| [#217](https://github.com/avidrucker/lccjs/issues/217) | **Filed + closed (COMBO)** — dedup the double-logged #210 velocity row + strip a residual CRLF; added a CSV integrity guard (no CR, no byte-identical dup rows) so `merge=union` can't resurrect it. |
| [#213](https://github.com/avidrucker/lccjs/issues/213) | **Closed (DATA)** — re-ran `enrich.py` + the day-02 notebook on the cleaned 85-row CSV; reported the material shifts (3rd HST day graduated; over-time trend lost significance; per-role now distinguishes TEST) to #208. |
| [#196](https://github.com/avidrucker/lccjs/issues/196)–[#200](https://github.com/avidrucker/lccjs/issues/200) | **Closed (TEST ×5)** — first coverage for the whole `src/plus`+`src/extra` region (#166): disassembler, assemblerplus, interpreterplus, lccplus, linkerStepsPrinter. 28 tests; OB-002/009/013/017 pinned as regressions. |
| [#225](https://github.com/avidrucker/lccjs/issues/225) | **Filed (RESEARCH)** — which issues earn a CSV row: tracker → none, scope-spike/spike/child → one each; "distinct work vs umbrella" as the test. |
| [#240](https://github.com/avidrucker/lccjs/issues/240) / [#241](https://github.com/avidrucker/lccjs/issues/241) | **Filed (RESEARCH)** — the two non-interactive CLI bugs (interpreter off-TTY; assembler `.o` name prompt); need a design discussion + an OG-LCC check. |
| [#242](https://github.com/avidrucker/lccjs/issues/242) | **Filed (RESEARCH)** — harden the close sequence so cleanup can't run on a race-rejected push (lesson 4); full incident timeline + recovery recipe. |
| memories | `process-adherence-fixes` (point 6: gate cleanup on confirmed push → #242); `terminal-agent-name-vs-fruit` (the #212 `CLAUDE_AGENT_NAME` mechanism). |

## Open threads for tomorrow

- **#242** — design the durable close tool (or documented gated chain). The interim
  recovery recipe is in the ticket; until then, never bare-newline-chain cleanup
  after `git push`.
- **OB-018** (`writeExecutable` fd leak / no try-finally in `linkerStepsPrinter.js`)
  is the *only* genuinely-uncovered OB left in the #166 region — needs partial-write
  fault injection. A clean ≤45m grabbable child of the same spirit as #196–#200.
- **#240 / #241** await a discussion (Charlie) on the right non-interactive contract;
  #241 in particular probably has a directly-informative OG-LCC answer (the `.o`
  author field is its convention).
- **#225** — the actual audit of existing rows + the doc/skill rule.

## Related artifacts

- `tests/new/{disassembler,assemblerplus,interpreterplus,lccplus,linkerStepsPrinter}.unit.spec.js`
  — the five new coverage suites (#196–#200).
- `tests/new/puzzle-velocity-csv.unit.spec.js` — the #217 integrity guard that every
  later velocity append (mine included) now has to satisfy.
- [TIL 2026-05-29 APPLE](./today-i-learned-2026-05-29-apple.md) #1 ("never chain
  `rebase && push`") — the parent of today's lesson 4; the close sequence keeps
  generating race lessons, which is itself the signal #242 should end.
- [TIL 2026-05-30 CHERRY](./today-i-learned-2026-05-30-cherry.md) #1 (stale-`main`
  version skew → the #228 guard) — I hit the *other* side of it: #228's new guard
  *blocked* my claim until I synced `main`. The guard working as intended.
