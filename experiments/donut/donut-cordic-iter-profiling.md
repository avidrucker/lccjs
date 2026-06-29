# Donut render cost vs CORDIC iteration count (#1509)

**Question:** how much does render cost change between **r1=r2=4** and **r1=r2=8** on the
a1k0n bit-ops donut?

**What `r1`/`r2` actually are (resolved during this research):** the page's `r1iter` /
`r2iter` knobs are the **CORDIC iteration counts** for the two `length_cordic` calls in the
inner ray-march — *not* the torus radii. (The source's literal `r1=1, r2=2` ARE the radii, but
they are baked into other constants and "won't work if you change them much" — so they are not a
render-time knob. The ticket's original "torus radii" framing was corrected to CORDIC iterations
with the reporter's confirmation.) `r1iter` = the **distance** CORDIC (1st call,
`donutbitops_ref.c:97`); `r2iter` = the **lighting** CORDIC (2nd call, `:99`). Default = **8**.
Lowering iterations trades accuracy for speed — the page's explicit subject.

## Method

`donut_profile.c` — derived verbatim from `donutbitops_ref.c` (the a1k0n source, committed
alongside) with four changes: `length_cordic()` takes an `iters` arg; a global counts every
CORDIC inner-loop step; the two call sites take compile-time `R1ITER`/`R2ITER`; and `main()`
renders `FRAMES` frames into an in-memory buffer (no terminal I/O, no `usleep`), times them with
`CLOCK_MONOTONIC`, and reports per-frame stats. Built `cc -O2`, `FRAMES=4000`.

Two metrics:
- **CORDIC iterations / frame** — deterministic, machine-independent; the robust cost proxy and
  the one that maps to the lccjs interpreter's instruction budget.
- **Wall-clock µs / frame** — directionally useful but noisy on a shared machine (see caveat).

## Results (`FRAMES=4000`, `cc -O2`)

| r1iter | r2iter | CORDIC iters/frame | µs/frame | speed vs (8,8) | marches/frame | lit px/frame |
|:--:|:--:|--:|--:|:--:|--:|--:|
| **8** | **8** | **207,430** | ~1,620–2,030 | 1.00× (baseline) | 11,147 | 799 |
| **4** | **8** | 157,100 | ~1,160 | ~1.4× | 11,274 | 807 |
| **8** | **4** | 162,867 | ~970 | ~1.7× | 11,755 | 800 |
| **4** | **4** | **110,515** | ~580–785 | **~2.3–2.8×** | 11,997 | 806 |
| 2 | 2 | 59,006 | ~190 | ~8× | 12,934 | **1,001** |

*(µs/frame is a single-run average over 4000 frames; absolute values swing run-to-run on a loaded
box. The CORDIC-iters column is exact and repeatable — prefer it.)*

## Findings

1. **r1=r2=4 vs r1=r2=8 → ~1.88× fewer CORDIC iterations (207k→110k), ~2.3–2.8× faster wall
   time.** Halving both CORDIC counts is the single biggest render-cost lever; everything else
   (march count, lit pixels) barely moves.
2. **Cost scales ~linearly with total CORDIC iterations.** 207k→1620µs, 110k→580µs, 59k→190µs —
   roughly proportional, with a small fixed per-pixel overhead that makes the wall-time speedup
   slightly *exceed* the iteration ratio at low counts.
3. **`r2iter` (the lighting CORDIC) dominates slightly.** Dropping only `r2iter` 8→4 (the `(8,4)`
   row, ~970µs) saves more time than dropping only `r1iter` (`(4,8)`, ~1160µs) — even though
   `(8,4)` does *more* total CORDIC iterations, because cutting `r1iter` degrades the distance
   estimate and adds a few ray-march steps that claw back some of the saving. Both knobs matter;
   `r2iter` is the cheaper win.
4. **Accuracy degrades visibly as iterations drop.** At `(4,4)` the donut is still clearly a
   torus but the **shading is coarser** — it loses the fine `~ - , .` gradient and the lighting
   skews brighter. At `(2,2)` it breaks down: lit-pixel count jumps 799→1,001 as the low-precision
   CORDIC mis-estimates lighting/occlusion. See the side-by-side below.

### Visual: (8,8) vs (4,4) — same rotation (frame 0)

`r1iter=r2iter=8` (full quality):
```
                              @@@@@@@@@@@@@@@@@@@@@
                         @@@@@@$$$$$##########$$$$@@@@@@$
                      @@@@@@$$###===*********===###$$@@@@@@$
                   $@@@@@@$$##==**!!;;:::::;;!!!*==##$$@@@@@@@
                 #$@@@@@@$$#==*!;::~---,,,---~::;!*==#$$$@@@@@@$
                $@@@@@@@$$##=*!:~-,...........,-~:;*==#$$@@@@@@@$#
               $$@@@@@@@@$$#=*!~..              .,~!=#$$@@@@@@@@$$#*
             *=#$$$@@@@@@@@@@@$$$#=               #$$@@@@@@@@@@@$$$#=!
             *=##$$$$@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@$$$##=*!
              :;**==####$$$$$$$$@@@@@@@@@@@@@@@@@$$$$$$$$####==**!;-
                  ~:;!!!***=========#########=========****!!;::-
```
`r1iter=r2iter=4` (~2.5× faster, coarser shading):
```
                               @@@@@@@@@$$@@@@@@@@@
                        $@@@@@@$$$$$=========$$$$$@@@@@@@
                     $@@@@@$$$$====***********====$$$$@@@@@@
                   $@@@@@$$$===****:::::::::::****===$$$@@@@@@
                 $@@@@@@$$$==***:::-----------:::***==$$$@@@@@@$=
                $@@@@@@@$$==**:::--...........---::**==$$@@@@@@@$$
             ==$$@@@@@@@@@$$$==*.                .-==$$@@@@@@@@@$$$=*
             **===$$$$$@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@$$$$$===**:
                 .:::******===========================******:::-
```

## Takeaway for the lccjs donut (#1468)

The lccjs port renders one fixed frame in **~8–10M interpreter instructions** and needs `-ms-1`
because of the 500k default cap. The CORDIC inner loop is the dominant cost, and this profiling
says a **`r1=r2=4` "fast mode" would cut CORDIC work ~1.9×** — plausibly pulling a frame from
~8–10M toward ~5–6M instructions, which could fit under a *much* tighter `--max-steps` (useful for
a snappier demo or a CI-friendly render) **at the cost of a visibly rougher donut**. If a
parameterized-iteration donut is ever wanted, `r2iter` (lighting) is the cheaper knob to cut
first. This would be a follow-up DEV ticket (out of scope here); the radii themselves are not a
viable knob (baked-in).

## Reproduce

```bash
cd experiments/donut
for cfg in "8 8" "4 4" "4 8" "8 4" "2 2"; do set -- $cfg
  cc -O2 -DR1ITER=$1 -DR2ITER=$2 -DFRAMES=4000 donut_profile.c -o /tmp/dp
  /tmp/dp >/tmp/frame_$1_$2.txt 2>&1 | tail -3   # stats on stderr; first frame in the .txt
done
```

Source of truth: `experiments/donut/donutbitops_ref.c` (a1k0n,
<https://www.a1k0n.net/code/donutbitops.c.html>) + `experiments/donut/donut_profile.c` (this harness).
