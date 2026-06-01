# Research: .hex / .bin execution feedback UX (#368)

**Conclusion: replace the misleading "Assembling" message with two
targeted lines — format tag + word count. File one small DEV ticket.**

---

## 1. Current observed behavior (empirical)

Four input types, four patterns. Captured live from the current `main` branch:

### `.hex` or `.bin`
```
Assembling halt.hex             ← fires from assembler.js:324 (custom LCC.js; OG LCC prints nothing)
Starting interpretation of halt.e
lst file = halt.lst
bst file = halt.bst
====================================================== Output
<program output>
```

### `.a` (two-pass assembly)
```
Starting assembly pass 1
Starting assembly pass 2
Starting interpretation of halt.e
lst file = halt.lst
bst file = halt.bst
====================================================== Output
<program output>
```

### `.e` (direct execution, no assembly)
```
Starting interpretation of halt.e
lst file = halt.lst
bst file = halt.bst
====================================================== Output
<program output>
```

---

## 2. The three UX problems

### Problem A — wrong verb signals wrong mental model

`"Assembling halt.hex"` uses the same verb as a `.a` compilation run.
A student reading this output has no way to know that no pass 1 / pass 2
ran. The *only* distinguishing signal is the *absence* of "Starting
assembly pass 1/2" — negative evidence, invisible unless you already know
what to look for.

### Problem B — no parse-success confirmation

`parseHexFile()` either aborts (malformed line → typed error) or silently
succeeds. A run with 1 word looks identical in output to a run with 100
words. There is no line that says "the parse completed and N words were
loaded." `this.locCtr` after `parseHexFile()` is exactly the word count
(set at `assembler.js:815`) — the data exists; it is just not surfaced.

### Problem C — architecture boundary violation (secondary)

The `console.log` at `assembler.js:324` fires inside the pure assembler
seam, which the project's architecture principles (`CLAUDE.md`) reserve
for typed-error throws and return values only. CLI output belongs in
`lcc.js`. This is a pre-existing violation (same line was intentionally
added as custom LCC.js behavior, per the comment at :321–323); fixing
the message text is independent of fixing the boundary.

---

## 3. Options assessed

### Option X — silence (match OG LCC exactly)

Remove the `"Assembling"` line entirely.

**Rejected.** The line was deliberately added as a LCC.js improvement
over OG LCC's silence (comment at `assembler.js:321`). Reverting to
silence removes the only parse-feedback signal and makes the problem
worse, not better.

### Option Y — warn-and-continue (status quo + no change)

Keep `"Assembling halt.hex"` as-is.

**Rejected.** Answers neither of Avi's questions: the verb misleads on
the pipeline stage, and there is still no parse-success confirmation.

### Option Z — replace with two targeted lines (recommended)

Change the single `"Assembling ..."` line to two lines:

```
Loading halt.hex (raw hex — no assembly pass)
Loaded 1 word → halt.e
```

Line 1 fires before `parseHexFile()`. Line 2 fires after, using
`this.locCtr` (word count) and `this.outputFileName` (already constructed
by `assembler.js:326`).

Apply the same treatment to `.bin`:

```
Loading halt.bin (raw binary — no assembly pass)
Loaded 1 word → halt.e
```

---

## 4. Recommended change — exact spec for DEV ticket

### What to change

**File:** `src/core/assembler.js`

**`.hex` block (lines 319–328 today):**

```js
// BEFORE
console.log(`Assembling ${this.inputFileName}`);
this.parseHexFile();
this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');
return;

// AFTER
console.log(`Loading ${path.basename(this.inputFileName)} (raw hex — no assembly pass)`);
this.parseHexFile();
this.outputFileName = this.constructOutputFileName(this.inputFileName, '.e');
console.log(`Loaded ${this.locCtr} word${this.locCtr !== 1 ? 's' : ''} → ${path.basename(this.outputFileName)}`);
return;
```

**`.bin` block (lines 307–317 today), same treatment:**

```js
// BEFORE
console.log(`Assembling ${this.inputFileName}`);
this.parseBinFile();
this.outputFileName = ...

// AFTER
console.log(`Loading ${path.basename(this.inputFileName)} (raw binary — no assembly pass)`);
this.parseBinFile();
this.outputFileName = ...
console.log(`Loaded ${this.locCtr} word${this.locCtr !== 1 ? 's' : ''} → ${path.basename(this.outputFileName)}`);
```

### Resulting full console output for `lcc.js foo.hex`

```
Loading foo.hex (raw hex — no assembly pass)
Loaded 3 words → foo.e
Starting interpretation of foo.e
lst file = foo.lst
bst file = foo.bst
====================================================== Output
<program output>
```

This answers both of Avi's questions directly:
- *"How do I know it doesn't go through an assembly pass?"*  
  → `"(raw hex — no assembly pass)"` is stated explicitly.
- *"How do I know the parse succeeded?"*  
  → `"Loaded N words → foo.e"` confirms the count and the output file.

### What NOT to change in this ticket

- The `.a` two-pass output (`"Starting assembly pass 1/2"`) — correct as-is.
- The `.e` direct-execution output (no assembly line at all) — correct as-is.
- The architecture boundary (moving `console.log` out of `assembler.js` into
  `lcc.js`) — valid long-term goal, but a separate refactor. Mixing it into
  this change widens scope without user-visible benefit.

---

## 5. Tests to add / update

The `assembler.formats.integration.spec.js` suite mocks `console.log` via
`jest.spyOn`. The `.hex` / `.bin` test cases (6a–6f) should assert that:
- The new first line includes `"Loading"` and `"raw hex"` / `"raw binary"`.
- The new second line includes `"Loaded"`, the word count, and `"→"`.
- `"Assembling"` is **not** emitted for these extensions.

Any e2e test that does a snapshot match on full console output for a
`.hex` or `.bin` run will need its golden updated.

---

## 6. Architecture note (separate ticket)

The `console.log` calls in `assembler.js:312, 324` are an existing
architecture boundary violation (pure seam emitting CLI output). The
correct long-term home for all CLI feedback is `lcc.js:handleSingleFile()`,
which already knows the extension and can access `this.assembler.locCtr`
after `this.assembleFile()` returns. That refactor should be a
standalone ticket: move console output from assembler seam to CLI layer,
update tests accordingly.
