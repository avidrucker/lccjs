// demo-007-signed-comparison.c
// Chapter 3: Assembly Language Basics
// Concept: Read two signed integers and report which is less, equal, or greater.
#include <stdio.h>
int main()
{
   int a, b;
   printf("Enter two signed integers\n");
   scanf("%d %d", &a, &b);
   if      (a <  b) printf("First number is less\n");
   else if (a == b) printf("Numbers are equal\n");
   else             printf("First number is greater\n");
   return 0;
}
