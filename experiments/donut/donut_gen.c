/*
 * donut_gen.c — constants + per-pixel test vectors for the render driver (#1471).
 *
 * Modes:
 *   ./donut_gen consts   -> the frozen single-frame constants, as `.word` lines
 *   ./donut_gen pixels    -> for a fixed test list of (j,i): "vx vy vz <glyph>"
 *                            (vx/vy/vz feed render_pixel; glyph is the expected char)
 *   ./donut_gen pixglyph  -> just the expected glyph per test pixel (golden file)
 *
 * Same math as donut_frame.c; this only instruments it to expose the values the
 * assembly port needs to hardcode (constants) and to verify against (pixels).
 */
#include <stdint.h>
#include <stdio.h>
#include <string.h>

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

/* the frozen single-frame seed */
static const int16_t sB = 0, cB = 16384, sA = 11583, cA = 11583;
static const int16_t sAsB = 0, cAsB = 0, sAcB = 11583, cAcB = 11583;

/* render one pixel given its v vector; returns the glyph (or ' ') */
static char render_pixel(int16_t vxi14, int16_t vyi14, int16_t vzi14) {
  const int r1i = r1 * 256, r2i = r2 * 256;
  int p0x = dz * sB >> 6, p0y = dz * sAcB >> 6, p0z = -dz * cAcB >> 6;
  int t = 512;
  int16_t px = p0x + (vxi14 >> 5), py = p0y + (vyi14 >> 5), pz = p0z + (vzi14 >> 5);
  int16_t lx0 = sB >> 2, ly0 = sAcB - cA >> 2, lz0 = -cAcB - sA >> 2;
  for (;;) {
    int16_t lx = lx0, ly = ly0, lz = lz0;
    int t0 = length_cordic(px, py, &lx, ly);
    int t1 = t0 - r2i;
    int t2 = length_cordic(pz, t1, &lz, lx);
    int d = t2 - r1i;
    t += d;
    if (t > 8 * 256) return ' ';
    if (d < 2) { int N = lz >> 9; return ".,-~:;!*=#$@"[N > 0 ? N < 12 ? N : 11 : 0]; }
    px += d * vxi14 >> 14;
    py += d * vyi14 >> 14;
    pz += d * vzi14 >> 14;
  }
}

/* compute the v vector at a given (j,i) by replaying the row/col accumulation */
static void v_at(int J, int I, int16_t *vx, int16_t *vy, int16_t *vz) {
  int16_t yincC = (cA >> 6) + (cA >> 5), yincS = (sA >> 6) + (sA >> 5);
  int16_t xincX = (cB >> 7) + (cB >> 6), xincY = (sAsB >> 7) + (sAsB >> 6), xincZ = (cAsB >> 7) + (cAsB >> 6);
  int16_t ycA = -((cA >> 1) + (cA >> 4)), ysA = -((sA >> 1) + (sA >> 4));
  for (int j = 0; j <= J; j++, ycA += yincC, ysA += yincS) {
    int xsAsB = (sAsB >> 4) - sAsB, xcAsB = (cAsB >> 4) - cAsB;
    int16_t vxi14 = (cB >> 4) - cB - sB;
    int16_t vyi14 = ycA - xsAsB - sAcB;
    int16_t vzi14 = ysA + xcAsB + cAcB;
    for (int i = 0; i <= I; i++, vxi14 += xincX, vyi14 -= xincY, vzi14 += xincZ) {
      if (j == J && i == I) { *vx = vxi14; *vy = vyi14; *vz = vzi14; return; }
    }
  }
}

/* test pixels chosen to span: blank, faint, mid, bright glyphs */
static const int pix[][2] = {
  { 0, 40}, {11, 39}, {11, 20}, { 6, 30}, { 8, 25},
  {22, 40}, { 5, 30}, {12, 10}, {15, 55}, {11, 11},
};

