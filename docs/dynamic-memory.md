# Dynamic memory in LCC assembly

A standalone reference for how `malloc` and `free` work in LCC(js) assembly —
what those concepts mean in C, how the primitives map to the 16-bit ISA, and the
specific implementation used in `plusdemos/gameSnake.ap`.

---

## Dynamic memory in C

In C, `malloc(n)` asks the OS (via `sbrk`/`mmap`) for `n` bytes of heap memory and
returns a pointer to it. `free(ptr)` returns that memory to the allocator so future
`malloc` calls can reuse it without asking the OS again.

```c
int *p = malloc(3 * sizeof(int));   // allocate 3 ints
p[0] = 5; p[1] = 3; p[2] = 0;      // use them
free(p);                            // reclaim
int *q = malloc(3 * sizeof(int));   // may reuse p's old memory
```

Key properties of C's allocator:
- **Heap lives between BSS and stack** — grows upward, stack grows downward.
- **`malloc` may call the OS** on the first allocation (or when the free list is
  exhausted), but otherwise recycles previously freed blocks.
- **`free` is O(1)** for a simple free list; no OS call needed.
- **Metadata overhead** — standard allocators store a size header before each
  block, so `free` knows how many bytes to reclaim.

---

## Memory layout in LCC

The LCC 16-bit address space is 65 536 words (one word = 16 bits):

```
Low address
  ┌────────────────────────┐ 0x0000
  │  code + static data    │  ← assembled instructions and .word/.string data
  ├────────────────────────┤
  │  heap (grows up ↑)     │  ← managed by @avail / malloc / free
  ├────────────────────────┤
  │  (free space)          │
  ├────────────────────────┤
  │  stack (grows down ↓)  │  ← r6 = sp; push/pop
  └────────────────────────┘ 0xFFFF
High address
```

There is no OS. The program owns the entire address space. Dynamic memory is
managed by hand, in assembly.

---

## `@avail` — the bump pointer

`@avail` is a one-word global that holds the address of the next free heap word.
It is initialised to `*+1`, which is LCC assembler syntax for "the address of the
word immediately after this `.word` directive."

```asm
@avail: .word *+1   ; initialised to its own address + 1 (= first heap word)
```

A bump allocator uses it like this:

```asm
; malloc(r1 = number of words to allocate) → r0 = base address
malloc:
    ld  r0, @avail    ; r0 = current top of heap
    add r1, r0, r1    ; r1 = new top (old top + size)
    st  r1, @avail    ; advance the bump pointer
    ret               ; r0 = allocated block address
```

**Characteristics of bump allocation:**
- O(1) allocation.
- Zero per-block metadata overhead.
- No reclamation — freed blocks are permanently lost (memory leaks).

---

## `@freeList` — the free-list head

`@freeList` is a one-word global that holds the address of the first recycled block,
or `0` if none are available. When a block is freed, its first word is repurposed to
store the address of the previously-free block (a singly-linked list of recycled
blocks).

```asm
@freeList: .word 0   ; 0 = free list is empty
```

### Placement constraint — `@freeList` must precede `@avail`

`@avail: .word *+1` initialises to the address immediately after itself. If
`@freeList` were placed *after* `@avail`, then `@avail` would initialise to
`@freeList`'s address, and the first `malloc` call would overwrite `@freeList`
with payload data.

```asm
; CORRECT — @freeList at N, @avail at N+1, heap starts at N+2
@freeList: .word 0
@avail:    .word *+1

; WRONG — @avail at N initialises to N+1 = @freeList; first malloc corrupts it
@avail:    .word *+1
@freeList: .word 0    ← clobbered on the first allocation
```

**Rule:** any static variable added to a section that ends with
`@avail: .word *+1` must be inserted before `@avail`, not after.

---

## Pattern 1 — fixed-size free list

This is the allocator used in `plusdemos/gameSnake.ap`. It works because every
allocation is exactly the same size (3 words: row, col, next-pointer for a snake
node), so no size header is needed — the freed block's first word can be repurposed
as the free-list next pointer without extra metadata.

### `malloc(r1 = size) → r0 = address`

```asm
malloc:
    ld   r0, @freeList
    cmp  r0, 0
    bre  @bump              ; free list empty → fall through to bump
    ldr  r2, r0, 0          ; r2 = node->next (stored in freed block's word 0)
    st   r2, @freeList      ; freeList = node->next
    ret                     ; r0 = recycled block address
@bump:
    ld   r0, @avail
    add  r1, r0, r1
    st   r1, @avail
    ret
```

On the fast path (free list non-empty): unlink the head block and return it.
On the slow path (free list empty): advance the bump pointer as before.

### `free(r0 = ptr)`

```asm
free:
    ld   r1, @freeList      ; r1 = current head
    str  r1, r0, 0          ; block->next = old head (reuse block's first word)
    st   r0, @freeList      ; freeList = this block
    ret
```

`free` is a leaf function (no nested calls), so no push/pop needed.

### C equivalent of this pattern

```c
static int *freeList = NULL;

int *my_malloc(void) {
    if (freeList) {
        int *block = freeList;
        freeList = (int *)*freeList;   // advance: freeList = block->next
        return block;
    }
    return bump_alloc(3);              // 3-word block from heap
}

void my_free(int *block) {
    *block = (int)freeList;            // block->next = old head
    freeList = block;
}
```

---

## Steady-state behaviour

Once the snake reaches a stable length, every move performs:

1. `removeSnakeTail` → calls `free(oldHead)` → links the 3-word node onto `@freeList`
2. `appendSnakeHead` → calls `malloc(3)` → pops that same node off `@freeList`

The bump pointer (`@avail`) stops advancing. No new heap words are consumed. The
maximum `@avail` value is reached when the snake is at its longest, and it stays
there for the rest of the game.

---

## Comparison table

| Concept | C | LCC assembly |
|---|---|---|
| Allocate N bytes | `malloc(N)` | `mov r1, N; bl malloc` → `r0` = ptr |
| Free a block | `free(ptr)` | `mov r0, ptr; bl free` |
| Heap start | managed by libc/OS | first address after `@avail` in binary |
| Bump pointer | internal to libc | `@avail: .word *+1` (explicit global) |
| Free-list head | internal to libc | `@freeList: .word 0` (explicit global) |
| Recycled block's next ptr | stored in hidden header | stored in `block[0]` (first word reused) |
| Block size metadata | 1–2 word header per block | none (fixed-size only; Pattern 1) |
| `free` cost | O(1) prepend | O(1) prepend |
| `malloc` fast path | O(1) from free list | O(1) from `@freeList` |
| `malloc` slow path | O(heap) or OS call | O(1) bump (`@avail` advance) |

---

## See also

- `plusdemos/gameSnake.ap` — live implementation (Pattern 1, lines ~660–683)
- `docs/research/560-free-implementation-in-lcc-assembly.md` — feasibility analysis,
  all three allocator patterns, ISA constraints
- `docs/research/202-gamesnake-code-quality.md` — code-quality audit that originally
  flagged the leak
