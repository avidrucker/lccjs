// demo-032-multiplication-algorithms.c
// Chapter 11: Integer Arithmetic
// Concept: Two integer-multiplication algorithms — slow repeated addition
//          (O(y)) and the binary shift-and-add method (O(log y)).
#include <stdio.h>
int slowmul(int x, unsigned y)
{
   int p = 0;
   while (y) { p += x; y--; }
   return p;
}
int mul(int x, unsigned y)
{
   int p = 0;
   while (y) {
      if (y & 1) p += x;
      y >>= 1;
      x <<= 1;
   }
   return p;
}
int main()
{
   printf("%d\n", slowmul(7, 255));   // 1785
   printf("%d\n", mul(7, 255));       // 1785
   return 0;
}
