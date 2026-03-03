# Oracle Experiment Results

This file records observed behavior from the original C LCC oracle using the
programs in `experiments/`.

These observations should drive parity work in `assembler.js`,
`interpreter.js`, `lcc.js`, and the corresponding tests.

## Environment

- Oracle binary: `LCC_ORACLE` from `.env`
- Confirmed working when run outside the sandbox
- Helper command:

```bash
node experiments/runOracleExperiment.js --keep --debug <experiment.a>
```

## Results

## `.org` forward gap

Experiment:

- `experiments/org_forward_gap.a`

Observed behavior:

- Oracle supports `.org`
- Forward `.org` succeeds
- `.org 4` after a word at location `0000` pads locations `0001`, `0002`, and `0003` with `0000`
- The subsequent label lands at `0004`
- The generated executable includes a normal start header and code section
- Program output was:

```text
11
22
```

Observed `.lst` details:

- `before` at `0000`
- `.org 4` leaves gap words:
  - `0001  0000`
  - `0002  0000`
  - `0003  0000`
- `after` at `0004`
- `main` at `0005`

Observed `.e` details:

- Header starts with `oS 0500 C`
- Confirms `.start main` produced start address `0005`

Conclusion:

- LCC.js should implement forward `.org` by padding with zero words up to the requested address.

## `.org` backward overlap

Experiment:

- `experiments/org_backward_overlap.a`

Observed behavior:

- Oracle rejects backward `.org`
- Exact error text:

```text
Error on line 12 of org_backward_overlap1.a:
        .org 1
Backward address on .org
```

- Oracle still produced:
  - `.e`
  - `.lst`
  - `.bst`

Observed `.e` detail:

- The generated `.e` file was exactly 1 byte: just `o`

Conclusion:

- LCC.js should reject backward `.org` with `Backward address on .org`
- Decide whether to match the oracle artifact behavior exactly by emitting a 1-byte `o` file on assembly failure for this case

## `.org` invalid operand

Experiment:

- `experiments/org_invalid_operand.a`

Observed behavior:

- Oracle rejects non-numeric `.org` operands
- Exact error text:

```text
Error on line 8 of org_invalid_operand1.a:
        .org banana
Bad number
```

- Oracle still produced:
  - `.e`
  - `.lst`
  - `.bst`

Observed `.e` detail:

- The generated `.e` file was exactly 1 byte: just `o`

Conclusion:

- LCC.js should reject invalid `.org` operands with `Bad number`
- Decide whether to match the same minimal `.e` artifact behavior on assembly failure

## `bp`

Experiment:

- `experiments/bp_basic.a`

Observed behavior:

- Oracle assembles and runs `bp`
- Console/stdout behavior includes:

```text
software breakpoint
dout>>>  2:         dout r0
7
nl>>>  3:         nl

halt>>>  4:         halt
```

- The final `.lst` output only contains the final program output:

```text
7
```

- Oracle reported `Instructions executed = 5`

Conclusions:

- `bp` does not behave like an unimplemented fatal trap in oracle LCC
- It appears to enter a breakpoint/trace/debug-like mode and then continue execution
- The trace-style `>>>` prompt output appears on stdout, not in the final `.lst`

Implementation note:

- LCC.js should not treat `bp` as a permanent runtime error if oracle parity is the goal
- Exact debugger interaction semantics still need to be matched carefully

## `sext` sweep

Experiment:

- `experiments/sext_sweep.a`

Observed behavior:

- Oracle assembled `sext r0, r1` as machine word `a04d`
- Changing the contents of `r1` changed the runtime result
- Oracle stdout and `.lst` output:

```text
Initial value: 34
sext with r1 = 3  -> 0
sext with r1 = 7  -> fffc
sext with r1 = 11 -> fff4
sext with r1 = 15 -> 4
```

Key implications:

- The runtime behavior depends on the contents of the source register, not just the encoded register id
- Current LCC.js `sext` behavior still needs parity work

## `sext` boundaries

Experiment:

- `experiments/sext_boundaries.a`

Observed behavior:

Oracle stdout and `.lst` output:

```text
Testing sext boundaries0x00FF with r1 = 3 -> ffff
0x0011 with r1 = 5 -> fffb
0x00F0 with r1 = 7 -> 0
0x0070 with r1 = 7 -> 0
```

Conclusions:

- Oracle `sext` semantics are not yet matched by the current LCC.js implementation
- The exact transformation rule still needs to be derived from the observed oracle outputs
- The experiment confirms that the current `demoU` parity gap is real

## Immediate follow-up tasks

### `.org`

- implement forward `.org` zero-padding behavior
- reject backward `.org` with `Backward address on .org`
- reject invalid `.org` operands with `Bad number`
- add parity-focused tests for:
  - forward gap padding
  - backward-address rejection
  - invalid operand rejection
- decide whether to match the oracle behavior of writing a 1-byte `o` executable on assembly failure

### `bp`

- replace the current fatal `bp` runtime behavior with debugger-oriented behavior when debugger parity work resumes
- add an oracle-backed regression test capturing current stdout interaction as closely as practical
- confirm whether the oracle always continues automatically after the breakpoint in non-interactive runs

### `sext`

- derive the exact oracle `sext` runtime rule from the observed outputs
- update interpreter implementation to match the oracle
- keep assembler encoding as `a04d` for `sext r0, r1` parity
- add parity tests using:
  - `experiments/sext_sweep.a`
  - `experiments/sext_boundaries.a`
