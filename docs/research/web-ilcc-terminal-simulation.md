# Research: web_ilcc terminal simulation — stdin/stdout for runnable LCC code blocks

**Issue:** #693 · **Date:** 2026-06-04 · **Agent:** APPLE

---

## 1. Reference project overview

[web_ilcc](https://github.com/aidanod3/web_ilcc) is a full-stack browser IDE for LCC assembly. It ships its own fork of the LCC interpreter as a backend Node.js service and provides a React frontend with a CodeMirror editor, CPU/register/memory debugger, and a terminal output panel. The autograder (FastAPI/Python) runs the same emulator core in a subprocess.

Architecture:
```
React frontend (Vite)  ←→  Express backend (port 3002)  ←→  lcc.js emulator (fork)
                                                          ←→  FastAPI autograder (port 8000, Python)
```

The emulator is a **Node.js server-side fork** of the LCC interpreter, not a browser bundle. All code execution happens on the backend; the frontend only sends source and receives output + state snapshots.

---

## 2. Stdout simulation

### web_ilcc approach

web_ilcc accumulates output server-side in `interpreter.output` and returns it to the frontend after each step or at completion. The frontend renders it in a `<pre>` element:

```jsx
<pre className={styles.output}>{output || 'No output yet...'}</pre>
```

Styling: JetBrains Mono, dark background (`#18181b`), gold accent (`#f7a800`), green for changed state.

The trap handlers (`DOUT`/`UDOUT`/`HOUT`/`AOUT`/`SOUT`/`NL`) all route through an internal `writeOutput(message)` method that appends to `this.output`.

### LCC.js current seam

LCC.js already has the right hook. The `Interpreter` constructor accepts a `write` callback option:

```javascript
// interpreter.js:104
this._write = options.write ?? (m => process.stdout.write(m));
```

All output trap handlers call `this.writeOutput(message)`, which delegates to `this._write`. Browser consumers just pass:

```javascript
const interp = new Interpreter({ write: m => (domElement.textContent += m) });
```

**No changes needed to the interpreter for output capture.** The `lcc-injector.js` already uses this seam.

---

## 3. Stdin simulation

### web_ilcc approach — two modes

**Batch / pre-supplied input:** The backend accepts an `input` field on session creation and step requests. This is appended to `interpreter.inputBuffer`. When `readLineFromStdin()` is called by `DIN`/`SIN`/`HIN`/`AIN`, it drains the buffer first before falling through to real stdin.

**Interactive input (pause-on-input):** The trace session is created with `pauseOnInput: true`. When the interpreter hits a read trap and the buffer is empty, it sets `pauseReason = 'input'` and suspends. The frontend detects `waitingForInput: true` in the response, shows an input widget, and POSTs the user's input back to the session. Execution resumes with the new input appended to `inputBuffer`.

The pause state machine:
```
running                  → step() → hit input trap → buffer empty
                                                    → pauseReason = 'input'
frontend sees waitingForInput: true
user enters text
POST /step { input: "42\n" } → inputBuffer += input
                             → execution resumes
```

### LCC.js current seam

LCC.js has `inputBuffer` on the interpreter, used identically for batch pre-supply:

```javascript
// interpreter.js:1301-1311
readLineFromStdin() {
  if (this.inputBuffer && this.inputBuffer.length > 0) {
    // drain buffer first
    const newlineIndex = this.inputBuffer.indexOf('\n');
    inputLine = this.inputBuffer.slice(0, newlineIndex);
    this.inputBuffer = this.inputBuffer.slice(newlineIndex + 1);
    ...
  } else {
    // falls through to process.stdin.fd — HANGS in browser
  }
}
```

**Gap:** When `inputBuffer` is exhausted, `readLineFromStdin()` and `readCharFromStdin()` fall through to `process.stdin.fd` — a synchronous blocking read that **hangs** in a browser JS environment (no process stdin available).

The current injector (`lcc-injector.js`) sidesteps this via `data-stdin`: programs that need input must have their full input pre-supplied via the attribute. Programs that exhaust `data-stdin` stall silently.

**For interactive input** the interpreter needs a `pauseOnInput` mechanism analogous to what web_ilcc implements — suspend execution (return a "needs input" sentinel), expose a resume path, and append new input to the buffer before resuming.

---

## 4. Input trap inventory

| Trap | Mnemonic | Reads | LCC.js method |
|------|----------|-------|---------------|
| 7 | `DIN` | Decimal integer, one line | `readLineFromStdin()` |
| 8 | `HIN` | Hex integer, one line | `readLineFromStdin()` |
| 9 | `AIN` | Single ASCII char | `readCharFromStdin()` |
| 10 | `SIN` | Null-terminated string to memory | `readLineFromStdin()` |

All four ultimately call one of two methods. A `pauseOnInput` hook on either is sufficient to cover the entire input surface.

---

## 5. Output trap inventory

| Trap | Mnemonic | Produces |
|------|----------|----------|
| 2 | `DOUT` | Signed decimal integer |
| 3 | `UDOUT` | Unsigned decimal integer |
| 4 | `HOUT` | Hex integer |
| 5 | `AOUT` | Single ASCII character |
| 6 | `SOUT` | Null-terminated string from memory address |
| 1 | `NL` | Newline |

All route through `writeOutput()` → `this._write`. The `write` option in the constructor captures all of these with no further changes.

---

## 6. Edge cases and infinite loops

### web_ilcc approach

- **Infinite loops:** capped at `maxSteps` per request (max 20,000), returns `maxStepsReached: true` flag; frontend can warn the user and offer to stop.
- **EOF on empty buffer:** `SIN`/`DIN` raise a `RuntimeError('sin: unexpected EOF on stdin')` which propagates as an error response.
- **Assembly errors:** caught by the assembler before execution, returned as `{ error: msg }`.
- **Session TTL:** 30-minute cleanup; prevents orphaned sessions.
- **Autograder timeout:** 5 seconds via `subprocess.run(..., timeout=5)`.

### LCC.js current handling

- Assembly errors: thrown via typed errors, caught by `lcc-injector.js` and shown in an `.lcc-error` styled box.
- Runtime errors: `InterpreterRuntimeError`, currently propagates to the caller — injector should catch and display.
- No step cap for one-shot execution — a tight infinite loop will hang the browser tab.

**Gap for browser:** Need a step cap or a yield mechanism (e.g. run in a Web Worker, or chunk execution with `setTimeout`) to prevent tab freeze on `while(1)` programs.

---

## 7. Recommendations for LCC.js browser playground

### 7a. Stdout — already solved

The `write` option in the `Interpreter` constructor is sufficient. Wire it to the output DOM element:

```javascript
const domBuffer = [];
const interp = new Interpreter({ write: m => domBuffer.push(m) });
// after executeBuffer(): outputEl.textContent = domBuffer.join('');
```

No interpreter changes needed.

### 7b. Stdin — two tiers

**Tier 1 (batch — already shipped):** `data-stdin` → `interpreter.inputBuffer`. Works for slide demos and programs where all input is known upfront. Use this for the injector/reveal-md use case.

**Tier 2 (interactive — new work):** Requires a `pauseOnInput` option on `executeBuffer` / the interpreter. When the buffer is empty and `pauseOnInput: true`, execution suspends and returns a `{ status: 'waiting-for-input', trapType: 'din'|'sin'|'ain'|'hin' }` result. The caller shows an input widget, user types, and calls `interpreter.resume(input)` (or `executeBuffer` again with the new `inputBuffer`). This is the same model web_ilcc uses server-side; implementing it client-side in LCC.js's interpreter pure-JS API would make it work without a backend.

### 7c. Infinite loop protection — new work

Run `executeBuffer` in a Web Worker and enforce a step cap (e.g. 50,000 instructions). On timeout or cap, terminate the worker and show a "Program did not halt" error.

### 7d. Minimum viable playground (incremental path)

| Phase | Feature | Effort | Status |
|-------|---------|--------|--------|
| P0 | Display-only (no exec) | zero | done |
| P1 | Run + output only (no input traps) | trivial | `_write` hook exists |
| P2 | Run + pre-supplied stdin (`data-stdin`) | small | injector ships it |
| P3 | Run + interactive stdin prompt | medium | needs `pauseOnInput` in interpreter |
| P4 | Infinite-loop protection (Web Worker + step cap) | medium | new work |
| P5 | Step-by-step debugger (CPU/memory panel) | large | web_ilcc reference |

---

## 8. Conclusion

web_ilcc solves the terminal simulation problem by running the interpreter server-side and using a pause-on-input protocol over HTTP. For LCC.js's browser-first use case (no server required), the equivalent is a pure-JS `pauseOnInput` option in `executeBuffer` + a Web Worker step cap.

The output side is already solved — `options.write` covers all output traps. The input side needs a single `pauseOnInput` extension to reach Tier 2 (interactive stdin). P1/P2 of the playground can ship today with zero interpreter changes; P3 is the key unblock for programs that read input.

**Filed follow-on tickets to consider:**
- DEV: add `pauseOnInput` option to `executeBuffer` — suspends when inputBuffer empty, returns sentinel
- DEV: Web Worker execution wrapper with step cap for browser playground
