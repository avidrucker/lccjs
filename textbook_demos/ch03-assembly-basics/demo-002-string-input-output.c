// demo-002-string-input-output.c
// Chapter 3: Assembly Language Basics
// Concept: Display a string prompt, read a string from the user, echo it back.
#include <stdio.h>
int main()
{
   char buffer[100];
   printf("Enter string\n");
   fgets(buffer, 100, stdin);
   printf("%s", buffer);
   return 0;
}
