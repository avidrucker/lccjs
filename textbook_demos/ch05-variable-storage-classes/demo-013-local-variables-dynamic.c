// demo-013-local-variables-dynamic.c
// Chapter 5: Variable Storage Classes
// Concept: Automatic (dynamic) local variables — allocated on the call stack,
//          accessed by frame-pointer-relative offsets in the assembly.
#include <stdio.h>
void f(int a)
{
   int x = 1;
   int y;
   y = x + a;
   printf("%d\n", y);          // prints 12
}
int main()
{
   f(11);
   return 0;
}
