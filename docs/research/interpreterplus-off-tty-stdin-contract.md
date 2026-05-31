# Research: LCC+ interpreter off-TTY stdin contract (#240)

**Agent:** BANANA · **Date:** 2026-05-30 · **Role:** RESEARCH (design discussion for Charlie)

Probe of issue #240: `node src/plus/interpreterplus.js <file.ep>` crashes with
`TypeError: process.stdin.setRawMode is not a function` whenever stdin is not a
TTY (piped input, `< /dev/null`, CI, a test harness). Decide the right fix and
its scope, define the non-interactive stdin contract, and check whether the
oracle gives a transferable answer.

## TL;DR

- **Root cause:** `setRawMode` exists only on TTY streams. `interpreterplus.js`
  calls it **unconditionally at two sites**, and the second is reached by four
  separate paths — so a guard on only the one shown in the issue is insufficient.
- **The fix is small and principled:** guard both `setRawMode` calls behind
  `process.stdin.isTTY`. Off-TTY the key queue simply never fills, and the
  existing `nbain` "no key" return value (0) **already defines a coherent
  non-interactive contract** — no new semantics are needed. **Verified by
  prototype:** with the guard, the write-only `randDeterministic.ep` runs to
  completion off-TTY and exits 0 (it crashes today).
- **A separate "non-interactive mode flag" is NOT needed** for the crash. The
  `isTTY` check makes write-only programs Just Work and unblocks the off-TTY
  test smoke that #198 had to abandon.
- **The oracle gives no transferable answer.** The LCC+ trap set (`nbain`,
  `rand`/`srand`, `sleep`, `clear`, `cursor`, `bp`, …) is a lccjs-specific
  invention; OG cuh63 LCC has no LCC+ and no real-time raw-mode input model at
  all. The only oracle-relevant input is blocking line/char input (`sin`/`ain`),
  which the **core** interpreter already handles gracefully off-TTY via
  `fs.readSync` (EOF → break). See "OG-LCC angle" below.
- **Open question that genuinely needs Charlie:** what should the *interactive*
  programs (the `nbain`/`bp` games) do off-TTY — accept a silent non-terminating
  run, emit a clean "needs a TTY" diagnostic, or grow scripted-input support?
  The crash fix does not depend on this answer; it can ship first.

## Root cause — two unguarded call sites, four crash paths

`setRawMode` is a method only on `tty.ReadStream`. When stdin is a pipe/file it
is a plain `Readable` and the method is absent → `TypeError`.

Two call sites in `src/plus/interpreterplus.js`:

1. **`main()` setup — line 125** (`process.stdin.setRawMode(true)`), inside
   `if (this.nonBlockingInput)`. This is the crash the issue reproduces with a
   valid `.ep`.
2. **`resetProcessStdin()` — line 18** (`process.stdin.setRawMode(false)`). This
   is the cleanup helper, and it is reached by **four** distinct paths:
   - `fatalExit()` (line 24-27) → on **any** fatal error, *including
     `Cannot open input file`* — so even a typo'd filename crashes with the
     `TypeError` instead of the intended clean "cannot open" message (observed:
     the repro in the issue body shows line 125, but `… file.ep < /dev/null`
     with a *missing* file crashes at line 18 via `fatalExit`).
   - the `process.on('exit', …)` handler registered at line 129-131.
   - the **HALT** trap (`executeTRAP` case 0, line 273) — every normal program
     exit.
   - the **Ctrl-C** handler inside the `data` listener (line 137).

**Implication for the fix:** guarding only the line-125 setup is not enough —
the `exit` handler and the HALT path both call `resetProcessStdin`, which would
still crash on exit. The guard belongs at the single chokepoint
(`resetProcessStdin`) **and** at the line-123 setup condition.

## Two input models in the toolchain

The toolchain has two unrelated stdin strategies; only one is TTY-fragile:

| | Core interpreter (`interpreter.js`) | Plus interpreter (`interpreterplus.js`) |
|---|---|---|
| Traps | `sin` (line), `ain` (char) | `nbain` (non-blocking char poll), `bp` |
| Mechanism | **blocking** `fs.readSync(fd, …)` | **raw-mode event loop** + `keyQueue` |
| Off-TTY | degrades gracefully: `readSync` returns 0 bytes at EOF → break, returns empty input | **crashes** at `setRawMode` |
| TTY-aware already? | yes — `process.stdin.isTTY` gate at `interpreter.js:255` (runtime-debugging feature) | no |

So the project already knows the `isTTY` idiom (core uses it at line 255), and
core already shows the desired off-TTY posture for *blocking* input: read until
EOF, then stop. The plus interpreter just never got the guard because raw-mode
real-time input is a different mechanism.

## The non-interactive contract is already latent in the code

`executeNonBlockingAsciiInput()` (trap 17, `nbain`, lines 343-354) returns the
oldest queued key, or **`0` ("no key")** when the queue is empty. Off-TTY, if we
skip `setRawMode`/`resume` and never attach the `data` listener, **the queue
never fills**, so `nbain` returns "no key pressed" forever. That is a complete,
coherent, already-implemented contract for non-interactive mode:

> Off a TTY, an LCC+ program sees an input stream on which no key is ever
> pressed.

No new "EOF vs block vs no-key" decision is required for `nbain` — the existing
"no key" branch *is* the answer.

### Three program classes off-TTY (under the guard)

- **(a) Write-only** (e.g. `randDeterministic.ep` — `srand`/`rand`/`dout`, no
  input): runs to completion, exits 0. **Verified** (prototype output below).
