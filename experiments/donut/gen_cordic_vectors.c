/*
 * gen_cordic_vectors.c — golden test vectors for the length_cordic LCC port (#1469).
 *
 * Emits, for a fixed list of (x, y, x2in, y2) tuples, the magnitude returned and
 * the rotated x2 written back, computed by the EXACT length_cordic from
 * donut_frame.c. Two copies are run per tuple:
 *   - cordic32: original `int x2` accumulator (matches frame_simple.txt's source)
 *   - cordic16: strict `int16_t x2` accumulator (what the 16-bit LCC machine does)
 * A tuple is only a valid unit-test vector if BOTH agree — i.e. it lies in the
 * range where 16-bit precision is sufficient (proven for the donut as a whole in
 * donut_B_cordic16.c). Divergent tuples are flagged and excluded.
 *
 * Build/run:  gcc -O2 -o gen_cordic_vectors gen_cordic_vectors.c && ./gen_cordic_vectors
 */
#include <stdint.h>
#include <stdio.h>

/* 32-bit-accumulator reference (verbatim from donut_frame.c) */
static int cordic32(int16_t x, int16_t y, int16_t *x2_, int16_t y2) {
  int x2 = *x2_;
  if (x < 0) { x = -x; x2 = -x2; }
  for (int i = 0; i < 8; i++) {
    int t = x, t2 = x2;
    if (y < 0) { x -= y >> i; y += t >> i; x2 -= y2 >> i; y2 += t2 >> i; }
    else       { x += y >> i; y -= t >> i; x2 += y2 >> i; y2 -= t2 >> i; }
  }
  *x2_ = (x2 >> 1) + (x2 >> 3);
  return (x >> 1) + (x >> 3);
}

/* strict 16-bit-accumulator version — the LCC-faithful target */
static int cordic16(int16_t x, int16_t y, int16_t *x2_, int16_t y2) {
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

int main(int argc, char **argv) {
  /* tuples kept within the donut's real operating range (|mag| <~ 2500, small x2) */
  int16_t tv[][4] = {
    {  1000,  200,   50,  -30 },
    { -1000,  200,   50,  -30 },   /* x<0 → right-half-plane flip negates x2 */
    {   300, -700, -100,   80 },
    {  2000, 1500,    0,  400 },
    {   256,    0,  100,  100 },
    {     0,  256,  100,  100 },
    {   -50,  -40,   10,   20 },
    {  1500, -900, -120,   64 },
  };
  int n = sizeof(tv) / sizeof(tv[0]);
  int golden = (argc > 1 && argv[1][0] == 'g');  /* "golden" => machine format */
  if (!golden)
    fprintf(stderr, "; idx   x      y    x2in   y2  ->   mag   x2out   (cordic16, LCC-faithful)\n");
  for (int k = 0; k < n; k++) {
    int16_t a = tv[k][0], b = tv[k][1], c = tv[k][2], d = tv[k][3];
    int16_t c16 = c, c32 = c;
    int m16 = cordic16(a, b, &c16, d);
    int m32 = cordic32(a, b, &c32, d);
    if (m16 != m32 || c16 != c32)
      fprintf(stderr, "; WARNING idx %d DIVERGES 16/32-bit — exclude\n", k);
    if (golden)
      printf("%d %d\n", m16, c16);                /* matches harness: "mag x2out" */
    else
      fprintf(stderr, "; %d  %6d %6d %6d %6d  ->  %5d  %5d\n",
              k, a, b, tv[k][2], d, m16, c16);
  }
  return 0;
}
