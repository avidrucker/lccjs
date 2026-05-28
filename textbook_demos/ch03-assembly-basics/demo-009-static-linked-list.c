// demo-009-static-linked-list.c
// Chapter 3: Assembly Language Basics
// Concept: A singly-linked list built in static storage and traversed by
//          walking next pointers until a NULL terminator.
#include <stdio.h>
struct Node {
   int data;
   struct Node *next;
};
struct Node n5 = {50, 0};
struct Node n4 = {40, &n5};
struct Node n3 = {30, &n4};
struct Node n2 = {20, &n3};
struct Node n1 = {10, &n2};
struct Node *first = &n1;
int main()
{
   struct Node *p = first;
   while (p != 0) {
      printf("%d\n", p->data);
      p = p->next;
   }
   return 0;
}
