// demo-015-while-loop.c
// Chapter 6: Control Flow and Recursion
// Concept: A pre-test while loop — condition checked at the top of the loop.
#include <stdio.h>
void countdown(int x)
{
   while (x != 0) {
      printf("%d\n", x);
      x = x - 1;
   }
}
int main()
{
   countdown(3);               // prints: 3 2 1
   return 0;
}
