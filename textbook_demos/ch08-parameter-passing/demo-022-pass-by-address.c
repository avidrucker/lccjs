// demo-022-pass-by-address.c
// Chapter 8: Parameter Passing
// Concept: Pass by address (C pointer parameters) — the callee writes through
//          the pointer and modifies the caller's variable.
#include <stdio.h>
int x = 7;
void f(int *p)
{
   *p = *p + 1;                // modifies x via the pointer
}
int main()
{
   f(&x);
   printf("%d\n", x);          // 8 — x WAS changed
   return 0;
}
