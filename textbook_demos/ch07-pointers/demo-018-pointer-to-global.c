// demo-018-pointer-to-global.c
// Chapter 7: Pointers
// Concept: Take the address of a global, store it in a pointer, and read /
//          write through the pointer.
#include <stdio.h>
int *p;
int x = 7;
int main()
{
   p = &x;
   printf("%d\n", *p);         // 7
   *p = 8;
   printf("%d\n", x);          // 8  (x changed via the pointer)
   return 0;
}
