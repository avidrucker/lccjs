/*
 * donut_frame.c — single static frame, simplified from donut_ref.c (#1468).
 *
 * This is the bridge between a1k0n's animating reference and the base-LCC port.
 * It keeps the EXACT fixed-point math of the reference but strips everything the
 * single-frame deliverable does not need:
 *
 *   removed:  for(;;) outer loop, Minsky R(...) rotation updates (animation),
 *             usleep timing, the "\r\x1b[23A" cursor-up + "...iterations..." line,
 *             the iters/nnormals counters.
 *   kept:     length_cordic(), the 23x79 render nest, the inner ray-march loop,
 *             the frozen initial angle (sA=cA=11583, sB=0, cB=16384).
 *
 * Output is exactly the 23x79 first frame of donut_ref.c followed by newlines.
 * This file is the parity oracle for the assembly version: byte-for-byte the
 * same glyphs. Only base-ISA-friendly operations are used (>>, +, -, *, and a
 * 12-byte lookup table); no float, no libm.
 */
#include <stdint.h>
#include <stdio.h>

// torus radii and distance from camera (baked into other constants)
enum { dz = 5, r1 = 1, r2 = 2 };

// CORDIC: magnitude of |x,y|, carrying (x2,y2) along to rotate the lighting
// normal. Writes the rotated lighting coord back through x2_, returns |x,y|.
int length_cordic(int16_t x, int16_t y, int16_t *x2_, int16_t y2) {
  int x2 = *x2_;
  if (x < 0) {            // start in right half-plane
    x = -x;
    x2 = -x2;
  }
  for (int i = 0; i < 8; i++) {
    int t = x;
    int t2 = x2;
    if (y < 0) {
      x -= y >> i;  y += t >> i;
      x2 -= y2 >> i; y2 += t2 >> i;
    } else {
      x += y >> i;  y -= t >> i;
      x2 += y2 >> i; y2 -= t2 >> i;
    }
  }
  // approx the 0.607 CORDIC gain by 1/0.625 = (>>1)+(>>3)
  *x2_ = (x2 >> 1) + (x2 >> 3);
  return (x >> 1) + (x >> 3);
}

int main(void) {
  // Frozen rotation state — the single angle we render (frame 0 of the ref).
  int16_t sB = 0,     cB = 16384;
  int16_t sA = 11583, cA = 11583;
  int16_t sAsB = 0,   cAsB = 0;
  int16_t sAcB = 11583, cAcB = 11583;

  int p0x = dz * sB >> 6;
  int p0y = dz * sAcB >> 6;
  int p0z = -dz * cAcB >> 6;

  const int r1i = r1 * 256;
  const int r2i = r2 * 256;

  int16_t yincC = (cA >> 6) + (cA >> 5);
  int16_t yincS = (sA >> 6) + (sA >> 5);
  int16_t xincX = (cB >> 7) + (cB >> 6);
  int16_t xincY = (sAsB >> 7) + (sAsB >> 6);
  int16_t xincZ = (cAsB >> 7) + (cAsB >> 6);
  int16_t ycA = -((cA >> 1) + (cA >> 4));
  int16_t ysA = -((sA >> 1) + (sA >> 4));

  for (int j = 0; j < 23; j++, ycA += yincC, ysA += yincS) {
    int xsAsB = (sAsB >> 4) - sAsB;
    int xcAsB = (cAsB >> 4) - cAsB;

    int16_t vxi14 = (cB >> 4) - cB - sB;
    int16_t vyi14 = ycA - xsAsB - sAcB;
    int16_t vzi14 = ysA + xcAsB + cAcB;

    for (int i = 0; i < 79; i++, vxi14 += xincX, vyi14 -= xincY, vzi14 += xincZ) {
      int t = 512;

      int16_t px = p0x + (vxi14 >> 5);
      int16_t py = p0y + (vyi14 >> 5);
      int16_t pz = p0z + (vzi14 >> 5);
      int16_t lx0 = sB >> 2;
      int16_t ly0 = sAcB - cA >> 2;
      int16_t lz0 = -cAcB - sA >> 2;
      for (;;) {
        int t0, t1, t2, d;
        int16_t lx = lx0, ly = ly0, lz = lz0;
        t0 = length_cordic(px, py, &lx, ly);
        t1 = t0 - r2i;
        t2 = length_cordic(pz, t1, &lz, lx);
        d = t2 - r1i;
        t += d;

        if (t > 8 * 256) {
          putchar(' ');
          break;
        } else if (d < 2) {
          int N = lz >> 9;
          putchar(".,-~:;!*=#$@"[N > 0 ? N < 12 ? N : 11 : 0]);
          break;
        }
        { int16_t dx=0,dy=0,dz2=0,a=vxi14,b=vyi14,c=vzi14; int dd=d; while(dd){ if(dd&1024){dx+=a;dy+=b;dz2+=c;} dd=(dd&1023)<<1; a>>=1;b>>=1;c>>=1;} px += dx>>4; py += dy>>4; pz += dz2>>4; }
      }
    }
    putchar('\n');
  }
  return 0;
}
