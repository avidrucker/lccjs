// demo-020-pointer-to-function.c
// Chapter 7: Pointers
// Concept: Store a function's address in a pointer and call it indirectly
//          (the assembly uses blr instead of bl).
#include <stdio.h>
int f(int x, int y)
{
   return x + y;
}
int main()
{
   int sum;
   int (*p)(int, int);

   sum = f(1, 2);              // direct call
   printf("%d\n", sum);        // 3

   p = f;                      // store function address
   sum = p(1, 2);              // indirect call via function pointer
   printf("%d\n", sum);        // 3
   return 0;
}
