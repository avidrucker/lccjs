// demo-023-pass-by-value-result.c
// Chapter 8: Parameter Passing
// Concept: Pass by value-result — the value is copied IN on call and copied
//          back OUT on return. This is NOT a C mechanism (Ada-style); the
//          closest C-valid simulation uses an explicit pointer.
//
// Conceptual (not valid C) form, as in the assembly comment:
//   int x = 7;
//   void f(value-result int a) { a = a + 1; }
//   int main() { f(x); printf("%d\n", x); }   // prints 8
//
// Below: a C-valid simulation. The caller copies x into a temp, lets f
// modify the temp, then copies the temp back to x — exactly what the
// assembly does with push/pop/st.
#include <stdio.h>
int x = 7;
void f(int *a)
{
   *a = *a + 1;
}
int main()
{
   int tmp = x;                // copy IN
   f(&tmp);                    // callee modifies the temp
   x = tmp;                    // copy OUT (the "result" half)
   printf("%d\n", x);          // 8
   return 0;
}
