# Project Status & Parity Notes

## Current Status

Implemented and stable:

- In-memory assembly and execution seams
- Centralized report generation
- Centralized file artifact helpers
- Typed error classes for pure reusable paths
- Categorized assembler integration coverage
- Oracle-backed research workflow
- Per-step trace output (`-t` flag) with source-text diffs
- Interactive stepping debugger (`-i` flag) with oracle-parity command set:
  - Enter / step count — step N instructions
  - `g` — run to completion
  - `q` — quit
  - `r` — display all registers
  - `m [addr [n]]` — display memory
  - `b [addr]` — set or cancel breakpoint
  - `i` — display next instruction source text
  - `h` — help
  - `s` — display stack
- Software breakpoint (`bp`) as CLI-aware trap:
  - pure in-memory: throws `software breakpoint`
  - CLI non-TTY: prints message and continues
  - CLI TTY: enters the debugger

Still actively being refined:

- Deeper decomposition of `src/core/assembler.js`
- Deeper decomposition of `src/core/interpreter.js`
- Remaining linker boundary cleanup and modularity work
- Exact oracle parity for some behaviors (e.g. `sext`)

## Known Parity / Research Areas

Areas that still require active research or refinement:

- Exact oracle `sext` semantics
- Some original-LCC edge cases around line-length parsing
- Some linker output-location behavior
- Whether to match oracle's exact artifact behavior on certain assembly failures

The current source of truth for active behavior contracts is:

- [docs/core-behavior-matrix.md](./core-behavior-matrix.md)
- [docs/parity_deviations.md](./parity_deviations.md)

See also:

- [experiments/debugger-results.md](../experiments/debugger-results.md) — oracle debugger command set, parity gap table, and implementation notes
