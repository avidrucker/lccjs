# Research: Three-letter-input `ain` newline behavior — #855

**Date:** 2026-06-05  
**Agent:** ELDERBERRY  
**Issue:** #855 — Three-letter-input program misreads characters  
**Related:** #852 (double-ain / din-newline investigation)

---

## Summary

`ain` reads exactly one byte from stdin — including `\n`. When a user types a letter and presses
Enter, the buffer contains `<letter>\n`; three consecutive `ain` calls on `a\nb\nc\n` input
read `a`, `\n`, `b` — not `a`, `b`, `c`.

**This is full parity between lccjs and OG LCC. It is not a lccjs defect.**

---

## Experiment: `experiments/three-letters.a`

Minimal program: three consecutive `ain` calls, then `aout` each result.

```asm
        ain r0
        ain r1
        ain r2
        aout r0
        aout r1
        aout r2
        nl
        halt
```

### Run: lccjs with `printf "a\nb\nc\n"`

```
Output: a
        b
```

`r0=97` ('a'), `r1=10` ('\n'), `r2=98` ('b') — aout r1 emits a bare newline, so
`abc` becomes `a` + newline + `b`.

### Run: OG LCC with `printf "a\nb\nc\n"`

```
Output: a
        b
```

**Identical output.** Both interpreters read `a`, `\n`, `b` from the input stream.

---

## Experiment: no-newline input

Both lccjs and OG LCC produce `abc` cleanly when input contains no separating newlines:

```bash
printf "abc" | lccrun.sh ... three-letters.a
# Output: abc    (both implementations)
```

This confirms `ain` reads raw bytes in sequence — newlines are not skipped or buffered away.

---

## Experiment: `experiments/three-letters-double-ain.a`

Consume-newline workaround: an extra `ain r3` after each letter read to discard the `\n`.

```asm
        ain r0          ; r0 = 'a'
        ain r3          ; consume \n
        ain r1          ; r1 = 'b'
        ain r3          ; consume \n
        ain r2          ; r2 = 'c'
        aout r0
        aout r1
        aout r2
        nl
        halt
```

```bash
printf "a\nb\nc\n" | lccrun.sh ... three-letters-double-ain.a
# Output: abc    (both lccjs AND oracle)
```

Workaround is effective and **required in the same way in both implementations**.

---

## Root cause

`readCharFromStdin()` (lccjs) and the OG LCC `ain` trap both perform a raw single-byte read.
Neither peeks ahead nor skips `\n`. When terminal input is Enter-delimited, the newline
is a real character in the byte stream and `ain` consumes it.

Contrast with `readLineFromStdin()` (used by `din`/`hin`/`sin`): reads up to and *discarding*
the `\n` delimiter, so the next call sees a clean line. `ain` has no analogous behavior.

---

## Conclusions

| Question | Answer |
|---|---|
| Does lccjs misread characters? | Yes — reads `\n` between Enter-delimited inputs |
| Does OG LCC misread the same way? | Yes — identical behavior |
| Is this a lccjs parity bug? | **No** — full parity |
| Does the double-ain workaround fix both? | **Yes** |
| Should this be documented? | Yes — `docs/pitfalls.md` entry |

---

## Recommended follow-up

Add a `docs/pitfalls.md` entry covering:
- `ain` reads exactly one byte including `\n`
- Programs that read multiple characters with `ain` and expect Enter-separated input must
  consume the newline between each letter with an extra `ain`
- This is ISA-level behavior, not a lccjs quirk — applies equally to OG LCC

This feeds into #852: the double-ain workaround documented in `docs/simpleCalc.a` is
correct ISA technique, not a lccjs workaround.
