# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

LCC.js is a JavaScript implementation of the LCC toolchain — assembler, linker, and interpreter for a 16-bit educational ISA. **No runtime dependencies**; Node ≥18 is all that's needed to run the tools. `npm install` only pulls dev deps (`jest`, `dotenv`, `@lezer/lr`, etc.).

## Commands

```bash
# First-time setup (run once after cloning)
npm install                                   # install dev deps (jest, dotenv, @lezer/lr, etc.)
npm run setup                                 # install git hooks (pre-commit + commit-msg + pre-push)

# Toolchain
node ./src/cli/lcc.js <infile> [options]   # assemble+run a .a, or run a .e directly, or link .o files
node ./src/core/assembler.js  <file>         # assemble only
node ./src/core/interpreter.js <file.e>      # interpret only
node ./src/core/linker.js m1.o m2.o          # link only
node ./src/plus/lccplus.js <file.ap>         # LCC+ pipeline (see "Two toolchains" below)

# Browser bundle
npm run build:browser                        # webpack → dist/lcc.bundle.js + dist/lcc-injector.js

# Showcase / Playground — local dev (verify CM6 features before deploy)
npm run build                                 # regenerate docs/site (build:browser + build:site)
npm run serve:site                            # serve the BUILT docs/site at http://localhost:8080/showcase/
# See docs/showcase-local-dev.md for the required pre-deploy verification checklist.
# Serve docs/site (the generated, deployed page). The legacy standalone source pages were removed in #1045 — /showcase/ is now generated solely by scripts/build-site.js.

# Tests
npm test                                      # primary suite (tests/new, --runInBand)
npm run test:all                              # full suite incl. slow tests
npm run test:oracle                           # oracle-parity suite (needs oracle binary; see below)
npm test -- --runTestsByPath tests/new/assembler.unit.spec.js   # run a single test file
```

Tests use `--runInBand` deliberately — the oracle/e2e suites shell out to a real binary and write temp files, so parallel workers would race. Keep new e2e tests serial-safe.

## Two toolchains: core vs plus

The repo ships **two parallel toolchains** and the file extension picks which one applies:

- **Core (LCC):** `.a` source → assembler → `.e` (executable) or `.o` (object); linker combines `.o` → `.e`; interpreter runs `.e`. Entry point `src/cli/lcc.js`.
- **Plus (LCC+):** `.ap` source → `.ep` executable. `src/plus/*plus.js` **subclass** the core assembler/interpreter to add extended pseudo-instructions (`clear`, `sleep`, `nbain`, `cursor`, `rand`/`srand`, `millis`, `resetc`) and require a `.lccplus` directive for valid output. Entry point `src/plus/lccplus.js`.

When changing core assembler/interpreter behavior, check whether the plus subclasses override the method you're touching (`handleDirective`, `writeOutputFile`, trap handlers in InterpreterPlus) — a core change can silently break LCC+ or be shadowed by it. `AssemblerPlus.handleInstruction` no longer exists as an override (#417): plus mnemonics are registered directly into `_instructionTable` in the constructor, so adding a core mnemonic to the table cannot be shadowed.

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

This repo runs a **Puzzle-Driven Development** discipline with multiple agents working concurrently. Before doing any puzzle work, **read [`docs/claude_workflow.md`](./docs/claude_workflow.md)** — it owns the full protocol (the per-puzzle phases, worktree claim mechanics, the close sequence, tool-failure discipline, and the PDD-scan `at_todo` trap). The skill inventory at **[`docs/skills.md`](./docs/skills.md)** lists every Claude Code skill used in this project, what it does, and when to invoke it. The essentials for orientation:

- **Worktree-per-task is the expected default**, even for small/docs edits — multiple agents touch this repo at once. Run `git worktree list` first to avoid clobbering, and close trunk-based via `git push origin HEAD:main`.
- `npm run claim` stakes a worktree under a per-session agent identity; `npm run puzzle:status` shows what's safe to grab; `npm run puzzles` runs the `pdd` scan.
- **Correcting an issue description:** redline, don't rewrite — `~~strikethrough~~` the error in place, add a `SEE COMMENTS FOR CORRECTIONS` banner, and post the fix as a comment. The `yegor-tickets` skill owns the convention; see `docs/claude_workflow.md` "While continuing" (#300).

