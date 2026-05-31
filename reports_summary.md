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

Last updated: 2026-05-30 (probe #257).

## Status at a glance

| # | Area | Symptom (one line) | Severity | Report status |
|---|------|--------------------|----------|---------------|
| 1 | `ldr`/`str` no-comma neg `offset6` | negative offset silently encodes as **0** (silent miscompile) | **High** | Report **drafted**, not sent · **now broadened** (see #7) |
| 2 | `mov` immediate range (OB-008) | `mov` rejects negatives its own `mvi` accepts | Medium | Report **drafted**, not sent · gate now clear **→ Charlie** |
| 3 | `jmp` with missing register | **segfaults** (vs a clean error) | Low* | No report (preserved deviation) |
| 4 | undefined-label `br` | leaves a runnable **blank `.e`** for a *failed* assemble | Low* | No report (footgun, premise-corrected) |
| 5 | long source line | no length check; line **silently split** into bogus source | Medium | **Not drafted** — conditional (#244) |
| 6 | `sext` non-`2^k−1` selector | returns silent garbage; contract unspecified | Low–Med | **SENT** — awaiting reply (#159) |
| 7 | no-comma neg `offset6` on `jmp`/`blr`/`jsrr` | same silent-→0 as #1, on more instructions | **High** | **NEW (probe #257)** — undocumented |
| 8 | no-comma neg `imm5`/`imm9` | `add`/`sub`/`and`/`cmp`/`mvi` **reject** a negative that the comma form accepts | Medium | **NEW (probe #257)** — undocumented |

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

### 1. `ldr`/`str` no-comma negative `offset6` → silent `0` (silent miscompile)
- **Symptom:** `ldr r1 fp -1` (space-separated operands) assembles with **no
  error**, writes a `.e`, but encodes `offset6 = 0` instead of `-1` (`6340` vs the
  correct `637f`). The program then reads/writes the wrong address. The comma form
  `ldr r1, fp, -1` is correct. **Silent miscompile — the most dangerous class here.**
- **Report:** [`docs/cuh63-ldr-str-silent-miscompile-bug-report.md`](./docs/cuh63-ldr-str-silent-miscompile-bug-report.md)
- **Evidence:** [`public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/`](./public_experiments/ldr_str_no_comma_neg_offset_silent_miscompile/)
- **Status:** drafted, not sent; no upstream-ledger entry yet (unlike OB-008).
- **Update (probe #257):** the same defect affects **`jmp`, `blr`, `jsrr`** too —
  see #7. Recommend sending #1 and #7 as **one** report covering the whole
  no-comma-negative family. `docs/parity_deviations.md` OG BUG #1 has been
  broadened accordingly.

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

---

## Confirmed, not yet drafted into a report

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
- **Status:** confirmed OG bug (`docs/parity_deviations.md` OG BUG #13), **report
  not yet drafted** — filing was left conditional on the #244 decision. Ready to
  write up if you want it sent.

### 7. No-comma negative `offset6` silent-drop on `jmp` / `blr` / `jsrr` — **NEW**
- **Symptom:** the #1 defect is **not** limited to `ldr`/`str`. Every
  `baser, offset6` instruction silently drops a negative no-comma offset to 0:
  `jmp r1 -1` → `c040` (offset 0) vs comma `jmp r1, -1` → `c07f`; `blr`/`jsrr` →
  `4040` vs `407f`. Verified for offsets −1 and −32; assembly succeeds with no
  diagnostic. Single-operand `ret -1` is **not** affected.
- **Evidence:** [`public_experiments/nocomma_negative_immediate_family/`](./public_experiments/nocomma_negative_immediate_family/)
- **Status:** confirmed; folds into report #1 (send as one). Now noted in
  `docs/parity_deviations.md` OG BUG #1. Tracked by **#258**.

### 8. No-comma negative `imm5`/`imm9` rejected (not miscompiled) — **NEW**
- **Symptom:** same root cause (no-comma parser can't read a negative integer) but,
  for immediate-field instructions, it manifests as a **hard error** instead of a
  silent drop. `add r0 r0 -1`, `sub`, `and`, `cmp`, `mvi r0 -1` all fail with
  `Error on line 1` and leave a blank `.e` (see #4), while the comma form **and**
  no-comma **positive** immediates (`add r0 r0 1` → `1021`) assemble fine. LCC.js
  accepts all forms and encodes correctly.
- **Evidence:** [`public_experiments/nocomma_negative_immediate_family/`](./public_experiments/nocomma_negative_immediate_family/)
- **Status:** confirmed; less dangerous than #1/#7 (fails loud, modulo the #4
  blank-`.e` footgun) but a real inconsistency. New entry (OG BUG #14) in
  `docs/parity_deviations.md`. Tracked by **#258**.

---

## Documented, deliberately not reported

These are recorded as OG bugs in `docs/parity_deviations.md` but are **not** slated
for a report — listed here so the decision is explicit, not an omission.

### 3. `jmp` with no register operand → segmentation fault
- OG LCC dereferences a null operand and crashes; LCC.js returns a clean
  `Missing register` error. Parity is impossible without replicating a crash, and
  the deviation is beneficial, so it's preserved. (`parity_deviations.md` OG BUG #3.)
  Could be reported as a robustness nit if desired — currently not.

### 4. Undefined-label `br` leaves a runnable blank `.e`
- A `br` to an undefined label correctly errors and exits 1 (premise from the
  original #105 report was corrected — OG *does* diagnose it), but OG also leaves a
  2-byte header-only `.e` on disk; executing that orphan hangs (zero words decode
  as a self-branch). LCC.js writes nothing on a failed assemble. (`parity_deviations.md`
  OG BUG #10.) This same blank-`.e`-on-error behavior is what makes finding #8 leave
  a stray `.e`. Footgun rather than a miscompile; not currently slated for a report.

---

## Coverage — what this summary is based on, and what is **not** yet swept

Probed and characterized: the no-comma operand parser across all immediate/offset
instructions (#1/#7/#8), `mov`/`mvi` immediate ranges (#2), source-line length
(#5/#244), label length (#244-sibling #245 → parity, no bug), `sext` (#6),
`jmp`/undefined-label edge cases (#3/#4).

**Not yet swept** (candidate future probes — no claim is made about these):
- `.word` / `.fill` / `.zero` with out-of-range or negative arguments.
- Missing-operand crashes on instructions other than `jmp` (e.g. `ld`, `st`, `bl`).
- Directive edge cases (`.org`/`.start`/`.global` interactions) beyond
  `parity_deviations.md`'s existing entries.
- Linker (`.o` → `.e`) parity — only lightly covered to date.
- Large-program / many-symbol stress behavior.

If you want, the next pass can extend the probe harness to any of the above.
