# LCC Assembly Idioms and Patterns

Recurring shapes to reach for when writing LCC assembly. Each pattern is keyed
to a canonical demo in `lccjs/textbook_demos/` — read that demo's source for
the working, commented version. The patterns here describe the *shape* and
when to use it.

The 8 canonical demos referenced from SKILL.md:

| Demo | File |
|---|---|
| 001 | `ch03-assembly-basics/demo-001-load-add-display.a` |
| 003 | `ch03-assembly-basics/demo-003-counting-loop.a` |
| 007 | `ch03-assembly-basics/demo-007-signed-comparison.a` |
| 010 | `ch04-functions-and-call-stack/demo-010-function-call-with-args.a` |
| 013 | `ch05-variable-storage-classes/demo-013-local-variables-dynamic.a` |
| 017 | `ch06-control-flow-and-recursion/demo-017-recursion-non-tail.a` |
| 018 | `ch07-pointers/demo-018-pointer-to-global.a` |
| 020 | `ch07-pointers/demo-020-pointer-to-function.a` |

---

## P1. Program skeleton (when to use: every `.a` file)

```
          .start main          ; entry point — required if main: isn't at addr 0

; ---- data section ----
@M0:      .string "Hello\n"
@N0:      .word 42

main:     ; ... code ...
          halt
```

