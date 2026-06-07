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

## 3. Write-path bugs need a read-back regression test through the real write surface

When fixing or reviewing a write-path bug in a test harness, add a regression test that
**reads back what was written through the actual write surface** (e.g. `virtualFs`) and
asserts the bytes are intact.

**Why:** a test that only checks the producer's in-memory state leaves the write path
dark — serialization/encoding bugs slip straight through. Read-back through the real
surface is the only thing that catches them.

*(Was `RULES.md` Rule 11 — relocated #1059, origin #548.)*

---

## 4. Cross-runtime stdout tests: drive lccjs via `spawnSync({input})`, not `inputBuffer`

For tests that compare lccjs stdout against another runtime (C, oracle, etc.), drive
lccjs via `spawnSync` with `{ input: stdinString }` — **not** via `lcc.inputBuffer`.

**Why:** `inputBuffer` triggers "simulated" mode in `readLineFromStdin()`, which echoes
each input line back through `writeOutput`, producing extra output that C programs never
emit — causing false parity failures on any demo that reads stdin. Piped stdin takes the
non-simulated path and both sides behave identically.

*(Was `RULES.md` Rule 19 — relocated #1059, origin #760.)*

---

## 5. Jest: `test.failing` for fixable bugs, `test.skip` only for by-design incompatibility

Use `test.failing` for tests covering **confirmed bugs with open fix tickets** — the test
runs, documents the broken behavior, and alerts when the fix lands (it flips to a test
failure, signalling the annotation can be removed). Use `test.skip` only for tests that
are fundamentally incompatible by design (e.g. platform-specific behavior that can never
match). **Never** use `test.skip` to silence a test for a fixable bug.

*(Was `RULES.md` Rule 20 — relocated #1059, origin #761.)*

---

## 6. Cross-module validation parity — test every copy together

Any input-validation pattern (character class, regex, or predicate) that appears in more
than one module — assembler, formatter, tmLanguage grammar, or elsewhere — must be
covered by a test that runs the same edge-case inputs against **every** copy. Divergence
is only detectable when all copies are exercised together.

See `tests/new/grammar.unit.spec.js` (label edge-case tests from #850 are the concrete
example). **Known gap:** the formatter's label regex (`/^([A-Za-z_]\w*)\s*:(.*)/s` in
`src/utils/formatter.js`) does not cover `@`- or `$`-prefixed labels — tracked in #798.

*(Was `RULES.md` Rule 21 — relocated #1059, origin #850/#870.)*

---

*(More entries to be added as they surface.)*
