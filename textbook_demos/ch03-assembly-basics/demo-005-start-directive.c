// demo-005-start-directive.c
// Chapter 3: Assembly Language Basics
// Concept: Same program as demo-004, but the subroutine is defined before main.
//          In assembly this requires a .start directive; in C the order is
//          irrelevant because the compiler/linker always uses main as entry.
#include <stdio.h>
void greet()
{
   printf("Hello\n");
}
int main()
{
   greet();
   greet();
   return 0;
}
