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
