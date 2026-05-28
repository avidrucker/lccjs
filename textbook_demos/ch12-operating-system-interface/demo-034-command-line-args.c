// demo-034-command-line-args.c
// Chapter 12: Operating System Interface
// Concept: argc and argv — the OS pushes them onto the stack before calling
//          main; this program prints the arguments in reverse order, which
//          includes argv[0] (the program name) last.
#include <stdio.h>
int main(int argc, char *argv[])
{
   int i = argc - 1;
   while (i >= 0) {
      printf("%s\n", argv[i]);
      i--;
   }
   return 0;
}
