# TIL 2026-06-04 APPLE — browser output already solved; pauseOnInput is the missing stdin key; ROLE: ≠ commit type

## Browser stdout: already solved via `options.write`

The LCC.js `Interpreter` constructor accepts a `write` callback:

```js
this._write = options.write ?? (m => process.stdout.write(m));
```

Every output trap (`DOUT`, `UDOUT`, `HOUT`, `AOUT`, `SOUT`, `NL`) routes through `this._write`. Browser consumers just pass `{ write: m => (el.textContent += m) }` — no interpreter changes needed. The output side of in-browser LCC execution was already solved before any playground work started (#693).

## Browser stdin: three tiers, one gap

There are three tiers of stdin support for runnable LCC code in a browser:

| Tier | Mechanism | Status |
|------|-----------|--------|
| P1 — no input traps | `options.write` only | ✓ works today |
| P2 — pre-supplied input | `data-stdin` → `inputBuffer` | ✓ works today |
| P3 — interactive input | `pauseOnInput` + resume | ✗ not yet (#702) |

The gap is in `readLineFromStdin()`: when `inputBuffer` is exhausted it falls through to `process.stdin.fd`, a synchronous blocking read that hangs a browser tab. The fix is a `pauseOnInput` option that suspends execution and returns a `{ status: 'waiting-for-input' }` sentinel instead of blocking. web_ilcc (the reference implementation, #693) uses this exact pattern server-side via a pause/resume HTTP session API.

## ROLE: prefix and commit type answer different questions

Issue title `ROLE:` (DEV, WRITER, RESEARCH, …) = *what kind of effort is this?*
Commit type (`fix:`, `feat:`, `docs:`, …) = *what kind of change resulted?*

They are never interchangeable. `fix:` as an issue prefix is wrong because it describes the outcome (a bug got fixed), not the work being assigned. The right issue prefix is always `DEV:` — the commit type belongs in the commit, not the ticket. This showed up repeatedly in the pre/post-#657 audit (#672): `bug:`, `fix:`, `docs:` in issue titles are the most common non-standard pattern. Filed as #683 for the ARCHITECT-level documentation of the distinction.
