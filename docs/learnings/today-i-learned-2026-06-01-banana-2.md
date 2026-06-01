# Today I Learned — 2026-06-01 (BANANA, session 2)

Four tickets: interpreter hang fix (#375), skill-gating fix (#377), oracle
loop-behavior research (#385), interpreter state-grouping research (#388).
The through-line: every issue had a smaller real blast radius than it appeared —
and in each case the gap came from a boundary that was already present but not
being used.

---

## 1. The EAGAIN spin loop is the interpreter hang — and isTTY fixes it cleanly

The 99.9% CPU hang on `name.nnn` absent + non-TTY stdin (#375) was an EAGAIN
retry loop in `readLineFromStdin()`. When stdin is set non-blocking (as it is in
Claude Code agent shells), `fs.readSync` returns EAGAIN repeatedly instead of
blocking. The `catch (err) { if (err.code === 'EAGAIN') continue; }` guard turns
this into a pure CPU spin that never terminates.

The fix is one check before reaching `readLineFromStdin()`:

```js
if (!process.stdin.isTTY) {
  process.stderr.write('Fatal: name.nnn not found and stdin is not a terminal.\n...');
  process.exit(1);
}
```

`process.stdin.isTTY` is `undefined`/`false` for pipes and non-interactive shells,
`true` for a real terminal. It distinguishes "this will block productively" from
"this will spin forever."

**Side effect:** two existing tests (`interpreter.e2e.spec.js` and
`linkerStepsPrinter.unit.spec.js`) used to pipe the name to the process via
`{ input: 'MilkyWay\n' }`. After the fix, piped-name creation stops working.
The correct non-interactive pattern is to pre-create `name.nnn` — both tests were
updated. This is the right posture: non-interactive callers own the setup.

---

## 2. Skill trigger descriptions need explicit "NEVER fire on" guards, not just positive triggers

The `puzzle-triage` skill fired on agent-readiness greetings ("you are agent
ELDERBERRY, are you ready to work?") because the trigger list included "After
closing a puzzle, when deciding the next one to pick up" — broad enough for the
model to pattern-match against any "what should I work on?" framing, including a
greeting (#377).

The fix has two parts:
1. **Restructure the trigger section** into positive (fire when…) + negative (NEVER fire on…) blocks. The negative block lists orientation greetings explicitly.
2. **Update the frontmatter description** — that's what the harness injects as the skill's trigger contract in the system prompt. Putting "NEVER fire on an agent-readiness greeting" there makes it visible at match time, not just inside the skill body.

**Pattern:** a skill trigger description that only lists when to fire will be
pattern-matched creatively. Listing explicit exceptions prevents the "close enough"
match. For skills with high false-positive risk, put the guard in the frontmatter.

---

## 3. "Oracle hangs silently" was a TTY vs non-TTY distinction, not a silence

The #385 issue description said `ret` bare causes the oracle to "hang indefinitely
with no output." The live probe showed something different: the oracle prints
`Possible infinite loop` and enters a stepping debug mode with a `ret>>>` prompt.

- **In TTY context:** the prompt waits for user input → appears to hang (the user
  sees the prompt but nothing completes).
- **In non-TTY context:** the prompt reads EOF immediately, prints one trace line,
  reads EOF again — looping at ~90 MB/s until killed (322–459 MB in 5 s).

The word "hang" was accurate for the observer's TTY experience but missed the
mechanism. The real behavior is "enters interactive debug mode that is
catastrophic in non-TTY contexts."

**Pattern:** when an issue describes a process as "hung with no output," probe in
the same context (TTY vs non-TTY) the reporter used. The same bug can look like a
silent freeze in TTY and a stdout flood in non-TTY. Both descriptions are honest;
neither is complete.

---

## 4. `createExecutionResult()` already isolates tests — blast radius was 450 internally, ~25 externally

The #388 issue counted ~450 `this.*` references across 18 files as the blast
radius for grouping interpreter fields. That count included ~387 *internal*
references inside `interpreter.js` itself — those move automatically when the
field moves.

The external surface turned out to be ~25 references across 6 files. The key
reason: `createExecutionResult()` is the boundary. Tests assert on
`result.output`, `result.mem`, `result.pc` (return values) — not on
`interpreter.output`, `interpreter.mem`. Moving `this.output → this.io.output`
only requires updating the 10 lines inside `createExecutionResult`, not the 41
test assertions.

The actual external injection points are small and specific:
- `lcc.js` writes 6 fields directly onto the interpreter before run.
- `iinterpreter.js` reads `r`, `mem`, `pc`, and a few flags at runtime.
- A handful of tests write `generateStats` and `inputBuffer`.

**Pattern:** before estimating blast radius for a refactor, distinguish internal
`this.*` uses (move for free) from external writes (lcc.js-style injection) and
external reads (test assertions via return value vs direct field access). A good
abstraction like `createExecutionResult` can silently already contain half the
blast.

---

## What went well

- **Interpreter hang fix was clean and fast.** The EAGAIN loop was findable in one
  grep; the fix was one if-block; the existing tests caught the two callers that
  needed updating immediately.
- **The oracle probe invalidated the issue description usefully.** Knowing the
  oracle does detect the loop (it says "Possible infinite loop") but then enters
  debug mode rather than exiting gave a sharper classification for the deviation
  entry (BY DESIGN beneficial, provisionally report-worthy).
- **Research produced a concrete deliverable.** The blast-radius correction for
  #388 went from "this is a multi-hour blocking problem" to "here's a 5-bucket
  75m first phase that ships without touching iinterpreter."

## What didn't go well

- **Start timestamp not captured for #377 or #385.** Both were claimed after the
  issue was already read. Actual minutes were left empty in the velocity rows.
  The protocol says capture the timestamp *before* `gh issue view` — this needs
  to become a reflex, not an afterthought.
- **The `--as BANANA` flag needed for every claim.** The claim script auto-assigns
  a fruit based on prior session state; `--as BANANA` overrides it. Easy to forget
  on the second or third claim of a session; if forgotten, the worktree gets a
  mismatched fruit name and the velocity row has to be corrected.
