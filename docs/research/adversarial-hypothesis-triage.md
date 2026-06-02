# Adversarial Hypothesis Triage — #404

**Architect:** FIG · **2026-06-01** · **Parent:** #246, #382  
**Input:** `docs/research/adversarial_hypotheses.md` (31 hypotheses)  
**Deliverable:** Decision record + sequenced filing plan for the TDD campaign

---

## Decision record

### 1. Priority order — revised

The doc's recommended first-seven (H-010, H-003, H-012, H-020, H-025, H-026, H-028)
is directionally correct but misordered. Adversarial re-ranking:

| Rank | Hypothesis | Why this slot |
|------|-----------|---------------|
| 1 | **H-026** linker odd-buffer crash | Node `ERR_OUT_OF_RANGE` — uncaught exception, hardest failure mode, most concrete repro |
| 2 | **H-025** duplicate global symbols | Silent last-wins; linked program calls wrong function; no error surfaced |
| 3 | **H-020** div/rem by zero → silent 0 | `Infinity / NaN` coerces to 0 in Uint16Array; program continues wrong |
| 4 | **H-012** shift count overflow | 4-bit field with no bound → count 16 corrupts opcode bits silently |
| 5 | **H-008** adjacent commas → silent 0 | H-010's tokenizer twin: `add r0,,r1` may silently encode as `add r0, r1, #0` |
| 6 | **H-010** evaluateImmediate null→0 | `parseNumber(undefined)→null`, `isNaN(null)===false` → 0; but earlier operand checks may catch it — verify first |
| 7 | **H-028** disassembler round-trip | No round-trip test exists; #166 closed without covering fidelity |
| 8 | **H-017** stale inputFileName on reuse | Pure-seam caller risk; concrete, isolated |

H-010 drops from rank 1 to rank 6 because `assembleADD` likely has an earlier operand-count
check that fires before `evaluateImmediate` is reached with `undefined`. If the earlier guard
is absent, H-010 immediately re-promotes. The test decides.

### 2. Batch size

**31 individual tickets is too many** — it floods the backlog and buries the high-signal items.
Decision: file high-priority hypotheses as individual TEST(/FIX) tickets; batch medium-priority
hypotheses by subsystem with the solver expected to write all tests in the batch and report
which are bugs vs confirmed-correct behavior.

Filing breakdown:
- **8 individual tickets** — top-priority items, likely real bugs, ≤35m each
- **4 subsystem-batch tickets** — medium-priority items grouped by module, ~45–55m each
- **4 routed to existing issues** — #218 owns oracle-gated parity questions; no new tickets
- **1 LCC+ smoke prerequisite** — must precede H-030 adversarial ticket
- **Total new tickets: 14** (8 individual + 4 batch + 1 LCC+ smoke + 1 H-031 design)

### 3. Overlap with #166 and #218

| Hypothesis | Disposition |
|-----------|-------------|
| H-028 (disassembler round-trip) | **File new ticket.** #166 is CLOSED and covered only crash-on-known-input, not round-trip fidelity. Gap is real. |
| H-009 (branch pcoffset9 boundary) | **Route to #218.** Add as a comment on the open parity-backlog issue. |
| H-013 (sra vs shift siblings inconsistency) | **Route to #218.** Oracle-gated ISA question. |
| H-016 (bl numeric literal) | **Route to #218.** Oracle-gated parity question. |
| H-019 (octal parsing) | **Route to #218.** Explicitly in scope of that issue already. |

### 4. LCC+ (H-030)

**Yes, a smoke test must come first.** H-030 adversarially tests instance reuse — but with 0%
coverage there is no baseline. File a "LCC+ assembler smoke test" ticket first (assemble a
minimal valid `.ap` program, check the `.ep` output is non-empty and parseable). H-030 becomes
a follow-on tagged "after smoke test."

### 5. H-031 (REPORT_MULTI_ERRORS design constraint)

**File as a small TEST ticket** — not a fix, not a docs update. The deliverable is a passing
test that encodes the constraint: assert that two bad lines produce exactly one error in the
`errors` array. This is behavioral verification of a design choice, which is exactly what the
TDD workflow is for.

### 6. Oracle-gated hypotheses

H-001 does NOT need the oracle — the error-message expectation is internal. Oracle-gated items
(H-009, H-013, H-016, H-019) are routed to #218 where that infrastructure already lives.

---

## Full disposition table (all 31)

