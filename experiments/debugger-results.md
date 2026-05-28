# Debugger Experiments

This log records the current debugger-related findings for LCC.js and the
oracle, using the safe timed experiment workflow.

## Safe Commands

Silent infinite-loop probe for `interpreter.js`:

```bash
node experiments/runTimedExperiment.js \
  --target interpreter \
  --tty \
  --timeout-ms 5000 \
  experiments/infinite_loop_silent.e
```

Silent infinite-loop probe for `lcc.js`:

```bash
node experiments/runTimedExperiment.js \
  --target lcc \
  --tty \
  --timeout-ms 5000 \
  experiments/infinite_loop_silent.a
```

Oracle probe:

```bash
node experiments/runTimedExperiment.js \
  --target oracle \
  --tty \
  --timeout-ms 5000 \
  experiments/infinite_loop_silent.a
```

Breakpoint probe:

```bash
node experiments/runOracleExperiment.js --debug experiments/bp_basic.a
```

## Current Findings

- `interpreter.js` has a symbolic-debugger loop plus `m`, `r`, and `s` support.
- `bp` now behaves as a CLI-aware software breakpoint in LCC.js:
  - pure in-memory execution throws `software breakpoint`
  - CLI non-TTY runs print `software breakpoint` and continue
  - CLI TTY runs print `software breakpoint` and enter the debugger loop
- `interpreter.js` infinite-loop handling remains intentionally custom:
  - pure in-memory execution stops at 500,000 steps with `Possible infinite loop`
  - CLI TTY runs may enter the debugger
- `lcc.js` now enables the same CLI-only runtime-debugging path as direct
  `interpreter.js`
- the oracle already confirmed that `bp` is debugger-oriented rather than a
  fatal runtime trap

## Remaining Verification Work

- verify actual TTY debugger-entry prompts for:
  - `interpreter.js` on infinite loop
  - `lcc.js` on infinite loop
  - oracle LCC on infinite loop, if it has comparable behavior
- compare the exact prompt / stepping semantics once PTY-backed runs are
  available outside the sandbox

---

## Oracle Debugger Full Command Set (probed 2026-05-27)

Probe method: piping stdin to `lcc -d demos/demoA.a` with the oracle binary
at `$LCC_ORACLE`. Using `printf` to provide commands one per line.

### Commands

| Input | Action | Oracle output |
|-------|--------|---------------|
| `Enter` (empty line) | Step 1 instruction (or step-count) | `{addr}:     {source}\n` then diffs |
| `{integer n}` | Set step-count to n; run n steps | Same per-step output for each |
| `g` | Run to completion (no debug output) | Only program I/O |
| `q` | Quit (stop execution) | No output; prompt disappears |
| `r` | Display all registers | `pc = {hex4}  ir = {hex4}  NZCV = {nzcv}\nr0 = ... r4 = fp = sp = lr = ` |
| `m` | Display all used memory words | `{addr4}: {hex4}` per word |
| `m {addr}` | Display 1 word at addr | `{addr4}: {hex4}` |
| `m {label}` | Display 1 word at symbol address | same |
| `m {addr\|label} n` | Display n words | n lines |
| `b {addr\|label}` | Set breakpoint; shows banner when hit | `Breakpoint at\n    {source}\n` |
| `b` | Cancel breakpoint | (none visible) |
| `i` | Display next instruction source text | `    {source text}\n` (no exec) |
| `h` | Help screen | Multi-line help |
| `c {reg\|addr\|label} val` | Set register/memory to val | **CRASHES oracle** (segfault) |

### Debug output format per step

After the user presses Enter at a `{mnemonic}>>> ` prompt, the oracle
prints (on the **same** line when piped, next line in a real TTY):

```
{addr padded to 2 chars, right-justified}:     {raw source text}
```

Note the **5 spaces** between the colon and the source text (vs 3 spaces
in the `-t` trace format).  Address is hex lowercase.

Then, if any state changed:

```
     <rN = {old_hex}/{new_hex}>     [if register changed]
<NZCV = {n}{z}{c}{v}>              [if flags set, appended or on new line?]
<pc = {old_hex}/{new_hex}>         [if branch taken]
```

Multiple diffs appear on the **same output line**, separated by 1 space.

### Parity gaps vs lccjs `debug()`

| Feature | Oracle | lccjs (current) |
|---------|--------|-----------------|
| Step command | Enter (empty line) | Any non-`q` input |
| State format | `{addr}:     {source text}` (5 spaces, source) | `{addr}: {hex_word}     ; {mnemonic}` (hex) |
| Continue to end | `g` | not implemented |
| Set step count | `{integer}` | not implemented |
| Display regs | `r` | not implemented |
| Display memory | `m [addr [n]]` | not implemented |
| Set breakpoint | `b {addr\|label}` | not implemented |
| Cancel breakpoint | `b` | not implemented |
| Display next instr | `i` | not implemented |
| Help | `h` | not implemented |
| Set reg/mem | `c` | not implemented (oracle crashes on this) |

### Implementation sizing

**Phase 1 — quick parity (2–3h):** State format fix (source text instead of
hex), `g` (continue), `r` (display regs), `m` (display memory).

**Phase 2 — breakpoints (2–4h):** `b {addr|label}` set/cancel, breakpoint
banner, integration with the existing `bp` trap.

**Phase 3 — step count + `i` (1–2h):** Numeric step-count command; `i` command.

**Skip or defer:** `c` (oracle crashes on it; not worth matching a buggy command).

Total for Phase 1 + 2: ~5–7h.  Suggest breaking into 2–3 scope-sized @todos.
