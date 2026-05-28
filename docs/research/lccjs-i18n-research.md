# Research: Japanese / non-ASCII text support on the 16-bit LCC architecture

**Date:** 2026-05-28
**Repo:** lccjs (this repo)
**Trigger:** "Is there a ticket for non-English (e.g. Japanese) support, and what would the blockers be?"
**Status:** Research / scoping only. No code changed. No feature committed.

---

## TL;DR

There is **no ticket** for i18n / Japanese / Unicode support. A full search of `docs/`,
source comments, and all 113 GitHub issues (open + closed) found nothing about Japanese,
i18n, internationalization, or localization. The only adjacent items are:

- **OB-025 / issue #58** — *Test interpreter line-ending portability (CRLF)* (CLOSED).
  About CRLF, not languages.
- **`current_issues.md:104`** and **`docs/init_code_review.md:53`** — note a *test-coverage
  gap*: "unicode in `inputBuffer`" is untested. Flags an untested path, not a feature.
- **Issue #20** — "Clarify language in README" (CLOSED) — means README *wording*, not a
  human language.

The interesting finding: the **16-bit word is coincidentally a near-perfect fit** for the
common case, and the storage + output path *almost works by luck*. The real blockers are
on the **input** path, in **signedness**, in **supplementary-plane** characters, and in
**display width** — not in storage.

---

## The lucky part: 16 bits ≈ the Unicode BMP

Unicode's Basic Multilingual Plane is exactly `U+0000`–`U+FFFF` — one 16-bit word. Almost
all everyday Japanese lives in the BMP:

| Script              | Range            | Fits 1 word? |
|---------------------|------------------|--------------|
| Hiragana            | `U+3040`–`U+309F`| yes          |
| Katakana            | `U+30A0`–`U+30FF`| yes          |
| CJK Unified (kanji) | `U+4E00`–`U+9FFF`| yes          |

So LCC's existing "one character = one 16-bit word, null-terminated" string model can
represent あ or 漢 in a single word **with no scheme change**. That part is *not* a blocker.

---

## Output (SOUT) nearly works already

`executeSOUT` (`src/core/interpreter.js:1279`):

```js
let charCode = this.mem[address];            // a full 16-bit word
const char = String.fromCharCode(charCode);  // BMP code point → JS string
this.writeOutput(char);                       // process.stdout.write defaults to utf8
```

It does **not** mask to a byte — it passes the whole word to `String.fromCharCode`. If a
word held `0x3042`, SOUT would emit あ correctly, because Node re-encodes the JS string to
UTF-8 for the terminal. **BMP output is mostly a non-issue**, provided the code point ever
got into memory.

---

## Input is the real wall

`readCharFromStdin` (AIN, `src/core/interpreter.js:1356`) reads **one byte at a time**:

```js
let ainBuffer = Buffer.alloc(1);
readSync(fd, ainBuffer, 0, 1, null);    // exactly 1 byte
let ainChar = ainBuffer.toString('utf8');
```

A Japanese character is 3 UTF-8 bytes (あ = `E3 81 82`). Decoding *one* of those bytes as
UTF-8 yields the replacement char `�`. `readLineFromStdin` (`:1290`) has the same flaw — it
accumulates `input += char` where each `char` is a single byte decoded in isolation, so a
multibyte sequence is mangled **before** it ever reaches the storage step.

Fixing this means buffering bytes until a complete UTF-8 sequence is assembled, then
delivering a code point — i.e. **redefining what "read a character" means**. The `A` in
AIN/AOUT literally stands for ASCII; the trap contract assumes one char = one byte.

> Note: `executeSIN`'s storage line `this.mem[address] = input.charCodeAt(i)` (`:1389`)
> would actually be fine for BMP — `charCodeAt` returns the UTF-16 code unit — *if* it ever
> received a correct string. The bug is upstream of it.

---

## Signedness gotcha

LCC words are two's-complement 16-bit (−32768…32767). Many kanji sit **above** `0x7FFF`:

| Char | Code point | Unsigned | Signed (16-bit) |
|------|-----------|----------|-----------------|
| 漢   | `U+6F22`  | 28450    | +28450 (ok)     |
| 鬱   | `U+9B31`  | 39729    | **−25807**      |

The null-terminated walk still works (only `0x0000` terminates), but any **signed
comparison**, sign-extension on load, or range check silently misbehaves for the upper half
of the CJK block.

---

## Beyond the BMP breaks the one-word model

Rare kanji (CJK Ext-B `U+20000`+) and emoji live in supplementary planes `U+10000`+, which
**don't fit in 16 bits**. UTF-16 represents them as surrogate pairs — two code units — so
they'd consume two words, each an invalid standalone code point. The clean "one word = one
character" invariant collapses, and any code computing length by counting words is wrong.

---

## Display width — what would actually break the demos

Even with perfect I/O, Japanese glyphs are **East-Asian-Wide**: they occupy *two* terminal
columns. Grid demos (`plusdemos/tictactoe.ap`, `gameSnake`) do cursor math assuming
1 char = 1 column. Drop a あ into a board cell and every column past it shifts, box-drawing
misaligns, and cursor-addressed redraws corrupt. Monospaced layout is **VM-external** (it's
the terminal + font), but it's the most *visible* hurdle for anything non-linear.

---

## Source-level: the assembler and `.string`

For a program to *contain* Japanese (`.string "こんにちは"`), the assembler must read the
`.a` source as UTF-8 and emit **one word per code point**. JS iteration helps —
`for (const ch of str)` and the spread operator iterate code points correctly (5 for
こんにちは) — but anything using `.length` / `charCodeAt` / byte loops counts UTF-16 units
or bytes and emits the wrong word count, especially across surrogate pairs. (Assembler
`.string` handling not yet audited against this — open item.)

---

## Program logic assumes ASCII

Typical assembly idioms bake in ASCII: `c - '0'` for digits, `c & ~0x20` for upper-casing,
`'a' <= c <= 'z'` range tests, sorting by code-point order. None generalize — Japanese has
no case, kana/kanji ordering isn't code-point order, no contiguous "digit" trick. This is
**program-author territory**, not the VM's, but it's why "it renders" ≠ "it works."

---

## Blocker summary

| # | Hurdle                            | Layer            | Nature                          |
|---|-----------------------------------|------------------|---------------------------------|
| 1 | Byte-at-a-time input mangles UTF-8| VM (AIN/SIN)     | **Code fix** — buffer to codepoint |
| 2 | Signed words for upper-BMP kanji  | VM semantics     | Design decision (treat as unsigned chars?) |
| 3 | Supplementary plane > 16 bits     | encoding model   | Fundamental — needs 2-word scheme  |
| 4 | Double-width glyph layout          | terminal/font    | VM can't own; demos must adapt     |
| 5 | `.string` word-count vs surrogates| assembler        | Code fix — iterate code points     |
| 6 | ASCII arithmetic idioms            | program author   | Out of scope for the VM            |

**Bottom line:** storage and output are *accidentally* close to working because 16 bits ==
the BMP and SOUT already passes whole words through. The genuine VM-side blockers are input
decoding (#1) and signed-word semantics (#2); supplementary-plane support (#3) and
display width (#4) are deeper / external.

---

## Related

- [[plus_linker_planned]] — other planned toolchain work
- `docs/init_code_review.md:53` — original note of the untested-unicode gap
- `current_issues.md:104` — test-coverage gap entry
- GitHub issue #58 (OB-025, CLOSED) — CRLF portability, the nearest adjacent ticket
