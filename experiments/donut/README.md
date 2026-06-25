# ASCII donut in base LCC (#1468)

A single static frame of a1k0n's integer/bit-ops donut, rendered by the **base**
LCC toolchain (no floating point, no LCC+), as a set of linked `.a` modules.

```
                              @@@@@@@@@@@@@@@@@@@@@
                         @@@@@@$$$$$##########$$$$@@@@@@$
                      @@@@@@$$###===*********===###$$@@@@@@$
                   $@@@@@@$$##==**!!;;:::::;;!!!*==##$$@@@@@@@
                ...  (23 rows x 79 cols)
```

## Build & run

```bash
./run_donut.sh          # build all modules, link, run (-ms-1), diff vs frame_simple.txt
```

Manually:
```bash
node ../../src/cli/lcc.js cordic.a      # -> cordic.o   (repeat for mul, render, donut)
node ../../src/cli/lcc.js cordic.o mul.o render.o donut.o -o donut.e
node ../../src/cli/lcc.js donut.e -ms-1 # the frame is ~8-10M instructions; lift the 500k cap
```

## Modules (linked)

| module | role | tested by |
|---|---|---|
| `cordic.a` | `length_cordic` — 8-iter CORDIC magnitude + lighting (unrolled) | `run_cordic_test.sh` (#1469) |
| `mul.a` | `mul_q14` — exact signed `(d*v)>>14` via 16-bit double word | `run_mul_test.sh` (#1470) |
| `render.a` | `render_pixel(vx,vy,vz)` — per-cell ray-march → glyph | `run_render_test.sh` (#1471) |
| `donut.a` | `main` — 23x79 loop nest, emits the frame | `run_donut.sh` (#1471) |

Each helper is exercised in isolation against C-generated goldens; `run_donut.sh`
is the end-to-end byte-for-byte check against `frame_simple.txt`.

## The C reference (oracle for the goldens)

| file | role |
|---|---|
| `donut_ref.c` | a1k0n's original animating bit-ops donut (verbatim) |
| `donut_frame.c` | simplified single frame — byte-identical to frame 0 of the reference |
| `frame_simple.txt` | the golden frame (output of `donut_frame.c`) |
| `donut_gen.c` | emits the frozen constants + per-pixel test vectors for the port |
| `donut_probe.c` | measured the `d`/`v` operand ranges that bound `mul_q14` |
| `gen_cordic_vectors.c`, `gen_mul_vectors.c`, `verify_mul_algo.c` | golden vectors + exhaustive checks |

## Notes for readers

- **Why modular + linked:** each helper stays small and independently testable;
  `lcc.js` assembles one `.a` → `.o`, then links the `.o`s. (Calling an external
  more than once per module needed the relocation fix #1474.)
- **Integer only:** the ISA has no float. CORDIC + a software fixed-point multiply
  do all the trig/projection; see `PORTING_NOTES.md` and `RENDER_SCOPING.md`.
- **Glyph ramp** `.,-~:;!*=#$@` is stored as `.word` ASCII codes, not `.string`
  (a literal `;` in a string trips lccjs comment-stripping — #1473).
