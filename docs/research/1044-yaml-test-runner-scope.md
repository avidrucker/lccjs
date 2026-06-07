# SPIKE #1044 — Assignment test-runner (`lcc --test`) scope

**Agent:** ELDERBERRY · **Date:** 2026-06-06 · **Parent:** #931 (item 7.3) · Research-only, no production code.

## Goal

Let a teacher/student run input→expected-output checks against an `.a` program
without writing Jest:

```yaml
program: mySort.a
tests:
  - input: "3 1 2"
    expected_output: "1 2 3"
```

…invoked as `lcc --test mySort.spec.yaml`, exiting non-zero if any case fails.

---

## 1. Current state (what exists today)

- **No `--test` flag.** `lcc.js` parses single-letter flags plus `--max-steps`,
  `--verbose`, `-l<hex>`, `-o` in `parseArguments` (`src/cli/lcc.js:232`); the
  dispatch in `main`/`handleSingleFile` (`src/cli/lcc.js:53,171`) only chooses
  assemble / link / run / interactive by file extension. There is no spec-driven
  multi-run mode.
- **The "run a program with stdin and diff its stdout" pattern already exists**,
  but only inside the Jest harness:
  - `tests/helpers/runOracle.js:8` — `runOracleOnDemo(demoPath, userInputs=[], opts)`
    spawns the toolchain via `spawnSync(cfg.lccPath, [...], { input: userInputs.join('\n')+'\n' })`
    (`runOracle.js:49–58`). This is the canonical **piped-stdin** path (RULES 19 /
    R-id; `spawnSync({input})`).
  - `tests/new/interpreter.e2e.spec.js:20` — `spawnSync(process.execPath, [interpreterPath, 'promptForName.e'])`
    with `timeout: 5000` (line 23) and an exit-code assertion `result.status === 0` (line 26).
- **Two stdin paths in the interpreter, and they differ:**
  - `inputBuffer` in-memory path — `src/core/interpreter.js:1345` (consumes a
    pre-set string; used by in-process `LCC.main()` test calls, e.g.
    `tests/new/lcc.oracle.e2e.spec.js:78`).
  - Real-FD piped path — `src/core/interpreter.js:1369` (`fs.readSync(process.stdin.fd, …)`).
  RULES 19 mandates the **piped path** for cross-runtime stdout tests — it is the
  one that exercises real newline/EOF behavior. `inputBuffer` is a test shortcut
  and **must not** be the runner's execution path.
- **Timeout wrapper exists:** `scripts/lccrun.sh` already gives wall-clock timeout
  + process-group kill + TTY-gated stdin forwarding, exiting `124` on timeout
  (RULES 13). It is the intended front for any toolchain invocation.
- **Exit-code convention:** clean halt → 0; assembly/runtime error → 1 via
  `src/utils/cliExit.js:18` (`fatalExit(msg, code=1)`); in Jest mode cliExit
  throws instead of exiting (`cliExit.js:16`).
- **No YAML anywhere.** `package.json` has no `js-yaml` (or any YAML lib) in deps
  or devDeps; zero `src/` imports of yaml. `JSON.parse` is freely used.

## 2. Gap (what the issue asks for that doesn't exist)

1. A **spec file format** + loader (program + list of {input, expected_output, …}).
2. A **`--test` CLI mode** that loops the cases, runs each through the real
   piped-stdin path, diffs stdout, and reports pass/fail with a CI-friendly exit code.
3. A **YAML dependency decision** that respects the repo's zero-runtime-dep rule.

---

## 3. Central open question — the dependency policy

The repo is **intentionally zero runtime deps** (`CLAUDE.md`). YAML needs a parser.
Three options:

| Option | Cost | Risk |
|---|---|---|
| **A. Vendor full YAML (js-yaml)** | ~4k LOC vendored or a new runtime dep | ❌ Breaks the zero-dep rule; ongoing maintenance/security surface. Rejected. |
| **B. JSON spec (no dep)** | `JSON.parse`, 0 LOC of parser | ✅ Zero risk. ⚠️ Less ergonomic for hand-authoring multi-line I/O (must `\n`-escape). |
| **C. Restricted hand-parsed YAML subset** | ~80–120 LOC: top-level `key: value`, a `tests:` sequence of `- ` block-mappings, quoted/plain scalars, and `\|` block scalars for multi-line | ⚠️ Users can hit unsupported YAML; must fail loudly with "restricted-subset" errors. Block scalars are the only genuinely fiddly part. |

### Recommendation: **B now, C as an optional fast-follow.**

- Make the **internal spec object** the contract: `{ program: string, tests: Array<{input, expected_output, exitCode?, timeoutSec?}> }`.
- Ship **JSON-canonical** (`lcc --test spec.json`) first — zero dep, honors the
  rule, gets the feature to teachers immediately. (`.test.json` / `.spec.json`.)
- Add a **restricted-YAML front-end** (`spec.yaml` → same internal object) as a
  separately-bounded puzzle *only if* hand-authoring ergonomics justify it. It is
  a pure pre-parser to the JSON path, so it carries zero risk to the runner core.
- Never vendor a full YAML library — it is the one option the project rule forbids.

This neutralizes the "central open question": the runner does not block on the
parser debate, because format selection is a thin front layer over a fixed object.

