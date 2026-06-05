# Research: `ain` after `din` — newline-consumption parity (#852)

**Date:** 2026-06-05  
**Agent:** DRAGONFRUIT  
**Issue:** [#852](https://github.com/avidrucker/lccjs/issues/852)

---

## Summary

OG LCC's `din` trap does **not** consume the trailing `\n` from stdin; lccjs's `din` **does**.
The double-`ain` workaround in `docs/simpleCalc.a` is correct for OG LCC and **broken** for lccjs.
This is a parity deviation classified **LCC.js BUG** — documented in `docs/parity_deviations.md §25`.

---

## Investigation checklist results

### ✅ Run `simpleCalc.a` (double-ain) in OG LCC and lccjs — confirm both produce `Result: 8`

| Tool | Input | Output |
|---|---|---|
| OG LCC | `5\n+\n3\n` | **Result: 8** ✓ |
| lccjs | `5\n+\n3\n` | **Invalid operation.** ✗ |

Result: **NOT identical** — lccjs fails with the double-ain pattern.

### ✅ Create `simpleCalc-single-ain.a` (remove consume-newline `ain`) — run both

Single-ain variant (`docs/simpleCalc-single-ain.a`): line 20 removed from `simpleCalc.a`
(the `ain r1  ; consume the newline char` line).

| Tool | Input | Output |
|---|---|---|
| OG LCC | `5\n+\n3\n` | **Invalid operation.** ✗ |
| lccjs | `5\n+\n3\n` | **Result: 8** ✓ |

Result: Exactly reversed — single-ain works in lccjs but not in OG LCC.

### ✅ Check lccjs `interpreter.js` `din` / `readLineFromStdin` for newline-stripping

`readLineFromStdin()` in `src/core/interpreter.js:1355`:

**Simulated-input path (inputBuffer):**
```javascript
const newlineIndex = this.inputBuffer.indexOf('\n');
if (newlineIndex !== -1) {
  inputLine = this.inputBuffer.slice(0, newlineIndex);
  this.inputBuffer = this.inputBuffer.slice(newlineIndex + 1); // ← consumes the \n
}
```
The `newlineIndex + 1` slice advances past the `\n`, removing it from the buffer.
After `din` reads `"5"` from `"5\n+\n3\n"`, the buffer becomes `"+\n3\n"` — the `\n` is gone.

**Real TTY path:**
```javascript
while (true) {
  let char = buffer.toString('utf8');
  if (char === '\n') {
    break;  // ← reads the \n from fd, then discards it
  }
  input += char;
}
```
The `\n` is read from the file descriptor and consumed (the break does not put it back).

Both paths consume the `\n`; after `din`, stdin/buffer starts with the NEXT character.

### ✅ Check if OG LCC's `din` trap internally consumes the newline

No C source for the `lcc` binary is available in `cuh63/`. The `lcc.txt` documentation
does not describe `din`'s newline handling. Behavioral conclusion is inferred from the
empirical test results above:

- Double-ain works with OG LCC → OG LCC's `din` leaves `\n` in stdin
- Single-ain works with lccjs → lccjs's `din` consumes the `\n`

---

## Execution trace

With simulated input `5\n+\n3\n` and the **double-ain** program:

**OG LCC behavior** (din leaves `\n` in buffer):
```
stdin:  5 \n + \n 3 \n
din r0: reads "5", \n remains → buffer: \n + \n 3 \n  →  r0 = 5
ain r1: reads \n            → buffer: + \n 3 \n      →  r1 = 10 (\n)
ain r1: reads +             → buffer: \n 3 \n         →  r1 = 43 (+) ✓
din r2: reads "3", \n→empty skipped → r2 = 3
Result: 8 ✓
```

**lccjs behavior** (din consumes `\n`):
```
stdin:  5 \n + \n 3 \n
din r0: reads "5", \n consumed → buffer: + \n 3 \n   →  r0 = 5
ain r1: reads +               → buffer: \n 3 \n       →  r1 = 43 (+)
ain r1: reads \n              → buffer: 3 \n           →  r1 = 10 (\n) ✗
din r2: reads "3"             → r2 = 3
→ r1 = 10 matches no branch → Invalid operation ✗
```

---

## Root cause

lccjs `readLineFromStdin()` slices past the `\n` boundary (`newlineIndex + 1`).
OG LCC reads until it has an integer, leaving the `\n` separator still available to the
next trap instruction. The POSIX `read(2)` model for character I/O does not automatically
consume the newline — OG LCC makes one `read` call per character and stops before reading
the `\n`.

---

## Outcome classification

**LCC.js BUG** — lccjs should match OG LCC: `din` (and `hin`) should leave the trailing
`\n` in the buffer/stdin so that a subsequent `ain` reads it before the next typed character.

The `simpleCalc.a` double-ain workaround is the canonical intended pattern (validated
against OG LCC). lccjs breaks that pattern.

---

## Follow-on

- **Parity deviation §25** added to `docs/parity_deviations.md`.
- **Pitfall §3.4** added to `docs/pitfalls.md` (runtime pitfall for `ain` after `din`).
- **DEV fix ticket** filed as a follow-on to this research (see issue comment on #852).

The fix: in `readLineFromStdin()`, change the simulated-input slice from  
`this.inputBuffer.slice(newlineIndex + 1)` → `this.inputBuffer.slice(newlineIndex)`  
so the `\n` remains in the buffer. The real TTY path requires not reading (or pushing back)
the `\n` from the fd — the current `break` consumes it; it should instead stop one read earlier.
The `din` retry loop (`if (dinInput.trim() === '') { continue; }`) naturally handles the
resulting empty-line reads that follow, so no secondary changes are needed in the DIN trap handler.
