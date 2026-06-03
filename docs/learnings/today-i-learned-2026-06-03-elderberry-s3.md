# TIL 2026-06-03 — ELDERBERRY s3

**Context:** Session covering #562 (Pattern 1 free-list allocator in gameSnake.ap),
#603 (site curated-samples dedup + charTypewriter placement), and #594 (pages.yml
path-trigger scoping).

---

## 1. `@freeList` must precede `@avail` — `*+1` is position-relative at assembly time

**What happened:** Implementing Pattern 1 free-list in `gameSnake.ap`, I needed to
add a `@freeList: .word 0` global alongside the existing `@avail: .word *+1` bump
pointer. The placement order matters.

`@avail: .word *+1` initialises the stored value to the address of the word
immediately after `@avail` itself — the self-referential `*` resolves at assembly
time to wherever `@avail` sits in the binary. If `@freeList` were placed *after*
`@avail`, then `@avail` would initialise to `@freeList`'s address, and the first
`malloc` call would overwrite `@freeList` with payload data.

**The rule:** any static variable added to a section that ends with
`@avail: .word *+1` must be inserted *before* `@avail`, not after. The heap starts
at the first address after `@avail`; placing statics after it silently puts them
inside the heap arena.

---

## 2. Saving a register before an in-place overwrite — the `removeSnakeTail` pattern

**What happened:** `removeSnakeTail` needed to call `free(oldHead)` after advancing
the list. The existing code was:

```asm
ldr r1, r0, 0   ; r1 = oldHead
ldr r1, r1, 2   ; r1 = oldHead->next  ← oldHead address lost here
str r1, r0, 0   ; *snake = oldHead->next
```

`oldHead` was gone by the time we needed to pass it to `free`.

**The fix:**

```asm
mov r2, r1       ; r2 = oldHead (save before overwrite)
ldr r1, r1, 2    ; r1 = oldHead->next
str r1, r0, 0    ; *snake = oldHead->next
mov r0, r2       ; r0 = oldHead (arg to free)
bl  free
```

**The pattern:** whenever a pointer is needed both as the base for an indirect load
and as an argument to a subsequent call, save it in a scratch register *before* the
load that overwrites it. In LCC assembly there is no stack-spill shortcut; a spare
register is the only option for a leaf-call caller.

---

## 3. Issue descriptions go stale when concurrent work changes the scope

**What happened:** Issue #594 ("pages.yml path triggers are over- and
under-scoped") was filed with a "Should have" trigger list that enumerated
`demos/demoA.a`, `demos/demoO.a`, `demos/demoN.a` — the curated samples at the
time of filing. By the time #594 was worked, #603 had:

- replaced those three with `demos/helloWorld.a`
- kept all 26 `demoA–demoZ` files (rendered by the alphabet suite, auto-discovered
  via `'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')`)

The issue's "Should have" list was therefore both stale (wrong curated files) and
incomplete (missed 23 of 26 alphabet demos).

**The rule:** before implementing a CI/config fix, audit the "Should have" against
the *current* state of the build script, not just the issue description. When other
agents closed intervening issues that touched the same files, the spec may have
drifted. The closing comment should note the discrepancy so reviewers understand why
the final diff differs from the issue's stated spec.

---

## 4. Wildcards in pages.yml path triggers are correct for folder-scanned sections

**What happened:** The issue title said "replace wildcards with exact rendered-file
list," which I initially read as "remove all wildcards." But `docs/research/**`,
`docs/learnings/**`, `docs/glossary/**`, and `docs/themes/**` are wildcard triggers
that are *correctly scoped*: `build-site.js` renders every `.md` file found in
those directories via `fs.readdirSync`. Adding a new `.md` to `docs/research/`
should trigger a rebuild — the wildcard is the right tool.

The over-scoping problem was specific to `demos/**` and `plusdemos/**`, which
contain files that are never rendered (`happy-path.a`, `gameSnake.ap`, etc.).

**The rule:** a wildcard trigger is over-scoped only when the directory contains
files that are *not* consumed by the build. Folder-scanned sections should keep
wildcards; explicit-file sections should enumerate. The two patterns serve different
purposes and should not be conflated.

---

## What landed

| Issue | Role | Deliverable |
|-------|------|-------------|
| #562 | SPIKE | Pattern 1 fixed-size free list in `gameSnake.ap`: `@freeList` global, updated `malloc`, new `free` leaf function, `removeSnakeTail` reclaims tail nodes |
| #603 | DEV | Replaced curated demoA/O/N with `demos/helloWorld.a`; moved `charTypewriter.ap` to new "LCC+ demos" section below alphabet suite; rebuilt `docs/site/index.html` |
| #594 | DEV | Fixed `pages.yml` path triggers: removed `demos/**`/`plusdemos/**` wildcards, enumerated all 27 rendered demo files, added 8 previously missing parity/workflow docs |
