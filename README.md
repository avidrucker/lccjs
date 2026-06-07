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
npm run setup                          # install git hooks (run once after cloning)
node ./src/cli/lcc.js demos/demoA.a  # assemble + run
node ./src/cli/lcc.js demos/demoA.e  # run executable directly
```

## What's In This Repo

| Path | Purpose |
|------|---------|
| `src/core/assembler.js` | Assembles `.a`, `.bin`, `.hex` → `.e` or `.o` |
| `src/core/interpreter.js` | Executes `.e` files |
| `src/core/linker.js` | Links `.o` files → `.e` |
| `src/cli/lcc.js` | Top-level CLI orchestrator |
| `src/interactive/ilcc.js` | Interactive stepping debugger (`-i` mode) |
| `src/utils/` | Report generation, file helpers, typed errors, name handling |
| `src/plus/` | LCC+ variants for the extended `.ap`/`.ep` toolchain |
| `tests/new/` | Unit, integration, oracle/e2e, and research tests |
| `experiments/` | Focused oracle experiments for ambiguous behavior |
| `docs/` | Architecture, parity, and per-module documentation |

## Installation

LCC.js has **no runtime dependencies** — Node.js is all you need to run the CLI tools.

Install dev/test dependencies, then set up the git hooks (run once after cloning):

```bash
npm install     # dev/test deps only (jest, dotenv); no runtime deps
npm run setup   # installs git hooks (commit-msg enforces commit format; pre-push runs PDD scan)
```

First-time contributors who skip `npm run setup` won't hit the hooks until a commit is rejected or a bad push slips through.

## Shell aliases (`alias.sh`)

`alias.sh` is an optional convenience installer. Running it once appends four short aliases to your `~/.bashrc` or `~/.zshrc` so you don't need to type `node ./src/...` every time:

| Alias | Expands to |
|-------|-----------|
| `lccjs` | `node <repo>/src/cli/lcc.js` |
| `lccplusjs` | `node <repo>/src/plus/lccplus.js` |
| `hex` | `node <repo>/src/utils/hexDisplay.js` |
| `picture` | `node <repo>/src/utils/picture.js` |

```bash
bash alias.sh
```

The script asks for consent before modifying your shell config, and is idempotent — if all four aliases already exist it exits without changes. Windows shells (cmd, PowerShell) are not yet supported; add the aliases manually or use the full `node` paths from the table above.

After running, reload your shell (`source ~/.bashrc` or open a new terminal) to activate the aliases.

## CLI Usage

### `lcc.js`

```bash
node ./src/cli/lcc.js <infile> [options]
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
node ./src/cli/lcc.js demos/demoA.a          # assemble + run
node ./src/cli/lcc.js demos/demoA.e          # run .e directly
node ./src/cli/lcc.js -t demos/demoA.a       # assemble + run with per-step trace
node ./src/cli/lcc.js -i demos/demoA.a       # assemble + interactive debugger
node ./src/cli/lcc.js module1.o module2.o    # link .o files → link.e
node ./src/cli/lcc.js -o prog.e m1.o m2.o   # link with custom output name
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
| [docs/who_lccjs_is_for.md](./docs/who_lccjs_is_for.md) | Persona-based "start here" guide — learners, teachers, and hobbyists each get a first-steps path into LCC.js |
| [docs/common-workflows.md](./docs/common-workflows.md) | Recurring operational workflows — when/why to run `npm run build`, manual vs. CI-automated deploy, the pre-push freshness guard |
| [docs/api.md](./docs/api.md) | Programmatic API — `assembleSource`, `executeBuffer`, return value shapes |
| [docs/oracle-setup.md](./docs/oracle-setup.md) | Oracle binary install, `.env` config, env knobs |
| [docs/status.md](./docs/status.md) | Current status, parity areas, known gaps |
| [docs/core-behavior-matrix.md](./docs/core-behavior-matrix.md) | Behavior contracts and oracle-vs-lccjs matrix |
| [docs/parity_deviations.md](./docs/parity_deviations.md) | Documented intentional deviations from oracle behavior |
| [docs/lccjs-unique-features.md](./docs/lccjs-unique-features.md) | The inverse of the parity doc — additive features LCC.js offers *beyond* OG LCC (`--explain`, `ilcc` debugger, browser playground, disassembler, LCC+, …) |
| [docs/lcc-isa.md](./docs/lcc-isa.md) | LCC instruction set summary (instructions, traps, directives, branch codes) |
| [docs/pitfalls.md](./docs/pitfalls.md) | Canonical catalog of LCC-assembly pitfalls — the surprises that bite first-timers (symptom → why → fix) |
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
