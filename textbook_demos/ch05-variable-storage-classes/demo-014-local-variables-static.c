// demo-014-local-variables-static.c
// Chapter 5: Variable Storage Classes
// Concept: Static local variables — file-scope storage (like globals) but
//          visible only inside the function that declares them.
#include <stdio.h>
int x = 5;                     // global x
void f()
{
   static int x;               // static local x in f (zero-initialized)
   printf("%d\n", x);
}
void g()
{
   printf("%d\n", x);          // global x
}
int main()
{
   static int x = 3;           // static local x in main
   printf("%d\n", x);          // 3
   f();                        // 0
   g();                        // 5
   return 0;
}
