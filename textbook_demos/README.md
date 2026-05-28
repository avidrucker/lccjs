# Textbook Demos

Assembly examples organized by chapter, following the same concept ordering as
the cuh63 package (*C and C++ Under the Hood*, Prof. Anthony J. Dos Reis).

Each file has a globally unique ID (`demo-NNN`) and a descriptive name
indicating the concept it demonstrates. One concept per demo where possible;
related concepts share a demo (e.g. 005 shows both the problem and the fix for `.start`).

> **Cross-reference:** [docs/cuh63/](../docs/cuh63/README.md) — annotated index of the original cuh63 exercises  
> **ISA reference:** [docs/lcc-isa.md](../docs/lcc-isa.md)

---

## Chapter 3 — Assembly Language Basics

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 001 | [demo-001-load-add-display.a](ch03-assembly-basics/demo-001-load-add-display.a) | ex0301 | `ld`, `add`, `dout`, `nl`, `halt`, `.word` |
| 002 | [demo-002-string-input-output.a](ch03-assembly-basics/demo-002-string-input-output.a) | ex0302 | `lea`, `sout`, `sin`, `.string`, `.zero` |
| 003 | [demo-003-counting-loop.a](ch03-assembly-basics/demo-003-counting-loop.a) | ex0303 | `mov`, `sub`, `brp` — pre-test counting loop |
| 004 | [demo-004-subroutine-call.a](ch03-assembly-basics/demo-004-subroutine-call.a) | ex0304 | `bl`, `ret` — basic subroutine |
| 005 | [demo-005-start-directive.a](ch03-assembly-basics/demo-005-start-directive.a) | ex0305+ex0306 | `.start` — fixing entry-point layout order |
| 006 | [demo-006-word-label-vs-literal.a](ch03-assembly-basics/demo-006-word-label-vs-literal.a) | ex0307+ex0308 | `.word label` stores address; `.word n` stores value |
| 007 | [demo-007-signed-comparison.a](ch03-assembly-basics/demo-007-signed-comparison.a) | ex0309 | `din`, `cmp`, `brlt`/`bre`/`brgt` — three-way signed compare |
| 008 | [demo-008-label-arithmetic.a](ch03-assembly-basics/demo-008-label-arithmetic.a) | ex0311 | `x+n`, `y-n` — assembly-time label offsets |
| 009 | [demo-009-static-linked-list.a](ch03-assembly-basics/demo-009-static-linked-list.a) | p0315 | `.word ptr`, `.zero pad` — static linked list |

## Chapter 4 — Functions and the Call Stack

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 010 | [demo-010-function-call-with-args.a](ch04-functions-and-call-stack/demo-010-function-call-with-args.a) | ex0401 | Full calling convention: `push`/`pop`, `fp`, args at `fp+2/3`, prologue/epilogue |
| 011 | [demo-011-function-return-value.a](ch04-functions-and-call-stack/demo-011-function-return-value.a) | ex0402 | Return value in `r0` |

## Chapter 5 — Variable Storage Classes

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 012 | [demo-012-global-variables.a](ch05-variable-storage-classes/demo-012-global-variables.a) | ex0501 | Global `.word` variables; `ld`/`st` by label |
| 013 | [demo-013-local-variables-dynamic.a](ch05-variable-storage-classes/demo-013-local-variables-dynamic.a) | ex0502 | Stack-frame locals; `ldr`/`str` with negative `fp` offsets |
| 014 | [demo-014-local-variables-static.a](ch05-variable-storage-classes/demo-014-local-variables-static.a) | ex0503 | Static locals as mangled file-scope labels (`@s0_x`) |

## Chapter 6 — Control Flow and Recursion

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 015 | [demo-015-while-loop.a](ch06-control-flow-and-recursion/demo-015-while-loop.a) | ex0601 | `while` pattern: test-at-top, `brz` to exit, `br` back |
| 016 | [demo-016-tail-recursion.a](ch06-control-flow-and-recursion/demo-016-tail-recursion.a) | ex0602 | Tail recursion; `s` debug trap to view call stack |
| 017 | [demo-017-recursion-non-tail.a](ch06-control-flow-and-recursion/demo-017-recursion-non-tail.a) | ex0603 | Non-tail recursion; pre/post-call work ("down/bottom/up") |

## Chapter 7 — Pointers

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 018 | [demo-018-pointer-to-global.a](ch07-pointers/demo-018-pointer-to-global.a) | ex0701 | `lea`; dereference `ldr r0,r0,0`; write-through `str r0,r1,0` |
| 019 | [demo-019-pointer-to-local.a](ch07-pointers/demo-019-pointer-to-local.a) | ex0702 | `add r0, fp, -n` to get address of a stack variable |
| 020 | [demo-020-pointer-to-function.a](ch07-pointers/demo-020-pointer-to-function.a) | ex0703 | `lea func`; indirect call `blr r0` |

