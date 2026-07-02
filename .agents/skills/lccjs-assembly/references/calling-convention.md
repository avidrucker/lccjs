# LCC Calling Convention

The contract every function must follow so calls nest correctly. Canonical
working examples: `lccjs/textbook_demos/ch04-functions-and-call-stack/demo-010`
(args), `demo-011` (return value), and `ch05/demo-013` (locals). Point to those
rather than copying.

## Register roles

| Reg | Role | Survives a call? |
|---|---|---|
| `r0` | scratch **+ return value** | no (caller-saved) |
| `r1`–`r4` | scratch | no (caller-saved) |
| `r5` = `fp` | frame pointer | yes — saved/restored by callee |
| `r6` = `sp` | stack pointer | yes — restored by epilogue |
| `r7` = `lr` | link register (return address) | yes — saved/restored by callee |

Scratch is `r0`–`r4`, period. Touching `r5`/`r6`/`r7` outside their role corrupts
every frame in the call chain (SKILL.md pitfall 1).

## The frame (stack grows downward)

After a callee's prologue, relative to `fp`:

```
   higher addresses
   fp+3   arg2          (caller pushed args right-to-left, so 1st arg is nearest fp)
   fp+2   arg1
   fp+1   saved fp      (caller's frame pointer)
   fp+0   saved lr      (return address)
   fp-1   local 1       (first local allocated)
   fp-2   local 2
   ...
   lower addresses  ← sp
```

Args read at `fp+2`, `fp+3`, … (first arg always `fp+2`). Locals read/written at
`fp-1`, `fp-2`, … via `ldr`/`str` with a **negative** `offset6` (−32…31 range).

## Prologue / epilogue (memorize this skeleton)

```asm
f:    push lr           ; save return address  (fp+0)
      push fp           ; save caller's frame  (fp+1)
      mov  fp, sp       ; establish this frame's base

      ; ── body ──

      mov  sp, fp       ; discard any locals
      pop  fp           ; restore caller's frame
      pop  lr           ; restore return address
      ret               ; pc = lr
```

## Caller side

```asm
      mov  r0, 2        ; push args RIGHT-TO-LEFT (last arg first)
      push r0
      mov  r0, 1        ; ...first arg pushed last → lands at fp+2 in callee
      push r0
      bl   f            ; lr = return address, jump to f
      add  sp, sp, 2    ; caller cleans up: pop the N pushed args
      ; return value is now in r0
```

The caller owns argument cleanup (`add sp, sp, <#args>` after `bl`). The callee
never pops the caller's args.

## Locals

Allocate by moving `sp` down after the prologue; the epilogue's `mov sp, fp`
reclaims them in one step.

```asm
      mov  r0, 1
      push r0           ; fp-1 = initialized local (x = 1)
      sub  sp, sp, 1    ; fp-2 = uninitialized local (y)
      ...
      ldr  r0, fp, -1   ; read x
      str  r0, fp, -2   ; write y
```

## Return value

By convention the return value travels out in `r0`; the caller reads it
immediately after `bl`. `r0` is **not** saved/restored across the epilogue —
that is what lets it carry the value out. No dedicated return instruction beyond
`ret` is involved.
