# TIL 2026-06-14 — INCABERRY (session 2)

**Context:** The day's second INCABERRY session closed issue #1306 by adding a BDD feature for the LCC+ extras contract. My first implementation attempt used `spawnSync` to run `src/plus/lccplus.js` as a child process. In this sandbox that path hit `EPERM`, even though the same CLI command worked fine outside the Jest harness. The fix was to drive the LCC+ driver in-process and spy on stdout/stderr plus TTY guards instead.

---

## 1. A CLI BDD test can be correct and still fail at the harness layer

**What happened:** The feature needed to validate the real LCC+ command surface, so the natural first step was to launch `node src/plus/lccplus.js <file>.ap` from the test. In this environment the child-process launch itself failed with `EPERM`, before any of the actual assertions could run. The same command worked when I ran it manually under a PTY, which made the failure clearly a harness limitation rather than a toolchain bug.

**What I learned:** For repo-local BDD work, "drive the real CLI" does not always have to mean "spawn a separate Node process." When the sandbox blocks child processes, the better seam is the driver module's `main()` method. That keeps the test at the user-facing contract level while avoiding an environment-specific false negative.

**The rule:** **If a CLI BDD test is blocked by sandboxed child-process spawning, fall back to the driver/module seam and keep the observable contract intact instead of weakening the feature or chasing the harness.**

---

## 2. Terminal-control assertions are easier to verify in-process when the environment is hostile

**What happened:** The LCC+ extras ticket also needed to cover `clear`, `cursor`, and `resetc`. In a PTY, those paths emit visible terminal control sequences. Inside the test harness, the more reliable approach was to flip `process.stdin.isTTY` and `process.stdout.isTTY` in-process and spy on `console.clear` plus stdout writes. That made the TTY-only behavior observable without needing a fragile external PTY wrapper inside Jest.

**What I learned:** The observable behavior matters more than the transport. If a terminal feature can be proven by checking the emitted control sequence or the call to `console.clear`, there is no reason to force a separate process just to make the harness feel closer to production.

**The rule:** **For TTY-sensitive CLI tests, prefer in-process TTY guards and output spies when they give the same user-visible proof and avoid brittle PTY plumbing.**

---

## What landed

| Artifact | Change |
|---|---|
| `tests/features/lccplus-extras.feature` | Added the new LCC+ extras BDD scenarios |
| `tests/new/lccplus-extras.bdd.spec.js` | Added the step definitions and in-process CLI harness |
| #1306 | Closed with seeded rand, millis, nbain, cursor, clear, and resetc coverage |

## Related artifacts

- `write-til-doc` skill — the workflow used to create this TIL
- `docs/learnings/README.md` — index entry added for this session
- Sibling same-day TIL: [TIL 2026-06-14 — INCABERRY](./today-i-learned-2026-06-14-incaberry.md)
