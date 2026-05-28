# cuh63 Exercise Reference

Annotated index of the assembly exercise files from the cuh63 package (*C and C++ Under the Hood*, Prof. Anthony J. Dos Reis, version 6.3). One doc per chapter, starting from Chapter 3 where assembly examples begin.

The original `.a` files live in `~/Documents/Study/Assembly/cuh63/` (not in this repo).

> **ISA reference:** [../lcc-isa.md](../lcc-isa.md) — full LCC instruction set  
> **LCC+ ISA:** [../lccplus-isa.md](../lccplus-isa.md) — extended instruction set

---

## Chapters

| Chapter | Doc | Topics | Files |
|---------|-----|--------|-------|
| 3 | [ch03.md](./ch03.md) | Assembly basics: loads/stores, I/O, loops, branches, subroutines, `.start`, `.word` label vs. literal, label arithmetic, linked list | ex0301–ex0311, p0315 |
| 4 | [ch04.md](./ch04.md) | Function call convention: push args right-to-left, `bl`/`ret`, `fp`-relative access, return value in `r0` | ex0401–ex0402 |
| 5 | [ch05.md](./ch05.md) | Variable storage classes: global (`.word`), dynamic local (stack frame), static local (mangled labels) | ex0501–ex0503 |
| 6 | [ch06.md](./ch06.md) | Control flow and recursion: `while` loop, tail recursion, non-tail recursion, `s` debugging trap | ex0601–ex0603 |
| 7 | [ch07.md](./ch07.md) | Pointers: to globals (`lea`), to locals (`add fp, -n`), to functions (`blr`) | ex0701–ex0703 |
| 8 | [ch08.md](./ch08.md) | Parameter passing: by value, by address, by value-result*, by name/thunks*, variadic (`va_list`) | ex0801–ex0804, ex0806 |
| 9 | [ch09.md](./ch09.md) | Structs: static allocation, label+offset field access, dynamic malloc, pass by value vs. by pointer | ex0901–ex0903 |
| 10 | [ch10.md](./ch10.md) | Arrays and strings: constant vs. variable index, global vs. local, all five string allocation forms, `mystrcpy` | ex1001–ex1003 |
| 11 | [ch11.md](./ch11.md) | Arithmetic algorithms: slow vs. binary multiplication (`srl`/`sll`), division by repeated subtraction | ex1101–ex1102 |
| 12 | [ch12.md](./ch12.md) | Command-line arguments: `.global main`, `argc`/`argv` via `fp+2`/`fp+3`, reverse print | ex1201 |
| 14 | [ch14.md](./ch14.md) | C++ references: reference parameters (hidden pointer), reference variables (global and local) | ex1401–ex1403 |
| 15 | [ch15.md](./ch15.md) | C++ classes: free functions with explicit `A*`, member functions with hidden `this`, dynamic allocation | ex1501–ex1504 |
| 16 | [ch16.md](./ch16.md) | Inheritance, virtual functions (vtable dispatch), constructors (name mangling, base-constructor chaining) | ex1601–ex1603 |
| 19 | [ch19.md](./ch19.md) | Address semantics: creation (`.word label`), propagation (`ld`/`st`), destruction (overwrite with constant) | ex1901 |

\* Not supported by C.

---

## Notable gaps in the package

- **Chapter 13** — no `ex13xx.a` files present
- **Chapter 17, 18** — no `ex17xx.a` / `ex18xx.a` files present
- **ex0805.a** — absent (Chapter 8 sequence skips from ex0804 to ex0806)
