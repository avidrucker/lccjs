// demo-012-global-variables.c
// Chapter 5: Variable Storage Classes
// Concept: Global variables — file-scope, fixed addresses, persist for the
//          lifetime of the program.
#include <stdio.h>
int x = 2, y = 0;
int main()
{
   y = x;
   printf("%d\n", y);          // prints 2
   return 0;
}
