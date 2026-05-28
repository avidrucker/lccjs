// demo-017-recursion-non-tail.c
// Chapter 6: Control Flow and Recursion
// Concept: Non-tail recursion — work happens both BEFORE and AFTER the
//          recursive call, so each frame must stay alive until unwinding.
#include <stdio.h>
void descend(int x)
{
   if (x == 0) {
      printf("bottom\n");
   } else {
      printf("down\n");
      descend(x - 1);
      printf("up\n");
   }
}
int main()
{
   descend(2);                 // prints: down down bottom up up
   return 0;
}
