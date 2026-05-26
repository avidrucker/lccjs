# cuh63 6.3 LCC audit

A reproducible behavior sweep of the cuh63 6.3 `lcc` binary, used to
verify which observed quirks are isolated regressions, which are
spec-conformant behavior, and which are undocumented features.

This audit was produced while preparing the upstream bug report at
[`../../docs/cuh63-mov-immediate-bug-report.md`](../../docs/cuh63-mov-immediate-bug-report.md).
Its purpose was to make sure the report concentrates on real issues
and doesn't accidentally flag spec-conformant behavior as bugs.

## How to run

```bash
# from this directory
./probe.sh
```

Reads `LCC_ORACLE` from `../../.env` or the environment. See the repo's
main README for how to install cuh63 and set `LCC_ORACLE`.

## What the probe covers

The probe runs ~50 minimal assembly snippets through cuh63 6.3 and
classifies each as ACCEPT (with encoding) or REJECT (with error
message). Sections:

1. **`mov dr, imm9`** — the headline regression. Spec says `mov` is a
   pseudo-instruction for `mvi`, with `imm9` a signed 9-bit field
   (range −256..+255). cuh63 6.3 rejects every negative `mov`
   immediate.
2. **`mvi dr, imm9`** — the underlying instruction. Correctly accepts
   the full spec range, demonstrating that the regression is isolated
   to the `mov` pseudo's parser path.
3. **Other pseudo-instructions** — `cea` (pseudo for `add dr, fp,
   imm5`) and `mov dr, sr` (pseudo for `mvr`) both work correctly.
4. **`imm5` boundaries on add/sub/and** — −16..+15 accepted, ±16+
   correctly rejected. No regression.
5. **Numeric literal forms** — decimal, hex, binary, char,
   unary-`+`/`-`, negative zero. All work per spec.
6. **Directive synonyms** — `.string`/`.stringz`/`.asciz`,
   `.word`/`.fill`, `.zero`/`.space`/`.blkw`, `.global`/`.globl` all
   produce identical encodings, matching the spec.
7. **Undocumented / questionable behaviors** — `.orig` silently
   accepted as synonym for `.org`; duplicate `.start` directives
   silently accepted (last-one-wins).
8. **Label arithmetic & `*`** — `br main+1`, `.word *` work.

## Summary of findings

| Category | Verdict |
|---|---|
| `mov dr, imm9` immediate range | **Regression** (see upstream bug report) |
| Everything else above | **Spec-conformant** in cuh63 6.3 |
| `.orig`, duplicate `.start` | **Undocumented behavior** (worth a note in the upstream report's "Other observations") |

The narrowness of the `mov` regression (every adjacent code path
works correctly, including the underlying `mvi`) makes the upstream
report's suggested fix — "route `mov`'s validator through the same
code path `mvi` uses" — concrete and low-risk.

## Files

| File | Purpose |
|---|---|
| `probe.sh` | The full audit sweep — ~50 probes across the categories above. |
| `README.md` | This file. |

The probe scripts under `../mov_mvi_parity/` (`probe.sh`,
`probe_mvi.sh`) are kept separate because they are referenced
directly from the bug report and the `mov`-specific OB-001 / OB-008
entries in `open_bugs.md`. This `cuh63_audit/` folder is the broader
context that confirms those findings are isolated.
