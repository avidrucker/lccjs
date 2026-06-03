# TIL 2026-06-03 — CHERRY

**Context:** A session that fixed a latent binary-corruption bug in the
assembler test harness (#527), patched a silent variable-shadow in the
day-six stats notebook (#521), and wrote a stats-vocabulary glossary (#534).

---

## A test that reads the producer's internal state doesn't verify the write path

**What happened:**

`assemblerIntegrationHarness.js` mocked `fs.writeSync` like this:

```js
virtualFs[fd] += buffer.toString('utf-8');  // ← converts binary to string
```

When the assembler writes a `.e` executable, it calls `writeSync` with raw
binary Buffers — machine-code words that include bytes that are not valid
UTF-8. `toString('utf-8')` mangles those bytes silently: some become
replacement characters, others get merged or split into multi-byte sequences.
The bytes stored in `virtualFs['output.e']` were corrupted from the first
write.

Yet the test suite had been green for months. Why? Every existing assembler
integration test checked `assembler.outputBuffer` — the in-memory list of
code words built during Pass 2 — and never read anything back from `virtualFs`.
The write path was completely untested. The corruption was real but invisible.

**What I learned:**

Checking the producer's in-memory state after it runs is not the same as
checking what it wrote. The assembler's `outputBuffer` being correct only
proves that the two-pass assembly logic worked. It says nothing about whether
the bytes that would land on disk are intact.

The harness had a second readable surface — `virtualFs` — and no test used
it to verify the write path. A future test that *did* read from `virtualFs`
would have gotten corrupted bytes with no warning.

**The rule:**

After fixing a write-path bug, write the regression test from the *reader's*
perspective. Assemble something, then read back what was written and assert the
bytes are correct. That test would have caught this from day one; no existing
test caught it because none looked at the output from the right direction.

**The concrete fix:**

`openSync` now initialises `virtualFs[fd] = Buffer.alloc(0)` and `writeSync`
appends via `Buffer.concat`. The regression test assembles a minimal one-line
program and asserts `virtualFs['sig.e']` is a Buffer whose first two bytes are
`0x6F, 0x43` — the `oC` magic that starts every valid LCC executable.

**Related:** The same session fixed a variable-shadow in the day-six stats
notebook (#521) where `kw` (the agent Kruskal-Wallis result from §3) was
silently overwritten by the model KW in §5, causing the §7 summary to print
the wrong numbers. Same class of bug: a name quietly refers to a different
thing, the output looks plausible, and nothing errors. The fix in both cases
is to name things precisely enough that a mismatch becomes obvious — `agent_kw`
vs `kw`, `Buffer.concat` vs string append.
