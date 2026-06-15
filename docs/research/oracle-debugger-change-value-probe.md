# Probe: the real Oracle debugger's `c <loc> val` (and `z`/`w`/`t`/`integer n`)

Research for #1348. Probed 2026-06-15 (CHERRY) against the real Oracle binary `$LCC_ORACLE`
(`cuh63` `lcc`), driving its `-d` debugger with scripted stdin via `scripts/lccrun.sh`.

> Terminology: **"Oracle" = the real Dos Reis `cuh63` binary.** This doc characterizes *its* runtime
> behavior, to decide how lccjs's `-d` (oracle-parity) debugger should behave (#1349) and whether an
> upstream bug report is warranted.

## TL;DR — the "`c` crashes the Oracle" hearsay is imprecise

The prior note (`experiments/debugger-results.md`, 2026-05-27) recorded `c <reg|addr|label> val` as
"**CRASHES oracle (segfault)**". That is **not** what well-formed usage does. Verbatim probing shows:

| Command | Verdict | Evidence |
|---|---|---|
| `c r0 5` (register form) | ✅ **works** — sets r0 = 0x0005 | §1 |
| `c r0` (missing value) | clean `Missing operand` error (exit 1) | §1 |
| **`c` (bare, no operands)** | 💥 **SEGFAULT — exit 139 (SIGSEGV)** | §1 |
| `c fff0 abcd` (addr, no `0x`) | `Error: Undefined label` (parsed `fff0` as a label) | §1 |
| `integer n` (e.g. `2`) | ✅ **works** — sets step-count, runs n, prints per-step diffs | §2 |
| `z` (run-to-end) | ✅ **works** | §2 |
| `t` (trace toggle) | ✅ **works** — prints `Trace off` | §2 |
| `w <addr>` (e.g. `w 3`) | ✅ **works** — prints `Watchpoint at 3` on the store | §3 |
| `w <label>` on a bare `.e` | `Undefined label` (symbol table absent when running `.e`; not a bug) | §3 |

**Headline:** the Oracle's change-value command **works** for well-formed register input; the only
crash is on **bare `c` with no operands** — a malformed-input robustness bug, not a "`c` is broken"
bug. `integer n`, `z`, `w`, `t` all work as `lcc.txt` documents.

## Method

- Oracle: `$LCC_ORACLE` = `/home/avi/Documents/Study/Assembly/cuh63/lcc`, wrapped in
  `scripts/lccrun.sh 8` (8 s timeout, process-group kill) to avoid hangs.
- A `name.nnn` was pre-seeded in the probe cwd to skip the author prompt (per
  `docs/research/og-lcc-author-name-noninteractive.md`).
- Programs (assembled with the Oracle):
  - `p.a`: `mov r0, 7` / `mov r1, 2` / `halt`
  - `s.a`: `mov r0, 9` / `st r0, x` / `halt` / `x: .word 0` (x lands at address 3)
- Commands fed one-per-line on stdin: `printf '<cmds>' | lccrun.sh 8 $LCC_ORACLE -d <prog>.e`.
- Debugger numbers are hex except `integer n` (decimal, per `lcc.txt`).

## §1. The `c` change-value command

**`c r0 5` — register form (WORKS):** before, `r` shows `r0 = 0000`; after `c r0 5`, `r` shows:
```
mvi>>>pc = 0000  ir = d007  NZCV = 0000
r0 = 0005  r1 = 0000  r2 = 0000  r3 = 0000
r4 = 0000  fp = 0000  sp = 0000  lr = 0000
```
r0 changed 0000 → 0005. No crash.

**`c r0` — missing value (clean error, exit 1):**
```
mvi>>>r0
Missing operand
```

**`c` — bare, no operands (SEGFAULT):** no output; the wrapped pipe exits **139** (128 + SIGSEGV 11).
Reproduced in isolation (`printf 'c\nq\n' | lccrun 8 $LCC_ORACLE -d p.e` → exit 139).

**`c fff0 abcd` — hex starting with a letter:** `Error: Undefined label` (the Oracle parses `fff0` as
a label; a raw hex address needs the `0x` prefix per `lcc.txt`). No crash.

## §2. `integer n`, `z`, `t`

**`integer n` (`2`) — WORKS:**
```
mvi>>>  0: d007     ; mvi
     <r0 = 0/7>
  1: d202     ; mvi
     <r1 = 0/2>
halt>>>pc = 0002 ...
```
Two instructions stepped with before/after diffs, exactly as `lcc.txt` documents.

**`z` (run-to-end) — WORKS:** steps `0`→`1`→`2: f000 ; halt` to completion.

**`t` (trace toggle) — WORKS:** prints `Trace off` and subsequent steps emit no trace.

## §3. `w` watchpoint

**`w 3` (numeric address) — WORKS:** running `s.e` (where `st r0, x` writes address 3), the watchpoint
fires:
```
  1: 3001     ; st
     <mem[3] = 0/9>
Watchpoint at 3
  2: f000     ; halt
```

**`w x` (label) on a bare `.e` — `Undefined label`:** the symbol table is not present when running a
pre-assembled `.e`, so label forms of `w`/`c`/`m` can't resolve. This is a **probe-setup artifact**
(use the `.a` path or numeric addresses), not an Oracle limitation.

## Implications

### For #1349 (lccjs `-d` advertises `c`/`integer n` but implements neither)
- **`integer n`** works in the Oracle → lccjs should **implement** it (step-count).
- **`c <reg> <val>`** works in the Oracle → lccjs should **implement** it (at least the register form),
  **with input validation** so lccjs does NOT replicate the bare-`c` segfault. Fix direction:
  **implement, do not de-advertise.**

### For the registry (#1341) — `z`/`w`/`t` are real, working Oracle commands
The lccjs `-d` debugger's missing `z`/`w`/`t` are legitimate OG-parity gaps to implement (each its own
DEV ticket), since the Oracle's versions demonstrably work.

### Upstream bug report (W8) — WARRANTED
The Oracle **segfaults on bare `c`** (and should be probed for other malformed debugger inputs). This
is a real robustness defect → draft an upstream report to Prof Dos Reis (`@GDR400`) following the
`docs/cuh63-*-bug-report.md` + `reports_summary.md` process (drafted, not auto-sent; no PII).

## Caveats
- Numbers in `-d` are hex except `integer n`. Hex addresses beginning with a letter need `0x`.
- Label forms (`c x`, `w x`, `m x`) require the symbol table — present when running `.a` (assemble+run),
  absent when running a bare `.e`. Re-probe label forms via the `.a` path if needed.
- Exit codes: `q` quit → exit 1; run-to-completion (`z`) → exit 0; segfault → 139.
