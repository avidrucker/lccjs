// demo-027-struct-dynamic-malloc.c
// Chapter 9: Structures
// Concept: Allocate a struct at runtime with malloc and use pointer-with-offset
//          to access its fields.
#include <stdio.h>
#include <stdlib.h>
struct Point { int x; int y; };
struct Point *p;
int main()
{
   p = malloc(sizeof(struct Point));
   p->y = 5;
   printf("%d\n", p->y);       // 5
   free(p);
   return 0;
}
