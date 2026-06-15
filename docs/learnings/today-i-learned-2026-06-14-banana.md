# TIL 2026-06-14 — BANANA

**Context:** A long session that took the `--explain` epic to completion and then
built out a whole BDD (jest-cucumber) coverage layer. Spanned the `--explain`
content batches (#1099/#1100/#1101), a reachability decision+fix (#1245/#1247),
the BDD pilot (#1249→#1252→#1257/#1258/#1259), and a time-boxed tracker (#1269)
that produced nine `.feature` children (#1280–#1303) plus a deferred remainder
(#1306). Thirteen living feature files now document the toolchain's core
behavior; full suite green at 1867 tests.

---

## 1. A worktree resolves `node_modules` from `main` — and `--ignore-scripts` silently breaks `better-sqlite3`

**What happened:** Adding the first native-needing dev-dep (jest-cucumber, #1252)
I ran `npm install jest-cucumber --save-dev --ignore-scripts` inside the worktree
— `--ignore-scripts` to dodge Playwright's browser download. The install exited
0, but the next full `npm test` went red: **16 db-touching tests across 4 suites**
failed with `Could not locate the bindings file`. It looked like I'd broken
something; I hadn't.

**What I learned:** A freshly-claimed worktree has **no `node_modules` of its
own** — Node resolves modules from the **main checkout's** `node_modules` via
parent-directory walk (worktrees live under `<repo>/.claude/worktrees/...`).
That's why `npm test` works in a worktree with no install. But the moment you
`npm install` *anything* there, npm builds a full, separate `node_modules` in the
worktree — and `--ignore-scripts` skips `better-sqlite3`'s native build, leaving
its binding unbuilt. `node_modules` is gitignored, so this never reaches the
committed result (`npm ci` builds it) — it's purely a local-run artifact that
masquerades as a regression. Fix: `npm rebuild better-sqlite3`.

**The rule:** **Never `--ignore-scripts` when adding a dep in a worktree; if you did, `npm rebuild better-sqlite3` before trusting `npm test`.** Authority: documented in `docs/project-gotchas.md` §7 + `do-this-not-that.md` (#1256); errors-table row 134.

---

## 2. Probe the real CLI *before* writing the assertion (or filing a "bug")

**What happened:** Writing BDD scenarios, I probed actual CLI output before
baking expectations three times, and each probe changed the plan:
- The undefined-external link **exits 0** (`status: 0`), printing the error to
  stderr — deliberate OG-LCC parity (`src/cli/lcc.js` `linkObjectFiles`). I'd
  been about to assert a non-zero exit *and* nearly filed a spurious "linker
  doesn't fail" bug (#1258).
- The interactive `-i` debugger — flagged as the "trickiest, maybe flaky" case —
  turned out to be driven **deterministically** by `spawnSync` stdin (~50 ms,
  exits 0). No in-process fallback needed (#1259).
- That same debugger's panel is **ANSI-coloured**, so `r0: 0005` only matches
  after stripping escape codes.

**What I learned:** My priors about CLI behavior were wrong as often as right.
The 60-second probe (`spawnSync` the real binary, inspect `status`/`stdout`/
`stderr`) is cheap insurance against a wrong assertion baked into a test and
against filing a bug for intended behavior.

**The rule:** **Run the real CLI on a crafted input and read exit code + streams before you assert on them or call it a bug.** Authority: #1311 (do-this-not-that entry).

---

## 3. Unit-green ≠ user-reachable — verify through the actual user surface

**What happened:** The `--explain` content (#1099–#1101) had passing unit tests,
yet `lcc badfile.e --explain` printed the bare error with **no explain block**
(#1245). Two CLI-path reasons: `loadExecutableFile` ran its *own* signature scan
and bailed with a different, un-keyed message; and even when the keyed error was
reached, the `catch` called `cliErrorExit(error.message, 1)` — dropping
`error.explainKey`. The unit tests drove the pure seam + render helper directly,
which is **not** how the CLI invokes them.

**What I learned:** Green unit tests on a seam prove the seam works, not that the
behavior reaches the user. The wiring *between* the seam and the CLI is exactly
where it leaked (#1247 fixed it by forwarding the key at the two `cliErrorExit`
sites).

**The rule:** **For user-facing behavior, verify end-to-end through the real CLI, not just the seam its unit test exercises.** Authority: #1247 (fix), #1311 (do-this-not-that entry).

---

## 4. The 30-min-or-split time-box turns "convert everything" into a self-limiting, self-perpetuating loop

**What happened:** "Convert more and more behaviors to BDD" is open-ended and
could sprawl. We capped each child at **~30 minutes, or until finished —
whichever first**, with an explicit overrun rule: stop, split the remainder into
a new child, close what landed (#1269). Nine children followed (#1280–#1303),
each actually finishing in ~12–17 min, every one leaving a complete feature *and*
the next checkbox teed up.

**What I learned:** A fixed per-item budget plus a split-on-overrun rule makes a
large fuzzy effort safe to hand to an agent: no single chunk balloons, and the
tracker checkbox + "next item" structure makes the loop resumable by anyone.

**The rule:** **Bound open-ended conversion work as one ~30-min child per slice with split-on-overrun, tracked on a parent that lists the slices.** Authority: tracker #1269 (encodes the rule); consistent with the project's PDD / yegor-microtasks discipline.

---

## 5. Separate *deciding* from *doing* with research → decision → implementation chains

**What happened:** Three times a fork showed up that wasn't mine to settle in a
commit, so I split it into its own ticket: the `--explain` reachability gap →
decision #1245 → impl #1247; the red `model`-field build → decision #1215 → impl
#1236; "adopt BDD?" → SPIKE #1249 → decision #1250 → tracer #1252. Each decision
ticket carried options + a recommendation; I posted the maintainer's ruling, then
the implementation child executed it.

**What I learned:** Folding an adopt-vs-don't or enforce-vs-report call into an
implementation commit hides it. A standalone `decision` ticket (with options +
recommendation) makes the call explicit, reversible, and closeable on its own —
and the implementation ticket stays a clean courier job.

**The rule:** **When a fork is the maintainer's to make, file it as a `decision` ticket with options + a recommendation; don't bury it in an implementation commit.** Authority: existing `decision`-label convention; demonstrated #1215/#1245/#1250.

---

## What landed

| Artifact | Change |
|---|---|
| `tests/features/*.feature` (+ `tests/new/*.bdd.spec.js`) | 13 BDD feature files covering assembler + interpreter + CLI behavior (#1252/#1257/#1258/#1259/#1280/#1287/#1288/#1290/#1293/#1294/#1298/#1300/#1303) |
| `src/core/interpreter.js`, `src/utils/explanations.js` | `--explain` runtime/format content + reachability fix (#1100/#1247) |
| `src/core/linker.js`, `interpreter.js`, `explanations.js` | `--explain` linker + file-format content (#1101) |
| `docs/project-gotchas.md` §7, `docs/do-this-not-that.md` | worktree `--ignore-scripts` trap (#1256) |
| `package.json` / lockfile | `jest-cucumber` dev-dep (#1252) |

## Open threads

- **#1306** — LCC+ `.ap` extras BDD coverage, deferred/low-priority (non-deterministic + terminal-driven extras need careful scenario design).
- **#1311** — fold lessons 2 & 3 into `docs/do-this-not-that.md`.

## Related artifacts

- `docs/project-gotchas.md` §7 (worktree `--ignore-scripts` trap); errors-table row 134; `docs/do-this-not-that.md`.
- Sibling 2026-06-14 TILs: [GRAPE](./today-i-learned-2026-06-14-grape.md) and [FIG (2)](./today-i-learned-2026-06-14-fig-2.md) both touched the `--explain` two-render-gates issue (#1102) from the other side.
