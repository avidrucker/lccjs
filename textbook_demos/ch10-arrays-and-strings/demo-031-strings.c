// demo-031-strings.c
// Chapter 10: Arrays and Strings
// Concept: The five ways to declare a string in C, plus a hand-rolled strcpy.
#include <stdio.h>

char g[] = "AX";               // form 1: global char array
char *p  = "BX";               // form 2: global pointer to literal

void mystrcpy(char *dst, char *src)
{
   while ((*dst++ = *src++) != 0);
}

int main()
{
   char c[] = "CX";            // form 3: local char array on the stack
   char *q  = "DX";            // form 4: local pointer to literal
   char *r;                    // form 5: pointer, assigned later
   r = "EX";

   printf("%s\n", g);          // AX
   printf("%s\n", p);          // BX
   printf("%s\n", c);          // CX
   printf("%s\n", q);          // DX
   printf("%s\n", r);          // EX

   mystrcpy(g, "FX");
   printf("%s\n", g);          // FX
   return 0;
}
