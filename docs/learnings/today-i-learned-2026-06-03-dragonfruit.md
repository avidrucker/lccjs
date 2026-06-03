# TIL 2026-06-03 — DRAGONFRUIT

## `assembleBR` silently accepts numeric operands; `assembleBL` does not

**Discovered during:** #520 (ARCHITECT: three follow-on decisions from #510)  
**Spawned:** #524 (RESEARCH: probe br/brz/brn family with numeric operand against oracle)

---

### The finding

`bl 5` and `br 5` look symmetrical — both are branch instructions with an invalid operand — but lccjs handles them completely differently.

**`bl 5` → "Bad label" (correctly rejected)**

`assembleBL` calls `isValidLabel(label)` before anything else (line 1735 in `assembler.js`):

```js
assembleBL(operands) {
  let label = operands[0];
  if (!this.isValidLabel(label)) {
    this.failAssembly(`Bad label`, 1);  // '5' fails here — digit-led token
  }
  // ...
}
```

`isValidLabel` requires `/^[A-Za-z_$@][A-Za-z0-9_$@]*$/`. A digit-led token like `5` fails immediately. Both lccjs and the oracle reject `bl 5`; they just produce different messages (`Bad label` vs `Undefined label` — which is §24 in `parity_deviations.md`).

**`br 5` → silently assembles with numeric address (undetected gap)**

`assembleBR` has no `isValidLabel` gate. It calls `evaluateOperand(operand, 'e')` directly:

```js
assembleBR(mnemonic, operands) {
  let label = operands[0];
  // ...
  let address = this.evaluateOperand(label, 'e');  // no isValidLabel gate
  let pcoffset9 = address - this.locCtr - 1;
  // ...
}
```

And `evaluateOperand` tries `parseNumber` first:

```js
evaluateOperand(operand, usageType) {
  let value = this.parseNumber(operand);
  if (!isNaN(value)) {
    return value;  // '5' parses as 5 — returns immediately
  }
  // ... label lookup only reached for non-numeric tokens
}
```

`parseNumber('5')` returns `5` (not NaN), so `evaluateOperand` returns `5` as the branch target address before the label-lookup path is ever reached. The assembler treats `5` as an absolute address and computes `pcoffset9 = 5 - locCtr - 1`. If that offset is in range (−256 to 255), the instruction assembles silently with no error and no warning.

The oracle almost certainly rejects `br 5` as "Undefined label" (same token-as-label parser behavior it uses for `bl 5`). If so, lccjs silently produces code the oracle refuses to produce — a parity gap of the worst kind: lccjs too permissive, oracle correct to reject.

This applies to the entire `assembleBR` family: `br`, `bral`, `brz`, `bre`, `brnz`, `brne`, `brn`, `brp`, `brlt`, `brgt`, `brc`, `brb` (all 12 mnemonics dispatch through `assembleBR`).

---

### Why this wasn't caught earlier

The §24 parity deviation was documented specifically for `bl`/`call`/`jsr` — the mnemonics that route through `assembleBL`. The `assembleBR` code path was not investigated because the visible symptom (different error messages) doesn't apply there: `br 5` doesn't produce an error message at all.

The divergence was only visible once I traced the exact code path for each encoder: `assembleBL` has an early `isValidLabel` guard; `assembleBR` does not. The absence of a guard is easy to miss because `assembleBR` is doing the right thing for its intended inputs — it should accept label names, and `evaluateOperand` handles undefined labels correctly for those. The bug is that it also silently accepts numeric literals when it shouldn't.

---

### The scope of §24 (unchanged)

§24 in `parity_deviations.md` correctly describes the `bl 5` divergence:  
- oracle: "Undefined label" (defers rejection to symbol-table lookup)  
- lccjs: "Bad label" (upfront syntactic check via `isValidLabel`)

The `br`-family divergence is a **separate, unrelated mechanism** and should become its own parity deviation entry once #524's oracle probe confirms the oracle's behavior. §24 should not be widened.

---

### Lessons

1. **Absence of a symptom is not evidence of symmetry.** `bl` and `br` look like the same instruction category from the outside, but their assembler paths are structurally different. Always trace the actual code path rather than reasoning from the mnemonic family.

2. **`evaluateOperand` is not label-only.** Its first action is `parseNumber`, making it quietly accept raw integers as absolute addresses. Any mnemonic that calls `evaluateOperand` without a prior `isValidLabel` gate will silently assemble numeric operands. The places that have such gates (`assembleBL`, `assembleLD`, `assembleLEA`, etc.) are making a deliberate choice; the places that don't are implicitly permissive.

3. **Parity deviations in error paths can mask permissiveness bugs.** The `bl 5` difference ("Bad label" vs "Undefined label") is a message-quality divergence — both tools reject. If I had stopped at "both reject, different messages," I would have missed that the `br` family doesn't reject at all.

4. **Grep for `isValidLabel` calls to find the coverage boundary.** The eight call-sites in `assembler.js` mark exactly which paths have upfront syntactic validation. Anything not in that list is relying on `evaluateOperand` or downstream error handling — and `evaluateOperand` is more permissive than `isValidLabel`.

---

### Follow-up

- **#524** (OPEN) — RESEARCH: probe `br 5`, `brz 5`, `brn 5` against the oracle to confirm divergence and document as a new parity deviation.
- Once #524 closes, a DEV ticket should consider whether `assembleBR` should add an `isValidLabel` gate before calling `evaluateOperand`, or whether the numeric-address behavior is a deliberate LCC.js extension worth keeping.
