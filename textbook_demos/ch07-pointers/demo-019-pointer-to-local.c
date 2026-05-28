// demo-019-pointer-to-local.c
// Chapter 7: Pointers
// Concept: Take the address of a stack-allocated local; the assembly computes
//          fp + offset at runtime to materialize the address.
#include <stdio.h>
int main()
{
   int x = 7;
   int *p = &x;
   printf("%d\n", *p);         // 7
   *p = 8;
   printf("%d\n", x);          // 8
   return 0;
}
