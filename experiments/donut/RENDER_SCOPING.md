# Render driver scoping (#1471)

Scoping pass for `demos/donut.a` — the 23×79 ray-march driver that wires
`length_cordic` (#1469) and `mul_q14` (#1470) into the single golden frame
`frame_simple.txt`. Done before writing the driver, per request.

## Headline: register pressure is NOT the hard part

The intimidating part of `donut_frame.c`'s `main()` is the ~25 named variables.
But for a **single frame** almost all of them are **frozen constants** — the
rotation state never rotates (no Minsky `R()` step), so everything derived from
it is a compile-once value. Precompute those into a **global `.word` block** at
startup and the live, mutable working set collapses to ~14 cells.

### Variable classification

| Class | Variables | Where it lives |
|---|---|---|
| **Frozen (compute once → global `.word`)** | sB,cB,sA,cA,sAsB,cAsB,sAcB,cAcB, p0x,p0y,p0z, r1i(256),r2i(512), yincC,yincS, xincX,xincY,xincZ, xsAsB,xcAsB, vxi14_init=`(cB>>4)-cB-sB`, lx0=`sB>>2`, ly0=`(sAcB-cA)>>2`, lz0=`(-cAcB-sA)>>2`, ramp string, 2048 | ~24 globals |
| **Per-row mutable** | ycA, ysA (`+= yincC/yincS` each row), j (row counter) | 3 cells |
| **Per-col mutable** | vxi14, vyi14, vzi14 (`+=xincX / -=xincY / +=xincZ`), i (col counter) | 4 cells |
| **Per-pixel** | t(=512), px, py, pz | 4 cells |
| **Per-march (reset each iter from lx0/ly0/lz0)** | lx, ly, lz | 3 cells |
| **Transient (registers only)** | t0,t1,t2,d,N | r0–r4 |

Persistent mutable cells ≈ **14**. No point in the program needs >5 live
registers: the shape is always *load → compute → store*, with `length_cordic`
and `mul_q14` as subroutines that carry their own frames. The `lx/ly/lz`
by-reference passing to `length_cordic` is exactly the `&x2cell` pattern already
proven in `cordic_test.a` (pass the address of the global cell; it writes back).

**Conclusion:** keep all 14 mutable cells + ~24 constants as **globals**, stream
through r0–r4. r5/r6/r7 stay untouched (fp/sp/lr).

## The real risks / work

1. **Instruction cap (CRITICAL, measured).** `interpreter.js` `DEFAULT_CAP =
   500000`; past it execution silently stops (`maxStepsReached`) and the frame
   is truncated. The frame is ~8–10M instructions (31,791 `mul` calls +
   ~24,800 `cordic` calls, per `donut_probe.c`). **Must run with `-ms-1`**
   (unlimited) or a high `--max-steps`. #1472's test must do the same.
2. **Runtime.** Measured interpreter throughput ≈ 2.5M instr/sec (20M-instr
   benchmark = 8.2s wall). Frame ≈ 3–8s — fine, but bump `scripts/lccrun.sh`
   timeout (e.g. 60s) for headroom.
3. **`pcoffset9` range.** `lea`/`ld`/`st` reach ±256 words. With a ~400-instr
   program plus a ~40-word data block, top-of-file references to bottom-of-file
   data will overflow. Mitigate with **pointer aliases** (`@xP: .word x` near the
   use site) — SKILL pitfall #2 — or split the data block.
4. **Output exactness.** 23 rows × 79 glyphs, ramp `".,-~:;!*=#$@"`, blank when
   `t>8*256`, glyph index `clamp(lz>>9, 0, 11)`; `nl` per row; NO status line
   (already stripped in `donut_frame.c`). Byte-for-byte vs `frame_simple.txt`.
5. **Volume.** ~24-word precompute + 3 nested loops + ray-march + glyph emit ≈
   300–450 lines. Mechanical, but the largest single .a so far.

## Estimated size & the module question

Driver alone ≈ 300–450 lines. Combined with the helpers inlined into one
self-contained `demos/donut.a` ≈ 550–650 lines — still under the 1000-line
refactor threshold. Two viable shapes (see ticket discussion / fork):
- **Modular:** `donut.a` driver `.extern`s the helpers; link `cordic.o + mul.o
  + donut.o`. Reuses the already-tested modules verbatim.
- **Single self-contained `demos/donut.a`:** helpers inlined, runs with one
  `lcc.js demos/donut.a` — idiomatic for `demos/`.

## Suggested implementation order (TDD, golden = frame_simple.txt)
1. Precompute block → dump the ~24 globals, sanity-check a few vs C.
2. One pixel end-to-end (fixed i,j) → verify its glyph vs the C frame.
3. One full row (i=0..78) → verify row vs `frame_simple.txt` line.
4. Full 23×79 nest → byte-diff vs `frame_simple.txt` (this is #1472).
Always run with `-ms-1`.