**Why this order:** `.start` near the top makes the entry point visible at a
glance. Data (`@M*` strings, `@N*` numerical constants) goes above the code
that uses it, so the `lea`/`ld` reaching backward stays within the ±256
`pcoffset9` window (SKILL.md pitfall #2).

**Canonical:** demo-001.

---

## P2. Counting loop — decrement-then-`brp` (when to use: known iteration count)

```
          mov  r4, 10          ; r4 = counter
@L0:      ; ... body ...
          sub  r4, r4, 1       ; counter--
          brp  @L0             ; repeat while > 0
```

**Why `brp`:** `brp` fires when the result of the previous arithmetic was
strictly positive (`N=0 AND Z=0`). After `sub r4, r4, 1`, the body runs for
counter values 10, 9, …, 1, then on the final decrement the result is 0 →
`brp` falls through. Total iterations = the initial value.

**Watch:** for an *inclusive* count (run while counter ≥ 0), use `brzp` —
`brp` excludes zero, which is the most common off-by-one in LCC loops.

**Canonical:** demo-003.

---

## P3. Pre-test loop — `cmp` + `brXX` to exit (when to use: condition not just "count > 0")

```
@L0:      ; loop top — test first
          ldr  r0, fp, 2       ; r0 = x
          cmp  r0, 0
          brle @L1             ; exit if x ≤ 0  (pseudo: combine brlt + bre)
          ; ... body ...
          sub  r0, r0, 1
          str  r0, fp, 2       ; write back if you need to
          br   @L0
@L1:      ; after loop
```

**Why:** unlike P2, the body never runs at all if the condition starts false.
Use this shape for arbitrary while-loops; P2 only fits "do N times."

**Branch suffix reference:** see SKILL.md pitfall #4 for the full table. The
hazardous ones: `brp` excludes zero; `brlt` is signed; `brc` is unsigned-below.

---

## P4. Three-way signed compare (when to use: <, =, > all need handling)

```
          cmp  r1, r2
          brlt @LT
          bre  @EQ
          ; fall-through == greater than
@GT:      ; ...
          br   @END
@LT:      ; ...
          br   @END
@EQ:      ; ...
@END:
```

**Why:** `cmp` sets all the flags from one subtraction; multiple `brXX`
checks against the same compare don't need to repeat `cmp`. Order the
branches so the fall-through case is the most common one in your program.

**Canonical:** demo-007.

---

## P5. Function call with arguments (when to use: anything more than a trivial helper)

**Caller side:**
```
          mov  r0, 2           ; rightmost arg pushed first
          push r0
          mov  r0, 1           ; leftmost arg pushed last
          push r0
          bl   f
          add  sp, sp, 2       ; pop the 2 args (caller cleans up)
```

**Callee side (prologue + epilogue):**
```
f:        push lr              ; save return addr — must come first
          push fp              ; save caller's frame pointer
          mov  fp, sp          ; establish our frame base

          ldr  r0, fp, 2       ; r0 = arg1 (leftmost — closest to fp)
          ldr  r1, fp, 3       ; r1 = arg2
          ; ... body, return value in r0 ...

          mov  sp, fp          ; discard locals, restore sp
          pop  fp              ; restore caller's frame pointer
          pop  lr              ; restore return addr
          ret                  ; pc ← lr
```

**Why right-to-left push:** so the leftmost arg ends up nearest `fp` at
`fp+2`. This makes variadic-style "first N args at fp+2…fp+N+1" possible.

**Why `push lr` first:** the callee's epilogue pops in reverse order; `lr` is
the *last* thing it touches before `ret`. Get the order wrong and `ret`
jumps to whatever was on top of the stack — typically a hard crash.

**Canonical:** demo-010.

---

## P6. Stack-allocated locals (when to use: function needs more state than `r0`–`r4`)

```
f:        push lr
          push fp
          mov  fp, sp
          sub  sp, sp, 3       ; allocate 3 local words

          ; locals live at fp-1, fp-2, fp-3
          mov  r0, 5
          str  r0, fp, -1      ; local1 = 5
          mov  r0, 10
          str  r0, fp, -2      ; local2 = 10
          ; ... use locals via ldr/str fp, -N ...

          mov  sp, fp          ; epilogue: dealloc locals AND restore sp
          pop  fp
          pop  lr
          ret
```

**Why negative offsets:** the stack grows downward, so `sp < fp` mid-function;
locals live between `sp` and `fp`. `offset6` is `[-32, 31]`, so a function
can have up to 32 locals without resorting to address arithmetic.

**Watch:** `offset6` is 6-bit. For more than 32 locals, you need to load the
local's address into a scratch register first.

**Canonical:** demo-013.

---

## P7. Non-tail recursion (when to use: post-call work needed in each frame)

The shape is exactly P5 + P6. The *only* thing that makes it work where naive
recursion fails: `push lr` in the prologue. Without it, the inner `bl` would
overwrite `lr`, and when the outer call tries to `ret`, it goes to the wrong
place.

```
descend:  push lr              ; ← THIS is the line that makes recursion safe
          push fp
          mov  fp, sp
          ldr  r0, fp, 2
          cmp  r0, 0
          brnz @REC
          ; base case
          lea  r0, @MSG_BOTTOM
          sout r0
          br   @END
@REC:     lea  r0, @MSG_DOWN
          sout r0
          ldr  r0, fp, 2       ; arg - 1
          sub  r0, r0, 1
          push r0
          bl   descend         ; recurse
          add  sp, sp, 1
          lea  r0, @MSG_UP     ; runs AFTER recursion unwinds
          sout r0
@END:     mov  sp, fp
          pop  fp
          pop  lr
          ret
```

**Why:** pre-call prints + post-call prints form the symmetric trace
("down/down/bottom/up/up"). Tail recursion (no work after the call) doesn't
need this discipline but still benefits from the uniform frame layout.

**Canonical:** demo-017.

---

## P8. Pointer to global — load address, then deref (when to use: read or write through a pointer)

```
          lea  r0, @gx         ; r0 = &gx (address of gx)
          ldr  r1, r0, 0       ; r1 = *r0 = gx
          add  r1, r1, 1       ; r1 = gx + 1
          str  r1, r0, 0       ; *r0 = r1 (write-through)

@gx:      .word 7
```

**Why `lea` then `ldr`/`str`:** `lea r0, @gx` puts the *address* of `@gx`
into `r0` (via `pcoffset9`, so the ±256 limit applies — SKILL.md pitfall #2).
`ldr r1, r0, 0` dereferences with `offset6 = 0`. `str` is symmetric.

**For symbols beyond ±256:** pointer alias pattern from SKILL.md pitfall #2:

```
          ld   r0, @gxP        ; r0 = address of gx (loaded from .word, not pcoffset)
          ldr  r1, r0, 0       ; deref
@gxP:     .word @gx            ; the alias — must be within ±256 of the ld above
```

**Canonical:** demo-018.

---

## P9. Function pointer + indirect call (when to use: dispatch tables, callbacks)

```
          lea  r0, target_fn   ; r0 = address of target_fn
          blr  r0, 0           ; indirect call — pc ← r0+0, lr ← return addr

target_fn:
          push lr
          push fp
          mov  fp, sp
          ; ... body ...
          mov  sp, fp
          pop  fp
          pop  lr
          ret
```

**Why `blr`:** like `bl` but takes a base register + `offset6` instead of a
PC-relative label. The function being called still uses the standard prologue
/ epilogue; the only difference is how control reaches it.

**Canonical:** demo-020.

---

## P10. String output (when to use: any printable text)

```
          lea  r0, @MSG        ; r0 = address of string (pcoffset9 — ±256 applies)
          sout r0              ; print until NUL

@MSG:     .string "hello, world\n"
```

**Why `sout` not `dout`:** `sout` prints a NUL-terminated string starting at
`r0`. `dout` prints the *number* in `r0`. Common confusion: `dout r0` after
`lea r0, @MSG` prints the address as a decimal integer, which is rarely what
you wanted.

**For numeric output:** `dout r0` (decimal), `hout r0` (hex), `aout r0`
(ASCII char), `nl` (newline — no operand needed; defaults to `r0` but writes
literal `\n`).

---

## P11. Pointer-alias for cross-distance access (when to use: file grew past 512 words)

The SKILL.md pitfall #2 pattern, restated as an idiom:

```
          ; at the top of the file, calling a function far below:
          ld   r0, @big_helperP    ; load *address* of big_helper from a nearby .word
          blr  r0, 0
@big_helperP:
          .word big_helper          ; the alias — within ±256 of the ld above
          ; ... 1000 lines of code ...
big_helper:
          ; ...
          ret
```

**When to reach for this:** the moment a `bl <label>` or `lea r0, <label>`
errors with `pcoffset9 out of range`. Don't try to reorganize the file to
shorten the distance — the pointer-alias pattern is the canonical fix.

---

## See also

- SKILL.md — the four non-negotiable pitfalls inline
- `pitfalls.md` — secondary bugs not covered above
- `isa-quickref.md` — instruction table, field widths
- `calling-convention.md` — register roles, frame layout (this file's P5/P6 in detail)
- `lccjs/textbook_demos/` — the canonical working set