| H-ID | Sev | Disposition | Ticket / Route |
|------|-----|-------------|----------------|
| H-001 | 🔴 | **FILE individual** | Assembler: unterminated string error points to wrong line |
| H-002 | 🟡 | **BATCH (assembler-error-quality)** | Likely not a bug; verify |
| H-003 | 🔴 | **BATCH (assembler-encoding)** | `*+0x10` hex suffix parse — real edge case |
| H-004 | 🟡 | **BATCH (assembler-encoding)** | `.org N == locCtr` no-op boundary; probably correct |
| H-005 | 🔴 | **BATCH (assembler-encoding)** | `.blkw 65536` off-by-one; verify intentionality |
| H-006 | 🟡 | **BATCH (assembler-error-quality)** | Duplicate label error line number |
| H-007 | 🟡 | **BATCH (assembler-error-quality)** | `.word foo bar` silent second-token ignore |
| H-008 | 🔴 | **FILE individual** | Adjacent commas → possible silent 0 encode |
| H-009 | 🟡 | **ROUTE → #218** | Branch pcoffset9 boundary; oracle-gated |
| H-010 | 🔴 | **FILE individual** | evaluateImmediate null→0 (rank 6; may be guarded earlier) |
| H-011 | 🟡 | **BATCH (assembler-error-quality)** | `.start` error names the missing label |
| H-012 | 🔴 | **FILE individual** | Shift count overflow → opcode corruption |
| H-013 | 🟡 | **ROUTE → #218** | `sra` vs siblings shift-0 inconsistency; oracle-gated |
| H-014 | 🟡 | **BATCH (assembler-error-quality)** | `ret 32` range check message |
| H-015 | 🔴 | **BATCH (assembler-error-quality)** | `dout 5` gives "Bad register" — error quality |
| H-016 | 🟡 | **ROUTE → #218** | `bl 5` numeric literal — oracle-gated |
| H-017 | 🔴 | **FILE individual** | Stale `inputFileName` on instance reuse |
| H-018 | 🟡 | **BATCH (assembler-encoding)** | Multiple trailing blank lines in listing |
| H-019 | 🔴 | **ROUTE → #218** | Octal parsing; already in scope of that issue |
| H-020 | 🔴 | **FILE individual** | div/rem by zero → silent 0 |
| H-021 | 🔴 | **BATCH (interpreter)** | `instructionsCap` override verification |
| H-022 | 🟡 | **BATCH (interpreter)** | Custom SP before first push; stats reporting |
| H-023 | 🔴 | **BATCH (interpreter)** | LDR/STR at 0xFFFF via negative offset wrap |
| H-024 | 🟡 | **BATCH (interpreter)** | SEXT_PARITY_TABLE selector > 15 fallthrough |
| H-025 | 🔴 | **FILE individual** | Duplicate global symbols — silent last-wins |
| H-026 | 🔴 | **FILE individual** | Linker odd-buffer crash (ERR_OUT_OF_RANGE) |
| H-027 | 🟡 | **BATCH (linker)** | CLI edge cases: zero input files, missing `-o` arg |
| H-028 | 🔴 | **FILE individual** | Disassembler round-trip fidelity |
| H-029 | 🟡 | **BATCH (disassembler)** | Extended-group opcode disambiguation |
| H-030 | 🔴 | **FILE individual** (after smoke) | AssemblerPlus instance-reuse state leak |
| H-031 | 🟡 | **FILE individual** | REPORT_MULTI_ERRORS constraint verification |

---

## Sequenced filing plan

### Tier 1 — individual tickets, file now, high-priority

File in this order (each is a ≤35m DEV/TEST puzzle):

1. **H-026** — `TEST: linker parseObjectModuleBuffer crashes on odd-length code section (ERR_OUT_OF_RANGE)`  
   Role: TEST · H:30m · Agent: any  
   Deliverable: failing test confirming the crash; fix is a `LinkerError` check before the last read.

2. **H-025** — `TEST: linker silently accepts duplicate global symbols — verify error or document first-wins/last-wins`  
   Role: TEST · H:30m · Agent: any  
   Deliverable: test with two `.o` files exporting same label; confirm error or deterministic winner.

3. **H-020** — `TEST: interpreter div/rem by zero — verify runtime error, not silent 0`  
   Role: TEST · H:30m · Agent: any  
   Deliverable: failing test demonstrating silent 0; fix is a zero-divisor guard in executeTRAP.

4. **H-012** — `TEST: assembler shift count (srl/sll/rol/ror) not range-checked — count 16 overflows opcode field`  
   Role: TEST · H:30m · Agent: any  
   Deliverable: test encoding `srl r0, 16`; confirm either error or machine-word corruption.

5. **H-008** — `TEST: assembler adjacent-comma tokenizer — add r0,,r1 may silently encode as add r0,r1,#0`  
   Role: TEST · H:30m · Agent: any  
   Deliverable: tests for `add r0,,r1` and `add r0, r1,`; confirm clean error, not silent 0.

