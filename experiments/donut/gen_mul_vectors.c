/*
 * gen_mul_vectors.c — golden vectors for the mul_q14 LCC port (#1470).
 *
 * mul_q14(d, v) computes (int16)((d * v) >> 14) the SAME way C does: a signed
 * arithmetic right shift of the full 32-bit product (rounds toward -inf). d is
 * always > 0 in the donut (measured range [2,672] by donut_probe.c); v is signed
 * (measured [-18097, 16971]). The vectors below span the measured extremes plus
 * sign / rounding edge cases — notably d*v < 0 with dropped low bits, where
 * "magnitude then negate" would be off by one.
 *
 * Build/run (default = human table to stderr; "golden" = one result per line):
 *   gcc -O2 -o gen_mul_vectors gen_mul_vectors.c
 *   ./gen_mul_vectors golden > mul_golden.txt
 */
#include <stdint.h>
#include <stdio.h>

static int16_t mul_q14(int d, int v) {
  return (int16_t)((d * v) >> 14);   /* arithmetic shift — the reference */
}

int main(int argc, char **argv) {
  int tv[][2] = {
    {   2,  16971 },   /* max v+, small d                         */
    { 672,  16971 },   /* max v+, max d                           */
    { 672, -18097 },   /* min v,  max d                           */
    { 100, -18097 },
    {   2,     -1 },   /* ROUNDING: (-2)>>14 == -1, NOT 0         */
    { 672,     -1 },   /* (-672)>>14 == -1                        */
    {   2,      0 },   /* zero                                    */
    { 672,      1 },   /* 672>>14 == 0                            */
    { 500,   8192 },   /* 4096000>>14 == 250                      */
    { 672,  16384 },
    {   3,  -5000 },
    {   1, -18097 },   /* d == 1                                  */
    {  42,  -8192 },   /* (-344064)>>14 == -21                    */
  };
  int n = sizeof(tv) / sizeof(tv[0]);
  int golden = (argc > 1 && argv[1][0] == 'g');
  if (!golden) fprintf(stderr, ";   d       v   -> (d*v)>>14\n");
  for (int k = 0; k < n; k++) {
    int d = tv[k][0], v = tv[k][1];
    int16_t r = mul_q14(d, v);
    if (golden) printf("%d\n", r);
    else fprintf(stderr, "; %3d  %6d   -> %5d\n", d, v, r);
  }
  return 0;
}
