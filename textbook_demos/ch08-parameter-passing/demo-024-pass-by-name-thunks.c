// demo-024-pass-by-name-thunks.c
// Chapter 8: Parameter Passing
// Concept: Pass by name (Algol 60) — the argument is re-evaluated on every
//          access using a "thunk" that captures the caller's environment.
//          This is NOT a C mechanism; C arguments are evaluated exactly once
//          at the call site. The closest C-valid simulation passes a thunk
//          function pointer explicitly.
//
// Conceptual (not valid C) form, as in the assembly comment:
//   int a = 1;
//   void f(name int y) { print(y); a = a + 2; print(y); }   // y re-evaluated
//   int main() { int b = 2; f(a + b); }
//   // prints: 3   (a+b = 1+2)
//   //         5   (a+b = 3+2, after a += 2)
//
// Below: a C-valid simulation. The "thunk" is a function that evaluates the
// expression in the caller's environment; f re-invokes it for each access.
#include <stdio.h>
int a = 1;
int b;
int thunk_a_plus_b(void)        // evaluates a + b in caller's environment
{
   return a + b;
}
void f(int (*y)(void))
{
   printf("%d\n", y());        // 3  (a=1, b=2, a+b=3)
   a = a + 2;
   printf("%d\n", y());        // 5  (a=3, b=2, a+b=5)
}
int main()
{
   b = 2;
   f(thunk_a_plus_b);
   return 0;
}
