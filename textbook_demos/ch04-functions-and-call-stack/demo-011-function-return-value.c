// demo-011-function-return-value.c
// Chapter 4: Functions and the Call Stack
// Concept: A function returns a value to its caller (in LCC, via register r0).
#include <stdio.h>
int f()
{
   return 5;
}
int main()
{
   printf("%d\n", f());        // prints 5
   return 0;
}
