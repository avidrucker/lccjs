# TIL 2026-06-07 — APPLE

**Context:** Built the test-runner core (#1091, child 2 of the #1044 `lcc --test`
feature) — `runTestSpec({program, tests[]})` runs each spec case as an
independent piped-stdin subprocess and returns a pass/fail results array.
Building it surfaced two things the scope spike (#1044) hadn't, and the
post-close verification taught me a shared-checkout lesson the hard way.

---

## 1. Verify what a CLI actually writes to stdout — don't trust a normalization spec

**What happened:** The #1044 spike §4 said output comparison is "normalized:
strip trailing newline, normalize `\r\n→\n`." I implemented exactly that, then
ran a real case through the runner. Every comparison failed. A default
`node src/cli/lcc.js <prog>` run prints a toolchain banner to **stdout** before
the program's own output:

```
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of echo.e
lst file = echo.lst
bst file = echo.bst
====================================================== Output
hello world      ← the only line the teacher's expected_output should match
```

A teacher's `expected_output` is `hello world`, never the banner. The spike's
normalization could never match.

**What I learned:** The fix is to isolate the program output after the
`===… Output` separator line that `lcc` emits in default (stats-on) mode — the
same marker `genStats.js` writes, so it's a stable, oracle-consistent boundary,
not an incidental string. Crucially, this separator is printed **only** when
stats are on, which is exactly how the runner invokes `lcc` (no `-nostats`), so
the marker is reliably present. A spike that reasons from source-reading can
miss what a binary actually emits at runtime.

**The rule:** **When a feature compares a CLI tool's "output," run the tool once
and look at the real bytes before trusting any spec's normalization — stdout
often carries banner/diagnostic noise the spec author never saw.**

---

## 2. A spawnSync that's slow under a timeout wrapper may be blocked on an orphaned child holding the pipe

**What happened:** My e2e suite took **40s for four trivial `echo.a` runs** —
~10s each, matching the default `timeout_sec` exactly. The programs finished
instantly (status 0, correct output), yet `spawnSync` returned only after the
full timeout. Timing it directly: `timeout=10s → 10005ms`, `timeout=2s → 2006ms`.
Wall-clock tracked the timeout to the millisecond.

**What I learned:** `scripts/lccrun.sh`'s watchdog is a backgrounded subshell
`( sleep "$TIMEOUT"; … ) &`. When the child finishes early, `kill $WATCHDOG_PID`
kills the **subshell** but orphans its `sleep` child — and that orphaned `sleep`
inherited lccrun's stdout/stderr file descriptors. `spawnSync` (capturing
output) waits for pipe **EOF**, which doesn't come until the `sleep` elapses.
I confirmed the root cause by patching a throwaway copy to redirect the
watchdog's stdio (`( … ) >/dev/null 2>&1 &`): **10005ms → 85ms**, identical
output. Filed as #1149 with the verified fix; the runner honors the documented
lccrun design and the e2e suite uses a small `timeout_sec` to stay fast.

**The rule:** **If a `spawnSync` that captures output blocks for exactly the
timeout value despite the child finishing instantly, suspect an orphaned
grandchild holding the stdout/stderr pipe open — not the program.**

---

## 3. Keep the impure boundary thin so an unreproducible failure mode stays unit-testable

**What happened:** I wanted to test the timeout classification (`lccrun` exit
124 → FAIL). My plan was an infinite-loop fixture (`top: br top`). It exited
**0**, not 124 — the interpreter's max-steps cap self-terminates runaway loops,
and with piped stdin an exhausted read returns EOF rather than blocking. There
was no easy way to make a real program produce a 124.

**What I learned:** I split the runner into a thin impure `runCase` (the
`spawnSync`) and a pure `classifyResult(testCase, res)` that turns a
spawnSync-shaped `{status, stdout, error}` into the verdict. The timeout path is
then unit-tested by handing `classifyResult` a synthetic `{status: 124}` — no
flaky fixture, no shelling out — while a couple of real e2e cases prove the
piped-stdin integration. The hard-to-reproduce branch became a one-line test.

**The rule:** **When a failure mode is hard to reproduce end-to-end, push the
verdict logic into a pure function that takes the raw result as data — then you
can feed it the failure synthetically.**

---

## 4. Never `git pull --rebase` a shared `main` checkout that holds another agent's WIP

**What happened:** After closing #1091 I ran `git pull --rebase` on the shared
`main` checkout during verification. `main` already had another agent's
uncommitted work (`M dist/*`, `M scripts/build-site.js` were present at session
start) plus an unpushed sibling TIL commit. The rebase autostashed the WIP,
rebased, and the stash-**pop conflicted** — leaving 8 conflict markers in
`build-site.js`, staged `dist/*`, and a stack of `autostash` entries. My own
#1091 work was safe (already on `origin/main`), but I'd wedged the shared
working tree with foreign in-flight changes I had no right to resolve. I stopped,
logged it (`GIT_STATE`, row 69), and surfaced it rather than untangle another
agent's work; BANANA cleaned it up.

**What I learned:** The main checkout is shared by many concurrent agents and is
routinely "dirty" with someone else's uncommitted work. A `pull --rebase` there
is a mutation with blast radius beyond your own task. DRAGONFRUIT's TIL today
records the right tool: `claim --allow-stale-main`, then rebase the *worktree*
onto `origin/main` — never operate on the shared working tree. (This
checkout-context family of traps hit ELDERBERRY, FIG, and INCABERRY today too;
harvested by spike #207.)

**The rule:** **Treat the shared `main` checkout as read-only when you don't own
its working tree — verify from your worktree or with read-only commands, and use
`claim --allow-stale-main` to work a dirty base instead of rebasing it in place.**

---

## What landed

| Artifact | Change |
|---|---|
| `src/testrunner/runner.js` | Runner core: piped-stdin per-case, banner isolation, normalize+compare, results array (#1091) |
| `src/utils/errors.js` | `TestRunnerError` for the missing-program harness failure (#1091) |
| `tests/new/runner.unit.spec.js`, `runner.e2e.spec.js` | 16 tests; pure classify seam + real piped-stdin e2e (#1091) |
| Issue #1149 | Filed: lccrun watchdog orphans its sleep → spawnSync stalls for the full timeout (verified fix) |

## Open threads

- #1149 carries a decision: fix lccrun's watchdog (benefits all spawnSync
  callers, e.g. `potato-token-test.js`) vs. switch the runner to a direct
  `spawnSync` JS timeout (the #1044 §5 alternative). (a) is preferred.
- The reporter/CLI child (#1092) may want to capture **stderr** on failure; the
  runner currently keeps to the agreed `{name, pass, reason, expected, actual,
  exitCode}` shape and doesn't surface it.

## Related artifacts

- Issues #1091, #1149, #1044 (spike), #1090 (spec loader)
- Sibling checkout-trap TILs today: [DRAGONFRUIT](./today-i-learned-2026-06-07-dragonfruit.md), [FIG](./today-i-learned-2026-06-07-fig.md), [ELDERBERRY](./today-i-learned-2026-06-07-elderberry.md)
