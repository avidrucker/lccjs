# TIL 2026-06-05 — APPLE

**Context:** Single session. Picked up issue #857 — `din`/`hin` parity fix
(lccjs was consuming the trailing `\n` after reading a decimal/hex number; OG LCC
leaves it in stdin, enabling the double-`ain` workaround pattern in `simpleCalc.a`).
Also ran two `/fruit-agent-orchestrate` triage cycles across seven agents.

---

## 1. `slice(newlineIndex)` is a no-op when `newlineIndex === 0`

**What happened:** The fix direction in issue #857 proposed changing
`this.inputBuffer.slice(newlineIndex + 1)` → `this.inputBuffer.slice(newlineIndex)`
to leave the `\n` in the buffer after `din` reads a line. Applied it, then traced
`din r2` when the buffer was `"\n3\n"` — `newlineIndex === 0`, so `slice(0)` returns
the whole string unchanged. The `din` retry loop (`if (dinInput.trim() === '') { continue; }`)
got `""` forever and spun infinitely.

**What I learned:** `String.prototype.slice(0)` is a full-copy identity — it returns
the entire string with no advancement. The issue's proposed fix was correct for the
happy path (`newlineIndex > 0`, a non-empty line) but silently broken at the edge case
where the buffer starts with `\n` (e.g. when `din` is called a second time after `ain`
already consumed the intended character). The fix needs two branches: leave `\n` when
reading a non-empty line; consume `\n` when the result is already empty (so the retry
loop can advance past it).

**The rule:** **When patching a `slice` index, explicitly trace the `0` case and
the end-of-string case before committing — boundary off-by-ones are invisible in
happy-path-only traces.**

---

## 2. Inline assembly test strings need at least one space of indentation

**What happened:** Wrote a regression test using the inline source string
`'din r0\nain r1\nhalt'` (no leading whitespace on any line). The assembler threw
"Invalid operation" (running directly in Node) and "Duplicate label" (in Jest with
mocked console). Switching to `'  din r0\n  ain r1\n  halt'` (two leading spaces)
assembled cleanly.

**What I learned:** The LCC assembler parses tokens at column 0 differently from
indented tokens — column-0 text is a candidate for label parsing rather than a
guaranteed instruction match. Fixture files like `dinEof.a` work because they
have their instructions already indented. Inline source strings don't get that
normalisation automatically.

**The rule:** **Always indent instructions by at least one space in inline assembly
source strings passed to `assembleSource()` in tests; column-0 tokens are label
candidates, not guaranteed instruction matches.**

---

## 3. GitHub issue body text carries ratification state that labels do not

**What happened:** During the second orchestration run, issue #798
("HUMAN DECISION: ratify #773 rulings — approve R2 + R6") was still open and
labeled `human-required`. Based on the label alone, all dependent R-series tickets
(#861, #863, #864) looked blocked. Fetching the body of #864 revealed the sentence
"R2 ruling ratified in #798" — meaning R2 had already been approved by the human
and #864 was ready to implement.

**What I learned:** GitHub labels are slow to update and often lag behind the actual
state of a decision. The issue body (especially the first paragraph of an
implementation ticket) is frequently more current — the implementer writes
"ratified in #N" or "approved in #N" when they file the child ticket. Labels
like `human-required` can persist on a parent ticket long after the human has acted.

**The rule:** **When orchestrating, fetch the body of implementation/child tickets
(not just the parent decision ticket) to detect ratified state — a stale label
on the parent does not mean the decision is still pending.**

---

## What landed

| Artifact | Change |
|---|---|
| `src/core/interpreter.js` | Conditional `slice` in `readLineFromStdin()` — non-empty lines leave `\n`; empty lines consume it |
| `src/core/interpreter.js` | TTY path: prepend `\n` to `inputBuffer` instead of discarding it |
| `tests/new/interpreter.unit.spec.js` | 4 regression tests for `din→ain` sequence and `simpleCalc.a` double-ain pattern |
| `docs/parity_deviations.md` | §25 removed (bug fixed); changelog entry added |
| `docs/pitfalls.md` | §3.4 updated — lccjs-specific caveat removed, double-ain pattern documented as working on both tools |

## Related artifacts

- Issue #857 (closed — the fix)
- Issue #852 (closed — the prior research that documented the deviation)
- `docs/research/ain-din-newline-parity-852.md` — execution trace and root-cause analysis
- `docs/parity_deviations.md` — §25 history in changelog