6. **H-010** — `TEST: evaluateImmediate — parseNumber(undefined) returns null which isNaN check passes as 0`  
   Role: TEST · H:30m · Agent: any  
   Deliverable: test that `add r0, r1` (missing immediate) errors, not silently encodes 0.

7. **H-028** — `TEST: disassembler round-trip fidelity — assemble→disassemble→re-assemble must be byte-identical`  
   Role: TEST · H:45m · Agent: any  
   Deliverable: parametric round-trip test for each major instruction type; report any deviations.

8. **H-017** — `TEST: assembler instance reuse — stale inputFileName leaks into second assembleSource call`  
   Role: TEST · H:25m · Agent: any  
   Deliverable: test calling assembleSource twice on same instance, no filename in second call; assert no stale filename.

9. **H-001** — `TEST: assembler unterminated string literal — error should report line 1, not the next line with a closing quote`  
   Role: TEST · H:25m · Agent: any  
   Deliverable: test for `.stringz "hello` without closing quote; assert error on line 1.

10. **LCC+ smoke** — `TEST: AssemblerPlus smoke test — assemble a minimal valid .ap program end-to-end`  
    Role: TEST · H:30m · Agent: any · **Prerequisite for H-030**  
    Deliverable: test that assembles a minimal `.ap` (with `.lccplus` directive), produces `.ep`, verifies non-empty output.

11. **H-030** — `TEST: AssemblerPlus instance reuse — resetAssemblyState must clear plus-specific state`  
    Role: TEST · H:30m · Agent: any · **Depends on LCC+ smoke ticket above**  
    Deliverable: test assembling two `.ap` programs on same instance; verify second result is clean.

12. **H-031** — `TEST: REPORT_MULTI_ERRORS=false constraint — verify exactly one error returned when two bad lines present`  
    Role: TEST · H:20m · Agent: any  
    Deliverable: passing test asserting `errors.length === 1` with two-bad-line source.

### Tier 2 — subsystem batch tickets

Each batch asks the solver to write tests for all hypotheses in the group and report which are bugs vs confirmed-correct behavior. Split into individual follow-on tickets only for actual bugs found.

13. **Assembler error-quality batch** (H-002, H-006, H-007, H-011, H-014, H-015)  
    Role: TEST · H:55m  
    Hypotheses: label-colon-in-string, duplicate-label line number, `.word foo bar`, `.start nonexistent` message, `ret 32` range message, `dout 5` register message.

14. **Assembler encoding/boundary batch** (H-003, H-004, H-005, H-018)  
    Role: TEST · H:45m  
    Hypotheses: `*+0x10` hex PC-relative, `.org N==locCtr` no-op, `.blkw 65536` off-by-one, trailing blank lines in listing.

15. **Interpreter behavior batch** (H-021, H-022, H-023, H-024)  
    Role: TEST · H:50m  
    Hypotheses: instructionsCap override, custom SP before push, 0xFFFF memory wrap, SEXT_PARITY_TABLE selector > 15.

16. **Linker + disassembler batch** (H-027, H-029)  
    Role: TEST · H:40m  
    Hypotheses: linker CLI edge cases (zero input files, missing -o arg), disassembler extended-group opcode disambiguation.

### Routes to #218 (no new tickets)

Add a single comment to #218 listing: H-009 (branch pcoffset9 boundary), H-013 (sra shift-0), H-016 (bl numeric literal), H-019 (octal parsing). These are pure oracle-parity questions that belong in that tracking issue.

---

## Adversarial critique of the original doc's priority list

| Original claim | Verdict |
|---|---|
| "H-010 is the highest-risk item" | **Overstated.** H-026 and H-025 are higher-severity — a Node crash and a silent wrong-function-call beat a potential null→0 that may be guarded upstream. H-010 is still important (rank 6). |
| "H-003 is a start-here item" | **Downgraded.** `*+0x10` hex PC-relative offsets are a rare usage pattern. Medium priority; batched rather than individual. |
| H-030 standalone | **Needs smoke test first.** Filing H-030 without any baseline LCC+ coverage is premature — can't tell if the test fails because of the hypothesis or because the whole LCC+ pipeline is broken. |
| "H-028: partly tracked in #166" | **Incorrect.** #166 is CLOSED and covered crash-on-input, not round-trip fidelity. H-028 is fully untracked. |
| Severity count: 12 🔴 | **Recount: 14.** The table in the issue says 12 High but lists 14 hypothesis IDs. Minor doc error; doesn't affect triage. |
