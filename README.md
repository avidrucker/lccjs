# LCC.js

> 16-bit educational assembler / linker / interpreter toolchain in JavaScript.

LCC.js is a JavaScript implementation of the LCC toolchain — the assembler, linker, and interpreter for a simple 16-bit educational ISA. It supports both file-oriented CLI usage and in-memory programmatic usage, with a growing test suite and oracle-driven parity work against the original LCC.

## Contents

- [Quick Start](#quick-start)
- [What's In This Repo](#whats-in-this-repo)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Testing](#testing)
- [Further Reading](#further-reading)

## Quick Start

```bash
npm install                            # dev/test deps only; no runtime deps
node ./src/core/lcc.js demos/demoA.a  # assemble + run
node ./src/core/lcc.js demos/demoA.e  # run executable directly
```

## What's In This Repo

| Path | Purpose |
|------|---------|
| `src/core/assembler.js` | Assembles `.a`, `.bin`, `.hex` → `.e` or `.o` |
| `src/core/interpreter.js` | Executes `.e` files |
| `src/core/linker.js` | Links `.o` files → `.e` |
| `src/core/lcc.js` | Top-level CLI orchestrator |
| `src/interactive/ilcc.js` | Interactive stepping debugger (`-i` mode) |
| `src/utils/` | Report generation, file helpers, typed errors, name handling |
| `src/plus/` | LCC+ variants for the extended `.ap`/`.ep` toolchain |
| `tests/new/` | Unit, integration, oracle/e2e, and research tests |
| `experiments/` | Focused oracle experiments for ambiguous behavior |
| `docs/` | Architecture, parity, and per-module documentation |

## Installation

LCC.js has **no runtime dependencies** — Node.js is all you need to run the CLI tools.

`npm install` installs dev/test dependencies only (`jest`, `dotenv`):

```bash
npm install
```

## CLI Usage

### `lcc.js`

```bash
node ./src/core/lcc.js <infile> [options]
```

| Option | Description |
|--------|-------------|
| `-d` | Debug mode — enter debugger at first instruction |
| `-m` | Display memory at end of run |
| `-r` | Display registers at end of run |
| `-f` | Full line display |
| `-x` | 4-digit hex output |
| `-t` | Trace mode — print per-step source text + register diffs |
| `-i` | Interactive stepping debugger (`.a` and `.e` files) |
| `-e` | Efficient mode (use with `-i`: forward-only stepping, lower memory) |
| `-c` | Colorblind mode (use with `-i`: alternate ANSI palette) |
| `-l<hex>` | Load point (hex address offset for `.lst`/`.bst` display) |
| `-o <outfile>` | Output file name (for linking) |
| `-nostats` | Skip `.lst`/`.bst` report generation |
| `-h` | Print help |

**Examples:**

```bash
node ./src/core/lcc.js demos/demoA.a          # assemble + run
node ./src/core/lcc.js demos/demoA.e          # run .e directly
node ./src/core/lcc.js -t demos/demoA.a       # assemble + run with per-step trace
node ./src/core/lcc.js -i demos/demoA.a       # assemble + interactive debugger
node ./src/core/lcc.js module1.o module2.o    # link .o files → link.e
node ./src/core/lcc.js -o prog.e m1.o m2.o   # link with custom output name
```

### Other entrypoints

```bash
node ./src/core/assembler.js demos/demoA.a    # assemble only
node ./src/core/interpreter.js demos/demoA.e  # interpret only
node ./src/core/linker.js module1.o module2.o # link only
```

## Testing

```bash
npm test              # primary suite
npm run test:all      # full suite including slow tests
npm run test:oracle   # oracle parity suite (requires oracle binary — see docs/oracle-setup.md)
```

Run a single file:

```bash
npm test -- --runTestsByPath tests/new/assembler.unit.spec.js
npm test -- --runTestsByPath tests/new/lcc.oracle.e2e.spec.js
```

Test organization under `tests/new/`:

- **unit** — pure helpers and pure APIs
- **integration** — wrapper behavior and file artifacts
- **oracle/e2e** — compatibility checks against the original LCC binary
- **research** — ambiguous behavior under investigation

## Further Reading

| Doc | Contents |
|-----|---------|
| [docs/api.md](./docs/api.md) | Programmatic API — `assembleSource`, `executeBuffer`, return value shapes |
| [docs/oracle-setup.md](./docs/oracle-setup.md) | Oracle binary install, `.env` config, env knobs |
| [docs/status.md](./docs/status.md) | Current status, parity areas, known gaps |
| [docs/core-behavior-matrix.md](./docs/core-behavior-matrix.md) | Behavior contracts and oracle-vs-lccjs matrix |
| [docs/parity_deviations.md](./docs/parity_deviations.md) | Documented intentional deviations from oracle behavior |
| [docs/lcc-isa.md](./docs/lcc-isa.md) | LCC instruction set summary (instructions, traps, directives, branch codes) |
| [docs/lccplus-isa.md](./docs/lccplus-isa.md) | LCC+ instruction set addendum (new instructions, trap vectors, `.lccplus` directive) |
| [docs/cuh63/](./docs/cuh63/README.md) | Annotated cuh63 exercise index — one doc per chapter (ch3–ch19), covering all `.a` examples from the textbook |
| [docs/assembler.md](./docs/assembler.md) | Assembler internals |
| [docs/interpreter.md](./docs/interpreter.md) | Interpreter internals |
| [docs/lcc.md](./docs/lcc.md) | `lcc.js` orchestrator internals |
| [docs/linker.md](./docs/linker.md) | Linker internals |
| [src/core/core.md](./src/core/core.md) | Core module design notes |
| [src/utils/utils.md](./src/utils/utils.md) | Utils module design notes |
| [experiments/README.md](./experiments/README.md) | Oracle experiment tooling |
| [experiments/debugger-results.md](./experiments/debugger-results.md) | Debugger oracle command set and parity gaps |
| [docs/lccjs-assembly-skill-design.md](./docs/lccjs-assembly-skill-design.md) | Design for the paired Claude skill that teaches AI agents to write idiomatic LCC assembly. The skill itself lives in [avidrucker/claude-config](https://github.com/avidrucker/claude-config) at `skills/lccjs-assembly/` (SKILL.md router + 4 on-demand references: `isa-quickref`, `calling-convention`, `pitfalls`, `idioms-and-patterns`, `house-style`). |

## License

MIT
