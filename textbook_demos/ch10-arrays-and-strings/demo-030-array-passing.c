// demo-030-array-passing.c
// Chapter 10: Arrays and Strings
// Concept: Arrays decay to pointers when passed. `int z[]` and `int *z` are
//          identical as parameter types; `z[1]` and `*(z+1)` compile to the
//          same load instruction.
#include <stdio.h>
int a[2];
void f1(int z[])  { printf("%d\n", z[1]); }
void f2(int *z)   { printf("%d\n", *(z + 1)); }
void f3(int z[])  { printf("%d\n", *(z + 1)); }
void f4(int *z)   { printf("%d\n", z[1]); }
int main()
{
   a[1] = 99;
   f1(a);                      // 99
   f2(a);                      // 99
   f3(a);                      // 99
   f4(a);                      // 99
   return 0;
}
