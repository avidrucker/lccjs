// demo-034-command-line-args.c
// Chapter 12: Operating System Interface
// Concept: argc and argv — the OS startup stub pushes them onto the stack
//          before calling main; main prints all arguments in reverse order.
//
// This version uses a hardcoded argv array (matching the assembly startup
// stub) so both sides produce identical deterministic output without
// depending on OS-provided command-line arguments.
//
// Expected output (printed in reverse order):
//   world
//   hello
//   prog
#include <stdio.h>
int main(void)
{
    const char *argv[] = {"prog", "hello", "world"};
    int argc = 3;
    int i = argc - 1;
    while (i >= 0) {
        printf("%s\n", argv[i]);
        i--;
    }
    return 0;
}
