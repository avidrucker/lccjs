# TIL — 2026-05-30 (BANANA, segment 3)

## Context
A clean end-to-end arc on the LCC+ off-TTY crash: did the #240 research (findings
doc + recommendation), filed the baseline DEV puzzle #259, implemented and closed
it, then filed the deferred design follow-up #272 — each linked to the next.

## Learnings

- **Fix the chokepoint, not the line in the stack trace.** The issue's repro
  pointed at the `setRawMode(true)` in `main()`. But the *same* crash also lived
  in `resetProcessStdin()`, reached by four other paths (`fatalExit` — so even
  "Cannot open input file" crashed —, the `exit` handler, the HALT trap, Ctrl-C).
  Guarding only the reported line would have shipped a fix that still crashed on
  every error and every normal exit. Trace **all** call paths into the failing
  primitive before deciding where the guard goes.

- **Check whether the contract already exists before designing one.** The "what
  should non-interactive input *mean*?" question looked like a design decision.
  It wasn't, for the common case: `nbain` already returns `0` ("no key") on an
  empty queue. Off-TTY the queue simply never fills, so the existing fallback
  branch *is* the contract. The fix was to let existing code run, not to invent
  semantics. Look for the latent answer in the code before opening a design debate.

- **Split the crisp fix from the fuzzy decision; ship one, file the other.** The
  crash fix had no open question (#259, option a). The *interactive* off-TTY
  posture (games loop forever, `bp` hangs) was a genuine design call — so it went
  to #240's research and then a standalone ticket (#272), not bundled into the
  fix. Don't let a fuzzy sub-decision hold a crash fix hostage; don't smuggle a
  design choice into a "minimal" patch either.

- **A test forces adjacent correctness you'd otherwise wave off as "optional."**
  The cursor-escape leak (`?25h` into piped stdout) wasn't the crash — I'd noted
  it as optional in the research. But an e2e test asserting clean stdout *requires*
  no stray ESC bytes, so guarding the three cursor writes became part of the fix,
  not gold-plating. Writing the assertion is what made the boundary honest.

- **Edit/Write mangle literal control bytes — anchor on ASCII, assert via
  `String.fromCharCode`.** Matching `old_string`s containing the ESC byte
  (`[?25h`) failed repeatedly, and `` typed into Write content landed
  as a raw ESC byte in the file. Reliable moves: anchor edits on the surrounding
  printable text (e.g. the function signature line), and in test code write
  `String.fromCharCode(27)` rather than a literal or backslash-escaped ESC.

- **Don't clobber another agent's uncommitted work to satisfy a guard.** The
  shared `main` checkout held CHERRY's *uncommitted* velocity row, which blocked
  `git pull --ff-only` and the claim freshness guard. The right move wasn't to
  stash it — it was `--allow-stale-main` + rebasing the worktree onto
  `origin/main` (the staleness reconciles at push). The guard has an override for
  exactly this; prefer it over disturbing a working tree you don't own.

- **"Available" ≠ "ready" — the gate can live in the body, not a label.** #268 is
  open, unassigned, unclaimed — looks grabbable. But its body says "Once
  `npm run close` lands…", and that tool (#266) is still being implemented by
  CHERRY and doesn't exist on `main` yet. A ticket can be blocked-in-fact with no
  `blocked` label. Read the dependency in the body and verify the depended-on
  artifact actually exists before calling something ready. (Also caught a stale
  cross-ref: #268 cited #257, but the real dependency is #266.)

## Outcome
#240 research closed (findings doc `interpreterplus-off-tty-stdin-contract.md`);
#259 fixed + closed (`f58afcd`: both `setRawMode` sites + three cursor escapes
guarded behind `isTTY`; new `interpreterplus.e2e.spec.js`; full suite 44/715
green); #272 filed for the deferred interactive-input design question, linked
bidirectionally to #240/#259. Velocity rows logged under BANANA throughout.
