# Project Gotchas

Non-obvious foot-guns specific to developing in or with the lccjs codebase. For ISA-level assembly surprises (wrong encoding, runtime traps, range limits) see [`docs/pitfalls.md`](./pitfalls.md). For workflow and tooling preferences see [`docs/do-this-not-that.md`](./do-this-not-that.md).

---

## 1. Assembly instructions must be indented — col-0 is a label

Any token at column 0 that does not end in `:` is parsed as a label by the assembler. Instructions, directives (`.word`, `.string`, `.start`), and traps all require at least one leading space or tab.

**Symptom:** an instruction silently becomes a label; the intended mnemonic disappears from the listing and the program misbehaves or fails assembly with a confusing error on the next token.

```
; Wrong — "add" at col 0 becomes a label, not an instruction
add r0, r0, 1

; Right
  add r0, r0, 1
```

This applies to demo files, test fixtures, and any `.a`/`.ap` source written to exercise the toolchain.

---

## 2. Template literal `.templateContent` is raw source, not the evaluated string

When extracting the body of a JavaScript template literal via regex or string slicing, the result contains raw source characters — escape sequences like `\\\\` appear as four backslash characters, not as the runtime string they represent.

**Symptom:** writing `.templateContent` directly to disk produces a file with literal `\\n`, `\\t`, or `\\\\` sequences rather than the intended whitespace or single backslash.

**Fix:** evaluate the content before writing:

```js
const runtime = new Function('return `' + body + '`')();
```

Or use a proper AST tool (e.g. `@babel/parser`) that handles escape resolution.

---

*(More entries to be added as they surface.)*
