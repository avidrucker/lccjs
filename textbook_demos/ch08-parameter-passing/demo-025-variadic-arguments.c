// demo-025-variadic-arguments.c
// Chapter 8: Parameter Passing
// Concept: Variable-length argument lists — va_list / va_start / va_arg walk
//          the variadic args by reading consecutive stack slots above the
//          last named argument.
#include <stdio.h>
#include <stdarg.h>
int add(int argnum, ...)
{
   int sum = 0;
   va_list p;
   va_start(p, argnum);
   while (argnum--) sum += va_arg(p, int);
   va_end(p);
   return sum;
}
int main()
{
   printf("%d\n", add(2, 5, 7));   // prints 12
   return 0;
}
