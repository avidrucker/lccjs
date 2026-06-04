# LCC.js — Development Roadmap

LCC.js is a JavaScript implementation of the LCC toolchain (assembler, linker, interpreter) for the 16-bit Low-Cost Computer ISA, plus an extended dialect (LCC+) for interactive programs. This document tracks what has been built, what is actively in progress, and where the project is heading.

---

## What's already done

### Core toolchain

- **Assembler** — two-pass assembler for the base LCC ISA (`.a` source → `.e` executable or `.o` object module), with full support for all standard pseudo-instructions, directives, and error reporting
- **Linker** — multi-module linker combining `.o` files into a single `.e` executable, with global/extern symbol resolution and relocation
- **Interpreter** — cycle-accurate interpreter for the 16-bit ISA with trap handlers, register and memory state, and runtime error reporting
- **LCC+ toolchain** — subclasses of the core assembler/interpreter adding extended pseudo-instructions (`clear`, `sleep`, `nbain`, `cursor`, `rand`/`srand`, `millis`, `resetc`) for interactive terminal programs; `.ap` source → `.ep` executable
- **`lcc.js` orchestrator** — unified CLI that assembles and runs a `.a` file in one command, or runs a `.e` directly, or links `.o` files; single entry point for the whole pipeline

### Testing framework

- **Jest suite** — `tests/new/` with unit, integration, and e2e test categories (`npm test`)
- **Oracle-parity differential testing** — `*.oracle.e2e.spec.js` suites run both LCC.js and the original `cuh63/lcc` binary and diff output; auto-skips when the oracle binary is absent
- **Golden-cache system** — expected outputs are frozen; drift is caught on re-run; update only when oracle output legitimately changes (`GOLDEN_AUTO_UPDATE=1`)
- **Documented parity deviations** — intentional divergences from OG LCC are listed in `docs/parity_deviations.md` so "fixes" don't accidentally revert deliberate choices

### Interactive debugger

- **`-i` interactive stepping debugger** — interactive step-through with breakpoints, register/memory inspection, run-to-completion, stack display; commands: Enter (step), `g` (run), `q` (quit), `r` (registers), `m` (memory), `b` (breakpoint), `i` (next instruction), `h` (help), `s` (stack). (`-d` is a separate debug-output flag that prints trace info without entering interactive mode.)
- **`bp` software breakpoint trap** — pure in-memory throw; CLI non-TTY continues with message; CLI TTY enters the debugger

### Syntax-highlighted demos

- **Custom TextMate grammar** (`docs/lcc.tmLanguage.json`) — LCC assembly language definition used for syntax highlighting in the site and playground
- **Syntax-highlighted demo site** (`docs/site/index.html`) — curated samples and the full `demoA`–`demoZ` alphabet suite, displayed with Shiki-powered syntax highlighting

### Playground code viewer

- **Playground** (`docs/showcase/index.html`) — live syntax highlighting as you type LCC assembly in the browser; uses the custom TextMate grammar; displays highlighted output alongside the editor

### Code highlighting in slides

- **Syntax-highlighted code in slide decks** — LCC assembly code blocks rendered with the custom grammar inside presentation slides; research into reveal-md, Marp, and Quarto as compatible platforms completed (`docs/research/613-*`, `docs/research/673-*`)

### Extensive demo and game library

- **26 base ISA demos** (`demos/demoA.a`–`demoZ.a`) — smallest-first progression covering registers, I/O, strings, control flow, recursion, and the stack
- **LCC+ interactive games** (`plusdemos/`) — Snake, Flappy Bird, Tic-Tac-Toe, Rock-Paper-Scissors (all playable today)
- **LCC+ building-block demos** — character cycling, typewriter output, non-blocking key polling, deterministic/nondeterministic RNG, 1D/2D player movement

### Extensive curriculum

- **Step-by-step tutorial** (`docs/tutorial_01_intro.md`) — intro to registers, I/O, directives, control structures, and the stack
- **cuh63 exercise index** (`docs/cuh63/`) — annotated exercise files organized by textbook chapter (ch3–ch19), mapped to Prof. Dos Reis's LCC textbook
- **ISA reference** (`docs/lcc-isa.md`, `docs/lccplus-isa.md`) — complete instruction tables for both toolchains
- **Pitfalls catalog** (`docs/pitfalls.md`) — common first-timer mistakes documented with explanations and fixes
- **Learner-path guide** (`docs/who_lccjs_is_for.md`) — entry points for students, educators, hobbyists, and contributors

---

## In progress

- **Playground code editor and runner** *(WIP)* — extend the playground from a code viewer into a full edit-assemble-run loop so learners can write and execute LCC assembly directly in the browser without installing anything locally; browser playground execution arc (#677)
- **Authoring guide for LCC slides** *(WIP)* — how to use the shipped reveal-md injector to author slide decks with live LCC code blocks; #695
- **Runnable code in slides** *(research)* — stdin/stdout simulation for truly interactive execution inside a browser slide context; #693
- **Linker boundary cleanup** — `linker.js` mid-transition toward the pure-seam / CLI-wrapper boundary established in assembler and interpreter
- **Deeper module decomposition** — continued decomposition of `assembler.js` and `interpreter.js` toward smaller, independently testable units

---

## Planned

- **LCC+ multi-module linker** — `src/plus/linkerplus.js` does not yet exist; multi-module `.ap` programs cannot be linked; this is the main missing piece of the LCC+ toolchain
- **Tetris** — falling-piece puzzle game in LCC+; requires real-time input, gravity timing, line-clear detection, and a grid renderer
- **Hangman** — non-blocking input and screen-clearing demo using LCC+ instructions
- **Tiny Roguelike** — turn-based grid movement and random dungeon generation in LCC+
- **Terminal graphics utilities** — minimal sprite/tile rendering helpers for richer game demos
- **CI test suite** — automated `npm test` runs on Linux, macOS, and Windows (a site-build/deploy workflow already exists at `.github/workflows/pages.yml`; this item tracks adding test execution to CI)
- **Potato token testing** (#589) — on-demand fuzzer that replaces each source token in `benchmark_isa.a` with `"potato"` one at a time and records the assembler's response; surfaces unhandled edge-cases and surprising error messages (inspired by S. Miller)
- **Potato input testing** (#590) — on-demand fuzzer that replaces each stdin prompt to `benchmark_isa.e` with `"potato"` (in reverse order) and diffs LCC.js vs oracle output; surfaces runtime input-rejection parity gaps

---

## Contributing

Browse the [issue tracker](https://github.com/avidrucker/lccjs/issues) for open work. The project uses Puzzle-Driven Development: `npm run puzzle:status` lists available bite-sized tasks. Good entry points: expanding linker test coverage, writing new demos, and improving documentation.
