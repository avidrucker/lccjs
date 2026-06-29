// donut_profile.c — profiling harness for #1509: measure how the two CORDIC
// iteration counts (r1iter / r2iter on the a1k0n bit-ops donut) drive render cost.
// Derived verbatim from donutbitops_ref.c (a1k0n) with four changes:
//   1. length_cordic() takes an `iters` arg (the i<8 loop becomes i<iters);
//   2. a global g_cordic_iters counts every CORDIC inner-loop step;
//   3. the two call sites take R1ITER / R2ITER (compile-time, default 8 each);
//   4. main() renders FRAMES frames into an in-memory buffer (no terminal I/O,
//      no usleep), times them, and prints stats to stderr + the first frame to
//      stdout for visual inspection.
//
//   cc -O2 -DR1ITER=4 -DR2ITER=4 -DFRAMES=2000 donut_profile.c -o donut_profile
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#ifndef R1ITER
#define R1ITER 8   /* CORDIC iterations for the distance cordic (first call) */
#endif
#ifndef R2ITER
#define R2ITER 8   /* CORDIC iterations for the lighting cordic (second call) */
#endif
#ifndef FRAMES
#define FRAMES 2000
#endif

const int dz = 5, r1 = 1, r2 = 2;          // torus radii (baked-in; NOT the knob here)
#define R(s,x,y) x-=(y>>s); y+=(x>>s)

static long g_cordic_iters = 0;            // every CORDIC inner-loop step, all frames

int length_cordic(int16_t x, int16_t y, int16_t *x2_, int16_t y2, int iters) {
  int x2 = *x2_;
  if (x < 0) { x = -x; x2 = -x2; }
  for (int i = 0; i < iters; i++) {
    g_cordic_iters++;
    int t = x, t2 = x2;
    if (y < 0) { x -= y >> i; y += t >> i; x2 -= y2 >> i; y2 += t2 >> i; }
    else       { x += y >> i; y -= t >> i; x2 += y2 >> i; y2 -= t2 >> i; }
  }
  *x2_ = (x2 >> 1) + (x2 >> 3);
  return (x >> 1) + (x >> 3);
}

static char fb[23 * 81 + 1];               // one frame: 23 rows x (79 glyphs + \n)
static int  fb_pos;
static char first_frame[sizeof fb];

int main(void) {
  int16_t sB = 0, cB = 16384, sA = 11583, cA = 11583;
  int16_t sAsB = 0, cAsB = 0, sAcB = 11583, cAcB = 11583;
  long total_marches = 0, total_lit = 0;

  struct timespec ts0, ts1;
  clock_gettime(CLOCK_MONOTONIC, &ts0);

  for (int frame = 0; frame < FRAMES; frame++) {
    fb_pos = 0;
    int p0x = dz * sB >> 6, p0y = dz * sAcB >> 6, p0z = -dz * cAcB >> 6;
    const int r1i = r1 * 256, r2i = r2 * 256;
    int niters = 0, nnormals = 0;
    int16_t yincC = (cA >> 6) + (cA >> 5), yincS = (sA >> 6) + (sA >> 5);
    int16_t xincX = (cB >> 7) + (cB >> 6), xincY = (sAsB >> 7) + (sAsB >> 6), xincZ = (cAsB >> 7) + (cAsB >> 6);
    int16_t ycA = -((cA >> 1) + (cA >> 4)), ysA = -((sA >> 1) + (sA >> 4));
    for (int j = 0; j < 23; j++, ycA += yincC, ysA += yincS) {
      int xsAsB = (sAsB >> 4) - sAsB, xcAsB = (cAsB >> 4) - cAsB;
      int16_t vxi14 = (cB >> 4) - cB - sB;
      int16_t vyi14 = ycA - xsAsB - sAcB;
      int16_t vzi14 = ysA + xcAsB + cAcB;
      for (int i = 0; i < 79; i++, vxi14 += xincX, vyi14 -= xincY, vzi14 += xincZ) {
        int t = 512;
        int16_t px = p0x + (vxi14 >> 5), py = p0y + (vyi14 >> 5), pz = p0z + (vzi14 >> 5);
        int16_t lx0 = sB >> 2, ly0 = sAcB - cA >> 2, lz0 = -cAcB - sA >> 2;
        for (;;) {
          int t0, t1, t2, d;
          int16_t lx = lx0, ly = ly0, lz = lz0;
          t0 = length_cordic(px, py, &lx, ly, R1ITER);   // r1iter
          t1 = t0 - r2i;
          t2 = length_cordic(pz, t1, &lz, lx, R2ITER);   // r2iter
          d = t2 - r1i;
          t += d;
          if (t > 8 * 256) { fb[fb_pos++] = ' '; break; }
          else if (d < 2) {
            int N = lz >> 9;
            fb[fb_pos++] = ".,-~:;!*=#$@"[N > 0 ? N < 12 ? N : 11 : 0];
            nnormals++;
            break;
          }
          px += d * vxi14 >> 14;
          py += d * vyi14 >> 14;
          pz += d * vzi14 >> 14;
          niters++;
        }
      }
      fb[fb_pos++] = '\n';
    }
    total_marches += niters;
    total_lit += nnormals;
    if (frame == 0) { fb[fb_pos] = 0; memcpy(first_frame, fb, fb_pos + 1); }
    R(5, cA, sA); R(5, cAsB, sAsB); R(5, cAcB, sAcB);
    R(6, cB, sB); R(6, cAcB, cAsB); R(6, sAcB, sAsB);
  }

  clock_gettime(CLOCK_MONOTONIC, &ts1);
  double secs = (ts1.tv_sec - ts0.tv_sec) + (ts1.tv_nsec - ts0.tv_nsec) / 1e9;

  fprintf(stderr, "R1ITER=%d R2ITER=%d FRAMES=%d\n", R1ITER, R2ITER, FRAMES);
  fprintf(stderr, "total_secs=%.4f  us_per_frame=%.2f\n", secs, secs * 1e6 / FRAMES);
  fprintf(stderr, "cordic_iters/frame=%ld  marches/frame=%ld  lit_pixels/frame=%ld\n",
          g_cordic_iters / FRAMES, total_marches / FRAMES, total_lit / FRAMES);
  fputs(first_frame, stdout);   // first frame (rotation angle fixed) for visual diff
  return 0;
}
