// demo-021-pass-by-value.c
// Chapter 8: Parameter Passing
// Concept: Pass by value — the callee receives a copy; the caller's variable
//          is unchanged.
#include <stdio.h>
int x = 7;
void f(int a)
{
   a = a + 1;                  // modifies the local copy only
}
int main()
{
   f(x);
   printf("%d\n", x);          // still 7 — x was NOT changed
   return 0;
}