---

## 4. Spec format (proposed internal object + JSON surface)

```jsonc
{
  "program": "mySort.a",          // required; path relative to the spec file
  "tests": [
    {
      "name": "sorts three",       // optional, for readable output
      "input": "3 1 2\n",          // fed via piped stdin (real FD path)
      "expected_output": "1 2 3\n",// compared to captured stdout (normalized)
      "exit_code": 0,               // optional; default: don't assert
      "timeout_sec": 10             // optional; default 10 → lccrun.sh arg
    }
  ]
}
```

- **stdin** is `input` joined/fed through `spawnSync({input})` — RULES 19. Each
  case is an independent subprocess (no state bleed between cases).
- **Output comparison** is normalized: strip trailing newline, normalize `\r\n→\n`
  (mirrors `interpreter.js:1347` and the existing `compareFiles` options).
- **Determinism gotcha (must handle):** every `lcc` run resolves the author name
  first (`src/cli/lcc.js:90`) and will **prompt on stdin** if no `name.nnn` exists
  in the cwd — silently eating the first line of test `input`. The runner **must
  pre-seed `name.nnn`** in the program's directory before each run (this is exactly
  what `interpreter.e2e.spec.js:18` does) or run with `-nostats` where viable.
  Flagged as the #1 correctness trap.

## 5. Runner surface

- **Invocation:** `lcc --test <spec.json>` (and later `<spec.yaml>`). Parsed in
  `parseArguments` as a long flag that captures the next arg as the spec path and
  short-circuits the normal extension dispatch in `main`.
- **Execution:** for each case, shell out via `scripts/lccrun.sh <timeout> node src/cli/lcc.js <program>`
  with the case `input` piped — reuses the timeout/process-group machinery and the
  real stdin path in one stroke. (Alternatively `spawnSync` directly with a JS
  timeout; lccrun.sh is preferred for parity with RULES 13.)
- **Output format:** per-case `PASS`/`FAIL` line; on FAIL, a first-diff block
  (expected vs actual, with a caret/line marker). End with `N passed, M failed`.
- **Exit code:** `0` iff all cases pass; `1` if any fail; `2` for a malformed spec
  / missing program (distinguish "your tests failed" from "your harness is broken").
  Timeout (lccrun `124`) surfaces as a FAIL with a "timed out" reason.

## 6. Reuse map (don't reinvent)

| Need | Reuse |
|---|---|
| timeout + pgroup kill | `scripts/lccrun.sh` (RULES 13) |
| piped stdin + stdout capture | `spawnSync({input})` pattern, `tests/helpers/runOracle.js:49` |
| name-prompt determinism | pre-seed `name.nnn`, `tests/new/interpreter.e2e.spec.js:18` |
| output normalization | `compareFiles` options + `interpreter.js:1347` |
| exit-code seam | `src/utils/cliExit.js:18` |

The runner is a **CLI/wrapper-layer** feature (subprocess orchestration + I/O),
so it belongs alongside `lcc.js` orchestration, not inside a core pure seam —
consistent with the "lcc.js stays orchestration-only" architecture note. The
spec **loader** (parse + validate → object, typed errors) is a pure seam and is
unit-testable on its own.

---

## 7. Perceived ROI — **Medium-High**

- **Value:** directly serves the educational mission (#931 ranked it a top-5
  leverage item, 7.3 "priority"). Teachers/students self-check assignments with no
  Jest, no JS. Foundational for the deferred `--record`/replay (5.3/7.4) and
  `--submit` (7.2) items, which build on the same spec object + runner.
- **Cost:** moderate. The hardest engineering question (YAML dep) is dissolved by
  the JSON-first recommendation. Every other piece reuses an existing pattern.
- **Risk:** low, *if* the name-prompt determinism trap is handled in the runner
  core from day one (otherwise every multi-line-input test silently corrupts).

## 8. Recommendation: **Decompose into puzzles.**

Proposed ≤60m DEV children (file as children of #1044, lane `area:toolchain`):

1. **Spec loader (pure seam):** `loadTestSpec(buffer, baseDir)` → validated
   `{program, tests[]}` object; typed error on malformed/missing fields. JSON
   surface only. Unit-tested. **~45m**
2. **Runner core:** given an internal spec object, run each case through
   `lccrun.sh`+`spawnSync({input})` (real piped stdin), pre-seed `name.nnn`,
   capture stdout/exit, normalize + compare, return a results array. **~60m**
3. **CLI wiring + reporter:** `--test <spec>` in `parseArguments`/`main`;
   pass/fail summary + first-diff output; exit codes 0/1/2. **~45m**
4. **e2e tests:** fixtures for all-pass, a failing-diff, a timeout, and an
   exit-code mismatch; assert reporter output + process exit code. **~45m**
5. **Docs:** teacher/student usage guide (spec format, examples, exit codes). **~30m**
6. *(Optional, gated on demand)* **Restricted-YAML front-end:** `spec.yaml` →
   internal object; strict errors on unsupported constructs. **~60m**

Sequencing: 1 → 2 → 3 → 4 (5 anytime; 6 last/optional). 1–4 deliver the full
JSON-based feature with zero new deps.

**This spike closes once children 1–5 are filed** (6 filed as optional/icebox).
