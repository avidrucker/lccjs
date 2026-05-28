// demo-026-struct-static.c
// Chapter 9: Structures
// Concept: Static struct — fields live at consecutive offsets from the struct's
//          base. Field access compiles to base+offset loads, whether via the
//          name (a.y) or a pointer (p->y).
#include <stdio.h>
struct Point { int x; int y; };
struct Point a;
struct Point *p;
int main()
{
   a.x = 1;
   a.y = 2;
   p = &a;
   printf("%d\n", a.y);        // 2
   printf("%d\n", p->y);       // 2  (via pointer)
   printf("%d\n", (*p).y);     // 2  (same machine code as p->y)
   return 0;
}
