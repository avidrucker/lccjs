// demo-010-function-call-with-args.c
// Chapter 4: Functions and the Call Stack
// Concept: Calling a function with arguments — the C side of the LCC calling
//          convention (caller pushes args right-to-left; callee reads them
//          from its stack frame).
#include <stdio.h>
void f(int x, int y)
{
   printf("%d\n", x + y);
}
int main()
{
   f(1, 2);                    // prints 3
   return 0;
}
