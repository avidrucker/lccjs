# TIL 2026-06-03 — DRAGONFRUIT s3

## Three learnings: `resetState()` config trap · Shiki lang key · `.bst/.lst` generation paths

**Discovered during:** #580, #604, #598

---

## 1. `resetState()` must not own configuration properties

**Ticket:** #580

### What happened

`Linker.link()` calls `this.resetState()` at the very start. `resetState()` had
`this.verboseModeOn = false` in its body. `lcc.js` sets
`linker.verboseModeOn = !!this.options.verbose` **before** calling `linker.link()` —
so the assignment was silently overwritten on every call, and `--verbose` never
reached the linker.

```js
// lcc.js
const linker = new Linker();
linker.verboseModeOn = true;      // set by caller
linker.link(files, 'out.e');      // link() calls resetState() → verboseModeOn = false ← bug
```

The bug was invisible in unit tests that called `adjustExternalReferences()` directly
(skipping `link()`), and invisible in integration tests that drove the Linker through
a mock — only the end-to-end `lcc.js --verbose` path exposed it.

### Fix

Move configuration properties out of `resetState()` — initialize them in the
constructor after `resetState()` returns. `resetState()` owns **per-call transient
state** (machine code buffer, symbol tables, module list); callers own **session
configuration** (`verboseModeOn`, load point, output file name when set before
`link()`).

```js
constructor() {
  this.resetState();
  this.verboseModeOn = false;   // config: survives resetState() calls
}

resetState() {
  this.machineCode = [];        // per-link state only
  this.globalSymbols = {};
  // ... no verboseModeOn here
}
```

### Pattern to watch for

Any class that has both a `reset()` / `resetState()` method and properties set by
callers before calling a long-running method: audit which properties are
**session configuration** vs **per-run state**. The former must live outside `reset()`.

---

## 2. Shiki v1 uses `grammar.name`, not `grammar.scopeName`, as the `lang:` key

**Ticket:** #604

### What happened

`docs/showcase/index.html` called:

```js
hl.codeToHtml(code, { lang: 'source.lcc', theme: 'github-dark' })
```

The custom grammar (`docs/lcc.tmLanguage.json`) has:

```json
{ "name": "lcc", "scopeName": "source.lcc", ... }
```

Shiki v1 registers languages under `name` (`"lcc"`), not under `scopeName`
(`"source.lcc"`). The page appeared to work on cached GitHub Pages sessions because
a prior load had registered the grammar under both keys (browser module cache). A
cold headless load (no cache, fresh profile) failed:

```
Language `source.lcc` not found, you may need to load it first
```

### Fix

Change every `lang: 'source.lcc'` to `lang: 'lcc'` in the HTML — match what Shiki
actually uses as the lookup key. Changing `grammar.name` to `"source.lcc"` is the
other option but risks breaking tooling (e.g., VS Code extensions) that expects
`name: "lcc"`.

### Rule of thumb

When integrating a TextMate grammar with Shiki v1, the `lang:` value in
`codeToHtml()` must match `grammar.name`, not `grammar.scopeName`. `scopeName` is a
CSS class / TextMate internal; Shiki uses `name` for its language registry key.

---

## 3. `.bst` / `.lst` have three callers, not one

**Ticket:** #598

### What happened

The glossary implied `.bst` / `.lst` files come from a single process. Code
inspection (`src/utils/genStats.js`, `src/utils/reportArtifacts.js`) revealed three
distinct callers of the same `generateBSTLSTContent` generator:

| Caller | When | Has source column | Has output + stats |
|---|---|---|---|
| `assembler.js main()` | `isObjectModule = true` (`.o` output) | yes | **no** |
| `interpreter.js main()` | `generateStats = true` | **no** | yes |
| `lcc.js executeFile()` | after assemble + run (common case) | yes | yes |

The glossary entry for `assembler.md` incorrectly stated that assembler-only reports
contain "program statistics" — they don't. Statistics (instructions executed, program
size, max stack size, load point) only appear when an interpreter instance is provided.

### The only real difference between `.bst` and `.lst`

`generateBSTLSTContent` is called twice with identical inputs; `isBST` is the sole
toggle:
- `.lst` → 4 hex digits per word (e.g., `1f01`)
- `.bst` → 16 binary digits in 4-bit groups (e.g., `0001 1111 0000 0001`)

### Follow-on

- #608 — decision: which path to treat as canonical in docs
- #609 — WRITER task to correct `assembler.md` + `interpreter.md`

---

## Related

- #580 — linker `verboseModeOn` fix
- #604 — Shiki lang key fix
- #598 — `.bst`/`.lst` generation research
- #612 — this TIL