## Git identity

Inherited from the parent `~/Documents/Study/CLAUDE.md`: GitHub `avidrucker`, commit email `6962664+avidrucker@users.noreply.github.com`. Don't override per-repo.

## Collaborators

When a ticket/comment names a collaborator, use their real GitHub handle so the @-mention actually notifies — **`@charlie` is inert; the handle is `@ItBeCharlie`**:

- **Charlie** = `@ItBeCharlie` — architecture/design reviewer (often asked to sign off before implementation)
- **Prof. Dos Reis** — oracle author. ⚠ GitHub handle currently **unverified** (both `GDR400` and `@profavc` return 404); do not @-mention until confirmed.

Full registry (source of truth): the `CONTRIBUTOR_*` block in [`.env.example`](./.env.example). Validate any handle before @-mentioning with `gh api /users/<handle>` (404 = won't notify).

## Commit conventions

Format: `type(optional-scope): description` — [Conventional Commits](https://www.conventionalcommits.org/).

**Two rules that are easy to get wrong:**

1. **Never use an issue number as a scope.** Put `#N` in the description body or a `Closes #N` footer instead.
   ```
   # Wrong
   research(#208): graduate @todo — de-confound velocity drift
   # Right
   research: graduate @todo — de-confound velocity drift (#208)
   ```
2. **One type per commit.** `test+fix:` is invalid — pick the dominant type or split the commit.

### Type vocabulary

Standard types (per spec): `feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ops`, `chore`

Project extensions (use exactly as shown):

| Type | When to use |
|------|-------------|
| `research` | Research-only deliverable (no production code change) |
| `data` | Data re-runs, CSV updates, notebook analysis |
| `stats` | Statistical analysis output commits |
| `pdd` | Adding or removing `@todo`/`@inprogress` puzzle markers at code sites |

### Scope vocabulary

Scopes are optional but should come from this list when used:

| Scope | Meaning |
|-------|---------|
| `velocity` | `puzzle-velocity.csv` row logging |
| `pm` | Project-management / issue-filing cycles |
| `pdd` | PDD marker edits (when `pdd` type doesn't apply) |
| `todos` | `TODOS.md` housekeeping |
| `learnings` | Entries in `docs/learnings/` |
| `parity` | Oracle parity deviation docs |
| `workflow` | `claude_workflow.md` edits |
| `glossary` | `docs/glossary/` changes |
| `claim` / `close` / `scripts` | Toolchain script changes |

Code-area scopes (assembler, interpreter, linker, plus, jest, cli, debug, etc.) are always valid — they map directly to source modules.

### Git hooks

`npm run setup` (run once after cloning) installs three hooks via symlink from `scripts/git-hooks/`:

| Hook | Enforces | Bypass |
|------|----------|--------|
| `pre-commit` | No code changes (`src/`, `scripts/`, `tests/`) staged directly on `main` | `git commit --no-verify` |
| `commit-msg` | No issue-ID scopes; no compound types | `git commit --no-verify` |
| `pre-push` | PDD puzzle scan; no conflict markers; no push mid-rebase | `git push --no-verify` |

Both hooks are in `scripts/git-hooks/` and stay current as the branch evolves (symlink, not a copy).

## Gotchas

Non-obvious foot-guns that are not obvious from the code: **[`docs/project-gotchas.md`](./docs/project-gotchas.md)**. For ISA-level assembly surprises see [`docs/pitfalls.md`](./docs/pitfalls.md); for workflow/tooling preferences see [`docs/do-this-not-that.md`](./docs/do-this-not-that.md); for working-practice patterns and anti-patterns (how to approach agent work) see [`docs/agent-patterns.md`](./docs/agent-patterns.md).

For any **showcase / playground** change, CM6 features must be verified in a browser against the *built* page before deploy — see **[`docs/showcase-local-dev.md`](./docs/showcase-local-dev.md)** (`npm run build && npm run serve:site`). Source reading is not sufficient (#985, #986, #987). For the high-level story of how the Pages site + playground are generated (build pipeline, what's committed vs generated, the dev loop), see **[`docs/site-generation.md`](./docs/site-generation.md)**.
