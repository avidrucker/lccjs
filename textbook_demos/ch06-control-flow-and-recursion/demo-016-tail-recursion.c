// demo-016-tail-recursion.c
// Chapter 6: Control Flow and Recursion
// Concept: Tail recursion — the recursive call is the last action before
//          return, so each frame contributes nothing to the post-call work.
#include <stdio.h>
void countdown(int x)
{
   if (x != 0) {
      printf("%d\n", x);
      countdown(x - 1);
   }
}
int main()
{
   countdown(3);               // prints: 3 2 1
   return 0;
}
