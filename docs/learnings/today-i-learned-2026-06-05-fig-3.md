# TIL 2026-06-05 — FIG session 3 — workflow doc completeness and LCC+ extension hook

**Context:** Three tickets closed today. #895 fixed a recurring workflow error where agents omit `--as <fruit>` on `npm run claim`. #897 filed the companion error (running `npm run close` before committing). #896 was a SPIKE that produced a working prototype for an LCC+ mnemonic registration hook — letting future play mnemonics land in `src/plus/play.js` without touching the core `AssemblerPlus` or `InterpreterPlus` classes.

---

## 1. The canonical command example is the rule agents actually follow

**What happened:** Agents were repeatedly hitting the `[claim] ✗ no agent identity set` error. The `--as <fruit>` flag was documented in `docs/do-this-not-that.md` under a rule titled "Always pass `--as <fruit>`" — but the primary workflow doc (`docs/claude_workflow.md`) showed the claim command as `npm run claim -- <issue>` in the "If I'm working in a git worktree" section. That's the line agents copy-paste.

**What I learned:** A rule buried in a secondary doc does not propagate. Agents read the first plausible-looking example and use it. The "authoritative" do-this-not-that entry was invisible because agents had already found a working-looking command before they got there. Making the fix meant correcting the canonical example at the source, not strengthening the rule elsewhere.

**The rule:** Every canonical command example in workflow docs must be complete and correct — an incomplete example is a recurring error waiting to happen.

---

## 2. `npm run close` only pushes; it does not commit

**What happened:** The second recurring error — `[close] ✗ working tree is not clean` — comes from agents treating `npm run close` as "finish the work and push." It is actually "push what is already committed." The name implies finality, but the tool has a strict precondition: all changes must be staged and committed first.

**What I learned:** The two-step sequence (1. `git commit -m "... Closes #N"`, 2. `npm run close N`) is not obvious from the tool name. The workflow doc described the sequence, but not as an explicit numbered list with a callout. Agents scanning quickly miss the commit step.

**The rule:** When docs describe a two-step sequence where step 1 is a hard precondition for step 2, write it as a numbered list with a dedicated "step 1 does NOT do X" note — prose buries the dependency.

---

## 3. External LCC+ encoders can't capture `this` at module load time — use a `trapVec` shorthand

**What happened:** The spike (#896) revealed a non-obvious constraint when designing the `play.js` registration hook. Inside `AssemblerPlus` constructor, trap encoders are arrow functions that capture `this` (the assembler instance):
```js
t['clear'] = { encoder: (ops) => this.assembleTrap(ops, TRAP_CLEAR), operandShape: '[sr]' };
```
An external module loaded later can't do this — `this` doesn't exist at module load time. The naive approach of exporting `{ encoder: (ops) => ..., operandShape }` just fails with a reference error.

**What I learned:** The fix is to shift the binding responsibility to `registerExtension()`. The external module exports a plain data descriptor `{ trapVec: 0x00F4, operandShape: '(none)' }` and `registerExtension()` generates the encoder:
```js
this._instructionTable[name] = {
  encoder: (ops) => this.assembleTrap(ops, entry.trapVec),
  operandShape: entry.operandShape,
};
```
Now `this` is the live assembler instance and the external module never needs to know about it. For complex encoders that genuinely need the assembler (like `rand`'s two-register form), a `getMnemonics(assembler)` factory pattern handles the exception.

**The rule:** When designing a plugin/registration API for a class, if internal methods are typically bound via arrow functions in the constructor, external registrants need a data-descriptor shorthand (not a raw function) so the host can do the binding.

---

## 4. Extension dispatch before the switch, not inside it

**What happened:** The interpreter side of the spike required `executeTRAP()` to handle externally-registered trap vectors. The temptation was to add a default case to the switch. Instead, the check goes *before* the switch:
```js
executeTRAP() {
  if (this._extTrapHandlers && this._extTrapHandlers[this.trapvec]) {
    return this._extTrapHandlers[this.trapvec]();
  }
  switch (this.trapvec) { ... }
}
```

**What I learned:** Putting the dispatch before the switch means the extension system is genuinely non-invasive — core never needs to be modified for a new play trap. If the check went in the `default` case instead, core would still own the dispatch logic and any future refactor of the switch would have to account for it. Pre-switch dispatch also avoids unnecessary case comparisons for every external trap invocation.

**The rule:** In a dispatch method you want open to extension, check an extension table before the core switch — not inside it.

---

## What landed

| Artifact | Change |
|---|---|
| `docs/claude_workflow.md` | Pre-claim section expanded to 3-step numbered checklist; canonical claim example now includes `--as <fruit>` (#895) |
| `docs/do-this-not-that.md` | Fixed wrong npm arg ordering in the `--as` example (#895) |
| `src/plus/play.js` | New: spike prototype extension module with `flash` demo mnemonic (#896) |
| `src/plus/assemblerplus.js` | Added `registerExtension(ext)` with `trapVec` shorthand auto-encoder (#896) |
| `src/plus/interpreterplus.js` | Added `registerExtension(ext)` + pre-switch dispatch in `executeTRAP()` (#896) |
| `src/plus/lccplus.js` | Added `--play`/`-p` flag that gates `require('./play')` (#896) |

## Open threads

- #897 filed but not yet resolved: the close-before-commit workflow fix needs the same treatment as #895 (numbered list + callout in `docs/claude_workflow.md`).
- `--module <path>` generalisation of the play hook is a natural follow-on to #896 — the export contract is already generic enough to support it.

## Related artifacts

- Issue #895 — pre-claim checklist fix
- Issue #896 — play.js registration hook spike
- Issue #897 — close-before-commit workflow fix (open)
- [docs/do-this-not-that.md](../do-this-not-that.md) — `--as` rule corrected
- [docs/claude_workflow.md](../claude_workflow.md) — pre-claim checklist expanded
