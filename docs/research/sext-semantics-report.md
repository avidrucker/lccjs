# `sext` semantics in LCC — research & bug report

**For:** Prof. Anthony Dos Reis (LCC author)
**From:** the LCC.js project (a JavaScript reimplementation of the LCC toolchain, validated for output parity against the `cuh63` 6.3 `lcc` binary)
**Re:** GitHub issue #150 · base-ISA `sext` instruction
**Date:** 2026-05-28

---

## TL;DR

The `sext` (sign-extend) instruction takes a second operand that the ISA table
describes only as *"sr specifies field to extend."* Empirically, that operand is
treated as a **bitmask** read from the runtime register value. `sext` produces a
**coherent** sign-extension **only when that mask is a contiguous low-order run
of 1-bits** (i.e. `sr ∈ {1, 3, 7, 15, 31, …} = 2^k−1`). For **every other**
selector value (e.g. `2, 4, 5, 6, 8, …`) the result corresponds to **no
sign-extension of any field of the input** — the output is non-monotonic and, as
far as we can tell, an artifact of the implementation rather than a defined
behavior.

We believe this is **(a) under-documented** and quite possibly **(b) a latent
bug** for non-contiguous selectors. This report shows the evidence and asks for
the intended contract.

---

## 1. What the documentation says

From the LCC ISA (as transcribed in `docs/lcc-isa.md`), the `sext` row is:

```
| sext | 1010  dr   sr 0 01101 | nz | dr sign extended (sr specifies field to extend) |
```

So `sext` is opcode `1010` (the extended-group opcode 10), eb-field `01101`, with
two 3-bit register operands `dr` and `sr`. The semantics are given as five words:
**"dr sign extended (sr specifies field to extend)."**

Three readings of *"sr specifies field to extend"* are all plausible from the
text alone:

1. **Bit width N** — `sr` holds a count; sign-extend the low `N` bits of `dr`.
2. **Bit index i** — `sr` holds a position; treat bit `i` of `dr` as the sign bit.
3. **Bitmask** — `sr` holds a mask; the set bits define the field.

The documentation does not say which, nor does it state any constraint on the
range or shape of `sr`. (Note also that `sr` is read at **run time** — it is the
*value currently in the register*, not an immediate field — so the selector is
generally data-dependent and not visible at assembly time.)

## 2. Method

A probe program holds a fixed input and sweeps the selector
`r1 = 0 … 15`, printing `sext r0, r1` each time:

```asm
        mov r0, 10        ; input = 0x000A = 0b01010
        mov r1, <k>       ; field selector
        sext r0, r1
        hout r0           ; print result
```

(Full source: [`experiments/sext_field_probe.a`](../../experiments/sext_field_probe.a).)

Run against the oracle `lcc` (cuh63 6.3):

```
cp sext_field_probe.a probe1.a && printf 'TestUser\n' > name.nnn
lcc probe1.a
```

## 3. Results — input `0x000A` (`0b01010`), oracle `lcc`

| selector `r1` | binary | oracle output | coherent sign-extend? |
|---:|:---|:---|:---|
| 0  | `0000` | `0x0000` | — (empty mask → 0) |
| **1**  | `0001` | `0x0000` | ✅ low **1** bit of `0b…0` = 0 → 0 |
| 2  | `0010` | `0x0002` | ✗ no field of `0b01010` sign-extends to `+2` here |
| **3**  | `0011` | `0xFFFE` | ✅ low **2** bits = `0b10`, sign set → −2 |
| 4  | `0100` | `0xFFFB` | ✗ = −5; not any field of the input |
| 5  | `0101` | `0xFFFA` | ✗ = −6 |
| 6  | `0110` | `0xFFFB` | ✗ = −5 |
| **7**  | `0111` | `0x0002` | ✅ low **3** bits = `0b010`, sign clear → +2 |
| 8  | `1000` | `0x0008` | ✗ = +8 |
| 9  | `1001` | `0x0008` | ✗ |
| 10 | `1010` | `0x000A` | ✗ = +10 |
| 11 | `1011` | `0xFFFE` | ✗ |
| 12 | `1100` | `0xFFFB` | ✗ |
| 13 | `1101` | `0xFFFA` | ✗ |
| 14 | `1110` | `0xFFFB` | ✗ |
| **15** | `1111` | `0xFFFA` | ✅ low **4** bits = `0b1010`, sign set → −6 |

