# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

LCC.js is a JavaScript implementation of the LCC toolchain — assembler, linker, and interpreter for a 16-bit educational ISA. **No runtime dependencies**; Node ≥18 is all that's needed to run the tools. `npm install` only pulls dev deps (`jest`, `dotenv`).

## Commands

```bash
node ./src/core/lcc.js <infile> [options]   # assemble+run a .a, or run a .e directly, or link .o files
node ./src/core/assembler.js  <file>         # assemble only
node ./src/core/interpreter.js <file.e>      # interpret only
node ./src/core/linker.js m1.o m2.o          # link only
node ./src/plus/lccplus.js <file.ap>         # LCC+ pipeline (see "Two toolchains" below)

npm test                                      # primary suite (tests/new, --runInBand)
npm run test:all                              # full suite incl. slow tests
npm run test:oracle                           # oracle-parity suite (needs oracle binary; see below)
npm test -- --runTestsByPath tests/new/assembler.unit.spec.js   # run a single test file
```

Tests use `--runInBand` deliberately — the oracle/e2e suites shell out to a real binary and write temp files, so parallel workers would race. Keep new e2e tests serial-safe.

## Two toolchains: core vs plus

The repo ships **two parallel toolchains** and the file extension picks which one applies:

- **Core (LCC):** `.a` source → assembler → `.e` (executable) or `.o` (object); linker combines `.o` → `.e`; interpreter runs `.e`. Entry point `src/core/lcc.js`.
- **Plus (LCC+):** `.ap` source → `.ep` executable. `src/plus/*plus.js` **subclass** the core assembler/interpreter to add extended pseudo-instructions (`clear`, `sleep`, `nbain`, `cursor`, `rand`/`srand`, `millis`, `resetc`) and require a `.lccplus` directive for valid output. Entry point `src/plus/lccplus.js`.

When changing core assembler/interpreter behavior, check whether the plus subclasses override the method you're touching (`handleInstruction`, `handleDirective`, `writeOutputFile`, trap handlers) — a core change can silently break LCC+ or be shadowed by it.

> Note: `src/plus/linkerplus.js` does not exist yet; LCC+ has no linker. Multi-module `.ap` linking is planned, not implemented.

## Architecture: pure seams vs CLI wrappers

The core modules are being refactored toward a deliberate boundary, and new code should respect it:

- **Pure in-memory APIs throw typed errors** (`src/utils/errors.js`) and return data — no `console.*`, no `process.exit`, no file I/O. Examples: `assembleSource(...)`, `executeBuffer(...)`, `parseObjectModuleBuffer(...)`. These are the testable seams.
- **CLI/wrapper paths own** console output, exit codes, and file reads/writes.

Maturity varies: `assembler.js` and `interpreter.js` have real pure seams; `linker.js` is mid-transition (still wrapper-heavy); `lcc.js` stays intentionally orchestration-only (option parsing, choosing assemble/link/run, report orchestration) and is **not** meant to become a library surface. Shared concerns — report generation (`.lst`/`.bst`), artifact naming, hex display — live in `src/utils/`, not in the core modules.

`src/interactive/` holds the `-i` stepping debugger (`ilcc.js`/`iinterpreter.js`), a separate execution path from the batch interpreter.

## Oracle-parity testing

A central activity here is differential testing against the **original LCC binary** ("the oracle", Prof. Dos Reis's `cuh` package). `*.oracle.e2e.spec.js` suites run both and diff the output.

- Requires `.env` with `LCC_ORACLE=/abs/path/to/cuh63/lcc` (copy `.env.example`; `.env` is gitignored). Full setup in `docs/oracle-setup.md`.
- Oracle suites **auto-skip** when `LCC_ORACLE` is unset, so plain `npm test` works without the binary.
- Golden caches are NOT auto-refreshed: run with `GOLDEN_AUTO_UPDATE=1` only when oracle output legitimately changed, so unexpected drift is caught otherwise.
- Intentional, documented divergences from oracle behavior live in `docs/parity_deviations.md` — consult it before "fixing" a parity mismatch; it may be deliberate.

## Project workflow (non-obvious, enforced by convention)

This repo runs a **Puzzle-Driven Development** discipline with multiple agents working concurrently. Before doing any puzzle work, **read [`docs/claude_workflow.md`](./docs/claude_workflow.md)** — it owns the full protocol (the per-puzzle phases, worktree claim mechanics, the close sequence, tool-failure discipline, and the PDD-scan `at_todo` trap). The essentials for orientation:

- **Worktree-per-task is the expected default**, even for small/docs edits — multiple agents touch this repo at once. Run `git worktree list` first to avoid clobbering, and close trunk-based via `git push origin HEAD:main`.
- `npm run claim` stakes a worktree under a per-session agent identity; `npm run puzzle:status` shows what's safe to grab; `npm run puzzles` runs the `pdd` scan.

## Git identity

Inherited from the parent `~/Documents/Study/CLAUDE.md`: GitHub `avidrucker`, commit email `6962664+avidrucker@users.noreply.github.com`. Don't override per-repo.
