# `sra r0, 0` — shift-by-zero ISA design question (#513)

**Date:** 2026-06-05  
**Issue:** [#513](https://github.com/avidrucker/lccjs/issues/513)  
**Status:** Decision pending — awaiting input from Prof. Dos Reis and Charlie

---

## What exists today

Both OG LCC and lccjs accept `sra r0, 0` without error. They agree on the encoding.

| Instruction | Count field | Machine word | Behavior |
|---|---|---|---|
| `sra r0` | 1 (default — no operand given) | `0xa023` | shifts right by 1 |
| `sra r0, 0` | 0 (explicit) | `0xa003` | **different word** — shifts right by 0 |
| `sra r0, 1` | 1 (explicit) | `0xa023` | same word as no-operand form |

This is **not a parity deviation** — oracle and lccjs produce identical output for all three forms (confirmed in #502).

---

## The open question

`sra r0, 0` is legal today in both tools. The question is whether it *should* be:

| Option | What lccjs does going forward | Oracle behavior | Repo change needed |
|---|---|---|---|
| **1 — Keep as-is** | Accepts `sra r0, 0`, encodes count=0 (distinct word) | Same (accepts it) | Nothing |
| **2 — Reject it** | Errors: "shift count must be 1–15" | Still accepts it (deliberate divergence, BY DESIGN) | Tighten lower bound of `evaluateImmediate` in `assembleSRA`: 0 → 1; add test |
| **3 — Normalize it** | Accepts it but silently encodes as count=1 (same word as `sra r0`) | Still encodes count=0 (deliberate divergence) | Add normalize path; add test |

Options 2 and 3 would make lccjs **intentionally stricter or smarter than OG LCC** — both tools currently agree, so either change creates a deliberate BY DESIGN deviation. LCC.js already has precedent for this pattern (e.g. §15 `.string` unknown escapes, §18 name.nnn fail-fast).

---

## Scope note

If option 2 or 3 is chosen, the same decision cascades to all five shift instructions — SRL, SLL, ROL, ROR — once #512 adds range-checking to those siblings. Currently only SRA has a range check at all; the others don't validate the count operand at the `evaluateImmediate` level.

---

## Open questions for Prof. Dos Reis / Charlie

1. **ISA intent:** Was count=0 for a shift instruction ever intended to be a valid encoding, or is it a silent gap in the original spec?
2. **Correct behavior:** Should assemblers accept `sra r0, 0` (Option 1), reject it (Option 2), or normalize it to 1 (Option 3)?
3. **All five siblings:** If count=0 is invalid, should that apply uniformly to SRA, SRL, SLL, ROL, ROR?

---

## References

- [#502](https://github.com/avidrucker/lccjs/issues/502) — probe confirming oracle/lccjs parity for all three forms
- [#512](https://github.com/avidrucker/lccjs/issues/512) — tracks inconsistency: SRA has range check, siblings don't
- [#51](https://github.com/avidrucker/lccjs/issues/51) — interpreter ct=0 corner (`>> -1` carry calculation)
