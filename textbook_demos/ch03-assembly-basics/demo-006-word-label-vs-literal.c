// demo-006-word-label-vs-literal.c
// Chapter 3: Assembly Language Basics
// Concept: A pointer holds an address; a plain int holds a value. The C analog
//          of the assembly distinction between `.word x` (label) and `.word 7`
//          (literal).
#include <stdio.h>
int x = 7;
int *y = &x;   // y holds the ADDRESS of x
int  z = 7;    // z holds the VALUE 7
int main()
{
   printf("%p\n", (void *)y);   // print the address of x
   printf("%d\n", z);           // print 7
   printf("%d\n", *y);          // dereference: print 7
   return 0;
}
