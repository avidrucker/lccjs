# Demo research questions — closure summary (#144)

Tracker for the four demo questions split out of #142. All four children are
resolved as of 2026-06-03. This note consolidates the findings and points to
where each answer lives.

---

## Q1 — `sext` sign-extension semantics (#150, CLOSED)

**Site:** `demos/happy-path.a:262`

**Finding:** `sext dr, sr` sign-extends `dr` using the runtime value of `sr` as a
bitmask. The instruction is only well-defined when `sr` holds a contiguous low-order
run of 1-bits — i.e. `sr ∈ {1, 3, 7, 15, 31, …} = 2^k−1`. For any other selector
value the output is non-monotonic and appears to be an implementation artifact rather
than a defined sign-extension.

**Status:** Report sent to Prof. Dos Reis; awaiting reply (#159, blocked). If he
confirms the `2^k−1` contract, lcc-isa.md and a diagnostic in the assembler/runtime
follow. Full evidence in [`docs/research/sext-semantics-report.md`](./sext-semantics-report.md).

---

## Q2 — `jmp` condition-suffix mnemonics (#151, CLOSED)

**Site:** `demos/happy-path.a:281`

**Finding:** **Documentation error in Appendix B p.276.** Condition-suffixed `jmp`
forms (`jmpz`, `jmpn`, `jmpe`, …) do not exist in the LCC ISA. Both lccjs and the
reference oracle (cuh63 6.3) reject every suffixed form with `Invalid operation`.
`jmp` has no condition-code field in its encoding; conditional branches use `br<cc>`.
lccjs is parity-correct; no assembler change is needed.

**Status:** Resolved. Clarifying note added to [`docs/lcc-isa.md`](../lcc-isa.md).
Full evidence in [`docs/research/jmp-condition-suffix-mnemonics.md`](./jmp-condition-suffix-mnemonics.md).

---

## Q3 — `cea` (compute effective address) semantics (#152, CLOSED)

**Site:** `demos/happy-path.a:317`

**Finding:** `cea dr, imm5` is a pseudo-instruction that expands to `add dr, fp,
imm5`. It computes the frame-pointer-relative address of a stack-frame local — the
fp-relative analogue of `lea` (which is PC-relative). Operand width is `imm5`
(range −16..15). Oracle parity is confirmed empirically:

```asm
cea r1, 0   ; → 0x1360  (add r1, fp, 0)
cea r2, -1  ; → 0x157f  (add r2, fp, -1)
```

**Status:** Resolved. `cea` added to the pseudo-instruction list in `lcc-isa.md`
and the immediate-width table in `docs/glossary/assembler.md` corrected (it was
incorrectly listed under `pcoffset9`; moved to the `imm5` row). No separate research
doc; findings are inline in the docs.

---

## Q4 — gameSnake malloc/free-stub memory leak (#153, CLOSED wontfix)

**Site:** `plusdemos/gameSnake.ap:169` (`removeSnakeTail`)

**Finding:** Yes, the pattern leaks. `gameSnake.ap` uses a **bump allocator**
(`malloc` at line 626) that increments a single `@avail` pointer and returns the
old value. There is no corresponding `free`: when `removeSnakeTail` removes the
oldest snake segment, the commented-out free stub is skipped and the node's memory
is permanently lost. The allocator comment itself confirms this: *"There is no free
in this demo, so removed snake segments are not reclaimed."*

This is intentional for a demo — the snake is bounded in length by the game logic,
so the leak is bounded and the program terminates before heap exhaustion. But it is
technically a memory leak: every call to `removeSnakeTail` orphans 3 words of heap.

**Status:** Closed wontfix (#153, 2026-05-29). Low priority for a demo; will
resurface in the #202 code-quality pass on `gameSnake.ap` if a proper free-list
allocator is ever added.

---

## Tracker disposition

All four children resolved; #144 closed on this commit.