## Chapter 8 — Parameter Passing

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 021 | [demo-021-pass-by-value.a](ch08-parameter-passing/demo-021-pass-by-value.a) | ex0801 | Push value; callee modifies copy; caller unchanged |
| 022 | [demo-022-pass-by-address.a](ch08-parameter-passing/demo-022-pass-by-address.a) | ex0802 | Push `&x`; callee dereferences; caller's `x` modified |
| 023 | [demo-023-pass-by-value-result.a](ch08-parameter-passing/demo-023-pass-by-value-result.a) | ex0803 | Value in, `pop`+`st` out on return *(not C)* |
| 024 | [demo-024-pass-by-name-thunks.a](ch08-parameter-passing/demo-024-pass-by-name-thunks.a) | ex0804 | Thunk functions; re-evaluation on every access *(not C)* |
| 025 | [demo-025-variadic-arguments.a](ch08-parameter-passing/demo-025-variadic-arguments.a) | ex0806 | `va_start`/`va_arg` simulation; pointer walk through stack args |

## Chapter 9 — Structures

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 026 | [demo-026-struct-static.a](ch09-structures/demo-026-struct-static.a) | ex0901 | Static struct; `label+offset` field access; pointer + `ldr r0,r0,1` |
| 027 | [demo-027-struct-dynamic-malloc.a](ch09-structures/demo-027-struct-dynamic-malloc.a) | ex0902 | Bump-allocator `malloc`; heap struct; `str r0,r1,1` field write |
| 028 | [demo-028-struct-passing.a](ch09-structures/demo-028-struct-passing.a) | ex0903 | Pass by value (push all fields) vs. pass by pointer (push `&s`) |

## Chapter 10 — Arrays and Strings

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 029 | [demo-029-array-access.a](ch10-arrays-and-strings/demo-029-array-access.a) | ex1001 | Global/local × constant/variable index — four access patterns |
| 030 | [demo-030-array-passing.a](ch10-arrays-and-strings/demo-030-array-passing.a) | ex1002 | Array decay to pointer; `int z[]` ≡ `int *z`; `z[1]` ≡ `*(z+1)` |
| 031 | [demo-031-strings.a](ch10-arrays-and-strings/demo-031-strings.a) | ex1003 | Five string allocation forms; `mystrcpy` char-by-char loop |

## Chapter 11 — Integer Arithmetic

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 032 | [demo-032-multiplication-algorithms.a](ch11-integer-arithmetic/demo-032-multiplication-algorithms.a) | ex1101 | Slow (repeated add) vs. binary method (`srl`/`sll`) |
| 033 | [demo-033-division-algorithm.a](ch11-integer-arithmetic/demo-033-division-algorithm.a) | ex1102 | Division by repeated subtraction |

## Chapter 12 — Operating System Interface

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 034 | [demo-034-command-line-args.a](ch12-operating-system-interface/demo-034-command-line-args.a) | ex1201 | `.global main`; `argc` at `fp+2`; `argv` at `fp+3`; `argv[i]` access |

## Chapter 14 — C++ References

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 035 | [demo-035-cpp-reference-parameters.a](ch14-cpp-references/demo-035-cpp-reference-parameters.a) | ex1401 | `int &a` compiles as hidden pointer; `lea` at call site; deref in callee |
| 036 | [demo-036-cpp-reference-variables.a](ch14-cpp-references/demo-036-cpp-reference-variables.a) | ex1402 | `int &xr = x` stored as pointer; every access = load + deref |

## Chapter 15 — Classes and Objects

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 037 | [demo-037-cpp-struct-free-functions.a](ch15-classes-and-objects/demo-037-cpp-struct-free-functions.a) | ex1501 | Struct + free functions with explicit `A*`; name mangling |
| 038 | [demo-038-cpp-class-member-functions.a](ch15-classes-and-objects/demo-038-cpp-class-member-functions.a) | ex1502 | Hidden `this` pointer; `@A@set$ii` / `@A@display$v` |
| 039 | [demo-039-cpp-struct-dynamic-malloc.a](ch15-classes-and-objects/demo-039-cpp-struct-dynamic-malloc.a) | ex1503 | Heap struct with malloc + free functions |
| 040 | [demo-040-cpp-dynamic-objects.a](ch15-classes-and-objects/demo-040-cpp-dynamic-objects.a) | ex1504 | `new A` via malloc + member functions |

## Chapter 16 — Inheritance and Polymorphism

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 041 | [demo-041-cpp-inheritance.a](ch16-inheritance-and-polymorphism/demo-041-cpp-inheritance.a) | ex1601 | `B: public A`; inherited fields; static dispatch limitation |
| 042 | [demo-042-cpp-virtual-functions.a](ch16-inheritance-and-polymorphism/demo-042-cpp-virtual-functions.a) | ex1602 | Vtable pointer in object; `ldr r0,r0,0; blr r0`; dynamic dispatch |
| 043 | [demo-043-cpp-constructors.a](ch16-inheritance-and-polymorphism/demo-043-cpp-constructors.a) | ex1603 | `@A@A$i` / `@B@B$ii`; base-constructor chain; stack and heap objects |

## Chapter 19 — Address Semantics

| ID | File | cuh63 source | Concept |
|----|------|-------------|---------|
| 044 | [demo-044-address-semantics.a](ch19-address-semantics/demo-044-address-semantics.a) | ex1901 | Address creation (`.word label`), propagation (`ld`/`st`), destruction (overwrite) |
