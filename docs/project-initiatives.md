# LCC.js — project initiatives

_Audience: contributors, AI agents · Tier: reference_

What LCC.js is, what's being built, where it's headed — and who benefits. This is the
**audience-facing** companion to two existing docs: the terse feature checklist in
[`../ROADMAP.md`](../ROADMAP.md) and the internal prioritization catalogue in
[`research/952-initiative-overview.md`](./research/952-initiative-overview.md). Per-feature
EPIC trackers are a separate effort (#1217). This file synthesizes; it does not duplicate them.

Every claim below links to a source (a `ROADMAP.md` section, an issue, a demo file, or code).
Items with no tracking artifact are marked **(aspirational)** rather than presented as planned work.

---

## Polished — the core toolchain

The base LCC toolchain is the mature, well-exercised core:

- **Assembler, linker, and interpreter** for the 16-bit educational ISA (`src/core/assembler.js`,
  `src/core/linker.js`, `src/core/interpreter.js`), plus the `-i` stepping debugger
  (`src/interactive/`). See `ROADMAP.md` → "What's already done → Core toolchain / Interactive debugger".
- **Oracle-parity testing** — a large suite differentially tests JS output against the reference
  `cuh63/lcc` binary, with deviations documented in `docs/parity_deviations.md`
  (`ROADMAP.md` → "Testing framework").
- Zero runtime dependencies (Node ≥18); see the top of [`../CLAUDE.md`](../CLAUDE.md).

## In progress

- **LCC+ (`lccplusjs`)** — the extended `.ap` toolchain (`src/plus/`): adds interactive/game
  pseudo-instructions (`clear`, `sleep`, `nbain`, `cursor`, `rand`/`srand`, `millis`, `resetc`),
  sound mnemonics, and a logging `boop` trap. Functional today; its **main missing piece is a
  multi-module linker** (`src/plus/linkerplus.js`, `ROADMAP.md` → "Planned → LCC+ multi-module linker").
- **Browser coding sandbox / playground** — extending the playground from a code *viewer* into a
  full edit-assemble-run loop in the browser, no install required (`ROADMAP.md` → "In progress →
  Playground code editor and runner", #677). Build pipeline: `docs/site-generation.md`.

## Future

- **A simple C compiler / decompiler to/from LCC assembly** — raise the level from hand-written
  assembly toward a small C front-end (and a decompiler back from LCC). **(aspirational —
  reporter-stated direction; not in `ROADMAP.md` and no tracking issue as of 2026-06-29.)**
- Tracked future games/tools live in `ROADMAP.md` → "Planned" (Tetris, Hangman, Tiny Roguelike,
  terminal-graphics utilities, the potato fuzzers #589/#590).

---

## Who it's for

### Fun (the playful surface)
A library of real, runnable LCC+ programs — Snake (`plusdemos/gameSnake.ap`), Flappy Bird
(`plusdemos/gameflappyBird.ap`), Tic-Tac-Toe (`plusdemos/tictactoe.ap`), Rock-Paper-Scissors
(`plusdemos/rock-paper-scissors.ap`) — built on real-time **non-blocking input** (`nbain`,
e.g. `plusdemos/charPolling.ap`) and **sound mnemonics** (`docs/lccplus-isa.md` § Sounds;
`plusdemos/sounds.ap`). See `ROADMAP.md` → "Extensive demo and game library".

### Educators
- A **chapter-by-chapter curriculum** of worked examples — `textbook_demos/ch03-…` through
  `ch12-…` (assembly basics, the call stack, pointers, structures, arrays/strings, the OS
  interface, etc.); `ROADMAP.md` → "Extensive curriculum".
- **Syntax-highlighted code in slides** (`ROADMAP.md` → "Code highlighting in slides"), with a
  slide-authoring guide (#695) and runnable-in-slide execution under research (#693).
- The browser playground (above) offers a **zero-install path** for students.

*(Charlie has acted as a design reviewer on the project; any specific classroom-adoption claim is
aspirational unless sourced.)*

### Hobbyists
- **Zero runtime dependencies** — Node ≥18 runs the whole toolchain (`../CLAUDE.md`).
- **Runs in the browser** via the playground — try LCC without installing anything.
- An **approachable 16-bit ISA** and a readable, demo-rich codebase — a clear on-ramp from
  reading demos → modifying games → writing your own `.ap` programs.

---

*Refresh this file as initiatives change tiers. Sources of truth it summarizes:
[`../ROADMAP.md`](../ROADMAP.md) (feature status), [`research/952-initiative-overview.md`](./research/952-initiative-overview.md)
(prioritization), and the per-feature EPIC trackers (#1217).*