- **(b) Input-polling games** (`gameSnake.ap`, `gameflappyBird.ap`,
  `charPolling.ap`, `playerWalk*.ap`, `findTheFruit*.ap`,
  `rock-paper-scissors.ap`, `tictactoe.ap` — all use `nbain`): run forever
  seeing "no key", so they never reach their quit-key path on their own. This is
  the case that needs a product decision (see open question).
- **(c) `bp` breakpoint** (trap 14, `executeLccPlusBreakpoint`, line 305-313):
  does `process.stdin.once('data', …)` to resume on a keypress. Off-TTY with
  stdin not resumed, `data` never fires → the program **hangs forever**. This
  trap genuinely requires interactive input.

## Prototype verification

Guarding both sites (the only change):

```js
// resetProcessStdin()
if (process.stdin.isTTY) process.stdin.setRawMode(false);
// main()
if (this.nonBlockingInput && process.stdin.isTTY) { … setRawMode(true) … }
```

```
$ node src/plus/interpreterplus.js plusdemos/randDeterministic.ep < /dev/null ; echo $?
Starting interpretation of plusdemos/randDeterministic.ep (LCC+)
Here are 20 random numbers (1-20, deterministic):
12
17
4
…
5
0          # <- exit 0 (was: TypeError + exit 1)
```

(The prototype was reverted; this research ticket ships findings, not code.)

### Secondary finding — cursor escapes leak off-TTY

`resetProcessStdin` also writes `[?25h` (show cursor) unconditionally, and
`executeToggleCursor`/`executeResetCursor` write `[?25l` / `[H`. Off
a TTY these raw escape bytes leak into piped/redirected output — the prototype
run above ended with a stray `[?25h`. Not the crash, but the same theme: the
cursor-control writes should arguably also be `isTTY`-guarded so non-interactive
output stays clean. Candidate for the follow-up DEV puzzle or a sibling ticket.

## OG-LCC angle

The oracle (cuh63 6.3 `lcc`) is **not transferable** here:

- LCC+ and its entire trap set (`nbain`, `rand`/`srand`, `sleep`, `clear`,
  `cursor`, `millis`, `resetc`, `bp`) are a **lccjs-specific extension**. OG LCC
  has no `.ep`/`.ap` toolchain and no real-time raw-mode input model, so there is
  nothing to port for the raw-mode crash.
- The only input behavior OG LCC and lccjs share is **blocking** line/char input
  (`sin`/`ain`), and there the **core** lccjs interpreter already mirrors the
  sensible off-TTY posture (read to EOF, then stop) via `fs.readSync`. No change
  needed there; it's not where the crash is.

This matches the issue's own expectation ("may not give a directly transferable
answer").

## Recommendation (scope for the follow-up DEV puzzle)

**Baseline fix — small, ships immediately, no design dependency:**

1. Guard `setRawMode` behind `process.stdin.isTTY` at both sites
   (`resetProcessStdin` line 18, and the line-123 setup condition).
2. (Optional, same puzzle) guard the cursor-control escapes behind `isTTY`.
3. Add an off-TTY e2e smoke for a write-only `.ep` (pipe `/dev/null`, assert
   exit 0 + expected stdout). This is exactly the determinism smoke #198 had to
   abandon because the CLN couldn't run off-TTY — the guard unblocks it.

**Deferred to Charlie's decision (the interactive class, b/c above):** pick one
posture for `nbain`/`bp` programs off-TTY —

- *Accept* — non-terminating run is fine (a game with an idle player); document
  it. Zero extra code.
- *Clean diagnostic* — first time an interactive trap is hit off-TTY, print one
  line ("this LCC+ program needs an interactive terminal") and exit non-zero.
  Prevents the silent hang on `bp` (case c).
- *Scripted input* — in cooked (non-raw) mode off-TTY, feed piped bytes into
  `keyQueue` so games can be driven by a fixture. Most work; enables e2e tests of
  the games themselves.

My lean: ship the baseline guard now (fixes the crash, unblocks write-only +
testing), and treat interactive-off-TTY as a clean diagnostic for `bp`
specifically (case c is the only true hang) — leaving full scripted input as its
own later puzzle if game e2e coverage is wanted.

## Open question for Charlie

Which LCC+ programs are *meant* to run non-interactively, and for the interactive
ones, which of the three postures above is the desired off-TTY contract? The
crash fix (baseline) does not block on this and can land first.

## Source references

- `src/plus/interpreterplus.js:18` — `resetProcessStdin` unguarded `setRawMode(false)`
- `src/plus/interpreterplus.js:24-27` — `fatalExit` → `resetProcessStdin` (crashes even on "file not found")
- `src/plus/interpreterplus.js:123-152` — `main` raw-mode setup + `exit`/`data` listeners
- `src/plus/interpreterplus.js:273` — HALT trap calls `resetProcessStdin`
- `src/plus/interpreterplus.js:305-313` — `bp` waits on `stdin.once('data')` (hangs off-TTY)
- `src/plus/interpreterplus.js:343-354` — `nbain` returns 0 ("no key") on empty queue
- `src/core/interpreter.js:255` — existing `process.stdin.isTTY` idiom
- `src/core/interpreter.js:1288-1366` — core blocking `fs.readSync` input (graceful EOF off-TTY)
- Sibling: `src/utils/name.js:20-63` — the `.o` author-name prompt, the assembler-side non-interactive-hostile counterpart
