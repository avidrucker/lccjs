# What LCC.js Gives You Beyond the Original

_Audience: students/learners, assembly enthusiasts, educators/teachers · Tier: reference, public_

LCC.js is a from-scratch JavaScript reimplementation of Prof. Dos Reis's LCC
toolchain (the `cuh63` `lcc` binary, referred to here as **OG LCC**). It assembles,
links, and runs the same 16-bit educational ISA, and a large part of the project
is spent proving byte-for-byte parity with the original.

This document is the **inverse** of [`parity_deviations.md`](./parity_deviations.md).
That doc catalogs where the two toolchains *differ* in behavior (the diff). This
one catalogs what LCC.js *adds* — the teaching-oriented features OG LCC simply
does not have (the superset). If you are a student or newcomer asking *"why use
LCC.js instead of, or alongside, the original `lcc`?"*, this is the list.

> **For behavioral differences** (where output diverges from OG LCC and why), see
> [`docs/parity_deviations.md`](./parity_deviations.md).

Every feature below was verified against the code at the time of writing.
**Shipped** means you can use it today; **Planned** means it is designed but not
yet implemented — these are called out explicitly so nothing here is oversold.

---

## At a glance

| Feature | Status | Invoke with |
|---------|--------|-------------|
| [`--explain` error coaching](#1-explain-error-coaching) | Shipped (4 error classes) | `lcc.js --explain file.a` |
| ["Did you mean?" typo suggestions](#2-did-you-mean-typo-suggestions) | Shipped | automatic |
| [`ilcc` interactive stepping debugger](#3-ilcc--interactive-time-travel-debugger) | Shipped | `lcc.js -i file.a` |
| [Browser sandbox / Playground](#4-browser-sandbox--playground) | Shipped | the `/showcase/` site, no install |
| [Disassembler](#5-disassembler) | Shipped | `node src/extra/disassembler.js file.e` |
| [Linking explainer](#6-linking-explainer) | Shipped | `node src/extra/linkerStepsPrinter.js a.o b.o` |
| [Syntax-highlighting tooling](#7-syntax-highlighting-tooling) | Shipped | Lezer grammar + Shiki themes |
| [LCC+ extended toolchain](#8-lcc-extended-toolchain) | Shipped (no linker yet) | `node src/plus/lccplus.js file.ap` |
| [Programmatic in-memory API](#9-programmatic-in-memory-api) | Shipped | `require('...')` — see `docs/api.md` |
| [Zero runtime dependencies](#10-zero-runtime-dependencies) | Shipped | `npm install` (dev deps only) |
| [Oracle differential test suite](#11-oracle-differential-testing) | Shipped | `npm run test:oracle` |
| LCC+ linker (multi-module `.ap`) | **Planned** | — not yet implemented |

---

## 1. `--explain` error coaching

**What it is.** When assembly fails on a known encoding/range error, `--explain`
appends a short, student-friendly block that teaches the underlying concept and
shows a correct form — instead of just reporting the error. Off by default so
plain output stays oracle-faithful.

**How to invoke.** `node src/cli/lcc.js --explain file.a`

**Status.** **Shipped.** The catalog currently covers four encoding/range error
classes — `pcoffset9`, `pcoffset11`, `imm5`, and `imm9` ranges
(`src/utils/explanations.js`). More error classes are planned to be wired in over
time (#1098–#1101); only the four above produce an explanation today.

**Example.** An immediate that overflows the signed 5-bit field on `add` prints
the normal error, then:

```
explain: An immediate operand on a register/immediate instruction (e.g. add, sub) is
         encoded in a signed 5-bit field, so it must lie within -16..15. A literal
         outside that window cannot be encoded inline.
         Use a value in -16..15, or load the constant into a register first
         (e.g. `mvi r2, 1000`) and use the register-register form (e.g. `add r0, r1, r2`).
```

*Source: `src/cli/lcc.js` (`--explain` flag, wires `assembler.explainModeOn`),
`src/utils/explanations.js` (the catalog), #1096.*

---

## 2. "Did you mean?" typo suggestions

**What it is.** A Levenshtein-distance suggestion engine that catches near-miss
typos and appends `Did you mean 'X'?` to the error. It fires across three
surfaces: the assembler (mistyped directives, mnemonics, register names), the
linker (an undefined external reference that closely matches a known symbol), and
the interactive debugger (an unknown label in a memory command).

**How to invoke.** Automatic — no flag. Whenever an unknown token has a close
match within edit distance 2, the suggestion is added.

**Status.** **Shipped.**

**Example.** `add r0, r1, r3` where you meant `r2` after a typo, or a directive
slip:

```
.wrod 5
       ^ unknown directive '.wrod'. Did you mean '.word'?
```

*Source: `src/utils/suggest.js` (`levenshtein`, `suggestClosest`); wired in
`src/core/assembler.js`, `src/core/linker.js`, `src/interactive/iinterpreter.js`.*

---

## 3. `ilcc` — interactive time-travel debugger

**What it is.** A terminal stepping debugger for LCC programs with **bidirectional
stepping**: you can step forward *and* backward through execution. A per-instruction
snapshot log records the state delta (registers, flags, PC, IR, and memory writes),
so reverse-step is a true undo. The dashboard shows panes for registers, a code
context window around the PC, a memory dump, the stack, and program output, with
symbol-table resolution of labels to addresses.

**How to invoke.** `node src/cli/lcc.js -i file.a` (or a `.e` executable). The `-i`
flag delegates entirely to the interactive debugger. A standalone entry point also
exists: `node src/interactive/ilcc.js file.a`.

**Status.** **Shipped.** An efficient mode (`-e`) disables snapshotting for
lower-memory, forward-only runs.

*Source: `src/interactive/ilcc.js` (CLI), `src/interactive/iinterpreter.js`
(stepping + rendering), `src/core/debug/`.*

---

## 4. Browser sandbox / Playground

**What it is.** Assemble and run LCC programs **in the browser, with no install**.
The showcase site ships a CodeMirror 6 editor with LCC syntax highlighting, runs
assembly + execution off the main thread in a Web Worker (with pause-on-input for
interactive `sin`/stdin programs), and lets you switch among pre-baked color
themes — all client-side, no CDN round-trips.

**How to invoke.** Open the showcase/playground site (generated under
`docs/site/showcase/`). Locally: `npm run build && npm run serve:site`, then visit
`http://localhost:8080/showcase/`.

**Status.** **Shipped.** Built by webpack into `dist/lcc.bundle.js` and assembled
into the static site by `scripts/build-site.js`.

**Bonus — live docs.** `src/browser/lcc-injector.js` scans static HTML (including
reveal-md slides) for `<code class="language-lcc">` blocks, runs them client-side,
and injects the live output beneath each — so documentation and slides can carry
executable, self-updating examples.

*Source: `src/browser/api.js`, `src/browser/lcc-worker.js`,
`src/browser/lcc-injector.js`, `webpack.browser.config.js`, `scripts/build-site.js`.
See also [`docs/site-generation.md`](./site-generation.md) and
[`docs/showcase-local-dev.md`](./showcase-local-dev.md).*

---

## 5. Disassembler

**What it is.** A binary-to-assembly disassembler. It reads a `.e` executable,
traces execution order (handling `bl`/`ret` call/return), decodes each instruction,
and reconstructs readable `.a` source with address-relative labels.

**How to invoke.** `node src/extra/disassembler.js <input.e>`

**Status.** **Shipped** (unit-tested in `tests/new/disassembler.unit.spec.js`).

*Source: `src/extra/disassembler.js`.*

---

## 6. Linking explainer

**What it is.** A pedagogical step-by-step visualizer for the linker. It walks
through (1) parsing each object module and building its tables, (2) resolving
external references (`E`/`e`/`V` entries), (3) adjusting local references (`A`
entries), and (4) writing the final `.e` — annotating each machine word with the
labels defined or referenced there. It is a teaching tool, separate from the
production linker in the main pipeline.

**How to invoke.** `node src/extra/linkerStepsPrinter.js [-o out.e] <obj1.o> <obj2.o> ...`

**Status.** **Shipped.**

*Source: `src/extra/linkerStepsPrinter.js` (#1101).*

---

## 7. Syntax-highlighting tooling

**What it is.** First-class editor/highlighting support for the LCC dialect:

- A **Lezer grammar** (`src/lang-lcc/lcc.grammar`) drives CodeMirror 6 highlighting
  in the browser playground.
- **Shiki** pre-renders highlighted code for multiple color themes at build time
  (no client CDN), shared by the site and the playground.
- A TextMate grammar (`docs/lcc.tmLanguage.json`) is the stable, Shiki-ready
  source that the above are kept in sync with.

**How to invoke.** Used automatically by the playground/site. The grammar files
are the reusable artifacts for any editor integration.

**Status.** **Shipped.**

*Source: `src/lang-lcc/`, `docs/lcc.tmLanguage.json`, `scripts/build-site.js`.
CodeMirror 6 integration notes live in
[`docs/showcase-local-dev.md`](./showcase-local-dev.md).*

---

## 8. LCC+ extended toolchain

**What it is.** A second, parallel toolchain that extends the base ISA. LCC+
sources use the `.ap` extension (and `.ep` for executables) and must declare a
`.lccplus` directive. It adds pseudo-instructions OG LCC lacks — among them
`clear`, `sleep`, `nbain` (non-blocking input), `cursor`, `rand`/`srand`,
`millis`, and `resetc` — implemented as extended trap vectors. The assembler and
interpreter subclass the core ones, so base parity is preserved while the extras
layer on top.

**How to invoke.** `node src/plus/lccplus.js <file.ap>`

**Status.** **Shipped** — with one explicit gap. There is **no LCC+ linker**:
`src/plus/linkerplus.js` does not exist, so multi-module `.ap` linking is
**Planned, not shipped**. Single-module `.ap` programs assemble and run today.

*Source: `src/plus/lccplus.js`, `src/plus/assemblerplus.js`,
`src/plus/interpreterplus.js`, `src/plus/constants.js`. Full instruction addendum:
[`docs/lccplus-isa.md`](./lccplus-isa.md).*

---

## 9. Programmatic in-memory API

**What it is.** Pure, in-memory entry points that assemble and execute LCC code
**without touching the filesystem** and **without calling `process.exit`** —
they return data and throw typed errors instead. OG LCC is a CLI binary only;
LCC.js can be embedded as a library (this is exactly what powers the browser
playground).

**How to invoke.** `require` the core seams, e.g. `assembleSource(...)` and
`executeBuffer(...)`.

**Status.** **Shipped.** Full surface and return-value shapes in
[`docs/api.md`](./api.md).

*Source: `src/core/assembler.js`, `src/core/interpreter.js`, `src/utils/errors.js`.*

---

## 10. Zero runtime dependencies

**What it is.** The toolchain is pure Node.js with **no runtime dependencies** —
Node ≥18 is all you need to run any of it. `npm install` pulls only *dev* deps
(jest, webpack, etc.) for building and testing. Nothing to compile, no native
add-ons.

**How to invoke.** `npm install` once (for dev/test tooling), then run any CLI
entry point directly with `node`.

**Status.** **Shipped.**

*Source: `package.json` (`dependencies` is empty; only `devDependencies`).*

---

## 11. Oracle differential testing

**What it is.** A differential test suite that runs LCC.js and the original `lcc`
binary side by side and diffs their output across the textbook exercises — the
machinery behind the parity guarantees. This is an infrastructure feature of the
project rather than something a single program "uses," but it is a major reason
LCC.js can credibly claim faithfulness to the original.

**How to invoke.** `npm run test:oracle` (requires the oracle binary; the suite
auto-skips when `LCC_ORACLE` is unset). Setup in
[`docs/oracle-setup.md`](./oracle-setup.md).

**Status.** **Shipped.**

*Source: `tests/new/*.oracle.e2e.spec.js`.*

---

## Shipped vs. Planned — summary

**Shipped today:** `--explain` coaching (4 error classes), "Did you mean?"
suggestions, the `ilcc` time-travel debugger, the browser playground (+ live-docs
injector), the disassembler, the linking explainer, Lezer/Shiki highlighting
tooling, the LCC+ extended ISA (single-module), the programmatic in-memory API,
zero-runtime-dependency packaging, and the oracle differential test suite.

**Planned, not shipped:**

- **LCC+ linker** (`src/plus/linkerplus.js`) — multi-module `.ap` linking. The
  base toolchain links `.o` files; LCC+ does not yet have a linker.
- **`--explain` coverage** beyond the four encoding/range error classes — more
  error classes are designed to be wired in over time (#1098–#1101).

---

## See also

- [`docs/parity_deviations.md`](./parity_deviations.md) — the contrast doc: where
  LCC.js *behavior* diverges from OG LCC, and why (OG-BUG / LCC.js-BUG / BY-DESIGN).
- [`docs/web-feature-parity.md`](./web-feature-parity.md) — browser vs. CLI feature
  coverage.
- [`docs/who_lccjs_is_for.md`](./who_lccjs_is_for.md) — persona-based "start here"
  guide for learners, teachers, and hobbyists.
- [`docs/lccplus-isa.md`](./lccplus-isa.md) — the full LCC+ instruction addendum.
