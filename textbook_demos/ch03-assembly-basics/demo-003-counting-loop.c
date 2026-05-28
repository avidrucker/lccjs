// demo-003-counting-loop.c
// Chapter 3: Assembly Language Basics
// Concept: A counting loop — sum the first 10 odd numbers.
#include <stdio.h>
int main()
{
   int sum = 0, odd = 1, count = 10;
   while (count > 0) {
      sum += odd;
      odd += 2;
      count--;
   }
   printf("Sum = %d\n", sum);   // prints: Sum = 100
   return 0;
}