The **only** selectors that produce a defensible sign-extension are
`r1 ∈ {1, 3, 7, 15}` — exactly the values `2^k − 1`. For those, `sext` sign-extends
the low-`k`-bit field of the input, which is the natural and useful behavior. The
remaining twelve selectors return values that do not correspond to sign-extending
*any* contiguous field of `0x000A`.

### Corroborating data set (`experiments/sext_boundaries.a`)

| input | `r1` | binary mask | oracle | reading |
|:---|---:|:---|:---|:---|
| `0x00FF` | 3 | `0b11` (2^2−1) | `0xFFFF` | ✅ low 2 bits `0b11`, sign set → −1 |
| `0x0011` | 5 | `0b101` (not 2^k−1) | `0xFFFB` (−5) | ✗ incoherent |
| `0x00F0` | 7 | `0b111` (2^3−1) | `0x0000` | ✅ low 3 bits `0b000` → 0 |
| `0x0070` | 7 | `0b111` (2^3−1) | `0x0000` | ✅ low 3 bits `0b000` → 0 |

Same conclusion: contiguous masks behave; the non-contiguous one (`r1=5`) does not.

## 4. Analysis

The evidence is consistent with `sext` treating `sr` as a **bitmask whose
contiguous low-order width defines the field to sign-extend**:

> `sext dr, sr` with `sr = 2^k − 1` ⟹ sign-extend the low `k` bits of `dr`.

Under that contract, selectors that are *not* of the form `2^k − 1` are
**out-of-contract**, and the values returned for them appear to be incidental
output of the internal bit manipulation rather than a defined result. They are
non-monotonic in both the selector and the input, so we could not fit them to any
simple alternative rule (bit-index, popcount, highest-set-bit — none match).

## 5. The problem

1. **Ambiguous specification.** "sr specifies field to extend" does not tell a
   programmer that `sr` is a *mask*, nor that it must be `2^k − 1`, nor what
   happens otherwise. A reasonable reader guesses "bit width" or "bit index" —
   both wrong.
2. **Silent garbage for out-of-contract selectors.** Because `sr` is a runtime
   value, a program that computes a selector and happens to land on a
   non-contiguous value (very easy — 12 of the low 16 values are non-contiguous)
   gets a silently wrong result with no diagnostic.

## 6. Questions / recommendations for the author

1. **What is the intended contract for `sr`?** Is it a mask (`2^k − 1`), a width,
   or something else? Confirming this lets us document it precisely and decide
   whether the out-of-contract outputs are "don't care" or a bug.
2. **If `sr` is meant to be a `2^k − 1` mask:** could the ISA documentation say so
   explicitly (e.g. *"sr is a mask of the form 2^k−1 selecting the low k bits;
   other values are undefined"*), and could the toolchain optionally diagnose
   non-`2^k−1` selectors rather than returning silent garbage?
3. **Is there a canonical idiom** for `sext` in LCC course material we should
   mirror in our teaching demos? (Our demo that motivated this, `happy-path.a`,
   had `sext` stubbed precisely because its usage was unclear.)

## 7. Reproduction

```bash
# Oracle (cuh63 6.3):
cd $(mktemp -d) && cp <repo>/experiments/sext_field_probe.a probe1.a
printf 'TestUser\n' > name.nnn
lcc probe1.a            # observe the r1=0..15 sweep

# LCC.js (identical output — see §8):
node src/cli/lcc.js experiments/sext_field_probe.a
```

## 8. LCC.js parity note (not a divergence)

LCC.js reproduces the oracle's `sext` output **exactly** for every case above —
verified by `diff` of the full `r1 = 0…15` sweep. To achieve this, LCC.js could
not implement `sext` as a formula; it ships a literal **16 × 32 lookup table**
(`SEXT_PARITY_TABLE` in `src/core/interpreter.js`) capturing the oracle's output
for selectors `0…15` over the low-5-bit input space, falling back to a raw-mask
sign-extend for selectors `≥ 0x10`. The fact that matching the reference required
hardcoding a table — rather than a one-line sign-extend — is itself evidence that
the behavior for non-contiguous selectors is not specified by any simple rule.

This report does not propose changing LCC.js (its job is to match the oracle). It
asks the author to clarify or correct the reference semantics, after which both
the documentation and LCC.js's table can be revisited.
