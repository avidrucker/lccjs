# Research: label-length limit — LCC.js vs OG LCC (#245)

**Agent:** APPLE · **Date:** 2026-05-30 · **Oracle:** cuh63 6.3 `lcc`
(`/home/avi/Documents/Study/Assembly/cuh63/lcc`)

Probe of issue #245: does the original LCC enforce a label-length cap that is
**independent** of the source-line length limit? Resolves the deferred research
note in `src/core/assembler.js` (`isValidLabel`, `src/core/assembler.js:608`) and
the `test.skip` placeholder in `tests/new/research.behavior.spec.js`. Companion to
the line-length probe ([`line-length-limit.md`](./line-length-limit.md), #244),
whose 298-char buffer finding is the confound this probe had to isolate.

## TL;DR

- **OG LCC has NO independent label-length cap.** A label is validated by
  character class only; it is bounded *solely* by how much fits on a source line
  before the 298-char read buffer splits it (the #244 limit). Labels up to
  **292 chars** (the most that fits with `: halt` on a 298-char line, inside the
  buffer) assemble cleanly with exit 0 and a written `.e`.
- **OG LCC has NO label-significance / truncation limit either.** Two labels
  sharing a 200-char common prefix and differing only in their **201st** character
  remain **distinct** — no spurious `Duplicate label` — proving the assembler keeps
  the *full* label, not a truncated-to-K-chars prefix. A 200-char label also
  round-trips correctly as a real **branch target** (`br <label>`), so long labels
  are genuinely usable, not accepted-and-ignored.
- **LCC.js matches this exactly.** `isValidLabel` (`src/core/assembler.js:608`)
  checks character class and placement only — no length rule — and labels are
  bounded only by the 300-char line cap (`validateLineLength`). Same inputs, same
  results, byte-for-byte agreement across the entire tested range.
- **Verdict: PARITY — no separate label-length check is warranted in LCC.js.**
  "Labels are bounded only by line length" is the correct, intentional design and
  is shared by both toolchains. This is **not** a deviation and produces **no** bug
  report to Prof. Dos Reis.

## Why this needed isolating (the confound)

A longer label makes a longer line, so a naive "grow the label until it fails"
test cannot tell a *label* cap apart from the *line* cap. Two controls separate
them:

1. **Keep the line short.** Put the label on an otherwise-minimal line
   (`<label>: halt`, so line length = labelLen + 6) and grow only the label,
   staying **inside** the 298-char buffer (#244). Any failure there would be a
   genuine label rule, since the line never reaches the buffer limit. → No failure
   observed up to labelLen 292 (line length 298).
2. **Collision test for hidden truncation.** A length cap can hide as *silent
   truncation to K significant chars* rather than an outright rejection. Two
   labels with a long shared prefix differing only in the final char collapse to
   one symbol (→ `Duplicate label`) iff the assembler truncates to K < prefix. →
   No collision at any prefix length up to 250, on either toolchain.

## Evidence

Probe harness: `/tmp/apple-245/{probe,significance}.js` (drives both `lcc` and
`src/core/assembler.js`; oracle run in a tmp dir with `name.nnn` present to avoid
the author prompt).

### No length cap (label on a short line, within the #244 buffer)

`"<a×n>: halt"`, n = label length, line length = n + 6:

| label len n | line len | oracle (exit/.e) | lcc.js |
|---|---|---|---|
| 1, 4, 8, 16 | ≤22 | 0 / yes | OK |
| 31, 32, 33 | 37–39 | 0 / yes | OK |
| 63, 64, 65 | 69–71 | 0 / yes | OK |
| 127, 128 | 133–134 | 0 / yes | OK |
| 255, 256 | 261–262 | 0 / yes | OK |
| 292 | 298 | 0 / yes | OK |

No rejection at any of the "usual suspect" cap values (32, 63, 64, 127, 255, 256).
First non-zero oracle exit: **none** in range. First lcc.js throw: **none**.

### No significance / truncation limit (prefix-collision)

`"<a×P>b: .word 1"` / `"<a×P>c: .word 2"` — identical first P chars, differ in the
last:

| common prefix P | label len | oracle | lcc.js |
|---|---|---|---|
| 4 … 30 | 5–31 | clean (no dup) | OK |
| 31, 32 | 32, 33 | clean (no dup) | OK |
| 63, 64 | 64, 65 | clean (no dup) | OK |
| 100, 200, 250 | 101–251 | clean (no dup) | OK |

No `Duplicate label` at any prefix length → labels are stored in full, not
truncated. (A 31- or 32-significant-char limit, the most plausible candidate, is
ruled out.)

### Long label is genuinely usable

`br LLL…(×200)` / `LLL…(×200): halt` → oracle exit 0 with `.e` written, lcc.js OK.
The symbol table resolves the full 200-char label to the right address.

## Relationship to #244 and #243

- The only bound on labels is the line-length / 298-char buffer behavior already
  characterized in #244. Beyond that boundary the same silent-split corruption
  documented there applies; there is nothing label-*specific* added on top.
- Supersedes the label-length portion of #243's "assess the skipped research
  suite" question: the placeholder becomes resolved assertions (see below), not an
  icebox ticket.

## Outcome

- **No code change to LCC.js.** Parity confirmed; the absence of a label-length
  cap is by design and matches the oracle.
- **No bug report to Prof. Dos Reis** — the label behavior itself is consistent
  and reasonable on both sides. (The separately-documented #244 silent-split is the
  only conditional report candidate, and it is a line-buffer issue, not a label
  one.)
- The `test.skip` placeholder is replaced with active assertions pinning the
  no-label-cap behavior of LCC.js.