int main(int argc, char **argv) {
  const char *mode = argc > 1 ? argv[1] : "consts";
  if (!strcmp(mode, "consts")) {
    const int r1i = r1 * 256, r2i = r2 * 256;
    printf("; frozen single-frame constants (from donut_gen consts)\n");
    printf("p0x:     .word %d\n", dz * sB >> 6);
    printf("p0y:     .word %d\n", dz * sAcB >> 6);
    printf("p0z:     .word %d\n", -dz * cAcB >> 6);
    printf("r1i:     .word %d\n", r1i);
    printf("r2i:     .word %d\n", r2i);
    printf("lx0:     .word %d\n", sB >> 2);
    printf("ly0:     .word %d\n", sAcB - cA >> 2);
    printf("lz0:     .word %d\n", -cAcB - sA >> 2);
    printf("k2048:   .word %d\n", 8 * 256);
    printf("; --- loop constants ---\n");
    printf("xincX:   .word %d\n", (cB >> 7) + (cB >> 6));
    printf("xincY:   .word %d\n", (sAsB >> 7) + (sAsB >> 6));
    printf("xincZ:   .word %d\n", (cAsB >> 7) + (cAsB >> 6));
    printf("yincC:   .word %d\n", (cA >> 6) + (cA >> 5));
    printf("yincS:   .word %d\n", (sA >> 6) + (sA >> 5));
    printf("xsAsB:   .word %d\n", (sAsB >> 4) - sAsB);
    printf("xcAsB:   .word %d\n", (cAsB >> 4) - cAsB);
    printf("sAcB:    .word %d\n", sAcB);
    printf("cAcB:    .word %d\n", cAcB);
    printf("vxinit:  .word %d\n", (cB >> 4) - cB - sB);
    printf("ycAinit: .word %d\n", -((cA >> 1) + (cA >> 4)));
    printf("ysAinit: .word %d\n", -((sA >> 1) + (sA >> 4)));
  } else if (!strcmp(mode, "pixels") || !strcmp(mode, "pixglyph")) {
    int n = sizeof(pix) / sizeof(pix[0]);
    for (int k = 0; k < n; k++) {
      int16_t vx, vy, vz;
      v_at(pix[k][0], pix[k][1], &vx, &vy, &vz);
      char g = render_pixel(vx, vy, vz);
      if (!strcmp(mode, "pixglyph")) printf("%c\n", g);
      else printf("; (j=%2d,i=%2d) vx=%6d vy=%6d vz=%6d -> '%c'\n",
                  pix[k][0], pix[k][1], vx, vy, vz, g);
    }
  } else if (!strcmp(mode, "scan") || !strcmp(mode, "scanglyph")) {
    /* one representative pixel per distinct glyph, in scan order — full ramp coverage */
    const char *order = " .,-~:;!*=#$@";
    int seen[128] = {0};
    int16_t yincC = (cA >> 6) + (cA >> 5), yincS = (sA >> 6) + (sA >> 5);
    int16_t xincX = (cB >> 7) + (cB >> 6), xincY = (sAsB >> 7) + (sAsB >> 6), xincZ = (cAsB >> 7) + (cAsB >> 6);
    int16_t ycA = -((cA >> 1) + (cA >> 4)), ysA = -((sA >> 1) + (sA >> 4));
    /* collect first occurrence of each glyph */
    struct { int16_t vx, vy, vz; char g; } found[16]; int nf = 0;
    for (int j = 0; j < 23; j++, ycA += yincC, ysA += yincS) {
      int16_t vxi14 = (cB >> 4) - cB - sB;
      int16_t vyi14 = ycA - (int16_t)((sAsB >> 4) - sAsB) - sAcB;
      int16_t vzi14 = ysA + (int16_t)((cAsB >> 4) - cAsB) + cAcB;
      for (int i = 0; i < 79; i++, vxi14 += xincX, vyi14 -= xincY, vzi14 += xincZ) {
        char g = render_pixel(vxi14, vyi14, vzi14);
        if (!seen[(int)g]) { seen[(int)g] = 1; found[nf].vx = vxi14; found[nf].vy = vyi14;
          found[nf].vz = vzi14; found[nf].g = g; nf++; }
      }
    }
    /* emit in ramp order for readability */
    for (const char *p = order; *p; p++)
      for (int k = 0; k < nf; k++)
        if (found[k].g == *p) {
          if (!strcmp(mode, "scanglyph")) printf("%c\n", found[k].g);
          else printf("%d %d %d   ; '%c'\n", found[k].vx, found[k].vy, found[k].vz, found[k].g);
        }
  }
  return 0;
}
