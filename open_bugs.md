# Open Bugs

Centralized log of **bugs in LCC.js code** (and one upstream bug in
cuh63 6.3 that affects parity work). Distinct from:

- [`current_issues.md`](./current_issues.md) — broader living index
  (bugs, missing features, doc gaps, test gaps, smells, research).
- [`TODOS.md`](./TODOS.md) — planned refactor / parity / feature work.
- [`docs/init_code_review.md`](./docs/init_code_review.md) — frozen
  May 2026 snapshot review.

Each bug below has: **ID** (referenceable from commits and other
docs), **severity**, **status**, **where**, a short description, and
suggested fix. Citations are `main`-relative; line numbers drift as
the code evolves, so verify file:line before fixing.

Last updated: 2026-06-01 — reconciled all entries OB-001..OB-026 against
their resolution commits. OB-001..OB-007 + OB-012 verified in #165;
OB-009..OB-026 verified in #170. Only OB-008 (upstream cuh63 bug) remains
open. All others are FIXED or DOCUMENTED on `main`.

---

## Confirmed bugs (verified)

### OB-001 — LCC.js `mov` accepts out-of-spec immediates and silently wraps
- **GH:** [#31](https://github.com/avidrucker/lccjs/issues/31)
- **Severity:** medium (silent miscompile, not a crash)
- **Status:** FIXED in `d39fe90` (verified 2026-05-28) — `mov` now
  routes through `evaluateImmediate(-256,255)` at `assembler.js:1940`,
  the same validator `mvi` uses.
- **Where:** `src/core/assembler.js` (the `mov` parser path)
- **Description:** The LCC ISA defines `mov dr, imm9` as a
  pseudo-instruction for `mvi dr, imm9`, with `imm9` a signed 9-bit
  field (range −256..+255). LCC.js's `mvi` correctly enforces that
  range; its `mov` does not. `mov r0, 256` is silently encoded as
  `mov r0, −256` (9-bit signed wraparound); `mov r0, 512` is
  encoded identically to `mov r0, 0` with no warning. Range-check
  bug, in the opposite direction from the cuh63 6.3 regression
  (OB-008).
- **Reproduction:**
  [`public_experiments/mov_mvi_parity/probe_mvi.sh`](./public_experiments/mov_mvi_parity/probe_mvi.sh)
- **Suggested fix:** Route `mov`'s immediate validator through the
  same code path `mvi` uses (or share a common helper). Add unit
  tests for −257, −256, +255, +256.

### OB-002 — Disassembler decodes `mvi` imm9 with an 8-bit mask
- **GH:** [#32](https://github.com/avidrucker/lccjs/issues/32)
- **Severity:** medium (latent — module has 0% coverage)
- **Status:** FIXED in `ee54749` (verified 2026-05-28) — mask
  corrected to `word & 0x1FF` at `disassembler.js:427`. (Module still
  has 0% test coverage — tracked separately in #166.)
- **Where:** `src/extra/disassembler.js:419`
- **Description:** `disassembleMVI` does `word & 0xFF` then
  sign-extends to 9 bits. The correct mask is `0x1FF`. For a
  spec-correct encoding like `mov r0, -15 → d1f1`, the disassembler
  would lose bit 8 and emit `mvi r0, 241` instead of `mvi r0, -15`.
  Same off-by-one-bit family of error as OB-001, in a different layer.
- **Suggested fix:** Change `word & 0xFF` → `word & 0x1FF`. Add a
  round-trip test (assemble → disassemble → re-assemble) for a few
  representative negative `mvi` immediates.

### OB-003 — Linker `error()` does not abort; `link()` writes broken `.e`
- **GH:** [#33](https://github.com/avidrucker/lccjs/issues/33), [#34](https://github.com/avidrucker/lccjs/issues/34), [#35](https://github.com/avidrucker/lccjs/issues/35) (decomposed)
- **Severity:** high (writes corrupt output silently)
- **Status:** FIXED in `2788fe2` (verified 2026-05-28) — `error()`
  now throws `LinkerError` (`linker.js:356`); `adjustExternalReferences`
  raises on an undefined symbol and `link()` aborts before
  `createExecutable()`, so no broken `.e` is written.
- **Where:** `src/core/linker.js:172-205, 363-366`
- **Description:** `Linker.error()` sets `errorFlag` and logs but
  does not throw. After `adjustExternalReferences()` returns early
  on an undefined-symbol error, `link()` falls through to
  `adjustLocalReferences()` and `createExecutable()`, writing a
  corrupt `.e` file to disk. The `linker.md` doc advertises a
  typed `LinkerError` boundary that the rest of the linker does
  not actually use.
- **Suggested fix:** Either make `error()` throw a `LinkerError`
  matching the doc (preferred), or check `errorFlag` between phases
  and bail before `createExecutable()`. Add an integration test
  with an unresolved external reference.

### OB-004 — `Interpreter.raiseRuntimeError` ignores `throwOnRuntimeError`
- **GH:** [#36](https://github.com/avidrucker/lccjs/issues/36)
- **Severity:** low (dead flag, no behavior change)
- **Status:** FIXED in `4d7f9de` (verified 2026-05-28) — the dead
  `throwOnRuntimeError` flag was removed; `raiseRuntimeError` is now a
  clean 3-liner (`interpreter.js:1735`).
- **Where:** `src/core/interpreter.js:1542-1550` (raise path);
  `src/core/interpreter.js:271` (flag set in `executeBuffer`)
- **Description:** `throwOnRuntimeError` is set on the instance but
  `raiseRuntimeError` always re-throws regardless. Test/CLI
  behavior happens to be correct only because `isTestMode` and the
  `main()` catch/remap conspire to produce the right outcome. Dead
  code, contradicts `docs/interpreter.md`.
- **Suggested fix:** Either honor the flag (branch on it like
  `Assembler.abortAssembly` does), or delete it entirely.

### OB-005 — `genStats.js` decimal / hex program-size inconsistency
- **GH:** [#37](https://github.com/avidrucker/lccjs/issues/37)
- **Severity:** medium (silent numerical inconsistency in reports)
- **Status:** FIXED in `7285f56` (verified 2026-05-28) — both the
  decimal and hex program-size forms now use
  `memMax - loadPoint + 1` (`genStats.js:129`).
- **Where:** `src/utils/genStats.js:125`
- **Description:** Decimal program-size uses `interpreter.memMax + 1`;
  hex form uses `interpreter.memMax - interpreter.loadPoint + 1`.
  The decimal form is wrong whenever `loadPoint != 0`.
- **Suggested fix:** Use `memMax - loadPoint + 1` for both. Add a
  unit test with a non-zero `loadPoint`.

### OB-006 — `interpreterplus.js` xorshift comments contradict the code
- **GH:** [#38](https://github.com/avidrucker/lccjs/issues/38)
- **Severity:** low (doc-only; code is correct classical xorshift)
- **Status:** FIXED in `047cfa6` (verified 2026-05-28) — the xorshift
  step comments in `executeRand()` now match the actual shifts.
- **Where:** `src/plus/interpreterplus.js:382-384`
- **Description:** Comments say "XOR shift right by 7 / left by 9 /
  right by 13" but code performs `<< 13`, `>> 17`, `<< 5`. The
  shifts (13, 17, 5) are a canonical 16-bit xorshift triple, so the
  code is likely correct; the comments are misleading.
- **Suggested fix:** Either correct the comments to match the
  shifts, or delete them — the variable name and constants are
  enough for any reader who knows xorshift.

### OB-007 — Linker `link()` accumulates state across calls
- **GH:** [#39](https://github.com/avidrucker/lccjs/issues/39)
- **Severity:** low (latent; no current caller invokes twice)
- **Status:** FIXED in `16d98b1` (verified 2026-05-28) — `link()`
  now calls `resetState()` at entry (`linker.js:170`).
- **Where:** `src/core/linker.js` (`link()` method)
- **Description:** `link()` does not reset `mca`, `mcaIndex`,
  `GTable`, etc. Calling `linker.link(...)` twice on the same
  instance silently produces garbage. Not exercised today, but
  it's a future trap and inconsistent with the assembler's
  reset-on-entry pattern.
- **Suggested fix:** Initialize per-call state at the top of
  `link()`, or factor a `reset()` helper and call it first.

---

## Upstream bugs (not LCC.js code, but affect parity work)

### OB-008 — cuh63 6.3: `mov` rejects negatives that its own `mvi` accepts
- **GH:** [#40](https://github.com/avidrucker/lccjs/issues/40)
- **Severity:** medium (blocks oracle regen of 5 demos)
- **Status:** report drafted, not yet sent
- **Where:** cuh63 6.3 `lcc` binary
- **Description:** The same binary's `mvi` accepts the documented
  spec-correct range (−256..+255); its `mov` rejects all negative
  immediates. The ISA summary shipped in the same package defines
  `mov` as a pseudo-instruction for `mvi`, so they should be
  equivalent. The older cuh-6.x build that produced the
  educational example listings (still in this repo's
  `tests/goldens/`) did not have this divergence — same `Ver 6.3`
  string in the listings, different validation logic.
- **Reproduction:**
  [`public_experiments/mov_mvi_parity/`](./public_experiments/mov_mvi_parity/)
- **Action:** Send
  [`docs/cuh63-mov-immediate-bug-report.md`](./docs/cuh63-mov-immediate-bug-report.md)
  to Prof. Anthony Dos Reis (dosreist@newpaltz.edu /
  aiwibird@gmail.com per `0READFIRST.txt`).

---

## High-suspicion smells (likely bugs; need verification)

### OB-009 — `assemblerplus.js:158` double-exits on error
- **GH:** [#41](https://github.com/avidrucker/lccjs/issues/41)
- **Severity:** medium (loses multi-error reporting)
- **Status:** FIXED in `4fba6ee` (verified 2026-06-01) — redundant `fatalExit()` after `error()` removed from `assembleRAND` in `assemblerplus.js`.
- **Where:** `src/plus/assemblerplus.js:158`
- **Description:** After calling `this.error()` (which sets
  `errorFlag` per the parent's pattern), the code immediately calls
  `fatalExit()`, bypassing error accumulation. Parent `Assembler`
  uses `errorFlag` to keep going and surface multiple errors in
  one pass; the plus variant short-circuits that.
- **Suggested fix:** Either remove the immediate `fatalExit()` and
  rely on `errorFlag`, or document why plus-mode wants
  fail-fast (and rename to make the intent visible).

### OB-010 — `assemblerplus.js:184` requires undocumented `.lccplus` directive
- **GH:** [#42](https://github.com/avidrucker/lccjs/issues/42)
- **Severity:** low (UX issue)
- **Status:** FIXED in `05ee186` (verified 2026-06-01) — error message improved to tell users what directive to add; usage skeleton added to `assemblerplus.md`.
- **Where:** `src/plus/assemblerplus.js:184`
- **Description:** Requires the source to begin with a `.lccplus`
  directive or exits with error. Not documented in `plus.md` or
  surfaced in any user-facing message that would help a
  newcomer.
- **Suggested fix:** Add the requirement to `src/plus/plus.md`;
  improve the error message to tell users what to add.

### OB-011 — `interpreterplus.js:36` dead `instructionsCap`
- **GH:** [#43](https://github.com/avidrucker/lccjs/issues/43)
- **Severity:** low (dead code)
- **Status:** FIXED in `c163d11` (verified 2026-06-01) — dead `instructionsCap` field removed from `InterpreterPlus`.
- **Where:** `src/plus/interpreterplus.js:36`
- **Description:** `this.instructionsCap = Infinity;` set in
  constructor; never read anywhere in the class. Either a leftover
  from a removed feature or a hook for one never implemented.
- **Suggested fix:** Delete, or wire it up if the feature is
  wanted.

### OB-012 — `interpreterplus.js:167` magic batch size of 500
- **GH:** [#44](https://github.com/avidrucker/lccjs/issues/44)
- **Severity:** low (smell)
- **Status:** FIXED in `8c443a8` (verified 2026-05-28) — the magic
  `500` was extracted to a named `ASYNC_BATCH_SIZE` constant.
- **Where:** `src/plus/interpreterplus.js:167`
- **Description:** `for (let i = 0; i < 500; i++)` processes 500
  instructions per tick with no rationale comment, constant, or
  test. Number could be too high (UI lag in `.ap` games) or too
  low (throughput throttle) and nobody would know.
- **Suggested fix:** Lift to a named constant with a comment
  explaining the trade-off, or measure and document.

### OB-013 — `lccplus.js:40-42` argument-shadowing on constructor + main()
- **GH:** [#45](https://github.com/avidrucker/lccjs/issues/45)
- **Severity:** low (fragile coupling)
- **Status:** FIXED in `fe71af7` (verified 2026-06-01) — redundant `inputFileName` pre-set removed from `LCCPlus` constructor; single source of truth via `main()` argument.
- **Where:** `src/plus/lccplus.js:40-42`
- **Description:** Passes `this.inputFileName` both to the
  assembler constructor and to its `main([this.inputFileName])`.
  Relies on undocumented ordering of who mutates what.
- **Suggested fix:** Either pass via constructor only or via
  `main()` only; document the chosen direction.

### OB-014 — `disassembler.js:84-87` silently skips G/E/V header entries
- **GH:** [#46](https://github.com/avidrucker/lccjs/issues/46)
- **Severity:** medium (latent; module has 0% coverage)
- **Status:** FIXED in `67e551d` (verified 2026-06-01) — null-terminator absence in G/E/V header entries now detected; typed error raised on malformed input.
- **Where:** `src/extra/disassembler.js:84-87`
- **Description:** Skips header G/E/V entries assuming they end at
  a null terminator. No check that the null terminator exists;
  premature EOF silently corrupts the label data without an error.
- **Suggested fix:** Validate the terminator-or-EOF case; raise a
  typed error on malformed input.

### OB-015 — `disassembler.js:189-210` `.zero` adjustment may truncate
- **GH:** [#47](https://github.com/avidrucker/lccjs/issues/47)
- **Severity:** medium (latent)
- **Status:** FIXED in `2b9e136` (verified 2026-06-01) — `adjustZeroDirectives` now iterates all labels in a zero block; adjusted count validated positive.
- **Where:** `src/extra/disassembler.js:189-210`
- **Description:** `adjustZeroDirectives` breaks on the first
  label found inside a `.zero` range; doesn't handle multiple
  labels in one zero block or validate that the adjusted count
  stays positive.
- **Suggested fix:** Iterate all labels in the range; assert
  adjusted count `> 0` and emit a typed error otherwise.

### OB-016 — `disassembler.js:731-805` unbounded string accumulation
- **GH:** [#48](https://github.com/avidrucker/lccjs/issues/48)
- **Severity:** medium (memory-DoS surface if disassembler is
  ever exposed to untrusted input)
- **Status:** FIXED in `94e98fb` (verified 2026-06-01) — `processData()` string accumulation capped; typed error on overflow.
- **Where:** `src/extra/disassembler.js:731-805`
- **Description:** `processData()` accumulates string bytes
  until a null terminator. A blob with many printable ASCII bytes
  could create an arbitrarily large in-memory string before
  termination.
- **Suggested fix:** Cap the accumulation length (e.g. 64KB),
  emit a typed error on overflow.

### OB-017 — `linkerStepsPrinter.js:501` V-table adjustment silently wraps
- **GH:** [#49](https://github.com/avidrucker/lccjs/issues/49)
- **Severity:** medium (latent; tool has 0% coverage)
- **Status:** FIXED in `345a2f9` (verified 2026-06-01) — overflow detected before `Uint16Array` store; typed error raised.
- **Where:** `src/extra/linkerStepsPrinter.js:501`
- **Description:** `preAdjustmentWord + globalAddr` is stored into
  a `Uint16Array` slot. If the sum exceeds 0xFFFF it wraps
  silently — likely creating an invalid address.
- **Suggested fix:** Check for overflow and emit a typed error
  before storing.

### OB-018 — `linkerStepsPrinter.js` `writeExecutable` lacks try/finally
- **GH:** [#50](https://github.com/avidrucker/lccjs/issues/50)
- **Severity:** low (partial-write leaves fd open + corrupt file)
- **Status:** FIXED in `12ab410` (verified 2026-06-01) — `writeExecutable` wrapped in try/catch/finally; fd closed and partial file unlinked on failure.
- **Where:** `src/extra/linkerStepsPrinter.js` (`writeExecutable`)
- **Description:** Uses `openSync`/`writeSync` without try/finally.
  On a mid-stream write failure the fd is leaked and the file is
  left in a half-written state.
- **Suggested fix:** Wrap in try/finally that closes the fd; on
  write failure, unlink the partial file.

### OB-019 — `Interpreter.executeSRL/SRA/ROL/ROR` corner at `ct = 0`
- **GH:** [#51](https://github.com/avidrucker/lccjs/issues/51)
- **Severity:** low (unreachable today)
- **Status:** DOCUMENTED in `b5c718a` (verified 2026-06-01) — corner unreachable today (assembler defaults `ct` to 1); documented in-code with rationale; no guard added (wontfix-by-design).
- **Where:** `src/core/interpreter.js:920-944`
- **Description:** Uses `ct - 1` to extract the "last bit shifted
  out." For `ct = 0`, the expression becomes `>> -1`, which JS
  evaluates as `>> 31`. The assembler defaults `ct` to 1 so the
  zero case is not currently reachable, but the corner is
  undocumented.
- **Suggested fix:** Guard the `ct = 0` case or document why it
  cannot be reached.

---

## Accumulated TODO debt (lurking unknowns)

### OB-020 — `loadPoint = 0` hardcoded in 5 spots; `-l<hex loadpt>` flag incomplete
- **GH:** [#52](https://github.com/avidrucker/lccjs/issues/52), [#53](https://github.com/avidrucker/lccjs/issues/53) (decomposed)
- **Severity:** medium (documented feature does not work)
- **Status:** FIXED in `6cb6cce` (OB-020a) + `37781e6` (OB-020b) (verified 2026-06-01) — five `loadPoint = 0` sites consolidated to `defaultLoadPoint`; `-l<hex>` flag wired to listing display.
- **Where:** `src/core/assembler.js:119, 192, 581, 715, 787`
- **Description:** All five sites set `loadPoint = 0` with the
  identical TODO comment "flags may dictate where in memory the
  program starts." The `-l<hex loadpt>` flag is documented (in
  `lcc.js` help output) but the assembler always assumes load
  point 0.
- **Suggested fix:** Plumb the flag from `lcc.js` through to a
  single `loadPoint` setter on the assembler; remove the
  five duplicates; add an integration test with `-l1000`.

### OB-021 — `evaluateImmediate` bounds untested across 6+ instructions
- **GH:** [#54](https://github.com/avidrucker/lccjs/issues/54)
- **Severity:** medium (validators may not actually validate)
- **Status:** FIXED in `6bfee1b` (verified 2026-06-01) — 20 boundary tests added covering all 7 `evaluateImmediate` call sites.
- **Where:** `src/core/assembler.js:1361, 1592, 1622, 1796, 1808, 1820, 1837`
- **Description:** Each site carries `//// TODO: test bounds, see
  if input is naive or not`. Bounds are passed in (e.g. −16..15
  for `imm5`, −32..31 for `offset6`) but no negative tests
  confirm the validator actually rejects out-of-range values.
  Same family of risk as OB-001 — a missing range check that
  may be silently wrapping.
- **Suggested fix:** Add a parametrized unit test that walks each
  call site with values at −1/+0/+max/+max+1/−min−1.

### OB-022 — `assembler.js:1781` `pcoffset11 out of range` path untested
- **GH:** [#55](https://github.com/avidrucker/lccjs/issues/55)
- **Severity:** low (validator likely correct but unverified)
- **Status:** FIXED in `586feef` (verified 2026-06-01) — `pcoffset11` out-of-range error path covered by integration test with a too-far branch target.
- **Where:** `src/core/assembler.js:1781`
- **Description:** Explicit `// TODO: test this in integration
  tests` next to the error path. The check exists; no test
  exercises it.
- **Suggested fix:** Add a small `.a` test program with a too-far
  branch target.

### OB-023 — Dead `.word` validation block with five outstanding TODOs
- **GH:** [#56](https://github.com/avidrucker/lccjs/issues/56)
- **Severity:** low (dead code + accumulated questions)
- **Status:** FIXED in `aa2dc48` (verified 2026-06-01) — dead validation block removed; accepted `.word` operand spacing forms documented in a reference table.
- **Where:** `src/core/assembler.js:1077-1084`
- **Description:** 8 lines of commented-out `this.error` / `return`
  with five "inspect to make sure" TODOs covering `.word` operand
  spacing variants (`.word x + 1`, `.word x+1`, `.word x +1`, etc.)
  and empty operand cases.
- **Suggested fix:** Either implement the validation and uncomment,
  or remove the dead block and document the accepted forms in the
  `.word` docs.

### OB-024 — Operand-spacing TODOs for `ret+3` / `ret +3` / `ret+ 3` / `ret + 3`
- **GH:** [#57](https://github.com/avidrucker/lccjs/issues/57)
- **Severity:** low (open parity question)
- **Status:** FIXED in `8ccc7df` (verified 2026-06-01) — four `ret`-spacing TODOs collapsed into one decision; accepted forms documented + 5 spacing-variant tests added.
- **Where:** `src/core/assembler.js:1844-1847`
- **Description:** Four near-identical TODOs about whether `ret`
  with various whitespace patterns is valid. The four variants
  should collapse into one decision, captured in
  `core-behavior-matrix.md`, and ideally one test.
- **Suggested fix:** Decide and write down which variants are
  accepted; collapse the four TODOs.

### OB-025 — `interpreter.js:1101` line-ending portability untested
- **GH:** [#58](https://github.com/avidrucker/lccjs/issues/58)
- **Severity:** low (cross-platform risk)
- **Status:** FIXED in `ba05124` (verified 2026-06-01) — 3 CRLF portability tests added; input-buffer path verified for both `\r\n` and `\n`.
- **Where:** `src/core/interpreter.js:1101`
- **Description:** `// TODO: check to make sure this behaves as
  expected on both Linux and Windows`. Input-handling code path,
  potentially CRLF-sensitive. No Windows CI run.
- **Suggested fix:** Add a unit test that drives `inputBuffer`
  with explicit `\r\n` and verifies the same parse as `\n`.

### OB-026 — `lcc.js:85` multi-file input not implemented
- **GH:** [#59](https://github.com/avidrucker/lccjs/issues/59)
- **Severity:** low (missing feature, not active bug)
- **Status:** DOCUMENTED in `0391071` (verified 2026-06-01) — multi-file `.a` input documented as a known research divergence in `parity_deviations.md`; no implementation planned (wontfix-by-design).
- **Where:** `src/core/lcc.js:85`
- **Description:** `// TODO: (extra feature) check similarly to
  see if multiple .a files were ...`. Multi-input handling is a
  documented oracle behavior LCC.js doesn't implement.
- **Suggested fix:** Decide whether to implement; if not, close
  the TODO with a pointer to `core-behavior-matrix.md`.

---

## See also

- [`current_issues.md`](./current_issues.md) — broader living
  index (this file is the bug-focused subset).
- [`docs/init_code_review.md`](./docs/init_code_review.md) —
  May 2026 snapshot review; many of these entries originate
  there.
- [`docs/learnings/`](./docs/learnings/) — write-ups of
  resolved investigations.
- [`public_experiments/`](./public_experiments/) — runnable
  reproductions linked from individual bug entries.
