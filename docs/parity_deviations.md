# Parity Deviations: LCC.js vs cuh63 6.3 OG LCC

Centralized record of every known behavioral difference between LCC.js and the
cuh63 6.3 `lcc` binary (the reference oracle). Each entry states the deviation,
its rationale, and points back to the source location.

> **Terminology:** "OG LCC", "the oracle", and "OG Oracle" all mean the same thing
> — the **original, source-of-truth LCC implementation** (Prof. Dos Reis's `cuh63`
> `lcc` binary) that LCC.js mirrors. This vocabulary is for contributors only;
> **user-facing CLI messages say plain "LCC"** so end users need none of it.

Three categories are used:

- **OG BUG** — OG LCC is wrong (per spec or by inspection); LCC.js is intentionally correct.
- **LCC.js BUG** — LCC.js deviates from OG LCC; tracked as open bug, fix pending.
- **BY DESIGN** — Intentional divergence for a documented reason (safety, portability, etc.).

> This doc is the *diff* (where behavior differs). For the *superset* — features
> LCC.js adds that OG LCC lacks — see
> [`docs/lccjs-unique-features.md`](./lccjs-unique-features.md).

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

**LCC.js behavior:** `assembleMOV` calls `evaluateImmediate(-256, 255,
"mov immediate value")` — the same range-checked validator `mvi` uses. All
values in the −256..+255 window assemble correctly; values outside that window
produce a `mov immediate value out of range` error (the OB-001 silent-wrap bug
was fixed in #31, closed).

**Source:** `src/core/assembler.js:1915` (`assembleMOV`, `mov` → `mvi` path)

**GitHub issue:** [#40 OB-008](https://github.com/avidrucker/lccjs/issues/40)

**Reference:** `docs/cuh63-mov-immediate-bug-report.md`

---

### 3. `jmp` with missing operand: both tools error cleanly; oracle leaves artifacts; LCC.js does not

> **CORRIGENDUM (#261, 2026-06-01):** ~~OG LCC segfaults on `jmp` (no operand).~~
> Not reproducible in cuh63 6.3. See `docs/research/jmp-missing-operand-segfault.md`.
> The entry below reflects the verified behavior.

#### `jmp` variants

| Input | cuh63 6.3 message | cuh63 6.3 pass | cuh63 6.3 artifacts | LCC.js message | LCC.js artifacts |
|-------|-------------------|----------------|---------------------|----------------|-----------------|
| `jmp` bare | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` | `Missing operand` | none ✓ |
| `jmp ,` | `Missing register` | pass 2 | `.e(2B)` `.lst` `.bst` | `Missing operand` | none ✓ |
| `jmp notaregister` | `Bad register` | pass 2 | `.e(2B)` `.lst` `.bst` | `Bad register` | none ✓ |
| `jmp r99` | `Bad register` | pass 2 | `.e(2B)` `.lst` `.bst` | `Bad register` | none ✓ |

All cases: exit=1 on both sides.

#### Blast radius — other single-register-operand instructions

| Instruction | Oracle message | Oracle pass | Oracle artifacts | LCC.js message | LCC.js artifacts |
|-------------|----------------|-------------|-----------------|----------------|-----------------|
| `blr` bare | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` | `Missing operand` | none ✓ |
| `jsrr` bare | `Bad register` | pass 1 and 2 | `.e(2B)` `.lst` `.bst` | `Missing operand` | none ✓ |
| `jsr` bare | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` | `Bad label` | none ✓ |
| `bl` bare | `Missing operand` | pass 1 only | `.e(1B)` `.lst` `.bst` | `Bad label` | none ✓ |
| `ret` bare | `Possible infinite loop` + debug-dump flood (killed by timeout) | both | `.e(4B)` `.lst(0B)` `.bst(0B)` | `Possible infinite loop` | `.e(4B)` ✗ |
| `jmp r0`   | `Possible infinite loop` + debug-dump flood (killed by timeout) | both | `.e(4B)` `.lst(0B)` `.bst(0B)` | `Possible infinite loop` | `.e(4B)` ✗ |

`ret` (= `jmp r7`; r7 initialises to 0 → jumps to address 0) and `jmp r0` (r0=0 at
startup → same) are valid instructions that produce infinite loops at runtime. Both
tools assemble them successfully. At runtime, the oracle prints `Possible infinite
loop` and enters a stepping debug mode: in a non-TTY context it reads EOF at each
`ret>>>`/`jmp>>>` prompt and floods stdout indefinitely (322–459 MB in 5 s; killed by
timeout); in a TTY it waits for user input and appears to hang. LCC.js detects the
same loop and exits 1 immediately with a single-line message. See deviation §19.

The `.e(4B)` column for LCC.js (marked ✗) is a **runtime-error artifact** — the
assembler wrote the `.e` before execution began (assembly was correct), but
the interpreter did not write `.lst`/`.bst` because it exited early. This differs
from the assembly-error artifact pattern in §3's primary deviation.

#### Deviations

**Primary — artifact-on-error:** Oracle leaves `.e`, `.lst`, `.bst` on disk even
when assembly fails. LCC.js leaves nothing. This is the same "fail-with-artifacts"
pattern as OG BUG #10 — the bare-operand cases are additional instances of it.

**Secondary — pass count:** Oracle catches `jmp`, `blr`, `jsr`, `bl` bare in pass
1 only. LCC.js always runs both passes before erroring. Observable: oracle prints
"Starting assembly pass 1" only; LCC.js prints both.

**Tertiary — message wording (exit=1 on both sides; wording only):**

| Input | Oracle | LCC.js |
|-------|--------|--------|
| `jmp ,` | `Missing register` | `Missing operand` |
| `jsrr` bare | `Bad register` | `Missing operand` |
| `jsr` bare | `Missing operand` | `Bad label` |
| `bl` bare | `Missing operand` | `Bad label` |

**Source:** `src/core/assembler.js` (`assembleJMP`, `assembleJSR`, `assembleBL`)

**Classification:** BY DESIGN — LCC.js's no-artifact behavior is safer. No parity
fix needed.

**Evidence:** `public_experiments/jmp_missing_operand_segfault/`,
`docs/research/jmp-missing-operand-segfault.md`

---

### 10. Failed assembly still leaves partial artifacts (`.e`/`.lst`/`.bst`) in OG LCC; LCC.js leaves nothing

**Scope (characterized in #263):** this is a **universal** OG LCC behavior, not
specific to undefined labels. Every error type tested leaves partial artifacts on
disk. Originally documented only for undefined-label `br`; the full scope was
confirmed by systematic probing of nine distinct error cases.

Repro — `br` to a label that is never defined (clearest single repro):

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
| executing the leftover `.e` | hangs — "Possible infinite loop"; ~100 MB of `brz` trace before detector fires | n/a — no `.e` exists |

**Error types that trigger the same orphan `.e` (2-byte `6f 43`):**

| Error | Example source |
|---|---|
| Undefined label | `br missing_label` |
| Out-of-range `imm5` | `add r0, r0, 100` |
| No-comma negative operand | `add r0 r0 -1` |
| Invalid directive | `.baddir` |
| Bad register | `mov r9, 5` |
| Missing operand | `add` (bare) |
| Numeric label on `br` | `br 999` |

**Edge case — duplicate label (pass-1 error):** fires before the second magic
byte is written, leaving a **1-byte** `6f` orphan instead of the usual 2 bytes.

**Cause (OG LCC):** artifact writes happen before or concurrent with error
detection. Pass-2 errors write the full `6f 43` header before aborting; the
pass-1 duplicate-label error aborts mid-write after the first byte. No cleanup
of partial files is performed.

**LCC.js behavior:** all `failAssembly(...)` paths (`assembler.js`) abort before
`writeOutputFile()`. No `.e`/`.lst`/`.bst` is produced on any error path, so
there is no orphan to accidentally run.

**Premise correction:** the original #105 report said OG LCC's assembler "reports
no error" and silently produces the blank `.e`. In fact OG LCC *does* report the
error and exit `1` — identical to LCC.js. The only divergence is the leftover
artifacts, and the infinite-loop hazard arises only if the orphan `.e` is
subsequently executed.

**Why OG BUG:** emitting a partial executable after a *failed* assembly is a
footgun — a build sequence that does not gate on exit code will run the orphan
and trigger the "Possible infinite loop" trace. A re-assembly that fails also
silently *overwrites* a previously-valid `.e` with the 2-byte orphan, replacing
a working build with a broken one.

**Source (LCC.js):** `src/core/assembler.js` — `failAssembly(...)` aborts before
`writeOutputFile()` on all error paths.

**Report:** `docs/cuh63-blank-e-on-error-bug-report.md` (filed 2026-06-05, #264).

**Repro:** `printf '    br cheese\n    halt\n' > undef.a`; `node src/cli/lcc.js
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

### 21. Successful `.o` assemble: LCC.js exits 0; oracle exits 1 (#270)

On a successful object-module assemble (`.a` with `.extern`/`.global` → `.o` that
needs linking), both tools produce identical artifacts (`.o`, `.lst`, `.bst`) and
print the same output, but the oracle exits **1** while LCC.js exits **0**.

| Path | LCC.js | Oracle (cuh63 6.3) |
|---|---|---|
| `.e` assemble+run (standalone `.a`) | 0 | 0 |
| `.o` assemble (`.a` with `.extern`, needs linking) | **0** | **1** |

The oracle's exit 1 is **specific to the `.o`/"needs linking" path** — both tools
exit 0 on a successful `.e` assemble+run. The `.o`, `.lst`, and `.bst` artifacts
produced by both tools are correct and identical.

**Cause (oracle):** `lcc` is primarily a "compile and run" tool. When it produces a
`.o` that cannot be executed directly it prints `Output file needs linking` and exits
1 — treating "no runnable output" as non-success even when the object module itself
is correctly formed.

**LCC.js behavior:** exits 0. A successful assemble that correctly writes a `.o` is
a success. Matching the oracle's exit 1 would break CI/scripts that check exit codes
after assembling object modules, and would contradict LCC.js's exit-code posture
elsewhere (see deviations #8, #9).

**Why OG BUG:** the oracle conflates "I produced no runnable executable" with
"assembly failed." These are distinct outcomes. Exit 1 conventionally signals error;
a correctly-produced `.o` with all artifacts written is not an error. LCC.js exit 0
is the semantically correct behavior.

**Source:** `src/core/assembler.js` — object-module branch returns without error;
`src/cli/lcc.js` exits 0 after a clean assemble.

**Repro:**
```bash
# With name.nnn in cwd:
node src/core/assembler.js demos/m1.a; echo $?   # → 0
$LCC_ORACLE m1.a; echo $?                         # → 1
```

**Reference:** `docs/research/og-lcc-author-name-noninteractive.md` (delta B);
decision recorded in #270.

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

### 24. `bl` / `call` / `jsr` with numeric token: oracle says `Undefined label`; LCC.js says `Bad label` (#510)

When a numeric literal is used as the branch target of `bl` (and its aliases `call`, `jsr`),
both assemblers reject the input with exit 1, but the error diagnostic differs.

| | Oracle (cuh63 6.3) | LCC.js |
|---|---|---|
| Input | `bl 5` | `bl 5` |
| Error text | `Undefined label` | `Bad label` |
| Exit code | 1 | 1 |
| Artifacts | 1-byte blank `.e` (OG BUG §10) | none |

**Cause (oracle):** the oracle's parser treats `5` as a **syntactically valid label
name** — it passes the token through to symbol-table lookup and only then rejects it
as undefined. The oracle's label validation is purely existence-based, not
syntactic: any token that is not a directive, mnemonic, or register is tentatively
treated as a label reference.

**LCC.js behavior:** `assembleBL` calls `isValidLabel(label)` before anything else.
`isValidLabel` requires the token to match `/^[A-Za-z_$@][A-Za-z0-9_$@]*$/` — a
token starting with a digit fails immediately with `Bad label`
(`src/core/assembler.js:1735–1736`). The error fires in Pass 1, before any
symbol-table lookup.

**Why OG BUG:** accepting a numeric token as a syntactically valid label name is
incorrect. A digit-led token can never legally be a label; deferring the rejection
to lookup time is a parser weakness, not a feature. LCC.js's upfront syntactic
check is the correct and more informative behavior — `Bad label` is a more precise
diagnosis than `Undefined label` for this case.

**Scope:** `bl 5` / `call 5` / `jsr 5` only. Whether the oracle similarly accepts
other syntactically invalid tokens (e.g. `bl 0x10`, `bl -1`) is not investigated
here.

**Source:** `src/core/assembler.js:1732` (`assembleBL`) — `isValidLabel` gate at
line 1735.

**Evidence:** `docs/research/adversarial_hypotheses.md` H-016; probe run #502.

**GitHub issue:** [#510](https://github.com/avidrucker/lccjs/issues/510)

---

### 28. `-d` debugger `c` command: oracle segfaults on a bare `c`; LCC.js validates (#1353)

In the interactive debugger, a bare `c` (the change-value command) with **no operands**
crashes the oracle with **SIGSEGV** (exit 139). Well-formed `c <loc> <val>` works, and
`c <loc>` (value omitted) prints a clean `Missing operand` — so the crash is specific to
the zero-operand case (a missing-operand guard absent on one path).

| Input at the `{mnemonic}>>>` prompt | Oracle | LCC.js (`-d` `debug()`) |
|---|---|---|
| `c r0 5` | sets r0 = 0x5 ✓ | sets r0 = 0x5 ✓ |
| `c r0` (no value) | `Missing operand` | `Missing operand` |
| **`c`** (no operands) | **SIGSEGV (exit 139)** | `Missing operand` (validated) |

LCC.js's `debug()` change-value handler validates both forms and never crashes (#1349).
Classified **OG BUG** — a robustness defect in the upstream binary. Drafted upstream
report: `docs/cuh63-debugger-bare-c-segfault-bug-report.md` (tracked by #1353, umbrella
#1406). Evidence: oracle probe #1348.

**Source (LCC.js side):** `src/core/interpreter.js` `debug()` — `c` handler prints
`Missing operand` for bare/valueless `c`.

**GitHub issue:** [#1353](https://github.com/avidrucker/lccjs/issues/1353)

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
`LinkerError`; `src/cli/lcc.js:linkObjectFiles` catches `LinkerError` and returns
cleanly, so the process exits 0.

This is parity-correct, not a deviation. Documented here because the
exit-0 outcome must be preserved whenever the error-handling path is changed.

**Source:** `src/core/linker.js` (`error()`), `src/cli/lcc.js:linkObjectFiles`
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

**Repro:** `node src/cli/lcc.js empty.a` on a 0-byte or whitespace-only `.a`;
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

**The `-f` flag connection (#1371):** OG LCC's `-f` ("full list files — lines in
`.lst`/`.bst` not truncated", `lcc.txt:150`) *disables* OG's truncation — i.e. it
makes OG behave the way LCC.js *already always does*. So in LCC.js, `-f` is a
**deliberate no-op**: the listing is full regardless. Rather than silently accept a
flag that does nothing, the `lcc`/`ilcc` CLI parsers emit a one-line, non-blocking
warning when `-f` is passed:
`Flag {-f} has no effect: LCCjs never truncates .lst/.bst listing lines (a deliberate
difference from LCC).` The user-facing text says **"LCC"** (not "oracle"/"OG") so it
needs no internal vocabulary. Source: `src/utils/flagDiagnostics.js` (`FLAG_DEVIATIONS`),
wired in `src/cli/lcc.js` and `src/interactive/ilcc.js` `parseArguments`.

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

### 15. `.string` unknown escapes: LCC.js rejects with a clear error; OG LCC silently drops the backslash (#157)

The supported escape set is **identical** in both toolchains — `\n \t \r \\ \"`
map byte-for-byte the same. They diverge only on escapes *outside* that set:

| `.string "[\X]"` | cuh63 6.3 | LCC.js |
|---|---|---|
| `\0` `\a` `\b` `\f` `\v` `\'` | drops `\`, emits the literal char (`[0]`, `[a]`, …) ✗ | `Unknown escape sequence: \X`, exit 1 ✓ |
| `\x41` (hex), `\101` (octal) | emits `x41` / `101` literally (no C numeric escape) | `Unknown escape sequence` |

**Why BY DESIGN:** LCC.js failing loud on an unrecognized escape is *safer* than
the oracle's silent backslash-drop — a typo like `"\march"` becomes a clear
diagnostic instead of silently assembling as `march`. This is the same
stricter-than-oracle posture as deviation #7 (line length).

**Note — #157 headline is non-reproducible:** the issue claimed LCC.js rejects a
`\n` escape with `Missing terminating quote`. It does not; `\n` (and the whole
supported set) assembles correctly, shipped demos rely on it, and the error for an
*unknown* escape is `Unknown escape sequence`, never `Missing terminating quote`.

**Source:** `src/core/assembler.js` — `parseString` (escape→byte, default branch
~`:992`) and the tokenizer `escape` flag (~`:938`). Tests:
`tests/new/assembler.directives.integration.spec.js` (describe "Assembler .string
escape sequences (#157)").

**Reference:** `docs/research/string-escape-parity.md`, probe
`public_experiments/string_escape_parity/`. This is a leniency difference, **not**
an oracle bug — no report to Prof. Dos Reis.

---

### 16. Object-module output atomicity: name-failure aborts before the `.o` is written (#269)

LCC.js now resolves the author name **before** writing any object-module output,
so a name-resolution failure (empty input / EOF on a non-TTY) aborts before the
`.o` exists — matching OG LCC's all-or-nothing behavior.

Repro — clean dir, no `name.nnn` in cwd, stdin closed (`< /dev/null`):

| stdin `/dev/null` | cuh63 6.3 | LCC.js (pre-#269) | LCC.js (post-#269) |
|---|---|---|---|
| diagnostic | `Unable to read name` | `Name cannot be empty` | `Name cannot be empty` |
| exit code | `1` | `1` | `1` |
| `.o` on disk | not written | **written** ✗ | not written ✓ |

**Cause (pre-fix):** `assembler.js` called `writeOutputFile()` (`:555`) **before**
`nameHandler.createNameFile()` (`:561`). On a name-only failure the `.o` was
already on disk when the process exited non-zero — a half-finished build (a `.o`
with no `.lst`/`.bst`), a footgun for any pipeline that ignores the exit code.

**Fix (#269):** the object-module branch resolves the author name first; only on
success does `writeOutputFile()` run. A name failure therefore writes nothing,
same as the oracle. The pre-existing diagnostic text (`Name cannot be empty` vs
the oracle's `Unable to read name`) is unchanged — a separate, pre-existing
wording difference, not addressed here.

**Why BY DESIGN / parity-correct:** all-or-nothing output is the safer behavior
and now agrees with the oracle. Documented here because the ordering
(resolve-name-before-write) must be **preserved** whenever the object-module
write path is refactored — reverting it silently reintroduces the non-atomic
build. Same posture as deviation #8 (parity-correct, preserve-on-change).

**Source:** `src/core/assembler.js` — object-module branch in `main()`
(name resolution moved ahead of `writeOutputFile()`).

**Test:** `tests/new/assembler.object-modules.integration.spec.js` (test 269 —
"should write no .o/.lst/.bst when the author name cannot be resolved").

**Decision status — provisional:** #269 carried the `decision` label; the
parity-policy call is the owner's (Charlie / Prof. Dos Reis). This fix was applied
under provisional owner direction and awaits formal ratification — tracked in
**#298** (report + sign-off). If overturned, this entry is re-classified as a
documented BY-DESIGN *divergence* (keep the `.o` on name-only failure) and the
code reverted.

**Reference:** `docs/research/og-lcc-author-name-noninteractive.md` (delta **A**),
sibling of #241.

---

### 17. Multi-file `.a` input: only the first file is assembled; extras silently ignored (OB-026)

OG LCC accepts multiple `.a` source files on the command line and assembles them
together. LCC.js assembles only `args[0]`; any additional `.a` arguments are
silently ignored.

**Why BY DESIGN:** decided in #59 (closed) — implement the single-file path cleanly
and document the divergence rather than replicating OG LCC's multi-file assembly.
The single-source-file case covers all lccjs use cases; multi-file `.a` is a rare
OG LCC feature.

**Source:** `src/cli/lcc.js` (`main()` dispatch comment: "Multiple .a files: only
args[0] is assembled; remaining .a args are silently ignored"). Full decision record:
`docs/core-behavior-matrix.md` → "Multi-file .a input".

**GitHub issue:** [#59 OB-026](https://github.com/avidrucker/lccjs/issues/59)

---

### 18. Non-interactive stdin with absent `name.nnn`: LCC.js fails fast; OG LCC hangs (#375)

When `name.nnn` is not present in the working directory and stdin is not a terminal
(e.g. a pipe, a closed fd, or an agent shell), the OG LCC binary blocks indefinitely
waiting for interactive input — consuming ~100% CPU with no diagnostic output.

LCC.js now detects this condition early in `createNameFile()` and exits non-zero
with a clear fatal message:

```
Fatal: name.nnn not found and stdin is not a terminal.
Create a name.nnn file in the working directory to run non-interactively.
```

| Condition | OG LCC (cuh63 6.3) | LCC.js (pre-#375) | LCC.js (post-#375) |
|---|---|---|---|
| `name.nnn` absent, stdin = TTY | prompt + reads name | prompt + reads name | prompt + reads name |
| `name.nnn` absent, stdin = non-TTY pipe | **hangs indefinitely** | **hangs indefinitely** | fatal error, exit 1 |
| `name.nnn` present | reads from file | reads from file | reads from file |

**Why BY DESIGN:** hanging silently with 99.9% CPU is the worst possible failure
mode for automated callers. The correct non-interactive usage is to pre-create
`name.nnn` in the working directory — the fatal error message tells callers exactly
what to do. The TTY interactive path is unchanged.

**Source:** `src/utils/name.js` — `createNameFile()`: TTY check before
`readLineFromStdin()`.

**Tests:** `tests/new/name.integration.spec.js` (new test: "createNameFile exits
non-zero with a diagnostic when name.nnn is absent and stdin is not a TTY");
`tests/new/interpreter.e2e.spec.js` and `tests/new/linkerStepsPrinter.unit.spec.js`
updated to pre-create `name.nnn` instead of piping it via stdin.

**GitHub issue:** [#375](https://github.com/avidrucker/lccjs/issues/375)

---

### 19. `ret` bare / `jmp r0`: oracle enters debug-dump loop; LCC.js exits immediately (#385)

`ret` assembles to `jmp r7`; r7 initialises to 0, so execution immediately jumps to
address 0 and loops. `jmp r0` has the same effect (r0=0 at startup). Both are valid
instructions — assembly succeeds on both runtimes.

| | Oracle (cuh63 6.3) | LCC.js |
|---|---|---|
| Assembly | Succeeds (both passes) | Succeeds (both passes) |
| Runtime message | `Possible infinite loop` + stepping debug dump | `Possible infinite loop` |
| Runtime exit | Never exits; killed at timeout (exit=124) | Exits immediately (exit=1) |
| TTY context | Pauses at `ret>>>`/`jmp>>>` prompt; waits for user input | Same immediate exit |
| Non-TTY context | Reads EOF at prompt; floods stdout (~90 MB/s) until killed | Same immediate exit |
| Artifacts | `.e(4B)` `.lst(0B)` `.bst(0B)` | `.e(4B)` only (no `.lst`/`.bst`) |

**Oracle detail:** the oracle detects the loop and prints `Possible infinite loop`,
then enters a stepping debugger mode — each iteration prints one trace line and emits
a `ret>>>` (or `jmp>>>`) prompt. In a TTY this waits for user input (appears to hang).
In a non-interactive context it reads EOF immediately and floods stdout at ~90 MB/s
until killed (322–459 MB in 5 s at timeout). The oracle never exits on its own.

**LCC.js behavior:** the interpreter's cycle-limit heuristic fires, prints a single
`Error running <file>: Possible infinite loop`, and exits 1. The `.e` file remains
(assembly was correct); no `.lst`/`.bst` because stats are written after execution
completes, which never happens.

**Why BY DESIGN (beneficial deviation):**

- LCC.js's fail-fast behavior is strictly better for automated callers (CI, agents,
  scripts) — it produces a clear error message and a clean exit code.
- The oracle's debug-dump mode is arguably useful in TTY contexts (stepping through
  the loop) but catastrophically bad in automated ones.
- No change to LCC.js is needed; the behavior is already correct.

**Report-worthy?** Provisionally yes — the oracle's stdout flood in non-TTY contexts
is a robustness defect, not educational behavior. A minimal report to Prof. Dos Reis
noting that `ret`/`jmp r0` cause unlimited stdout in non-interactive use would be
appropriate. Tracked in **#385** pending owner ratification.

**Source:** `src/core/interpreter.js` — cycle-limit / loop-detection logic.

**Evidence:** `public_experiments/` (probe described in #385); §3 blast-radius table
corrected in same commit.

**GitHub issue:** [#385](https://github.com/avidrucker/lccjs/issues/385)

---

### 20. `.bin` / `.hex` loading message: LCC.js prints a diagnostic; oracle is silent (#371)

When a `.bin` or `.hex` file is loaded, no assembly pass runs — the file is parsed
directly into the output buffer. LCC.js prints a user-facing loading line; the oracle
prints nothing in either case.

| | Oracle (cuh63 6.3) | LCC.js |
|---|---|---|
| `.bin` input message | *(none)* | `Loading <file> (no assembly pass) — N word(s)` |
| `.hex` input message | *(none)* | `Loading <file> (no assembly pass) — N word(s)` |

**Why BY DESIGN:** the original `Assembling …` message (present before #371) was already
LCC.js-only behavior, noted in inline code comments as a deliberate user-feedback choice.
The wording was misleading because no assembly pass runs; #371 replaced it with an
accurate loading message that also reports the word count. Removing the message entirely
would regress user feedback without any oracle-parity benefit.

**Source:** `src/core/assembler.js` — `.bin` branch (~line 386) and `.hex` branch (~line 397).

**GitHub issue:** [#371](https://github.com/avidrucker/lccjs/issues/371)

---

### 22. `bp` in non-interactive context: oracle enters step-trace mode; LCC.js continues cleanly (#501)

`bp` is the software breakpoint instruction. In a TTY session it pauses execution and
enters the interactive debugger. In a non-interactive (non-TTY) context both runtimes
auto-continue past the breakpoint — but they diverge in what they print.

| | Oracle (cuh63 6.3) | LCC.js |
|---|---|---|
| Assembly | Succeeds (both passes) | Succeeds (both passes) |
| `bp` message | `software breakpoint` | `software breakpoint` |
| Post-`bp` execution | Continues with per-instruction step traces | Continues cleanly, no traces |
| Step trace example | `dout>>>  2:         dout r0` | *(none)* |
| Program output (`dout r0` = 7) | Present, interleaved with traces | Present, no interleaving |
| Runtime exit | Exits normally after `halt` | Exits normally after `halt` |

**Oracle detail:** after hitting `bp` in a non-TTY context, the oracle enters the same
stepping debug mode as in §19 — but unlike `ret`/`jmp r0`, which loop infinitely and
flood stdout, a well-formed program runs to `halt` and terminates normally. The oracle
prints one trace line per instruction (`<mnemonic>>>  <pc>:         <instruction>`) before
executing each instruction following the breakpoint; program output is interleaved with
the trace lines.

**LCC.js behavior:** `bp` in non-interactive context prints `software breakpoint` and
continues execution without step traces. Program output appears cleanly with no
interleaving.

**Why BY DESIGN (beneficial deviation):**

- LCC.js's clean output is strictly better for automated callers (CI, agents, test
  suites) — step traces interleaved with program output corrupt any downstream parsing.
- The oracle's step-trace behavior is a side effect of the interactive debugger being
  activated in a non-TTY session. Useful in a TTY context (actual single-step
  debugging); misleading in automated ones.
- No change to LCC.js is needed; the behavior is already correct.

**Note on §19 relationship:** §19 (`ret`/`jmp r0` debug-dump flood) and this deviation
share the same root cause — the oracle enters step mode after any breakpoint-triggering
event. §19's program loops infinitely so the step dump is catastrophic; here the program
terminates normally so the step dump is bounded.

**Source:** `src/core/interpreter.js` — `bp` trap handler.

**Evidence:** `experiments/bp_basic.a` probe — run #501.

**GitHub issue:** [#501](https://github.com/avidrucker/lccjs/issues/501)

---

### 23. `.org` invalid operand: oracle prints `Bad number`; LCC.js prints `Invalid number for .org directive` (#500)

When the operand of a `.org` directive cannot be parsed as a number (e.g. `.org banana`),
the two assemblers emit the same exit code and error shape but different diagnostic text.

| | Oracle (cuh63 6.3) | LCC.js |
|---|---|---|
| error text | `Bad number` | `Invalid number for .org directive` |
| error channel | stdout | stderr |
| exit code | `1` | `1` |
| artifacts emitted | 1-byte blank `.e` (see OG BUG §10) | none |

The error-channel and blank-artifact differences are covered by existing deviations
(§10 / §11 / §12); this entry records only the message-text divergence.

**Why BY DESIGN:** `Bad number` is the oracle's generic parse-failure message reused across
multiple directive contexts. `Invalid number for .org directive` is more informative: it
identifies the affected directive, reducing user confusion. LCC.js-stricter-is-safer applies.

**Source:** `src/core/assembler.js:1109` (`failAssembly('Invalid number for .org directive', 1)`).

**GitHub issue:** [#500](https://github.com/avidrucker/lccjs/issues/500) (probe evidence)

---

### 26. Empty / comment-only / whitespace-only `.hex`: oracle exits 1 with missing-executable error; lccjs exits 0 silently (#934)

When a `.hex` file produces zero words (empty file, comment-only lines, whitespace-only
lines), the oracle attempts to open and run the `.e` file it did not create, fails with a
file-not-found error, and exits 1. LCC.js exits 0 silently without creating any artifacts.

| | Oracle (cuh63 6.3) | LCC.js |
|---|---|---|
| Empty file | `Cannot open executable file <name>.e` | *(silent)* |
| Comment-only lines | `Cannot open executable file <name>.e` | *(silent)* |
| Whitespace-only lines | `Cannot open executable file <name>.e` | *(silent)* |
| Exit code | 1 | 0 |
| Artifacts emitted | none | none |

**Oracle behavior:** after parsing a `.hex` file and getting 0 words, the oracle skips
creating the `.e` file but then proceeds to the run step anyway, where it fails with a
file-not-found message.

**LCC.js behavior:** `parseHexFile()` detects `locCtr === 0` → `abortAssembly('Empty file', 0)` →
`fatalExit('Empty file', 0)` → `process.exit(0)`. The exit code is 0 and no message is printed
(same `fatalExit` behavior documented in §9).

**Why BY DESIGN:** this follows the same design choice documented in §9 for empty `.a` files —
LCC.js treats a zero-word `.hex` input as a clean no-op rather than an error. The comment at
`assembler.js:880` explicitly calls this "custom LCC.js behavior in 12/2024". If strict parity
is ever required, flip to exit 1 at the `abortAssembly('Empty file', 0)` call in `parseHexFile`.

**Source:** `src/core/assembler.js:883` (`abortAssembly('Empty file', 0)` in `parseHexFile`).

**Evidence:** `docs/research/hex-oracle-parity-934.md` Cases 5–7.

**GitHub issue:** [#934](https://github.com/avidrucker/lccjs/issues/934)

---

### 27. Malformed `.hex` line error diagnostics: oracle prints descriptive errors; lccjs exits 1 silently (#934)

When a `.hex` file line has bad content (wrong number of nibbles, non-hex characters),
the oracle prints a multi-line error identifying the file, line number, source text, and
specific error type. LCC.js exits 1 with no output.

| Case | Oracle error text | LCC.js output |
|---|---|---|
| 3 nibbles (`1A2`) | `Fewer than four hex digits in hex number` | *(silent)* |
| 5 nibbles (`1A2F3`) | `More than four hex digits in hex number` | *(silent)* |
| Non-hex char (`1G2F`) | `Bad hex number` | *(silent)* |

Oracle error format for all cases:
```
Error on line N of <file>:
<source line text>
<error description>
```

**LCC.js behavior:** `parseHexFile()` calls `abortAssembly(message, 1)` where `message` is
a descriptive string (e.g. `"Error: line 1 in .hex file does not have exactly 4 nibbles: …"`).
However, `abortAssembly` routes to `fatalExit(message, 1)`, which calls `process.exit(1)`
and **discards the message text** (text only surfaces when `isTestMode` is true). The user
sees no diagnostic.

Both sides agree on exit code 1 and no artifact creation.

**Why BY DESIGN:** this is a property of the `fatalExit` wrapper, not a bug in the hex
parser. The messages are present in the code and surfaced in tests; they are just not
forwarded to stdout/stderr in CLI mode. Changing to `cliErrorExit` would print them but is a
separate decision from parity. No production code changes are made here.

**Source:** `src/core/assembler.js:860–863` (`abortAssembly` calls in `parseHexFile`).

**Evidence:** `docs/research/hex-oracle-parity-934.md` Cases 2–4.

**GitHub issue:** [#934](https://github.com/avidrucker/lccjs/issues/934)

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
| 2026-05-30 | Deviation 15 added (#157) | `.string` escape set is identical to the oracle (`\n \t \r \\ \"`); they diverge only on UNKNOWN escapes — LCC.js rejects with `Unknown escape sequence` while OG silently drops the backslash. Classified BY DESIGN (lccjs stricter-is-safer). The #157 headline (`\n` rejected) is non-reproducible. Evidence: `docs/research/string-escape-parity.md` |
| 2026-05-31 | Deviation 16 added (#269) | Object-module output atomicity: assembler now resolves the author name BEFORE `writeOutputFile()`, so a name-only failure aborts before the `.o` is written (matches oracle all-or-nothing); pre-fix LCC.js left an orphan `.o`. Classified BY DESIGN / parity-correct (preserve-on-change). Decision is provisional pending owner ratification — tracked in #298 |
| 2026-06-01 | §4 OB-001 removed (#31 closed) | `mov` immediate range-checking is fixed: `assembleMOV` now calls `evaluateImmediate(-256, 255, "mov immediate value")` — out-of-range imm9 errors rather than wrapping. Removed from "LCC.js BUG" section. §2 (OB-008) LCC.js behavior description and source line (`:1880` → `:1915`) updated to match. |
| 2026-06-01 | §5 OB-002 removed (#32 closed) | Disassembler `mvi` imm9 mask corrected: `disassembleMVI` now uses `word & 0x1FF` (9-bit, correct). Removed from "LCC.js BUG" section. |
| 2026-06-01 | §6 OB-026 → BY DESIGN §17 (#59 closed) | Multi-file `.a` input: decided — only `args[0]` is assembled, extras silently ignored. Moved from "LCC.js BUG (fix pending)" to BY DESIGN §17; full decision record in `docs/core-behavior-matrix.md`. |
| 2026-06-01 | Deviation 18 added (#375) | Non-interactive stdin + absent `name.nnn`: LCC.js now exits immediately with a fatal diagnostic instead of hanging at ~100% CPU. OG LCC blocks indefinitely. Classified BY DESIGN (fail-fast is safer). |
| 2026-06-01 | §3 OG BUG #3 corrigendum (#261) | Segfault claim not reproducible in cuh63 6.3. Oracle exits 1 with "Missing operand" and leaves `.e`/`.lst`/`.bst` artifact files (same pattern as OG BUG #10). Entry rewritten: BY DESIGN (no-artifact behavior beneficial). Full probe: `docs/research/jmp-missing-operand-segfault.md`. |
| 2026-06-01 | §3 blast-radius table corrected + Deviation 19 added (#385) | `ret` bare / `jmp r0` row: LCC.js column was `Missing operand` / `none ✓` — both wrong. Actual: LCC.js says `Possible infinite loop` (runtime, exit=1) and leaves `.e(4B)`. Oracle says `Possible infinite loop` then floods stdout in a debug-dump loop (never exits; killed at timeout). `jmp r0` row added. Footnote corrected. New deviation §19 documents the runtime divergence; classified BY DESIGN (beneficial). |
| 2026-06-01 | Deviation 20 added (#371, #441) | `.bin`/`.hex` loading message: LCC.js prints `Loading <file> (no assembly pass) — N word(s)`; oracle is silent. Message predated #371 (was `Assembling …`); #371 improved wording. Classified BY DESIGN. |
| 2026-06-01 | OG BUG #21 added (#270) | Successful `.o` assemble: oracle exits 1 ("needs linking"), LCC.js exits 0. Oracle's exit 1 is specific to the `.o` path — both exit 0 on `.e` assemble+run. Classified OG BUG: exit 1 conflates "no runnable output" with "error"; LCC.js exit 0 is semantically correct. |
| 2026-06-02 | Deviation 22 added (#501) | `bp` in non-interactive context: both runtimes auto-continue past `bp` (oracle does NOT flood stdout). Oracle enters step-trace mode, printing `<mnemonic>>>  <pc>:   <instruction>` before each instruction after the breakpoint; LCC.js continues cleanly with no traces. Classified BY DESIGN (clean output better for automated callers). Same root cause as §19 (oracle debug-dump mode) but bounded because the program terminates normally. |
| 2026-06-02 | OG BUG §24 added (#510) | `bl` / `call` / `jsr` with numeric token: oracle `Undefined label` vs LCC.js `Bad label`. Oracle accepts digit-led tokens as syntactically valid label names (defers rejection to lookup); LCC.js rejects upfront via `isValidLabel`. Classified OG BUG — upfront syntactic validation is correct. |
| 2026-06-02 | BY DESIGN §23 added (#500) | `.org` invalid operand: oracle emits `Bad number`; LCC.js emits `Invalid number for .org directive`. Classified BY DESIGN (more informative). Forward-gap padding confirmed byte-identical (parity achieved); `.orig` synonym confirmed parity-complete. Parity test added: `tests/new/assembler.org.oracle.e2e.spec.js`. |
| 2026-06-03 | LCC.js BUG §25 added (#524) | BR-family with numeric token: oracle rejects all variants (`br 5`, `brz 5`, `brn 5`, `brp 5`, `brgt 5`) with `Undefined label` (exit 1); LCC.js silently assembles (exit 0). Root cause: `assembleBR` calls `evaluateOperand` without a label-validation gate, unlike `assembleBL` (§24). Classified LCC.js BUG — fix is to add `isValidLabel` guard in `assembleBR`. Evidence: `docs/research/br-numeric-operand-parity.md`. |
| 2026-06-03 | §25 LCC.js BUG fixed (#538) | `assembleBR` now calls `isNumLiteral(operands[0])` before `evaluateOperand` — bare integer branch targets are rejected with `Bad label` (exit 1), matching oracle intent. Regression tests #95–#97 added to `tests/new/assembler.instructions.integration.spec.js`. §25 removed from "LCC.js BUG" section. |
| 2026-06-05 | LCC.js BUG §25 re-added (#852) | `din` newline-consumption parity: lccjs consumes the trailing `\n` after reading a decimal; OG LCC leaves it in stdin. Double-`ain` workaround in `simpleCalc.a` broken under lccjs (works under OG LCC). Classified LCC.js BUG. Research doc: `docs/research/ain-din-newline-parity-852.md`. |
| 2026-06-05 | §25 LCC.js BUG fixed (#857) | `readLineFromStdin()` simulated path now leaves `\n` in `inputBuffer` after reading a non-empty line (conditional `slice`); empty-line reads consume the `\n` to avoid infinite retry. TTY path prepends `\n` to `inputBuffer` instead of discarding it. `simpleCalc.a` double-`ain` program now produces `Result: 8` as expected. §25 removed from "LCC.js BUG" section. |
| 2026-06-06 | BY DESIGN §26 and §27 added (#934) | `.hex` oracle parity characterization complete. §26: empty/comment-only/whitespace-only `.hex` → oracle exits 1 ("Cannot open executable file"); lccjs exits 0 silently (BY DESIGN, mirrors §9). §27: malformed line diagnostics → oracle prints "Fewer/More than four hex digits" / "Bad hex number"; lccjs is silent on exit 1 (BY DESIGN — `fatalExit` discards message text). Evidence: `docs/research/hex-oracle-parity-934.md`. |
| 2026-06-15 | §11 augmented; header terminology note (#1371) | Confirmed §11 by probing the oracle (`-f` off → 67-col truncation; `-f` on / lccjs → full 166-col line). Documented the `-f`-flag connection: OG's `-f` disables the §11 truncation, which lccjs never does, so `-f` is a deliberate no-op in lccjs. `lcc`/`ilcc` now emit a non-blocking warning when `-f` is passed (`src/utils/flagDiagnostics.js` `FLAG_DEVIATIONS`). Added a header terminology note (OG/oracle/"OG Oracle" = original source-of-truth LCC; user-facing CLI messages say plain "LCC"). |
| 2026-06-15 | OG BUG §28 added (#1353) | `-d` debugger `c` command: a bare `c` (no operands) segfaults the oracle (exit 139); `c r0` (value omitted) prints `Missing operand` and `c r0 5` works, so the crash is the zero-operand case. LCC.js validates and never crashes (#1349). Drafted upstream report `docs/cuh63-debugger-bare-c-segfault-bug-report.md`; reports_summary row #28; umbrella #1406. Evidence: probe #1348. |
