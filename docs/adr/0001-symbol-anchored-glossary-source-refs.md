---
status: accepted
---

# Symbol-anchored `Source:` references in the glossary

The per-module glossaries in `docs/glossary/` cite their backing code with a
`**Source:**` line. As of this decision those references use **stable symbol names**
(function / method / `const` / a distinctive landmark string) and **never line numbers**,
because line numbers drift on every refactor of the cited file and a glossary full of
stale `:195`-style citations silently misleads the newcomers the glossary exists to help.

## Context

`docs/glossary/assembler.md` carried **244** `assembler.js` line-number citations; a
measurement during #1357 found **~28%** already pointing at the wrong place (blank lines,
bare `}`, comments) — and that is only the *detectable* drift. `assembler.js` had grown to
2289 lines through repeated refactors since the glossary was written. Line-number
references are write-once, rot-forever: any manual re-verification pass is stale by the
next PR. (Parent: #1354 / topic A1; supersedes the line-number-fix approach of #1357.)

## Decision

A glossary `Source:` reference cites **only stable symbols**:

```markdown
**Source:** `assembler.js` — `assembleBR()`, `_instructionTable`
```

- **No line numbers** — not even as an "approximate hint". A `~L195` still rots and still
  reads as authoritative; banning them outright is what makes the convention durable.
- When the relevant code is **not inside a single named symbol** (a block within a long
  method, a bare top-level statement), cite the **nearest enclosing named symbol** plus a
  **distinctive grep landmark** — a unique string/regex from that code — so a reader can
  `grep` straight to it:

  ```markdown
  **Source:** `interpreter.js` — `step()`, grep `"unknown opcode"`
  ```
- A symbol that is genuinely hard to anchor (no enclosing name, no distinctive landmark)
  is a signal the underlying code wants decomposing — but that is the *code's* ticket, not
  the glossary's; cite the file + nearest landmark and move on.

## Considered options

- **Pure symbol, no line numbers** — *chosen.* Never drifts; fully greppable, so the
  glossary becomes self-verifiable (`grep -n assembleBR src/core/assembler.js`).
- **Symbol + approximate line hint (`~L195`)** — rejected: the line still rots and tempts
  readers/maintainers to trust it; reintroduces the failure mode by the back door.
- **Symbol + exact line (`:195`)** — rejected: this *is* the drift we are removing.

## Consequences

- **Existing entries must be re-anchored** from line numbers to symbols across
  `assembler.md`, `interpreter.md`, `linker.md`. That bulk work is downstream of this
  decision — tracked as chunks of #1354, not done here.
- The glossary `README.md` **entry convention is updated** in this same change to specify
  the symbol-anchored form (and `stats-analysis.md`, which cites notebooks, is unaffected).
- A **lightweight automated check** that every cited symbol still grep-matches its file is
  desirable; **delivered in #1362** as `scripts/check-glossary-symbols.js`
  (`npm run glossary:check`) plus `tests/new/glossary-source-refs.spec.js`, which fails the
  suite if any cited symbol or `grep` landmark no longer resolves in its source file(s).
- Navigation costs a `grep` instead of a direct line jump — accepted as the price of a
  reference that stays correct.
