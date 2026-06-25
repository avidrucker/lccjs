# Donut → base-LCC porting notes (#1468)

Spike output. Establishes what a single-frame ASCII-donut port to base LCC needs,
grounded in a working C reference and the LCC ISA.

## Modules in this directory

| File | Role |
|---|---|
| `donut_ref.c` | a1k0n's original animating bit-ops donut, saved verbatim. The "golden" source. |
| `donut_frame.c` | Simplified **single static frame**. Same fixed-point math, animation/ANSI/timing stripped. **Byte-for-byte identical** to frame 0 of `donut_ref.c`. This is the parity oracle. |
| `frame_simple.txt` | The canonical 23×79 golden frame (output of `donut_frame.c`, == multiplier path). |
| `donut_A_shiftadd.c` / `frame_A.txt` | Variant using a1k0n's lossy 11-bit shift-add multiply substitute. Renders a *slightly different* donut (15 rows differ). |
| `donut_B_cordic16.c` | Variant proving the CORDIC accumulator fits in `int16_t` — identical output. |

Reproduce: `gcc -O2 -o donut_frame donut_frame.c && ./donut_frame | diff - frame_simple.txt`

## What ports cleanly to base LCC

- **16-bit integers throughout.** The state (`sA/cA/...`), the per-pixel vectors
  (`vxi14/vyi14/vzi14`), the ray-march point (`px/py/pz`) and lighting (`lx/ly/lz`)
  are all `int16_t`. ✔ native word size.
- **CORDIC is fully 16-bit safe.** Variant B proves clamping its `x2` accumulator
  to `int16_t` changes nothing. ✔ no 32-bit needed in magnitude/lighting.
- **No floating point, no div/rem, no sqrt.** All avoided by design. ✔
- **`sra` = signed `>>`** (sign-replicating). ✔ exact match for C's signed shift.
- **`and`/`or`/`xor`/`not`** exist → `d&1024`, `d&1023`, `(...)<<1` all map. ✔
- **Constant multiplies fold to shifts/adds:** `dz*sB>>6` (dz=5) = `(sB+(sB<<2))>>6`;
  `r1*256`/`r2*256`/`8*256` are compile-time constants → constant pool. ✔

## The three real obstacles

### 1. The 32-bit multiply `d * vxi14 >> 14` (the crux)
`d` ≈ 2..1100 (11 bits), `vxi14` is ±16384 (14-bit fixed point). Product ≈ up to
~18M → needs ~25 bits. LCC `mul` returns only the **low 16 bits**, so it gives the
wrong answer. Two ways out:

- **(a) Exact:** software signed 16×16→32 multiply (hi:lo), then `>>14` across the
  double word. Matches `frame_simple.txt` exactly. ~1 routine, called 3×/march-step.
- **(b) a1k0n's shift-add:** port the `#else` branch verbatim — keeps only 16-bit
  registers, but is intentionally lossy (11 bits of `d`). Matches `frame_A.txt`,
  **not** `frame_simple.txt`. Simpler, but the golden becomes the variant frame.

### 2. Variable shift `>> i` in CORDIC
`sra` takes a **constant** count; `i` runs 0..7. Fix: **unroll the 8-iteration
CORDIC loop** so each step emits a literal `sra rX, <i>` (i=0 ⇒ identity, skip).
Alternative: a shift-by-N helper that loops single shifts. Unrolling is cleaner and
CORDIC is the hot path.

### 3. Register pressure (5 scratch regs: r0–r4)
The inner ray-march keeps ~12 live 16-bit values plus loop counters. r5/r6/r7 are
fp/sp/lr — untouchable. ⇒ keep the per-pixel state in **stack locals** (`str/ldr`
at negative `fp` offsets) and stream values through r0–r4. Constants (11583, 16384,
512, 2048, 256, ramp string) live in a `.word`/`.string` pool loaded via pointer
aliases (pcoffset9 reaches ±256 words — use `@xP: .word x` near each use site).

## Other notes
- Output one char at a time via `aout` (char in `r0`); end each of 23 rows with `nl`.
- Ramp `".,-~:;!*=#$@"` (12 bytes) in a `.string`; index = `clamp(lz>>9, 0, 11)`.
- Preserve C precedence exactly: `ly0 = (sAcB - cA) >> 2`, `lz0 = (-cAcB - sA) >> 2`
  (`>>` binds looser than `-`).
- Shift-count field covers our max (`>>14`); all shifts ≤14. ✔

## Recommended decomposition (post-fork)
1. **Pick the golden** (fork below) → freeze the target frame.
2. Helper: `length_cordic` (unrolled ×8, by-ref lighting carry).
3. Helper: the chosen multiply path (exact 32-bit, or shift-add).
4. Driver: the 23×79 nest + inner ray-march, spilling to stack locals.
5. Golden test: assemble+run, diff stdout against the frozen frame.

Items 2–4 each look ≥60 min of hand-assembly → this is an epic, not one micro-task.
```
