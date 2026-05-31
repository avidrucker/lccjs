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

### 1. no-comma syntax: negative `offset6` silently encodes as 0 (whole `baser,offset6` family)

| | cuh63 6.3 | LCC.js |
|---|---|---|
| `ldr r1 fp -1` | `6340` (offset=0) ✗ | `637f` (offset=-1) ✓ |
| `str r1 fp -1` | `7340` (offset=0) ✗ | `737f` (offset=-1) ✓ |
| `jmp r1 -1` | `c040` (offset=0) ✗ | `c07f` (offset=-1) ✓ |
| `blr r1 -1` / `jsrr r1 -1` | `4040` (offset=0) ✗ | `407f` (offset=-1) ✓ |
| comma forms (`ldr r1, fp, -1` …) | correct ✓ | correct ✓ |

**Scope (broadened by probe #257):** this is NOT limited to `ldr`/`str` — it
affects **every** instruction taking a `baser, offset6` operand pair: `ldr`,
`str`, `jmp`, `blr`/`jsrr`. A negative no-comma offset silently encodes as 0 on
all of them (verified for −1 and −32). Single-operand `ret offset6` (`ret -1`) is
**not** affected. The `imm5`/`imm9` instructions hit the same parser limitation
but fail loud instead — see OG BUG #14.

**Cause:** OG LCC's tokenizer splits e.g. `ldr r1 fp -1` on whitespace; the
`-1` token is not recognized as a signed integer in the no-comma parser path,
and the offset is silently set to 0. The comma path goes through a different
signed-integer validator and works correctly.

**LCC.js behavior:** `assembleLDR` / `assembleSTR` call `evaluateImmediate`
with the signed range `[-32, 31]` regardless of whether commas were used.
Result: all valid offsets (positive, zero, negative) encode correctly.

**Source:** `src/core/assembler.js:1797–1818` (`assembleLDR`, `assembleSTR`)

**Reference:** `public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/`
and `docs/cuh63-ldr-str-silent-miscompile-bug-report.md`; the `jmp`/`blr`/`jsrr`
extension is probed in `public_experiments/nocomma_negative_immediate_family/`
(#257). Summarized in `reports_summary.md`.

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

### 10. Failed assembly (undefined label) still leaves a runnable blank `.e` in OG LCC; LCC.js leaves nothing

Repro — `br` to a label that is never defined:

```asm
    br cheese
    halt
```

| | cuh63 6.3 | LCC.js |
|---|---|---|
| diagnostic | `Undefined label` (line 1) | `Undefined label` (line 1) |
| exit code | `1` | `1` |
| `.e` | written — 2 bytes, header-only/blank (`6f 43`) | **not written** |
| `.lst` / `.bst` | written | not written |
| executing the leftover `.e` | hangs — "Possible infinite loop"; zero-filled image decodes as `brz` offset 0 (self-jump) | n/a — no `.e` exists |

**Cause (OG LCC):** the assembler reports the undefined-label error and exits
`1`, but has already written a header-only `.e` (plus `.lst`/`.bst`) and leaves
it on disk. The 2-byte `.e` holds only the file magic, no code; when executed,
the zero words decode as a chain of `brz` (opcode `0`) with offset `0` — an
infinite self-loop (OG LCC's own detector prints "Possible infinite loop").

**LCC.js behavior:** an undefined label calls `failAssembly('Undefined label', 1)`
in Pass 2 (`assembler.js:417`), which aborts **before** `writeOutputFile()`
(`assembler.js:569`). No `.e`/`.lst`/`.bst` is produced, so there is no orphan
artifact to accidentally run. Same `Undefined label` diagnostic, same exit `1`.

**Premise correction:** the original #105 report said OG LCC's assembler "reports
no error" and silently produces the blank `.e`. In fact OG LCC *does* report
`Undefined label` and exit `1` — identical to LCC.js. The only divergence is the
leftover blank `.e`/listings, and the infinite-loop hazard arises only if that
orphan `.e` is subsequently executed.

**Why OG BUG:** emitting a runnable executable for a *failed* assembly is a
footgun — a build step that ignores the exit code and runs `prog.e` will hang.
LCC.js's all-or-nothing output is the safer, correct behavior.

**Source:** `src/core/assembler.js:417` (`failAssembly('Undefined label', 1)`),
aborting before `src/core/assembler.js:569` (`writeOutputFile`).

**Repro:** `printf '    br cheese\n    halt\n' > undef.a`; `node src/core/lcc.js
undef.a` (errors, no `.e`) vs oracle `lcc undef1.a` (errors but leaves a 2-byte
`undef1.e`; `lcc undef1.e` then infinite-loops).

---

### 13. Long source lines silently split into bogus source (no length guard) (#244)

OG LCC has no line-length check. It reads each source line into a fixed buffer
that holds **298 characters**; a line of length ≥ 299 is **silently split** at the
boundary and the overflow tail is fed back to the assembler as the next source
line(s). Consequences are content-dependent and never mention line length:

- A single over-long line whose tail parses cleanly → **exit 0, `.e` written**,
  with a bogus label silently injected into the symbol table (silent corruption).
- Two over-long lines with matching tails → misleading `Duplicate label` error on a
  spurious line number.
- Failure is non-monotonic in length (e.g. a whitespace-padded line errors at 900
  chars but assembles at 1000) — the signature of an unchecked fixed buffer.

LCC.js is intentionally correct here: it rejects lines > 300 chars with a clear
diagnostic (see BY DESIGN #7) rather than silently splitting them.

**Source (oracle):** line-read buffer in cuh63 6.3 `lcc` (298-char capacity).

**Repro:** `lcc` on a file whose first line is `;` + 398 `a`s then `\thalt` →
exit 0, `.e` written (tail swallowed as a label). Two such comment lines →
`Duplicate label`. Full evidence: `docs/research/line-length-limit.md`.

**Bug report to Prof. Dos Reis:** conditional / not yet filed — decision tracked
in #244 (this is the candidate OG bug from that probe).

---

### 14. no-comma syntax: negative `imm5`/`imm9` is rejected, not encoded (#257)

| | cuh63 6.3 | LCC.js |
|---|---|---|
| `add r0 r0 -1` (no-comma, neg) | `Error on line 1` + blank `.e` ✗ | `103f` (imm5=-1) ✓ |
| `add r0 r0 1` (no-comma, **pos**) | `1021` ✓ | `1021` ✓ |
| `add r0, r0, -1` (comma) | `103f` ✓ | `103f` ✓ |

Same family as OG BUG #1, same root cause (the no-comma operand parser cannot read
a negative integer), but for the immediate-field instructions — `add`, `sub`,
`and`, `cmp` (`imm5`) and `mvi` (`imm9`) — it manifests as a **hard error** rather
than a silent drop. OG LCC accepts the comma form **and** no-comma *positive*
immediates, but rejects no-comma *negative* immediates with a generic
`Error on line 1` (and the OG BUG #10 blank-`.e` footgun fires). LCC.js accepts all
forms and encodes correctly.

This is less dangerous than #1 (it fails loud rather than miscompiling) but is a
real inconsistency. Verified by `public_experiments/nocomma_negative_immediate_family/`.

**Bug report to Prof. Dos Reis:** candidate; fold into the OG BUG #1 no-comma
report as the "fails-loud" half of the same parser defect. Summarized in
`reports_summary.md`.

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

### 7. Source line length limit: LCC.js enforces 300 chars (researched, #244)

LCC.js rejects source lines longer than 300 raw characters (incl. comment and
whitespace) with a clear `Line exceeds maximum length of 300 characters` abort.

**Researched against the oracle (#244):** OG LCC has **no explicit line-length
limit and no diagnostic.** It reads each line into a fixed buffer holding **298
chars**; lines ≥ 299 are **silently split**, and the overflow tail is parsed as
the next source line(s) — see the OG BUG entry below. LCC.js's 300-char cap is
therefore a **safer, fail-fast** replacement for the oracle's silent corruption,
not a port of any oracle limit. Counting the **raw line including comments** is
confirmed correct (the oracle's buffer fills the same way). The off-by-two
(LCC.js accepts 299–300-char lines the oracle would split) favors LCC.js; keeping
300 over 298 is intentional.

**Status:** resolved — BY DESIGN, no change planned. The old "if research reveals
a different limit, update this" caveat is discharged.

**Source:** `src/core/assembler.js` (`validateLineLength`)

**Reference:** `docs/research/line-length-limit.md` (full probe + evidence)

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

### 11. `.a` listing Source-Code column: LCC.js prints full source lines; OG LCC truncates

In the `.lst`/`.bst` reports produced from a `.a` (assemble path), OG LCC clamps
the rendered **Source Code** column to a fixed listing width — long lines are cut
mid-token. LCC.js appends the source line verbatim, untruncated.

| | cuh63 6.3 | LCC.js |
|---|---|---|
| long comment line | truncated (~67-col line cap; e.g. `…next pointer (.`) | full line preserved (e.g. `…next pointer (.word next_label).`) |
| longest emitted line (demo-009 `.lst`) | 67 chars | 109 chars |
| `.lst` size (demo-009) | 3141 bytes | 4020 bytes |

Applies only to artifacts that carry source text (the `.a` path); `.e`-path reports
have no Source Code column, so there is no divergence there.

**Why BY DESIGN:** truncating the listing discards information (the tail of long
comments and source lines). LCC.js favors a faithful, complete listing over
byte-for-byte column parity. A deliberate readability choice, not a parity
commitment — surfaced as the owner decision in the #145 spike and resolved in
favor of full lines.

**Source:** `src/utils/genStats.js:73` (code-bearing rows) and `:82` (comment-only
rows) append `entry.sourceLine` with no width clamp.

**Reference:** `docs/research/debugger-oracle-parity.md` (deviation **E**) and the
probe `experiments/debugger-report-parity-probe.sh`.

**Note:** the sibling column-geometry/whitespace deltas from the same spike (header
`A`/`S` padding, stats-block alignment, `Loc/Code` widths, BST trailing space,
banner date format) are now classified together as **deviation 12** below.

---

### 12. Listing report-format cosmetic deltas: LCC.js does not chase byte-exact oracle parity

The `.lst`/`.bst` reports differ from the oracle in five cosmetic ways. The #13
spike refresh (2026-05-29) re-ran the parity probe against current `main` and
confirmed all five still reproduce on demo-009:

| id | where | cuh63 6.3 | LCC.js |
|---|---|---|---|
| A | banner date | `Fri May 29 11:12:41 2026` (ctime-style) | `Fri, May 29, 2026, 11:12:41` |
| B | Header `A`/`S` lines | `A␣␣␣␣␣0000` (addr right-aligned, 5-wide) | `A␣0000` (single space) |
| C | Program-statistics block | label padded ~22, value right-aligned | label padded wider, value left-set |
| D | `Loc`/`Code` column geometry | `Loc␣␣␣␣␣␣␣␣␣␣Code` | `Loc␣␣␣Code` |
| F | BST data rows | trailing space after the binary word | trimmed |

(Delta **E** — the `.a` source-line truncation — is deviation 11 above. The
product name/version, `LCC` vs `LCC.js` and `Ver 6.3` vs `0.1`, is intentionally
different and is not a deviation.)

**Why BY DESIGN:** these are pure whitespace / padding / date-shape differences in
human-facing listing files. Per the same readability rationale as deviation 11,
LCC.js favors its own consistent formatting over byte-for-byte oracle listing
parity. Resolved as the owner decision on #13 (2026-05-29): accept as intentional
divergence; the symbolic-debugger feature is complete.

**Source:** `src/utils/genStats.js` (banner / header / statistics / row formatting).

**Reference:** `docs/research/debugger-oracle-parity.md` (deltas **A**–**F**), the
probe `experiments/debugger-report-parity-probe.sh`, spike #145, build issue #13.

**Note for future parity work:** if byte-exact listing parity is ever required,
these are the five sites — each a small (~15–30m) formatting puzzle, smallest-first
**F → B → A → D → C**, every fix gated by re-running the probe.

---

## Pending parity investigations (stubs)

_None pending._

---

## Changelog

| Date | Entry | Change |
|---|---|---|
| 2026-05-26 | Initial creation | Deviations 1–8 documented |
| 2026-05-27 | Pending stubs added | Reserved sections for #105, #106 (split from #29) |
| 2026-05-28 | Deviation 9 added | Characterized empty/whitespace `.a` (#106): LCC.js exit 0 + no artifacts vs OG exit 1 + header-only listings; classified BY DESIGN |
| 2026-05-28 | Deviation 10 added | Characterized undefined-label `br` (#105): both error + exit 1, but OG leaves a runnable blank `.e` (infinite-loops if run) while LCC.js writes nothing; classified OG BUG. All pending stubs now cleared |
| 2026-05-28 | Deviation 11 added | `.a` listing Source-Code column: LCC.js prints full source lines, OG LCC truncates to listing width; classified BY DESIGN (from the #145 report-parity spike) |
| 2026-05-29 | Deviation 12 added | Listing report-format cosmetic deltas (A banner date, B header A/S padding, C stats alignment, D Loc/Code geometry, F BST trailing space) classified BY DESIGN; closes #13 (symbolic debugger feature complete — #13 spike refresh confirmed all five still reproduce) |
| 2026-05-30 | OG BUG #1 broadened; #14 added (#257) | No-comma negative-offset silent-drop confirmed to span the whole `baser,offset6` family (`jmp`/`blr`/`jsrr`, not just `ldr`/`str`); new OG BUG #14 records the `imm5`/`imm9` fails-loud half of the same no-comma parser defect. Both summarized in `reports_summary.md`; evidence in `public_experiments/nocomma_negative_immediate_family/` |
