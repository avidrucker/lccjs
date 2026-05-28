// demo-033-division-algorithm.c
// Chapter 11: Integer Arithmetic
// Concept: Integer division by repeated subtraction — subtract divisor from
//          dividend until it goes negative; the count is the quotient.
#include <stdio.h>
int divide(int x, unsigned int y)
{
   int q = 0;
   while (1) {
      x -= y;
      if (x < 0) break;
      q++;
   }
   return q;
}
int main()
{
   printf("%d\n", divide(77, 7));     // 11
   return 0;
}
