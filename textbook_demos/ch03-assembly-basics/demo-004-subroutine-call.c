// demo-004-subroutine-call.c
// Chapter 3: Assembly Language Basics
// Concept: Calling a subroutine twice.
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
