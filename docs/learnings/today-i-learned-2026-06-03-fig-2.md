# Today I Learned — 2026-06-03 (FIG-2)

Session: assembler edge-case tests (#555), velocity row eligibility rule (#225),
and enrich.py retirement research (#288).

---

## 1. The assembler tokenizer silently drops trailing and double commas

When adding edge-case tests for malformed operands (#555), I discovered that the
tokenizer treats commas exactly like whitespace — as a token *delimiter*, not a
token in itself. It only pushes a token when `currentToken !== ''`, so:

- `add r0, r1,` (trailing comma) → tokens `["add", "r0", "r1"]`
- `add r0, , r1` (double comma) → tokens `["add", "r0", "r1"]`

Both silently produce the same three-token list. The "missing operand" error comes
from the *instruction handler* (`assembleADD` checking `operands[2] === undefined`),
not from any parse-phase complaint about the comma syntax.

This matters for debugging: a user who writes `add r0, r1,` expecting an error like
"unexpected trailing comma" gets a less obvious "Missing operand" message instead.
Worth knowing when writing tests that distinguish *syntactic* rejection from
*semantic* rejection.

**Corollary:** unary `+5` is silently valid. JavaScript's `parseInt("+5", 10)`
returns `5`, so the assembler accepts `add r0, r1, +5` without complaint. Only
*compound* signs (`+-5`, `--5`, `++5`) produce `NaN` and trigger "Bad number".

---

## 2. SQL VIEWs cover at most 3 of 18 enriched columns in this pipeline

When researching whether to retire `enrich.py` (#288), I found that the enrichment
splits cleanly into three tiers:

| Tier | What it needs | SQL VIEW? |
|---|---|---|
| Git churn (7 cols) | `git show --numstat` subprocess | ❌ |
| GitHub issue times (2 cols) | `gh api` subprocess | ❌ |
| Notes flags (5 regex cols) | `re.compile` patterns | ❌ (no built-in REGEXP) |
| Pure ratios (`c_ratio`, `h_ratio`, `span_min`) | Arithmetic on existing cols | ✅ |

Only the 3 pure-arithmetic columns can live in a VIEW. The other 15 require either
a subprocess or regex — capabilities that standard SQLite doesn't provide. A VIEW
is additive (nice-to-have for quick CLI queries), but it cannot replace `enrich.py`.

The general principle: before deciding to "move enrichment to SQL", enumerate
*each* enriched column's data dependencies. Subprocess calls and regex are the
immediate disqualifiers.

---

## What landed

| Artifact | Change |
|---|---|
| [#555](https://github.com/avidrucker/lccjs/issues/555) | 8 new assembler edge tests (218–225): compound signs, trailing/double commas, malformed offset6. |
| [#225](https://github.com/avidrucker/lccjs/issues/225) | Velocity row eligibility rule (tracker→no row, scope-spike→one row) in `docs/puzzle-velocity.md` + `puzzle-velocity` skill. |
| [#288](https://github.com/avidrucker/lccjs/issues/288) | Research verdict: keep `enrich.py`; findings at `docs/research/retire-enrich-py.md`. |
| [#570](https://github.com/avidrucker/lccjs/issues/570) | This TIL. |
