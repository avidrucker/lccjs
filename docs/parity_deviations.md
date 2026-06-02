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

## LCC.js BUG — LCC.js deviates from OG LCC (fix pending)

_None currently — see Changelog for OB-001 (#31 closed), OB-002 (#32 closed),
and OB-026 (#59 decided → BY DESIGN §17)._

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

**Source:** `src/core/lcc.js` (`main()` dispatch comment: "Multiple .a files: only
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
