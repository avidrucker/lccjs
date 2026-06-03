# Research: free() in LCC(+) assembly (#560)

**Date:** 2026-06-03  
**Agent:** APPLE  
**Parent:** #560 · Related: #153, #144

---

## Verdict

A real `free()` is implementable in the base LCC ISA. LCC+ adds nothing useful for
memory management. For `gameSnake.ap` specifically, the simplest and most efficient
approach is a **fixed-size free list** — zero extra words per block, minimal code.
The bump allocator leak is, however, benign in practice (bounded memory budget;
the game ends long before exhausting the address space).

---

## Memory model

| Property | Value |
|---|---|
| Address space | 65 536 words (0x0000–0xFFFF), 16 bits each |
| Stack | grows DOWN from 0xFFFF; r6 = sp |
| Frame pointer | r5 = fp |
| Link register | r7 = lr |
| Heap (bump) | grows UP from end of code/data |
| Bump pointer | `@avail` in `gameSnake.ap`, initialised to `*+1` |

The code + static data region and the heap share the low end of the address space;
the stack lives at the high end. A bump allocator growing up and a stack growing down
collide in the middle — the same layout as classic 8/16-bit micros.

---

## ISA capabilities relevant to a free() implementation

The base ISA has everything needed:

- **Indirect load/store with offset:** `ldr dr, base, offset6` and `str sr, base, offset6`
  — essential for reading/writing block headers and linked-list next pointers.
- **Arithmetic:** `add`, `sub` — can adjust pointers by constant offsets.
- **Bitwise:** `and`, `or`, `not`, `xor` — can manipulate a free/allocated flag in a header.
- **Conditional branches + compare** — enough for list traversal.
- **`push`/`pop`** — stack discipline for calling conventions.

**Practical constraints:**

- `imm9` range is −256..255 and `imm5` is −16..15. Loading a bitmask like `0x8000`
  requires a shift: `mvi r0, 1` + `sll r0, 15`. Not expensive, just not a single
  instruction.
- `offset6` in `ldr`/`str` is 6-bit signed (−32..31), sufficient for struct fields
  up to 31 words offset from the base pointer.

**LCC+ additions:** `rand`, `srand`, `millis`, `sleep`, `clear`, `cursor`, `nbain`,
`resetc` — none of these assist with memory management. LCC+ has no
memory-management traps.

---

## Three allocator patterns, from simplest to most general

### Pattern 1 — Fixed-size free list (best fit for gameSnake)

Works when all allocations are the same size. `gameSnake` allocates only snake nodes,
each exactly **3 words** (row, col, next). A singly-linked free list costs nothing
extra per allocated block — the freed block's first word becomes the next pointer
while it sits on the free list.

```asm
; Global state (one word each):
@freeList:  .word 0          ; head of free list (0 = empty)
@avail:     .word *+1        ; bump pointer (existing)

; malloc(r1 = size in words) — modified to check free list first
malloc:
        ld   r0, @freeList
        cmp  r0, 0
        bre  @bump            ; free list empty → fall through to bump
        ldr  r2, r0, 0        ; r2 = node->next
        st   r2, @freeList    ; freeList = node->next
        ret                   ; r0 = recycled block address
@bump:
        ld   r0, @avail
        add  r1, r0, r1
        st   r1, @avail
        ret

; free(r0 = ptr to 3-word node)
free:
        ld   r1, @freeList    ; r1 = current head
        str  r1, r0, 0        ; node->next = old head  (reuse first word)
        st   r0, @freeList    ; freeList = node
        ret
```

**Overhead:** 0 extra words per allocated block. 1 global word (`@freeList`).  
**Code size:** ~10 instructions for malloc + ~4 for free.  
**Limitation:** only works for fixed-size allocations. All freed blocks are 3 words;
calling `malloc(3)` always gets a 3-word block back.

### Pattern 2 — Implicit free list (variable-size, general)

Each block gets a **1-word header** before the payload storing the block size and a
free/allocated bit. `free()` marks the header and coalesces adjacent free blocks
during the next `malloc()` scan.

```
Memory layout:
  [header: size | free_bit] [word 0] [word 1] ... [word size-2]
   ^ ptr - 1                ^ ptr returned to caller
```

`malloc(n)` searches from the start of the heap for a free block of size ≥ n.
`free(ptr)` sets the free bit in `mem[ptr - 1]`.

**Overhead:** 1 extra word per block always.  
**Complexity:** requires a linear scan of the heap on every `malloc()` — O(heap size).

### Pattern 3 — Explicit free list (variable-size, faster malloc)

Extends Pattern 2: each free block stores a next-pointer in its first payload word,
so `malloc()` only traverses the free list rather than the whole heap.

**Overhead:** 1-word header always; free blocks additionally use 1 payload word for
the next pointer (so minimum allocatable size = 2 words).  
**Complexity:** `malloc()` is O(free list length), `free()` is O(1) for insertion;
O(heap size) only for coalescing passes.

---

## Is the gameSnake leak worth fixing?

| Metric | Value |
|---|---|
| Leak per tail removal | 3 words (one node) |
| Max snake length | boardSize² = 100 nodes (10×10 grid) |
| Max total leaked words | ~300 words (= 600 bytes) |
| Total address space | 65 536 words |
| Fraction of address space leaked at max | ~0.5% |

The snake length is bounded by the board (100 cells). The game ends (win or collision)
long before exhausting the address space. **The bump-allocator leak is benign for a
demo of this scale.**

That said, Pattern 1 is so cheap (4 instructions for `free`, ~5 extra for the
`malloc` fast path, 1 global word) that adding it is a reasonable code-quality
improvement — not a correctness fix. Whether to do so is the call made in #153
(closed wontfix) and #202 (code-quality pass).

---

## Summary answers to the sub-questions

| Question | Answer |
|---|---|
| Can a free-list allocator be written in the base ISA? | **Yes.** All required operations exist. |
| Does LCC+ add any helpful instruction? | **No.** Its extensions are I/O-oriented. |
| Minimum heap metadata overhead? | **0 words** (fixed-size list) or **1 word/block** (variable-size). |
| Is the gameSnake leak worth fixing? | **Pragmatically no** — bounded budget, game ends first. Low-cost Pattern 1 would be a nice cleanup if #202 is ever worked. |
| Simplest viable allocator pattern? | **Fixed-size free list (Pattern 1)** — trivial to implement, zero runtime overhead per block. |
