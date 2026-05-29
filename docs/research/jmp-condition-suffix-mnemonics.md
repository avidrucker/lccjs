# Do `jmp` condition-suffix mnemonics work?

Tracker: [#151](https://github.com/avidrucker/lccjs/issues/151) (split from #144) ·
Marker site: `demos/happy-path.a`

## Question

Appendix B (p.276) of the LCC reference states that `jmp` uses the **same
mnemonic suffixes** as the branch instructions — implying `jmpz`, `jmpnz`,
`jmpn`, `jmpp`, `jmplt`, `jmpgt`, `jmpc`, `jmpb`, `jmpal`, etc. all exist. But the
suffixed `jmp` forms **error on assembly** in lccjs with `Invalid operation`. Is
that a documentation error, an lccjs gap, or an oracle gap?

## Method

Assembled minimal programs using suffixed `jmp` forms with **both** lccjs and the
reference oracle (`cuh63 6.3 lcc`, via `LCC_ORACLE`), e.g.:

```asm
        .start main
main:   mvi r0, 5
        jmpz r0
        halt
```

## Result

| form | lccjs | oracle (cuh63 6.3) |
|---|---|---|
| `jmp r0` (plain) | ✅ assembles | ✅ assembles |
| `jmpz r0` | ❌ `Invalid operation` (line 3) | ❌ `Invalid operation` (line 3) |
| `jmpn r0`, `jmpe r0`, … | ❌ `Invalid operation` | ❌ `Invalid operation` |

- **Identical behaviour:** both tools reject every suffixed `jmp` with the same
  `Invalid operation` diagnostic.
- The oracle leaves a **7-byte `.e`** after the errored assembly — that is the
  documented [deviation 10](../parity_deviations.md) blank/header-only artifact
  (OG LCC writes a runnable-looking blank `.e` even on failed assembly), **not** a
  successful assembly of `jmpz`.
- **Static confirmation:** `src/core/assembler.js` recognises `jmp` (and `ret`)
  but has **no `jmpXX` cases** — the condition suffixes (`z/nz/n/p/lt/gt/c/b/al`)
  belong only to the `br` family. Any `jmpXX` token falls through to
  `Invalid operation`. Consistent with the ISA: `jmp` is encoded `1100 000 baser
  offset6` with no condition-code field (see [docs/lcc-isa.md](../lcc-isa.md)).

## Conclusion

**Documentation error in Appendix B p.276** — condition-suffixed `jmp` is **not**
implemented by the LCC architecture as realised in either lccjs or the reference
oracle. The conditional-control-flow instruction is `br<cc>`; `jmp` is the
unconditional register-relative jump.

- **Not an lccjs gap:** lccjs matches the oracle exactly (both reject identically).
- **No assembler change:** rejecting `jmpXX` is correct, parity-preserving behaviour.
- **Upstream:** worth flagging to the textbook author as a doc erratum, but it does
  not gate any lccjs work.
