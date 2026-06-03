# LCC+ off-TTY interactive contract (#272)

**Agent:** CHERRY · **Date:** 2026-06-03 · **Role:** RESEARCH / design

Defines the agreed-upon behavior for interactive LCC+ traps when
`process.stdin.isTTY` is false — piped input, redirect, CI, headless test
harness. This is the decision document that #272 was filed to produce; the
underlying research lives in
[`interpreterplus-off-tty-stdin-contract.md`](./interpreterplus-off-tty-stdin-contract.md)
(#240) and the crash fix shipped in #259.

---

## Context

Post-#259 the crash (`TypeError: process.stdin.setRawMode is not a function`)
is gone. What remains undefined is what the two interactive traps — `nbain`
and `bp` — should do when the interpreter is running without a TTY.

Three postures were on the table:

- **(a) Accept** — document non-terminating / silent behavior; zero code.
- **(b) Clean diagnostic** — on first interactive-trap hit, print one line and
  exit non-zero. Turns the silent hang into a deterministic failure.
- **(c) Scripted input** — feed piped bytes into `keyQueue` off-TTY so games
  can be driven by test fixtures. Most work; enables interactive-demo e2e tests.

The community comment on this issue (yousseeff20) independently reached the
same split as the #240 research lean.

---

## Contract decisions

### `nbain` (trap 17) — option (a): idle-player contract, accepted as-is

**Off-TTY behavior:** `keyQueue` never fills → `nbain` returns `0` ("no key
pressed") on every call.

**Rationale:** `nbain` is a non-blocking poll, not a blocking read. Returning
"no key" when there is no input source is semantically correct — it accurately
models a player who never presses anything. The `while (nbain() == 0)` pattern
used in `gameSnake.ap`, `charPolling.ap`, and the other seven polling games is
indistinguishable from a valid idle loop; the runtime cannot distinguish
"waiting for player" from "no player will ever arrive". Terminating after N
empty polls would inject an assumption about intent that the ISA does not
warrant.

**Implementation status:** already implemented and correct (the `isTTY` guard
in `main()` added by #259 is the full fix; `executeNonBlockingAsciiInput` at
`src/plus/interpreterplus.js:352-363` already returns 0 on an empty queue).
No code change.

**Observable consequence off-TTY:** input-polling programs run forever —
they never reach their quit-key path. This is accepted. Callers that need
deterministic termination should use `bp` (option b below) or scripted input
(option c, future).

---

### `bp` (trap 14) — option (b): clean diagnostic, fail fast

**Off-TTY behavior:** print a one-line diagnostic to stderr and exit non-zero
immediately.

**Rationale:** a breakpoint is a synchronization point that requires external
interaction by definition. Off-TTY there is no possible event source to satisfy
`process.stdin.once('data', …)`, so `this.running` stays `false` and the
non-blocking loop never restarts — the program hangs silently. Unlike `nbain`,
there is no "coherent idle" interpretation for `bp`: a breakpoint that can
never be continued is a stuck program, not an idle one. Failing fast with a
clear message gives CI and headless callers a deterministic, inspectable error
instead of a hung process.

**Proposed diagnostic:**

```
lcc+: breakpoint hit off-TTY — interactive terminal required; exiting.
```

Exit code: 1.

**Implementation status:** NOT YET IMPLEMENTED. The current
`executeLccPlusBreakpoint()` at `src/plus/interpreterplus.js:314-322`
unconditionally calls `process.stdin.once('data', …)` with no TTY guard.
A follow-up DEV puzzle must add the guard — see §Follow-up below.

---

### Scripted input — option (c): deferred

Feeding piped bytes into `keyQueue` in cooked (non-raw) mode would enable e2e
tests of the interactive demos without a TTY. This is the highest-ROI future
addition (unlocks game e2e coverage) but also the most design work — byte vs
character handling, buffering, EOF semantics, timing between inputs all need
their own contract. Deferred as its own puzzle when interactive-demo e2e
coverage becomes a priority.

---

## Summary table

| Trap | Off-TTY posture | Implementation |
|------|----------------|----------------|
| `nbain` (trap 17) | Returns 0 ("no key") forever — idle-player contract, accepted | ✅ Done (#259) |
| `bp` (trap 14) | Print diagnostic + exit 1 — fail fast | ❌ Needs DEV puzzle |
| Scripted input | Deferred | — |

---

## Follow-up

Per RULES.md rule 10, deferred work must become a ticket before this close.
A DEV puzzle for the `bp` guard is filed as the closing comment of #272.

**Proposed guard (sketch, not final code):**

```js
executeLccPlusBreakpoint() {
  if (!process.stdin.isTTY) {
    process.stderr.write(
      'lcc+: breakpoint hit off-TTY — interactive terminal required; exiting.\n'
    );
    fatalExit('breakpoint hit off-TTY', 1);
    return;
  }
  this.running = false;
  process.stdin.once('data', () => {
    this.running = true;
    this.startNonBlockingLoop();
  });
}
```

---

## Source references

- `src/plus/interpreterplus.js:314-322` — `executeLccPlusBreakpoint` (needs guard)
- `src/plus/interpreterplus.js:352-363` — `executeNonBlockingAsciiInput` (already correct)
- `src/plus/interpreterplus.js:132` — TTY guard on raw-mode setup (shipped by #259)
- [`docs/research/interpreterplus-off-tty-stdin-contract.md`](./interpreterplus-off-tty-stdin-contract.md) — full root-cause analysis (#240)
- #259 — crash fix (baseline guard)
- #241 — assembler-side non-interactive-hostile name prompt (sibling theme)
