# Oracle Setup

The `*.oracle.e2e.spec.js` suites (and `npm run test:oracle`) drive the
original LCC ("the oracle") and diff its output against LCC.js. They are
skipped if the oracle is not configured, so you can run `npm test` without
this setup; only the oracle suites need it.

## Installation steps

**1. Obtain the LCC package** from Prof. Anthony Dos Reis. The canonical
distribution is the `cuh` zip (e.g. `cuh63.zip`, the "Computing Unsaturated
Hex" 6.3 edition) that ships alongside his textbook. The package contains
prebuilt `lcc`, `linker`, `sim`, etc. binaries for Windows, Linux,
Raspberry Pi, pre-m1 Mac (top-level), and Apple Silicon Mac (`macm/`).

**2. Install it to a folder of your choice.** Per the package's
`0READFIRST.txt`, no system install is required — just unzip and use the
files in place. On Linux:

```bash
mkdir -p ~/Documents/Study/Assembly/cuh63
unzip ~/Downloads/cuh63.zip -d ~/Documents/Study/Assembly/cuh63
cd ~/Documents/Study/Assembly/cuh63
cp lnx/* .              # overlay the Linux binaries on the pre-m1 Mac ones
chmod 755 lcc linker sim b basic comment h2b hexbin micro o optimal r register s see stack tiny
./lcc                   # sanity-check; should print "Usage: lcc <infile>"
```

On Apple Silicon Mac, use `cp macm/* .` instead. On Raspberry Pi,
`cp rasp/* .`. On Windows and pre-m1 Mac, no copy is needed.

**3. Point LCC.js at the binary.** Copy `.env.example` to `.env` and set
`LCC_ORACLE` to the absolute path of the `lcc` binary you just installed:

```bash
cp .env.example .env
# then edit .env so LCC_ORACLE points at e.g. /home/you/.../cuh63/lcc
```

`.env` is gitignored; `.env.example` is the checked-in template.

> **Note for worktree users:** If you start work via `npm run claim`, `.env` is automatically copied from the repo root into the worktree — no manual copy needed. Make sure `.env` is configured at the repo root once (this step) and every subsequent `claim` inherits it.

**4. Run the oracle suites:**

```bash
npm run test:oracle
```

## Environment knobs

These variables go in `.env` (see `.env.example` for the full template):

| Variable | Default | Purpose |
|----------|---------|---------|
| `LCC_ORACLE` | _(required)_ | Absolute path to the oracle `lcc` binary |
| `LCC_TIMEOUT_MS` | `20000` | Per-oracle-invocation timeout (ms) |
| `GOLDEN_AUTO_UPDATE` | off | Set to `1` to refresh golden caches when oracle output legitimately changes |
| `KEEP_ORACLE_TMP` | off | Set to `1` to keep temp files after each oracle run (debugging) |
| `DEBUG_ORACLE` | off | Set to `1` for verbose `runOracle.js` logging |

## Research tooling

The repo contains oracle-driven research tooling under `experiments/`.

Use it when behavior is ambiguous or not yet fully matched:

- `.org`
- `bp`
- `sext`
- debugger-related behavior
- other original-LCC drift questions

See:

- [experiments/README.md](../experiments/README.md)
- [experiments/results.md](../experiments/results.md)
- [experiments/debugger-results.md](../experiments/debugger-results.md)
