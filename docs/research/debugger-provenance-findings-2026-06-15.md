# Debugger provenance — review findings (2026-06-15)

Companion to `docs/debugger-command-registry.md` (the tables). This doc records **how we know** what
we know — the investigation, the corrections we had to make, and the fact/inference methodology — so
the registry's claims are auditable rather than asserted. Filed for #1341.

## How this started

A readiness review of #1089 ("ilcc `sb`/`b` alias for `{-N}`") found the proposed alias unsafe:
`sb` is swallowed by the existing `s{anchor}` dispatch branch, and `b` is the **breakpoint** letter in
the original LCC debugger. Pulling that thread revealed the real problem was structural — no single
source of truth for the debugger command/flag surface, drift from the Oracle, and multiple in-flight
tickets choosing conflicting letters with no coordination.

## Corrections we had to make (fact beat first-draft inference)

This investigation is a case study in separating objective reality from plausible inference. Three of
our own early claims were **wrong** and were corrected against sources:

1. **"lccjs has one debugger (ILCC)."** → **WRONG.** lccjs has **two** mutually-exclusive debuggers:
   the `-d` oracle-parity debugger (`src/core/interpreter.js` `debug()`, ~L938) and the `-i` ILCC TUI
   (`src/interactive/iinterpreter.js` `runInteractive()`). `src/cli/lcc.js:83` short-circuits to
   interactive, so they never co-run. The OG-style breakpoint/`g` commands the registry "reserves"
   already exist — on the `-d` surface.

2. **"`-i` is double-booked."** → **IMPRECISE.** `-i` (bare) = interactive in `lcc.js:383`; `-i<N>`
   = instruction cap in `ilcc.js:161`; they are different syntactic forms in different parsers and
   never collide. The real defect is **inconsistent cap naming** (`-i<N>` vs `lcc.js`'s `--max-steps`,
   absent from `ilcc.js`).

3. **Provenance labels ("Charlie-derived", "lccjs-original") were inferences.** The repo only *cites*
   `Reference: ItBeCharlie/interactive_lccjs` (`iinterpreter.js:11`); it does not state derivation
   direction. We resolved these by **asking the author** and **reading Charlie's source**, not by
   guessing.

We also corrected a terminology hazard: calling lccjs's `-d` debugger "the oracle debugger" is
confusing because **Oracle = the real Dos Reis binary**. lccjs's is the oracle-*parity* imitation. The
registry now reserves "Oracle/OG" for the real binary exclusively.

## Fact / inference methodology

Each claim was tagged by its evidential basis and resolved by its fastest reliable source:

| Source class | Used for | Examples |
|---|---|---|
| **Codebase (definitive)** | what lccjs actually does | two-debugger architecture; `debug()` command handlers; `-i`/`--max-steps` wiring; ILCC command set |
| **OG docs (`lcc.txt`)** | what the Oracle specifies | OG debugger commands (`b/c/g/z/w/i/m/r/s/t`) + OG CLI flags; OG has no `-c` flag, no reverse-step |
| **Charlie's source** | what Charlie's tool has | TUI command set; `-i<N>`=cap; interactive-by-default + `-n`; **no** breakpoints/`g`/`z`/`w`/`c`-change; no `--max-steps` |
| **Author (direct answer)** | lineage / origination | ILCC derived from Charlie's; reverse-step (`{-N}`) was Charlie's first |
| **Empirical probe (pending)** | Oracle runtime behavior | does the real Oracle's `c <loc> val` work or crash? → W7 |

**Out of scope (user decision):** web_ilcc — a browser GUI with no command letters / CLI debug flags;
not a parity target for this work.

## Confirmed provenance (summary; full tables in the registry doc)

- **`-i` TUI surface** (`{N}/{-N}/0/a/m/s/c{N}/l`): **Charlie-origin**; lccjs is a near-identical port.
  Reverse-step `{-N}` is Charlie's. lccjs adds small enhancements (`a{label}` symbol resolution, #1041).
- **`-d` oracle surface** (`b/g/m/r/s/i` + Enter): **OG-origin**; lccjs imitates the Oracle.
- **Flags:** `-e/-c/-n/-i<N>/-x/-f/-m/-r/-t` Charlie-origin; `-d/-f/-m/-r/-t/-x/-l/-o/-h` shared with OG;
  `-i`(interactive), `--max-steps`, `-v/--explain/--test` **lccjs-original**.

## Defects found (evidence-cited)

1. **lccjs `-d` `debug()` advertises `c <loc> val` and `integer n` in its `h` help (interpreter.js
   ~L1016-1018) but implements neither** — both fall through to a single step. (lccjs defect.)
2. **lccjs `-d` lacks the Oracle's `z`/`w`/`t` commands** — OG-parity gap.
3. **Inconsistent instruction-cap flag** (`-i<N>` vs `--max-steps`) across entry points.
4. **The Oracle's own `c <loc> val` is reportedly crash-prone** (`experiments/debugger-results.md`) —
   **unverified hearsay**; W7 will probe the real binary, and W8 files an upstream report to Prof Dos
   Reis only if the probe confirms an Oracle defect.

## Follow-up work (see plan / tickets)

#1341 registry doc (this) · #1342 data-driven registry + guards · #1343 coverage tracker ·
#1089 reframed · #1088 coordinated · W2 `-d` verify+document · W3 the advertised-but-unimplemented
bugs · W4 `-i`/`--max-steps`/`-ms` consistency + WRITER docs · W6 doc placement · W7 Oracle `c` probe ·
W8 (conditional) upstream report.
