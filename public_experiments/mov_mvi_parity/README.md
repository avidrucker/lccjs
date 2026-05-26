# `mov` / `mvi` parity experiments (cuh63 6.3 vs LCC.js)

This directory contains the public, runnable artifacts for the
investigation documented in
[`../../docs/cuh63-mov-immediate-bug-report.md`](../../docs/cuh63-mov-immediate-bug-report.md).

Two findings emerged from these probes:

1. **An apparent regression in cuh63 6.3's `mov` parser:** it rejects
   every negative `mov` immediate, even though the shipped ISA summary
   defines `mov dr, imm9` as a pseudo-instruction for `mvi dr, imm9`
   and the same binary's `mvi` accepts the full spec-correct
   −256..+255 range.

2. **A range-check gap in LCC.js's `mov`:** the assembler accepts
   inputs outside the spec range and silently wraps them via the
   underlying 9-bit signed field — `mov r0, 512` is encoded
   identically to `mov r0, 0` with no warning. (See `open_bugs.md`
   in the repo root for the LCC.js-side bug.)

## Files

| File | What it is |
|---|---|
| `mov_neg.a` | Minimal one-line reproduction: `mov r0, -15` followed by `halt`. cuh63 6.3 rejects this with "mov immediate value out of range"; LCC.js accepts it and encodes `d1f1` (spec-correct 9-bit signed −15). |
| `probe.sh` | Sweeps `mov r0, ⟨val⟩` for a range of values from −257 to +512. Reports accept/reject for both tools and the bytes LCC.js produces. |
| `probe_mvi.sh` | Same sweep, but comparing `mov` against `mvi` side-by-side on the same binary. The cuh63 6.3 disagreement between `mov` and `mvi` is the headline finding. |

## Running

Both scripts read `LCC_ORACLE` from the repo's `.env` (the same
variable the test suite uses) or from the environment. The path
should point at the cuh `lcc` binary on your system.

```bash
# from this directory
./probe.sh
./probe_mvi.sh
```

If `.env` does not exist yet, see the "Running oracle-parity tests"
section of the repo's main `README.md` for how to set up `LCC_ORACLE`.

## Expected output of `probe_mvi.sh`

Reproduces the side-by-side acceptance table from the upstream bug
report. The bolded rows in that report correspond to inputs the spec
allows and `mvi` accepts but `mov` rejects:

```
value    | mov: OG      | mov: LCCjs   | mvi: OG      | mvi: LCCjs
---------+--------------+--------------+--------------+-------------
-257     | REJECT       | ACCEPT       | REJECT       | REJECT
-256     | REJECT       | ACCEPT       | ACCEPT       | ACCEPT
-255     | REJECT       | ACCEPT       | ACCEPT       | ACCEPT
-1       | REJECT       | ACCEPT       | ACCEPT       | ACCEPT
0        | ACCEPT       | ACCEPT       | ACCEPT       | ACCEPT
1        | ACCEPT       | ACCEPT       | ACCEPT       | ACCEPT
255      | ACCEPT       | ACCEPT       | ACCEPT       | ACCEPT
256      | REJECT       | ACCEPT       | REJECT       | REJECT
257      | REJECT       | ACCEPT       | REJECT       | REJECT
```

Notes on the LCC.js column:

- `mvi` matches the spec exactly.
- `mov` is permissive in both directions — it accepts everything,
  silently wrapping out-of-range values via the underlying 9-bit
  signed encoding. This is the LCC.js-side bug.

## Why this lives in `public_experiments/`

This directory is intended for self-contained, sharable, runnable
investigations — the kind of thing that can be posted in a bug
report, linked in a discussion thread, or run by someone else
without first having to understand the LCC.js internals.

Compare with `scratch/`, which is gitignored and used for
in-flight notes and one-off probing.
