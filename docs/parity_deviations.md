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
LCC.js matches this behavior: `Linker.error()` logs to stderr and throws
`LinkerError`; `lcc.js:linkObjectFiles` catches `LinkerError` and returns
cleanly, so the process exits 0.

This is parity-correct, not a deviation. Documented here because the
exit-0 outcome must be preserved whenever the error-handling path is changed.

**Source:** `src/core/linker.js` (`error()`), `src/core/lcc.js:linkObjectFiles`
(catch block for `LinkerError`)

---

### 9. Empty / whitespace-only `.a`: LCC.js exits 0 with no artifacts; OG LCC exits 1 with header-only listings

| | cuh63 6.3 | LCC.js |
|---|---|---|
| stdout | `Starting assembly pass 1` then `Empty file` | `Starting assembly pass 1` only |
| exit code | `1` | `0` |
| `.lst` / `.bst` | written, header-only (82 bytes: version/date header + author line + trailing blank line) | **not** written |
| `.e` | not written | not written |

**Cause (LCC.js):** after Pass 1, when `locCtr === 0` (no instructions or data
emitted), `assembler.js` calls `abortAssembly('Empty file', 0)`. In CLI mode
`abortAssembly` routes to `fatalExit(message, 0)`, which calls `process.exit(0)`
and **discards the message** (the text only surfaces in test mode). Because the
abort short-circuits Pass 2 and the post-execution report step in `lcc.js`, no
`.lst`/`.bst`/`.e` files are generated.

**OG LCC behavior:** prints `Empty file`, exits `1`, but still emits header-only
`.lst` and `.bst` reports. (Note: the original #106 premise said "no error is
reported" — in fact OG LCC prints `Empty file` and exits non-zero; only the
listing files are header-only.)

**Why BY DESIGN:** the exit code `0` is a deliberate LCC.js choice — the
empty-input handling is annotated "custom LCC.js behavior in 12/2024" in the
sibling `.hex`/`.bin` paths (`assembler.js:833`, `:905`). LCC.js treats a
degenerate empty/whitespace source as a clean no-op rather than an error.

**Note for future parity work:** if strict CLI parity is ever required, two
sub-divergences remain — (a) exit code `0` vs `1` (flip the code at
`assembler.js:368`), and (b) LCC.js emits no header-only listings. Both are
currently intentional no-ops; neither is tracked as a bug.

**Source:** `src/core/assembler.js:367–369` (`abortAssembly('Empty file', 0)`),
`src/core/assembler.js:47–53` (`fatalExit` drops the message at code 0)

**Repro:** `node src/core/lcc.js empty.a` on a 0-byte or whitespace-only `.a`;
oracle `lcc empty1.a` for comparison.

---

## Pending parity investigations (stubs)

<!-- @todo #105:45m/DEV Characterize lccjs behavior for undefined-label `br` (oracle produces blank .e); replace this stub with a full deviation entry. See #105 -->

### (pending #105) Undefined-label `br` — oracle produces blank `.e`

---

## Changelog

| Date | Entry | Change |
|---|---|---|
| 2026-05-26 | Initial creation | Deviations 1–8 documented |
| 2026-05-27 | Pending stubs added | Reserved sections for #105, #106 (split from #29) |
| 2026-05-28 | Deviation 9 added | Characterized empty/whitespace `.a` (#106): LCC.js exit 0 + no artifacts vs OG exit 1 + header-only listings; classified BY DESIGN |
