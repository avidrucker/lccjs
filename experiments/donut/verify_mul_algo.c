/*
 * verify_mul_algo.c — exhaustive proof that the mul.a ALGORITHM equals C's
 * (d*v)>>14 over the donut's entire measured operand domain (#1470).
 *
 * `emu` reimplements mul.a's exact steps using only 16-bit (uint16_t) words:
 * MSB-first shift-add into a (hi:lo) double word, two's-complement negate of the
 * whole double word when v<0, then (hi<<2)+(lo>>14). If this matches the plain
 * (d*v)>>14 for every (d,v) the frame can produce, the approach is sound; the
 * LCC harness (run_mul_test.sh) then confirms the assembly implements it.
 *
 * Build/run: gcc -O2 -o verify_mul_algo verify_mul_algo.c && ./verify_mul_algo
 */
#include <stdint.h>
#include <stdio.h>

/* bit-faithful model of mul.a (16-bit registers only) */
static int16_t emu(int d, int v) {
  uint16_t uv = (v < 0) ? (uint16_t)(-v) : (uint16_t)v;
  uint16_t dd = (uint16_t)d;
  uint16_t hi = 0, lo = 0;
  for (int k = 0; k < 16; k++) {
    uint16_t topbit = lo >> 15;          /* old lo MSB                */
    lo = (uint16_t)(lo << 1);
    hi = (uint16_t)((hi << 1) | topbit);
    uint16_t dmsb = dd >> 15;            /* sll d, c = old MSB        */
    dd = (uint16_t)(dd << 1);
    if (dmsb) {
      uint16_t nlo = (uint16_t)(lo + uv);
      if (nlo < lo) hi = (uint16_t)(hi + 1);  /* carry out of lo      */
      lo = nlo;
    }
  }
  if (v < 0) {                            /* negate (hi:lo)           */
    hi = (uint16_t)~hi;
    lo = (uint16_t)~lo;
    uint16_t nlo = (uint16_t)(lo + 1);
    if (nlo < lo) hi = (uint16_t)(hi + 1);
    lo = nlo;
  }
  /* result = (hi<<2) + (lo>>14), as 16-bit two's complement */
  return (int16_t)((uint16_t)(hi << 2) + (uint16_t)(lo >> 14));
}

int main(void) {
  long checked = 0, bad = 0;
  int first = 1;
  for (int d = 2; d <= 672; d++) {
    for (int v = -18097; v <= 16971; v++) {
      int16_t ref = (int16_t)(((int)d * v) >> 14);
      int16_t got = emu(d, v);
      checked++;
      if (ref != got) {
        bad++;
        if (first) { printf("MISMATCH d=%d v=%d ref=%d got=%d\n", d, v, ref, got); first = 0; }
      }
    }
  }
  printf("checked %ld pairs, %ld mismatches\n", checked, bad);
  return bad ? 1 : 0;
}
