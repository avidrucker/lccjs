# Parity Deviations: LCC.js vs cuh63 6.3 OG LCC

Centralized record of every known behavioral difference between LCC.js and the
cuh63 6.3 `lcc` binary (the reference oracle). Each entry states the deviation,
its rationale, and points back to the source location.

Three categories are used:

- **OG BUG** — OG LCC is wrong (per spec or by inspection); LCC.js is intentionally correct.
- **LCC.js BUG** — LCC.js deviates from OG LCC; tracked as open bug, fix pending.
- **BY DESIGN** — Intentional divergence for a documented reason (safety, portability, etc.).

---

## OG BUG — OG LCC is wrong; LCC.js is correct

### 1. `ldr`/`str` no-comma syntax: negative `offset6` silently encodes as 0

| | cuh63 6.3 | LCC.js |
|---|---|---|
| `ldr r1 fp -1` | `6340` (offset=0) ✗ | `637f` (offset=-1) ✓ |
| `str r1 fp -1` | `7340` (offset=0) ✗ | `737f` (offset=-1) ✓ |
| `ldr r1, fp, -1` (comma) | `637f` ✓ | `637f` ✓ |

**Cause:** OG LCC's tokenizer splits `ldr r1 fp -1` on whitespace; the
`-1` token is not recognized as a signed integer in the no-comma parser path,
and the offset is silently set to 0. The comma path goes through a different
signed-integer validator and works correctly.

**LCC.js behavior:** `assembleLDR` / `assembleSTR` call `evaluateImmediate`
with the signed range `[-32, 31]` regardless of whether commas were used.
Result: all valid offsets (positive, zero, negative) encode correctly.

**Source:** `src/core/assembler.js:1797–1818` (`assembleLDR`, `assembleSTR`)

**Reference:** `public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/`
and `docs/cuh63-ldr-str-silent-miscompile-bug-report.md`

---

### 2. `mov` rejects negative immediates that `mvi` accepts (OB-008)

| | cuh63 6.3 | LCC.js |
|---|---|---|
| `mov r0, -1` | REJECT ✗ | ACCEPT ✓ |
| `mov r0, -256` | REJECT ✗ | ACCEPT ✓ |
| `mvi r0, -1` | ACCEPT ✓ | ACCEPT ✓ |

**Cause:** Per spec (`LCCInstructionSetSummary.pdf`), `mov dr, imm9` is a
pseudo-instruction that translates to `mvi dr, imm9`. The 9-bit signed field
covers −256..+255. OG LCC 6.3 rejects all negative `mov` immediates while
accepting the same values via `mvi` — an apparent regression in the `mov`
validation path.

**LCC.js behavior:** `assembleMOV` uses `evaluateImmediateNaive` (no range
check, relies on the 9-bit signed encoding). All values in the −256..+255
window assemble correctly. Values outside that window silently wrap — see
OB-001 below.

**Source:** `src/core/assembler.js:1880` (`assembleMOV`, `mov` → `mvi` path)

**GitHub issue:** [#40 OB-008](https://github.com/avidrucker/lccjs/issues/40)

**Reference:** `docs/cuh63-mov-immediate-bug-report.md`

---

### 3. `jmp` with missing register: OG LCC segfaults; LCC.js errors cleanly

| | cuh63 6.3 | LCC.js |
|---|---|---|
| `jmp` (no operand) | Segmentation fault ✗ | `Missing register` error ✓ |

**Cause:** OG LCC's `jmp` parser dereferences a null/uninitialized operand
pointer. LCC.js explicitly validates that the register operand is present and
returns a typed error.

**Source:** `src/core/assembler.js:1822–1828` (`assembleJMP`)

**Note:** Parity not possible here without replicating a crash — this
deviation is beneficial and preserved.

---

## LCC.js BUG — LCC.js deviates from OG LCC (fix pending)

### 4. `mov` out-of-spec immediates silently wrap (OB-001)

| | cuh63 6.3 | LCC.js |
|---|---|---|
| `mov r0, 256` | REJECT | silently wraps to 0 |
| `mov r0, -257` | REJECT | silently wraps |

**Cause:** `assembleMOV` calls `evaluateImmediateNaive` instead of
`evaluateImmediate(-256, 255, …)`. Values outside the 9-bit signed range are
accepted and silently wrapped by the 9-bit mask (`& 0x1FF`).

**Fix:** Route the `mov` → `mvi` path through `evaluateImmediate(-256, 255,
"mvi immediate")`, the same validator `mvi` already uses.

**Source:** `src/core/assembler.js:1860–1886` (`assembleMOV`, OB-001 `@todo`)

**GitHub issue:** [#31 OB-001](https://github.com/avidrucker/lccjs/issues/31)

---

### 5. Disassembler decodes `mvi` imm9 with 8-bit mask (OB-002)

| | Expected | LCC.js |
|---|---|---|
| `mvi r0, 0x1FF` | imm9 = -1 (signed 9-bit) | imm9 = 0xFF (8-bit mask applied) |

**Cause:** The disassembler applies `0xFF` where it should apply `0x1FF` to
extract the 9-bit immediate from the `mvi` encoding.

**Source:** `src/extra/disassembler.js:425` (OB-002 `@todo`)

**GitHub issue:** [#32 OB-002](https://github.com/avidrucker/lccjs/issues/32)

---

### 6. Multi-file `.a` input not implemented (OB-026)

OG LCC accepts multiple `.a` source files on the command line and assembles
them together. LCC.js only handles multiple `.o` files (linking path). If
multiple `.a` files are given, only the first is assembled.

**Source:** `src/core/lcc.js:85–99` (`main`, OB-026 `@todo`)

**GitHub issue:** [#59 OB-026](https://github.com/avidrucker/lccjs/issues/59)

---

## BY DESIGN — Intentional, documented divergences

### 7. Source line length limit: LCC.js enforces 300 chars

LCC.js rejects source lines longer than 300 raw characters. OG LCC's limit
is unresearched (see `core-behavior-matrix.md` Research entry). The 300-char
cap is a defensive guard and not a parity commitment — if oracle research
reveals a different limit, this should be updated.

**Source:** `src/core/assembler.js` (line-length validation)

**Reference:** `docs/core-behavior-matrix.md` ("Research: original LCC behavior
for the 300-character limit")

---

### 8. Linker exit code on error: both OG LCC and LCC.js exit 0

When the linker encounters an error (undefined external, duplicate global),
OG LCC prints the error message but exits with code 0 (confirmed by probe).
LCC.js matches this behavior: `Linker.error()` sets `errorFlag` and logs, but
does not throw; the calling chain returns early rather than aborting with a
non-zero exit.

This is parity-correct, not a deviation. Documented here because the
flag-based `error()` pattern is a recognized code smell (OB-003b) — any
future refactor to a thrown-exception model must preserve the exit-0 outcome
to maintain parity.

**Source:** `src/core/linker.js:370–373` (`error()`), `src/core/linker.js:175`
(OB-003b `@todo`)

**GitHub issues:** [#33 OB-003a](https://github.com/avidrucker/lccjs/issues/33),
[#34 OB-003b](https://github.com/avidrucker/lccjs/issues/34),
[#35 OB-003c](https://github.com/avidrucker/lccjs/issues/35)

---

## Changelog

| Date | Entry | Change |
|---|---|---|
| 2026-05-26 | Initial creation | Deviations 1–8 documented |
