# Oracle Experiments

This directory contains focused `.a` programs intended to be run against the
original C LCC oracle, not just LCC.js.

The purpose of these experiments is to discover the actual oracle behavior for
features or edge cases that are still ambiguous in LCC.js, including:

- `.org` / `.orig`
- `bp`
- `sext`
- other parity gaps that are still marked as research

## How Oracle Runs Work In This Repo

The current oracle contract is the same one used by the oracle test helpers:

1. Read `LCC_ORACLE` from `.env`
2. Copy `example.a` into a temp directory as `example1.a`
3. Create `name.nnn` in that temp directory
4. Run the oracle binary with the basename only:

   `lcc example1.a`

5. Inspect the generated outputs:

- `example1.e`
- `example1.lst`
- `example1.bst`

This matches the behavior in:

- `tests/helpers/runOracle.js`
- `tests/helpers/env.js`

## Recommended Command

Run a single experiment with:

```bash
node experiments/runOracleExperiment.js experiments/sext_sweep.a
```

Keep the temp directory for inspection:

```bash
node experiments/runOracleExperiment.js --keep experiments/org_forward_gap.a
```

Pass input lines to the oracle program:

```bash
node experiments/runOracleExperiment.js experiments/some-input-test.a --input "hello" --input "42"
```

Print oracle stdout/stderr even on success:

```bash
node experiments/runOracleExperiment.js --debug experiments/bp-basic.a
```

## Safe Timeout Runner

For risky experiments such as infinite-loop or debugger-entry checks, use the
timed runner instead of running the interpreter directly in the terminal. It
caps captured output and hard-stops the child after the requested timeout.

Run `interpreter.js` for at most 5 seconds:

```bash
node experiments/runTimedExperiment.js \
  --target interpreter \
  --tty \
  --timeout-ms 5000 \
  experiments/infinite_loop_silent.e
```

Run `lcc.js` for at most 5 seconds:

```bash
node experiments/runTimedExperiment.js \
  --target lcc \
  --tty \
  --timeout-ms 5000 \
  experiments/infinite_loop_silent.a
```

Run the oracle for at most 5 seconds:

```bash
node experiments/runTimedExperiment.js \
  --target oracle \
  --tty \
  --timeout-ms 5000 \
  experiments/infinite_loop_silent.a
```

This is the safest way to test whether a program reaches debugger-like behavior
without letting the process flood stdout indefinitely.

## Manual Equivalent

If you want to reproduce the run without the helper script:

```bash
tmp="$(mktemp -d)"
cp experiments/sext_sweep.a "$tmp/sext_sweep1.a"
printf 'TestUser\n' > "$tmp/name.nnn"
cd "$tmp"
"$LCC_ORACLE" sext_sweep1.a
```

## How To Use These Experiments

For each experiment:

1. Run it against the oracle
2. Inspect stdout/stderr
3. Inspect the generated `.e`, `.lst`, and `.bst`
4. Record the observed behavior in docs, TODOs, or new research tests
5. Only then update LCC.js behavior or parity tests

## Current Experiment Set

- `org_forward_gap.a`
- `org_backward_overlap.a`
- `org_invalid_operand.a`
- `bp_basic.a`
- `sext_sweep.a`
- `sext_boundaries.a`
- `infinite_loop_demoJ.a`
- `infinite_loop_silent.a`
