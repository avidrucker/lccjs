# Research: `.string` escape-sequence parity — LCC.js vs OG LCC (#157)

**Agent:** APPLE · **Date:** 2026-05-30 · **Oracle:** cuh63 6.3 `lcc`

Investigates #157: "lccjs `.string` rejects `\n` escape that the oracle accepts
(`Missing terminating quote`)", split from the #150 sext probe. Resolves the
deferred research questions on which escape-handling path fails, why there are two
handlers, and the oracle's full supported escape set.

## TL;DR

- **The headline bug does NOT reproduce.** lccjs `.string "hi\n"` assembles and
  runs correctly (`\n` → newline). The exact repro from the issue produces no
  `Missing terminating quote`; it outputs `hi\n`. Shipped demos already depend on
  this (`demos/demoP.a` `"Hi\n"`, `demos/happy-path.a` `"A\nmulti-line\nstring"`),
  and a pre-existing test (#209 in `assembler.directives.integration.spec.js`)
  already pins escaped-newline assembly. The #150 report was a **misdiagnosis**.
- The escape-handling code has been correct since commit `8639411` (**2024-12-30**),
  ~17 months *before* #157 was filed (2026-05-29) — so this was never a regression
  that got fixed; the premise was wrong at filing time.
- **lccjs's supported escape set is identical to the oracle's special set:**
  `\n \t \r \\ \"` — byte-for-byte agreement (verified by `.e` diff).
- **The genuine — and opposite — divergence:** for any escape *outside* that set,
  **lccjs rejects** with a clear `Unknown escape sequence: \X` error, while the
  **oracle silently drops the backslash** and emits the following character
  literally (`\0`→`0`, `\a`→`a`, `\q`→`q`, `\x41`→`x41`, `\101`→`101`). The oracle
  supports **no** C numeric/control escapes (`\0 \a \b \f \v`, hex, octal) — it just
  passes the char through.
- **Verdict: BY DESIGN — no lccjs code change.** lccjs being *stricter* than the
  oracle is safer: a typo like `\m` becomes a loud error instead of silently
  swallowing the backslash. The deviation is documented (parity_deviations.md +
  core-behavior-matrix.md) rather than "fixed".

## Parity table

`.string "A<seq>B"`, assembled by both tools; behavior of `<seq>`:

| escape | lccjs | oracle | parity |
|--------|-------|--------|--------|
| `\n` | `0x0a` newline | `0x0a` newline | ✓ identical |
| `\t` | `0x09` tab | `0x09` tab | ✓ identical |
| `\r` | `0x0d` CR | `0x0d` CR | ✓ identical |
| `\\` | `0x5c` backslash | `0x5c` backslash | ✓ identical |
| `\"` | `0x22` quote | `0x22` quote | ✓ identical |
| `\0` | **error** `Unknown escape sequence: \0` | `'0'` (0x30) — backslash dropped | ✗ lccjs stricter |
| `\a` `\b` `\f` `\v` | **error** | `'a' 'b' 'f' 'v'` — backslash dropped | ✗ lccjs stricter |
| `\'` | **error** | `'\''` (0x27) — backslash dropped | ✗ lccjs stricter |
| `\x41` (hex) | **error** | `x41` literal — NOT 'A' | ✗ neither does C-hex |
| `\101` (octal) | **error** | `101` literal — NOT 'A' | ✗ neither does C-octal |
| `\q` (bogus) | **error** | `'q'` — backslash dropped | ✗ lccjs stricter |

Confirmed by byte-level `sout` hexdump: oracle `"[\0]"` → `5b 30 5d` (`[0]`),
`"[\a]"` → `5b 61 5d` (`[a]`), `"[\b]"` → `5b 62 5d` (`[b]`) — i.e. the literal
character, never the C control code. Probe:
`public_experiments/string_escape_parity/`.

## Answers to the issue's follow-up questions

1. **Which path fails — tokenizer (L902) or `parseString` (L967)?** Neither, for
   the supported set. The tokenizer's `escape` flag (assembler.js:938–943) correctly
   prevents an escaped `\"` from ending the string, so the closing quote is never
   lost — *that* is the mechanism the issue suspected was broken, but it works. For
   an *unsupported* escape, `parseString`'s `default` branch (assembler.js:992–994)
   is what raises `Unknown escape sequence` — never `Missing terminating quote`.
2. **Why two handlers?** They do different jobs and both are needed: the tokenizer
   `escape` flag is a **lexer** concern (don't split a token on an escaped
   delimiter); `parseString` is the **decoder** (escape → byte). They are not
   redundant. Minor cleanup opportunity: the tokenizer only needs to recognise `\`
   as "next char is literal for splitting purposes" — it does not need to know the
   escape *set*, and currently doesn't. No unification warranted.
3. **Oracle's full escape set:** special-cased = `\n \t \r \\ \"` only; everything
   else = drop-backslash passthrough. No octal/hex/`\0`/`\a` support.
4. **Position dependence?** None. `\n` works mid-string and immediately before the
   closing quote (the case the issue guessed "breaks"). Verified both.
5. **Do shipped demos rely on it?** Yes — `demos/demoP.a` and `demos/happy-path.a`
   use `\n` in `.string` and assemble/run fine, which alone disproves the headline.

## Outcome

- **No lccjs code change.** Headline non-reproducible; the real divergence
  (strict-reject vs silent-passthrough on unknown escapes) is classified BY DESIGN.
- Regression tests added to `tests/new/assembler.directives.integration.spec.js`
  (describe "Assembler .string escape sequences (#157)"): pin the supported set's
  bytes and the clear `Unknown escape sequence` error.
- `docs/core-behavior-matrix.md`: new `.string` escape row.
- `docs/parity_deviations.md`: new BY DESIGN entry (lccjs stricter on unknown
  escapes).
- This is a lccjs↔oracle *leniency* difference, not an oracle bug — **no report to
  Prof. Dos Reis** (silent backslash-drop is sloppy but not a miscompile).
