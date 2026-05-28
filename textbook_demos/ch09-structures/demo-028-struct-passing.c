// demo-028-struct-passing.c
// Chapter 9: Structures
// Concept: Pass by value (copy all fields onto the stack) vs. pass by pointer
//          (push one address regardless of struct size).
#include <stdio.h>
struct Point { int x; int y; };
struct Point a;
void f(struct Point s)         // pass by value — copies all fields
{
   printf("%d %d\n", s.x, s.y);
}
void g(struct Point *p)        // pass by pointer — one word
{
   printf("%d %d\n", p->x, p->y);
}
int main()
{
   a.x = 1;
   a.y = 2;
   f(a);                       // 1 2
   g(&a);                      // 1 2
   return 0;
}
