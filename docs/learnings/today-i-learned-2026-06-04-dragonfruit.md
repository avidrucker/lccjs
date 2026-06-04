# Today I Learned — 2026-06-04 (DRAGONFRUIT)

Date: 2026-06-04
Agent: DRAGONFRUIT
Context: Browser playground cluster — closed #675 (webpack build), #687 (terminal
styling), #702 (pauseOnInput). Filed #705/#709–711/#695 for follow-on gaps.

---

## 1. "Already done" is a valid close — verify before implementing

Picking up #675 ("add a webpack build step"), the first thing to do was actually
check the repo. `webpack.browser.config.js`, `npm run build:browser`, and
`dist/lcc.bundle.js` were all already present and working. The issue had been
implemented as a side-effect of #595 and #682, but never closed.

The close commit was a single CLAUDE.md docs fix (the `build:browser` command
was missing from the Commands section). No webpack work required.

**Lesson:** run the repro steps from the issue before writing any code. A 2-minute
check saved 30 minutes of implementation, and the docs gap was the only real work.

---

## 2. Backing up PC is the key to resumable synchronous execution

For `pauseOnInput` (#702), the challenge is suspending a `while (this.running) { this.step(); }` loop mid-trap without threads or coroutines.

The trick: when `inputBuffer` is empty and `pauseOnInput` is set, decrement `this.pc` by 1 before throwing the pause signal. `step()` had already incremented PC past the TRAP instruction — backing it up means the same TRAP re-executes cleanly when `resume()` re-enters `run()`. No separate "re-entry state machine" needed; the interpreter's normal fetch-decode-execute cycle handles the restart.

```
step() fetches TRAP → pc++
readLineFromStdin() sees empty buffer
  → this.pc--          ← back to TRAP address
  → throw InputPauseSignal
executeBuffer() catches signal → returns sentinel
caller supplies input, calls resume()
run() → step() → fetches TRAP again → reads from inputBuffer ✓
```

**Lesson:** for synchronous interpreters, "suspend and resume" can be implemented
with a single `pc--` + a thrown signal. The CPU's own program counter is the
resume pointer.

---

## 3. Use a signal class, not an Error, for non-error control flow

`InputPauseSignal` is not an `LccError`. It has no stack trace, no `message`,
no inheritance from `Error`. It is just:

```js
class InputPauseSignal {
  constructor(trapType) { this.trapType = trapType; }
}
```

Throwing it lets the signal propagate through the call stack (through
`executeTRAP()` → `run()` → `executeBuffer()`) without being mistaken for a
runtime fault by any existing error handler. The catch in `executeBuffer` checks
`instanceof InputPauseSignal` specifically and returns the sentinel; everything
else re-throws as before.

**Lesson:** `throw` is a general-purpose non-local exit, not just for errors. A
lightweight signal class keeps control-flow intent clear and avoids accidentally
catching real errors.

---

## 4. A build path and a runtime path can silently diverge

After closing #687 (terminal styling), running the playground in a browser
revealed the Run button always showed "lcc.bundle.js not loaded". The `<script>`
tag in `docs/site/showcase/index.html` was:

```html
<script src="../dist/lcc.bundle.js"></script>
```

From `docs/site/showcase/`, `..` resolves to `docs/site/` — so the browser
looks for `docs/site/dist/lcc.bundle.js`. Webpack writes to repo-root `dist/`.
The paths never cross. Worse: `npm run build:site` regenerates the playground
page from `build-site.js`, which produces a syntax-only page with no Run button
at all — silently discarding the #676/#687 execution features on every build.

Two separate tickets filed for the two root causes (#709, #710); a spike for
verification (#711).

**Lesson:** the path your tool writes to and the path your HTML loads from are
independent assumptions. Verify both by actually opening the page in a browser
before closing a browser-facing ticket.

---

## What landed

| Issue | What |
|---|---|
| [#675](https://github.com/avidrucker/lccjs/issues/675) | Closed — already implemented; added `build:browser` to CLAUDE.md Commands |
| [#687](https://github.com/avidrucker/lccjs/issues/687) | Terminal styling: `#0a0a0a`/`#4af626`, `$ lcc` prompt prefix, injected CSS |
| [#702](https://github.com/avidrucker/lccjs/issues/702) | `pauseOnInput` on `executeBuffer` + `resume()` + closure API in `api.js`; 10 unit tests |
| [#695](https://github.com/avidrucker/lccjs/issues/695) | Filed — guide for LCC code block options (syntax-highlight vs runnable) |
| [#705](https://github.com/avidrucker/lccjs/issues/705) | Filed — tracker for broken playground Run button |
| [#709–711](https://github.com/avidrucker/lccjs/issues/709) | Filed — bundle copy step, build:site execution features, e2e verification spike |
