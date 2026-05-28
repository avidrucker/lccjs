// demo-029-array-access.c
// Chapter 10: Arrays and Strings
// Concept: Four combinations of array access — global vs. local array, crossed
//          with compile-time constant vs. runtime variable index.
#include <stdio.h>
int ga[10], x = 3;
int main()
{
   int la[10];
   ga[2] = 10;                 // global, constant index
   ga[x] = 11;                 // global, variable index
   la[2] = 12;                 // local,  constant index
   la[x] = 13;                 // local,  variable index
   printf("%d\n", ga[2]);      // 10
   printf("%d\n", ga[3]);      // 11
   printf("%d\n", la[2]);      // 12
   printf("%d\n", la[3]);      // 13
   return 0;
}
