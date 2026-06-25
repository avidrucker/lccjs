/*
 * donut_probe.c — measure the operand ranges at the `d * v >> 14` site (#1470).
 *
 * Same single-frame math as donut_frame.c, but instead of rendering it records,
 * at every execution of the inner multiply, the min/max of d and of the three v
 * operands (vxi14/vyi14/vzi14), plus min/max of the (d*v)>>14 result and the full
 * 32-bit product |d*v|. This tells us exactly how many bits we must carry and
 * whether d is ever <= 0 in the multiply path.
 *
 * Build/run: gcc -O2 -o donut_probe donut_probe.c && ./donut_probe
 */
#include <stdint.h>
#include <stdio.h>
#include <limits.h>

enum { dz = 5, r1 = 1, r2 = 2 };

static int length_cordic(int16_t x, int16_t y, int16_t *x2_, int16_t y2) {
  int16_t x2 = *x2_;
  if (x < 0) { x = -x; x2 = -x2; }
  for (int i = 0; i < 8; i++) {
    int16_t t = x, t2 = x2;
    if (y < 0) { x -= y >> i; y += t >> i; x2 -= y2 >> i; y2 += t2 >> i; }
    else       { x += y >> i; y -= t >> i; x2 += y2 >> i; y2 -= t2 >> i; }
  }
  *x2_ = (x2 >> 1) + (x2 >> 3);
  return (x >> 1) + (x >> 3);
}

static int dmin = INT_MAX, dmax = INT_MIN;
static int vmin = INT_MAX, vmax = INT_MIN;
static long prodmax = 0;          /* max |d*v|         */
static int resmin = INT_MAX, resmax = INT_MIN;   /* (d*v)>>14 */
static long ncalls = 0, dnonpos = 0;

static int track(int d, int16_t v) {
  ncalls++;
  if (d <= 0) dnonpos++;
  if (d < dmin) dmin = d;
  if (d > dmax) dmax = d;
  if (v < vmin) vmin = v;
  if (v > vmax) vmax = v;
  long p = (long)d * v;  if (p < 0) p = -p;  if (p > prodmax) prodmax = p;
  int r = d * v >> 14;
  if (r < resmin) resmin = r;
  if (r > resmax) resmax = r;
  return r;
}

int main(void) {
  int16_t sB = 0, cB = 16384, sA = 11583, cA = 11583;
  int16_t sAsB = 0, cAsB = 0, sAcB = 11583, cAcB = 11583;
  int p0x = dz * sB >> 6, p0y = dz * sAcB >> 6, p0z = -dz * cAcB >> 6;
  const int r1i = r1 * 256, r2i = r2 * 256;
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
        t0 = length_cordic(px, py, &lx, ly);
        t1 = t0 - r2i;
        t2 = length_cordic(pz, t1, &lz, lx);
        d = t2 - r1i;
        t += d;
        if (t > 8 * 256) break;
        else if (d < 2) break;
        px += track(d, vxi14);
        py += track(d, vyi14);
        pz += track(d, vzi14);
      }
    }
  }
  printf("multiply-site calls : %ld\n", ncalls);
  printf("d  range            : [%d, %d]   (d<=0 occurrences: %ld)\n", dmin, dmax, dnonpos);
  printf("v  range            : [%d, %d]\n", vmin, vmax);
  printf("max |d*v|           : %ld   (needs %d bits)\n", prodmax,
         (int)(prodmax ? (sizeof(long)*8 - __builtin_clzl(prodmax)) : 0));
  printf("(d*v)>>14 range     : [%d, %d]\n", resmin, resmax);
  return 0;
}
