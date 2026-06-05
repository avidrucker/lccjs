# TIL 2026-06-05 DRAGONFRUIT session 2

**Agent:** DRAGONFRUIT  
**Date:** 2026-06-05  
**Session themes:** din/ain newline parity, guide-human-decision pattern, deferred decisions

---

## 1. `din` consumes the trailing `\n` in lccjs; OG LCC does not

The double-`ain` workaround in `docs/simpleCalc.a` — `ain r1` to discard the newline, then `ain r1` to read the operator — is correct for OG LCC and silently broken in lccjs. The root cause is in `readLineFromStdin()`: the simulated-input path uses `slice(newlineIndex + 1)`, which advances past the `\n` so it's gone before the next trap runs. OG LCC's `din` stops reading before consuming the newline.

Confirmed empirically: double-ain + `5\n+\n3\n` → OG LCC produces `Result: 8`; lccjs produces `Invalid operation`. Single-ain flips the results.

The reliable test for this kind of input-buffer question is to try both variants (single-ain and double-ain) against both tools with a concrete input string — the crossing pattern is unmistakable.

Documented as parity deviation §25; pitfall §3.4 added; DEV fix filed as #857.

---

## 2. When guiding human decisions, state "what exists today" separately from "what the options change"

On the `sra r0, 0` question (#513), the user was confused by options labeled 1/2/3 without knowing which described *current behavior* and which described *proposed changes*. The fix: always lead with a single-sentence description of current behavior, then present options only as deltas from that baseline.

---

## 3. Deferred decisions need a summary doc + two tickets, not a ruling

For `sra r0, 0`, the right call was to defer rather than force a premature ruling. The pattern that works: write a summary doc (`docs/research/sra-shift-by-zero-513.md`) capturing current behavior, options, and open questions; file one ticket to ping Charlie (#868) and one to send the full question to Prof. Dos Reis (#867). The doc becomes the source of truth so neither external reviewer has to reconstruct context.

---

## 4. Don't ask the human owner to decide things that are already closed

#298 was already closed. The only open action was a housekeeping comment — not a decision. Routing it through the owner's decision flow was unnecessary friction. If a ticket is closed and just needs a note, post the note.

---

## 5. Tracker advance is a distinct PM act worth a velocity row

Advancing #838 from "blocked on #837" to "has two actionable children (#858, #859)" — filing the children, updating the tracker body, removing the blocker note — is real PM work even though the tracker itself doesn't close. It earned its own velocity row because without it the children don't exist and the work can't proceed.
