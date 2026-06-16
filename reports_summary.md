# LCC oracle (cuh63 6.3) — bug-report summary

A single high-level index of every **upstream** behavior in the original LCC
(`cuh63` 6.3 `lcc`, Prof. Anthony J. Dos Reis) that LCC.js's differential testing
has surfaced as a candidate bug or as a divergence worth raising. Intended as a
cover sheet for Prof. Dos Reis and for Charlie (the items needing a maintenance
decision are flagged **→ Charlie**).

Scope note: this file lists **oracle-side** findings only. Bugs in *LCC.js's own*
code are tracked separately in [`open_bugs.md`](./open_bugs.md) (the `OB-*`
series). Each oracle finding's verdict is one of: a confirmed original-LCC bug, an
intentional/acceptable deviation we simply document, or inconclusive — 100% parity
is **not** a goal.

Last updated: 2026-06-05 (#264 — row #4 scope expanded to all error types; report doc drafted).

## Status at a glance

| # | Area | Symptom (one line) | Severity | Report status |
|---|------|--------------------|----------|---------------|
| 1 | `ldr`/`str` no-comma neg `offset6` | negative offset silently encodes as **0** (silent miscompile) | **High** | Family report **send-ready** (see #7/#8) · pending human email (#506) |
| 2 | `mov` immediate range (OB-008) | `mov` rejects negatives its own `mvi` accepts | Medium | Report **drafted**, not sent · gate now clear **→ Charlie** |
| 3 | `jmp` with no/bad operand | leaves `.e`/`.lst`/`.bst` on error (artifacts-on-error, same pattern as #10); ~~segfaults~~ [claim corrected in #261] | Low* | No report (BY DESIGN) |
| 4 | any failed assembly | leaves partial artifacts (`.e`/`.lst`/`.bst`) for **every** error type; universal footgun | Low* | Report **drafted**, not sent (`cuh63-blank-e-on-error-bug-report.md`, #264) |
| 5 | long source line | no length check; line **silently split** into bogus source | Medium | Report **drafted**, not sent (#260) |
| 6 | `sext` non-`2^k−1` selector | returns silent garbage; contract unspecified | Low–Med | **SENT** — awaiting reply (#159) |
| 7 | no-comma neg `offset6` on `jmp`/`blr`/`jsrr` | same silent-→0 as #1, on more instructions | **High** | **Send-ready** — covered in family report · pending human email (#506) |
| 8 | no-comma neg `imm5`/`imm9` | `add`/`sub`/`and`/`cmp`/`mvi` **reject** a negative that the comma form accepts | Medium | **Send-ready** — covered in family report · pending human email (#506) |
| 19 | `ret`/`jmp r0` non-TTY oracle flood | oracle enters step-trace loop, floods stdout indefinitely (never exits); LCC.js detects loop and exits cleanly | Medium | No report (BY DESIGN — #385 closed) |
| 21 | `.o` assemble exit code | `lcc` exits **1** on successful `.o` assemble ("needs linking") | Medium | Report **send-ready** · pending human email (#508) |
| 24 | `bl`/`call`/`jsr` numeric token | oracle `Undefined label` vs LCC.js `Bad label` (diagnostic wording only; both exit 1) | Low | No report (BY DESIGN — #510 closed) |
| 28 | `-d` debugger bare `c` | a bare `c` (no operands) **segfaults** the oracle (exit 139); `c r0`/`c r0 5` are fine | Low | Report **drafted** (`cuh63-debugger-bare-c-segfault-bug-report.md`, #1353) · pending human send · umbrella #1406 |

\* "Low" severity but a genuine defect; classified low because the trigger is a
malformed/edge-case program rather than valid everyday source.

Legend — **SENT**: in Prof. Dos Reis's inbox. **drafted, not sent**: a finished,
sendable report doc exists. **not drafted**: confirmed with evidence but no report
written yet. **NEW**: surfaced by this pass, not yet in any ledger.

---

## Sent / awaiting reply

### 6. `sext` semantics for non-`2^k−1` selectors
- **Symptom:** `sext` produces well-defined output only for `2^k−1` (contiguous
  low-bit) mask selectors; non-contiguous selectors return values not described by
  any simple rule. LCC.js can only match the oracle by shipping a literal 16×32
  lookup table — itself evidence the behavior is unspecified.
- **Report:** [`docs/research/sext-semantics-report.md`](./docs/research/sext-semantics-report.md)
- **Status:** sent; **awaiting his reply**, tracked by blocked issue **#159**.
  The report asks (a) what the 2nd operand's contract is, (b) whether the ISA doc
  should state it and the toolchain diagnose bad selectors, (c) the canonical
  `sext` idiom. Pre-scoped actions for each possible answer live on #159.

---

## Drafted and ready — awaiting send

### 1 / 7 / 8. No-comma negative-operand full family (silent miscompile + hard reject)
- **Symptom:** the no-comma operand parser cannot read a negative integer, causing
  two distinct failures depending on operand position:
  - **Silent miscompile** — `ldr`, `str`, `jmp`, `blr`/`jsrr`: negative no-comma
    `offset6` silently encodes as 0. `ldr r1 fp -1` → `6340` (wrong) vs comma
    `ldr r1, fp, -1` → `637f` (correct). `jmp r1 -1` → `c040`; `blr r1 -1` → `4040`.
  - **Hard reject** — `add`, `sub`, `and`, `cmp`, `mvi`: no-comma negative
    `imm5`/`imm9` triggers `Error on line 1` + blank `.e`, while the comma form
    and no-comma **positive** immediates assemble fine.
- **Family report (primary):** [`docs/cuh63-nocomma-negative-operand-family-bug-report.md`](./docs/cuh63-nocomma-negative-operand-family-bug-report.md) — covers all seven instructions; ready to send.
- **Original `ldr`/`str` report:** [`docs/cuh63-ldr-str-silent-miscompile-bug-report.md`](./docs/cuh63-ldr-str-silent-miscompile-bug-report.md) — superseded by the family report; retained as a historical record with an update notice.
- **Evidence:** [`public_experiments/nocomma_negative_immediate_family/`](./public_experiments/nocomma_negative_immediate_family/), [`public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/`](./public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/)
- **Status: send-ready, pending human email** — report finalised with absolute GitHub URLs (#506); PDF conversion and email are the human's action. Once sent, flip this row to **SENT** and file a follow-up issue (parallel to #159) to act on any reply. Recommend deciding whether to bundle with the `mov` report (#2/OB-008) before sending.

### 2. `mov` rejects negative immediates that `mvi` accepts (OB-008)
- **Symptom:** the shipped ISA summary defines `mov dr, imm9` as a pseudo-instruction
  for `mvi dr, imm9` (signed 9-bit, −256..+255). cuh63 6.3 accepts the full range
  via `mvi` but rejects **all** negative `mov` immediates. The older 6.x build that
  produced this repo's golden listings did not diverge — same `Ver 6.3` string,
  different validation logic. Blocks oracle regeneration of 5 demos.
- **Report:** [`docs/cuh63-mov-immediate-bug-report.md`](./docs/cuh63-mov-immediate-bug-report.md)
- **Evidence:** [`public_experiments/mov_mvi_parity/`](./public_experiments/mov_mvi_parity/)
- **Tracking:** issue **#40**, ledger [`open_bugs.md` OB-008](./open_bugs.md).
- **Status → Charlie:** the report's stated blocker was the #31 decision on which
  range LCC.js's `mov` should validate. **#31 is now closed** — LCC.js kept the
  `−256..+255` `mvi` range (i.e. it already treats the oracle's narrower `mov` as
  the bug). That's exactly the branch in which #40 says to **send** the report, so
  OB-008 appears unblocked. Needs Charlie's go-ahead to send.

### 21. Successful `.o` assemble exits 1 ("needs linking")
- **Symptom:** when assembly produces an object module — triggered by `.extern` or
  `.global` directives — `lcc` exits **1** even though all artifacts (`.o`, `.lst`,
  `.bst`) are correctly written and no errors are reported. The standalone `.e`
  assemble+run path exits 0. The non-zero exit misrepresents a successful operation
  as a failure; any build script or CI harness that checks `$?` after a `.o`
  assemble will abort falsely with no way to distinguish a genuine assembly error
  from a successful "needs linking" assemble.
- **Report:** [`docs/cuh63-o-assemble-exit-code-bug-report.md`](./docs/cuh63-o-assemble-exit-code-bug-report.md)
- **Evidence:** `docs/parity_deviations.md` §21; parity decision #270 (closed — LCC.js exits 0, correct behavior).
- **Status: send-ready, pending human email** — report is complete (#508). Once sent, flip this row to **SENT** and file a follow-up issue to act on any reply.

### 5. No source-line length limit — long lines silently split into bogus source
- **Symptom:** OG LCC has no line-length check; it reads each line into a fixed
  **298-char** buffer and silently **splits** longer lines, feeding the overflow
  tail back as the next source line. Consequences are content-dependent and never
  mention length: a single over-long line can assemble to exit 0 with a **bogus
  label injected** into the symbol table (silent corruption); two can produce a
  misleading `Duplicate label`; failure is non-monotonic in length.
- **Evidence:** [`docs/research/line-length-limit.md`](./docs/research/line-length-limit.md)
  (full probe from #244). LCC.js is intentionally stricter: a clear "line exceeds
  300 chars" diagnostic (`docs/parity_deviations.md` BY DESIGN #7).
- **Report:** [`docs/cuh63-line-length-silent-split-bug-report.md`](./docs/cuh63-line-length-silent-split-bug-report.md)
- **Status:** confirmed OG bug (`docs/parity_deviations.md` OG BUG #13); report
  **drafted, not sent** (#260). Sending is the human's call.

---

## Confirmed, not yet drafted into a report

_(No items currently in this category — #7 and #8 are now covered by the family
report under §1/7/8 above.)_

---

## Documented, deliberately not reported

These are recorded as OG bugs in `docs/parity_deviations.md` but are **not** slated
for a report — listed here so the decision is explicit, not an omission.

### 3. `jmp` with no/bad operand → oracle leaves `.e`/`.lst`/`.bst` on error; LCC.js leaves nothing
- **Corrected claim (#261):** the original report said OG LCC segfaults — not
  reproducible in cuh63 6.3. Actual behavior: both tools error and exit 1, but
  the oracle leaves artifact files on disk (same artifacts-on-error pattern as
  OG BUG #10). LCC.js writes nothing. The segfault story is obsolete; the actual
  deviation (artifact leftovers) is the same footgun as #4/#10 — and the
  LCC.js no-artifact behavior is beneficial. (`parity_deviations.md` §3, corrigendum
  #261.) Not slated for a report.

### 4. Any failed assembly leaves partial artifacts (`.e`/`.lst`/`.bst`) on disk
- **Scope expanded (#263/#264):** originally documented only for undefined-label `br`
  (OG BUG #10). Systematic probing of nine error types confirms this is universal:
  every error (undefined label, out-of-range immediate, bad register, invalid
  directive, missing operand, duplicate label, numeric label) leaves partial
  artifacts before exit 1. Pass-2 errors write a 2-byte `6f 43` header-only `.e`;
  the pass-1 duplicate-label case writes a 1-byte `6f` orphan. `.lst` and `.bst`
  are always written. Executing the orphan triggers "Possible infinite loop" with
  ~100 MB of output. A failed re-assembly also silently overwrites a valid `.e`
  from a prior successful build.
- **Report:** `docs/cuh63-blank-e-on-error-bug-report.md` — drafted, not yet sent.
  (`parity_deviations.md` OG BUG #10.)

### 19. `ret` bare / `jmp r0` → oracle enters step-trace debug loop; floods stdout in non-TTY
- `ret` (= `jmp r7`; r7=0 at startup) and `jmp r0` (r0=0) both assemble correctly
  and produce an infinite loop at runtime. The oracle detects it, prints `Possible
  infinite loop`, then enters a stepping debugger — in a non-TTY context this reads
  EOF at each prompt and floods stdout at ~90 MB/s until killed. LCC.js detects the
  loop and exits 1 immediately with a single diagnostic line. (`parity_deviations.md`
  BY DESIGN §19.) Decision: classify as BY DESIGN (beneficial deviation); no report
  filed. (#385 closed 2026-06-01.)

### 24. `bl` / `call` / `jsr` with a numeric token → oracle `Undefined label`; LCC.js `Bad label`
- Both assemblers reject `bl 5` (and aliases) with exit 1, but the oracle accepts
  digit-led tokens as syntactically valid label names and defers rejection to
  symbol-table lookup time; LCC.js rejects via `isValidLabel` upfront. The
  observable difference is diagnostic wording only — both are correct exits.
  (`parity_deviations.md` OG BUG §24.) Decision: BY DESIGN — the LCC.js
  upfront-syntactic check is intentionally stricter; no upstream report needed.
  (#510 closed 2026-06-02.)

---

## Coverage — what this summary is based on, and what is **not** yet swept

Probed and characterized: the no-comma operand parser across all immediate/offset
instructions (#1/#7/#8), `mov`/`mvi` immediate ranges (#2), source-line length
(#5/#244), label length (#244-sibling #245 → parity, no bug), `sext` (#6),
`jmp`/undefined-label edge cases (#3/#4), `.o`-assemble exit code (#21/#270),
`ret`/`jmp r0` infinite-loop oracle behavior (#19/#385), `bp` non-TTY step-trace
(#22/#501), `.org` invalid operand (#23/#500), `bl`/numeric-token label validation
(#24/#510).

**Not yet swept** (candidate future probes — no claim is made about these):
- `.word` / `.fill` / `.zero` with out-of-range or negative arguments.
- Missing-operand crashes on instructions other than `jmp` (e.g. `ld`, `st`, `bl`).
- Directive edge cases (`.org`/`.start`/`.global` interactions) beyond
  `parity_deviations.md`'s existing entries.
- Linker (`.o` → `.e`) parity — only lightly covered to date.
- Large-program / many-symbol stress behavior.

If you want, the next pass can extend the probe harness to any of the above.
