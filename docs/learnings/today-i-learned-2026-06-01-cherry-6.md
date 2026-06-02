# TIL — 2026-06-01 · CHERRY (session 6)

Four tickets: two research spikes (#444, #455), one docs move (#448), one PM round
(filing #451, #452, #458). Most of the session was read-the-code-first investigation
where the surprising finding differed from the symptom in the issue.

---

## 1. `setsid+&` drops stdin — and `[ -t 0 ]` is the right fix predicate

`lccrun.sh` uses `setsid "$@" &` to background the child in a new session so a
watchdog can kill the whole process group on timeout. Side effect: bash redirects
background-job stdin to `/dev/null` in the absence of any explicit stdin redirect
(POSIX-specified, not a bash quirk).

Two candidate fix predicates were tested:

- `[ -p /dev/stdin ]` — true only for pipes; drops file-redirected stdin, and
  would forward a TTY to a setsid'd child (SIGTTIN). Wrong.
- `[ -t 0 ]` — true only for interactive terminals. Drop stdin only then; forward
  everything else (pipe, file, `/dev/null`). Correct.

```bash
if [ -t 0 ]; then
  setsid "$@" </dev/null &
else
  setsid "$@" <&0 &
fi
```

Everything else in `lccrun.sh` (watchdog, `kill -- -PGID`, exit code) is unchanged.
Tracked in #451.

**Lesson:** when you want "drop interactive stdin but pass through pipes and files,"
`[ -t 0 ]` is the right question — not `[ -p /dev/stdin ]`.

---

## 2. A second bug hid behind the first

The issue (#444) said `din` outputs `0` when stdin is dropped. What actually happens
now is a 10-second timeout: `readLineFromStdin()` returns `""` on EOF (`fs.readSync`
returns 0 bytes immediately on `/dev/null`), and the `din` handler's `while (true)`
loop hits `if (dinInput.trim() === '') continue` — spinning at 100% CPU until killed.

Fixing `lccrun.sh` to pass stdin through will make this spin reachable via normal
piped use. Tracked separately in #452.

**Lesson:** when a symptom changed between when an issue was filed and now, a second
bug probably arrived in the meantime. Read the code; don't trust the issue's stated
output.

---

## 3. Grep the instruction table, not the ISA doc, when auditing grammar coverage

For #455, the faster and more authoritative source was `assembler.js:_buildCoreTable()`
rather than `docs/lcc-isa.md`. A single grep turned up three gaps the ISA doc wouldn't
have surfaced cleanly:

- `sext` — in the table, not in the grammar
- `.globl` — aliased in the directive handler, absent from the pattern
- `m`, `r`, `s` — in the table, used in real demo files, missing from the grammar
  (the spike doc incorrectly claimed they were included)

All three gaps landed in one ≤15m DEV ticket (#458).

**Lesson:** for grammar coverage audits, grep the authoritative token source
(instruction table, parser) — not prose docs that may be stale.

---

## 4. Put context in the child ticket; link the closed parent as secondary reference

When filing DEV tickets from a closed RESEARCH ticket, the temptation is "see #N for
context." The right order is reversed: repro, code site, and fix direction go directly
in the new ticket body; the closed issue number is just the audit trail. Closed issues
drift out of sight — an agent needs to start from the ticket alone without chasing
references.
