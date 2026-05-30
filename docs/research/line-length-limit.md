# Research: source-line length limit — LCC.js vs OG LCC (#244)

**Agent:** APPLE · **Date:** 2026-05-30 · **Oracle:** cuh63 6.3 `lcc`
(`/home/avi/Documents/Study/Assembly/cuh63/lcc`)

Probe of issue #244: does the original LCC have a 300-char (or any) source-line
length limit, and what does it count? Resolves the deferred research note in
`src/core/assembler.js` (`validateLineLength`) and the `test.skip` placeholder in
`tests/new/research.behavior.spec.js`.

## TL;DR

- **OG LCC has NO explicit line-length limit and no "line too long" diagnostic.**
  It reads each source line into a **fixed buffer that holds 298 characters**.
  A line of length ≥ 299 is **silently split** at the buffer boundary, and the
  overflow tail is **fed back into the assembler as if it were the next source
  line(s)**.
- That silent split is a **latent bug in OG LCC** (see "OG bug" below): depending
  on what the overflow happens to parse as, the assemble either (a) **succeeds with
  exit 0 and writes a `.e`** while injecting a bogus label into the symbol table,
  or (b) fails with a **misleading, content-dependent error** like `Duplicate
  label` that never mentions line length.
- **LCC.js enforces an explicit 300-char raw-line cap** (`validateLineLength`,
  `src/core/assembler.js:238`) that aborts with a clear message
  (`Line exceeds maximum length of 300 characters`, exit 1, no `.e`).
- **Verdict:** LCC.js's limit is a **BY DESIGN** deviation that is *safer* than the
  oracle — it converts silent corruption into a fail-fast diagnostic. No change to
  LCC.js is warranted. The oracle's silent-split behavior is an **OG BUG** and is
  the (conditional) candidate for a report to Prof. Dos Reis.

## What "counts" toward the length

Raw bytes of the line, **including the comment and leading/trailing whitespace**,
*before* any comment-stripping or tokenization — for **both** toolchains:

- LCC.js counts `line.length` on the raw line (pre-strip). Confirmed by code.
- OG LCC's buffer splits comment-only lines (`; aaaa…`) and whitespace-padded
  instruction lines (`        …halt`) at the same 298-char boundary as code,
  proving the buffer fills with raw bytes regardless of token content.

So LCC.js's choice to **count the raw line including comments is correct and
matches the oracle's buffer semantics.** The provisional code comment in
`validateLineLength` ("the 300-character limit includes comments until the
original LCC behavior is researched") can be resolved: counting raw incl. comments
is right.

## Evidence

Probe harness: `/tmp/apple-244/*.js` (drives both `lcc` and `src/core/assembler.js`
over generated `.a` inputs; oracle run in a tmp dir with `name.nnn` present to
avoid the author prompt).

### Buffer boundary = 298 chars

A comment line of length `N` followed by `.bad` (an always-erroring directive).
The line number OG LCC attributes to `.bad` jumps from 2 → 3 exactly at `N = 299`,
i.e. the comment line started occupying two logical lines:

```
N=298 → ".bad" reported on line 2   (line fits in one buffer)
N=299 → ".bad" reported on line 3   (line split into two)
```

### Overflow is parsed as source code, not discarded

- **Single** 400-char comment line → **exit 0**, `.e` written. The 102-char
  overflow tail (`aaaa…`) is silently swallowed as a **label definition** in the
  symbol table — silent corruption, no diagnostic.
- **Two** identical 400-char comment lines → **`Duplicate label`** error (each
  overflow tail produces the same `aaaa…` label → collision). The error names a
  spurious line number and never mentions line length.

### Non-monotonic, content-dependent failure

Whitespace-padded `halt` lines fail at length 900 but **pass** at 1000; comment
lines pass through ~835 then fail near 897. Whether a too-long line errors —
and with what message — depends on where the split lands and what the tail tokens
collide with. This is the signature of a fixed buffer with no bounds check, not a
designed limit.

### LCC.js, same inputs

| line length | OG LCC | LCC.js |
|---|---|---|
| ≤ 298 | assembles | assembles |
| 299–300 | **silently split** (tail → bogus label, often exit 0 + `.e`) | assembles |
| > 300 | silently split / spurious error | **aborts:** `Line exceeds maximum length of 300 characters`, exit 1, no `.e` |

Note the 298-vs-300 off-by-two: LCC.js *accepts* 299–300-char lines that the
oracle would split. That favors LCC.js (it assembles them correctly as one line),
so it is not a defect. Tightening LCC.js to 298 for exact buffer-parity is
**optional and not recommended** — 300 is a clean round number and the divergence
is immaterial for real programs.

## Verdicts (per the #244 framing)

1. **LCC.js 300-char raw-line cap → BY DESIGN (intentional, safer).** Not a bug.
   Keep as-is. Documented in `docs/parity_deviations.md`.
2. **OG LCC silent line-splitting (no length guard, overflow parsed as code) →
   OG BUG.** Latent; requires pathological lines > 298 chars, but the exit-0 +
   `.e`-written silent-corruption path is the dangerous kind (no diagnostic).
   This is the **conditional** candidate for a bug report to Prof. Dos Reis
   (see #244 scope note). Low severity; not yet filed pending a go/no-go.
3. **"What does it count" → resolved:** raw bytes incl. comment/whitespace, for
   both. LCC.js's behavior is correct.

## Follow-ups

- `validateLineLength` code comment updated to point here (the open question is
  answered; the 300/raw-incl-comment choice is intentional).
- `tests/new/research.behavior.spec.js` line-length `test.skip` replaced with an
  active regression test pinning the LCC.js contract.
- Bug report to Prof. Dos Reis on the OG silent-split bug: **deferred, conditional**
  — decision tracked in #244.
