# Research: What generates .bst/.lst — assembler, interpreter, or both?

**Issue:** #598  
**Unblocks:** #599 (glossary correction)  
**Evidence base:** `src/core/assembler.js`, `src/core/interpreter.js`, `src/cli/lcc.js`, `src/utils/reportArtifacts.js`, `src/utils/genStats.js`

---

## Short answer

Both the assembler and the interpreter can produce `.lst` / `.bst` files, but through **three distinct code paths** that all funnel into a single shared generator (`generateBSTLSTContent` in `genStats.js`). The path taken determines what sections appear in the report. The only difference between `.lst` and `.bst` is machine-code column encoding — this is confirmed.

---

## The shared generator

`src/utils/genStats.js` exports one function:

```js
generateBSTLSTContent({ isBST, assembler, interpreter, userName, inputFileName, ... })
```

Both files are produced by calling it twice with identical arguments except `isBST`:
- `isBST = false` → `.lst` (4 hex digits per word, e.g. `1f01`)
- `isBST = true`  → `.bst` (16 binary digits in 4-bit groups, e.g. `0001 1111 0000 0001`)

That toggle is the **only structural difference** between the two files. All other content is identical.

---

## Three code paths

### Path 1 — Assembler standalone CLI (`assembler.js main()`)

**When triggered:** only when `isObjectModule = true` — i.e., the source uses `.global` / `.extern` and produces a `.o` file. Regular `.a` → `.e` assembly does **not** generate reports here; that is left to the interpreter or lcc.js.

**Call site** (`assembler.js` ~line 654):
```js
if (this.isObjectModule) {
  const { lstContent, bstContent } = this.buildReportArtifacts(this.userName);
  writeReportFiles(this.inputFileName, lstContent, bstContent);
}
```

**Data passed to generator:**
```js
buildReportArtifacts({ assembler: this, interpreter: null, ... })
```

**Sections produced:**

| Section | Present? | Source |
|---------|----------|--------|
| Version/timestamp header | yes | fixed string |
| User name | yes | `name.nnn` |
| Object-module header lines | yes (if any) | `assembler.headerLines` |
| Code listing (with source column) | yes | `assembler.listing` |
| Output section | **no** | — |
| Program statistics | **no** | — |

The column header is `Loc   Code           Source Code` — source text is included per-line.

---

### Path 2 — Interpreter standalone CLI (`interpreter.js main()`)

**When triggered:** whenever `generateStats = true` (the default when run directly; suppressed by `-nostats`).

**Call site** (`interpreter.js` ~line 455):
```js
if (this.generateStats) {
  const { lstContent, bstContent } = this.buildReportArtifacts(userName, this.inputFileName);
  writeReportFiles(this.inputFileName, lstContent, bstContent);
}
```

**Data passed to generator:**
```js
buildReportArtifacts({ assembler: null, interpreter: this, ... })
```

**Sections produced:**

| Section | Present? | Source |
|---------|----------|--------|
| Version/timestamp header | yes | fixed string |
| User name | yes | `name.nnn` |
| Executable header lines | yes (if any) | `interpreter.headerLines` |
| Code listing (**no** source column) | yes | `interpreter.initialMem` dump |
| Output section | yes | `interpreter.output` |
| Program statistics | yes | `interpreter.*` fields |

The column header is `Loc   Code` — no source text, because the interpreter has no access to the original assembly source. The code section is a memory dump of `initialMem` (the snapshot taken after loading, before execution).

**Program statistics included:**
- Instructions executed (hex + dec)
- Program size (hex + dec)
- Max stack size (hex + dec)
- Load point (hex + dec)

---

### Path 3 — Combined lcc.js CLI (`lcc.js executeFile()`)

**When triggered:** `generateStats = true` after assemble-then-run. This is the most common production path for `.a` source files.

**Call site** (`lcc.js` ~line 384):
```js
if (this.generateStats) {
  const { lstContent, bstContent } = this.buildReportArtifacts(includeSourceCode, includeComments);
  writeReportFiles(this.outputFileName, lstContent, bstContent);
}
```

**Data passed to generator:**
```js
buildReportArtifacts({
  assembler: includeSourceCode ? this.assembler : null,  // non-null for .a source
  interpreter: this.interpreter,
  ...
})
```

**Sections produced (for `.a` source, `includeSourceCode = true`):**

| Section | Present? | Source |
|---------|----------|--------|
| Version/timestamp header | yes | fixed string |
| User name | yes | `name.nnn` |
| Header lines | yes (if any) | assembler (preferred over interpreter) |
| Code listing **with** source column | yes | `assembler.listing` |
| Output section | yes | `interpreter.output` |
| Program statistics | yes | `interpreter.*` fields |

**For `.e` / `.hex` / `.bin` direct execution** (`includeSourceCode = false`), the assembler is passed as `null`, so the code section falls back to the interpreter's memory dump (same as Path 2) — but the output and statistics sections are still present.

---

## Content differences between the three paths

| Report section | Assembler path (`.o`) | Interpreter path (`.e`) | lcc.js combined (`.a`) |
|---|---|---|---|
| Header lines | from assembler | from interpreter | from assembler |
| Code listing column header | `Loc   Code   Source Code` | `Loc   Code` | `Loc   Code   Source Code` |
| Source text per line | yes | **no** | yes |
| Output section | **no** | yes | yes |
| Program statistics | **no** | yes | yes |

---

## Implications for the glossary

The current `assembler.md` entry for `.bst / .lst report` says:

> "Sibling report files generated for object-module assembly. Both contain the same header + source-code column + program statistics…"

This is inaccurate in two ways:

1. **"Generated for object-module assembly"** — this describes only Path 1. The most common reports come from Path 3 (lcc.js combined). Interpreter Path 2 also produces them independently.

2. **"program statistics"** — assembler-only reports (Path 1) contain **no** program statistics. Statistics only appear when an interpreter instance is provided (Paths 2 and 3).

The **See also** link to `interpreter buildReportArtifacts` is not wrong — there is a real interpreter path — but it suggests two parallel producers rather than one shared generator with different data inputs.

The `interpreter.md main()` entry is accurate for Path 2.

---

## Answers to the open questions in #598

**Q1: Which tool produces `.bst` / `.lst`?**  
All three: assembler standalone (object modules only), interpreter standalone, and lcc.js (combined). In practice, the lcc.js combined path is the primary one for normal `.a` → `.e` → run workflows.

**Q2: Do assembler-generated and interpreter-generated versions have different content?**  
Yes — significantly. The assembler path includes source code per line but no output/stats. The interpreter path includes a memory dump without source text, plus output and stats. Only the lcc.js combined path has both source text and runtime output/stats in the same report.

**Q3: Is the only difference between `.bst` and `.lst` the machine-code column encoding?**  
Yes, confirmed. `generateBSTLSTContent` is called twice with identical inputs; `isBST` is the sole toggle. `.lst` uses 4 hex digits; `.bst` uses 16 binary digits in 4-bit groups.
