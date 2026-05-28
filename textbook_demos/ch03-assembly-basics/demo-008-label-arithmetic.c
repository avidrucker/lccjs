// demo-008-label-arithmetic.c
// Chapter 3: Assembly Language Basics
// Concept: Adjacent words in memory can be reached by offset from a single
//          label — the C analog is array indexing relative to a base.
#include <stdio.h>
int arr[] = {5, 11, 17};
int main()
{
   printf("%d\n", arr[0]);    // 5    (assembly: ld r0, x)
   printf("%d\n", arr[1]);    // 11   (assembly: ld r0, x+1)
   printf("%d\n", arr[2]);    // 17   (assembly: ld r0, x+2)
   printf("%d\n", arr[1]);    // 11   (assembly: ld r0, y-1)
   return 0;
}
