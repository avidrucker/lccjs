# TIL 2026-06-14 — FIG

**Context:** A single ticket carried this whole session: #1238 (`bug: resetAssemblyState() omits listingLoadPoint — reused Assembler leaks -l value`). It started as an *issue-review* readiness pass (child #1265 under tracker #938), the human said "take it," and the implementation turned up that the ticket's prescribed fix was wrong. The session ended with the fix shipped, a follow-up filed (#1277), and an authority-path ticket for the lesson below (#1285).

---

## 1. Review readiness ≠ implementation soundness

**What happened:** I ran the `issue-review-skill` on #1238 and scored it **14/15 — READY**. By every rubric dimension it deserved that: clean Have/Should/Repro/Acceptance, single deliverable, a real reproduction, citations to the audit and the linker pattern. Then I went to implement it and discovered the prescribed fix would ship a regression.

**What I learned:** The review rubric measures whether a ticket is *legible and actionable* — it cannot measure whether the prescribed solution is *correct*. Those are different axes. A ticket can be a model of clarity and still tell you to do the wrong thing. The rubric has no "is the suggested fix architecturally sound?" dimension, and it couldn't have — that question is only answerable by doing implementation-level tracing.

**The rule:** **A READY verdict certifies the ticket is clear, not that its prescribed fix is right. Re-verify the fix on contact with the code.**

---

## 2. Verify the prescribed fix mechanism, not just the bug

**What happened:** #1238 said "add `listingLoadPoint` to `resetAssemblyState()`." The leak was real — I confirmed it with a throwaway probe (reuse an `Assembler`, `-l` on run 1, none on run 2 → run 2 inherited `0x3000`). But before applying the prescribed fix I wrote a *second* probe that monkey-patched `resetAssemblyState()` to clear the field, exactly as the ticket asked. Result:

```
NAIVE-FIX CLI path listingLoadPoint after assemble = 0x0   (want 0x3000 → -l BROKEN)
```

The prescribed fix breaks the CLI `-l` feature outright.

**What I learned:** Confirming the bug is real is only half the verification. The audit author saw the symptom correctly and proposed a plausible fix without tracing the call ordering. Probing the *fix* — not just the *bug* — cost two minutes and saved a regression that had **zero existing test coverage** to catch it.

**The rule:** **Probe the prescribed fix's mechanism before applying it; a real bug does not imply a correct prescription.** (Authority-path ticket: #1285.)

---

## 3. Why the prescribed fix was wrong: reset runs *inside* assembleSource

**What happened:** The root cause is an ordering subtlety. `lcc.js` `assembleFile()` sets `assembler.listingLoadPoint` (the `-l<hex>` value) on the instance, *then* calls `main()` → `assembleSource()` → `resetAssemblyState()`. So `resetAssemblyState()` fires **after** the CLI has set the value. Clearing the field there wipes every `-l` invocation.

**What I learned:** `listingLoadPoint` is per-run **input**, like `inputFileName`/`outputFileName` — caller-supplied config that must survive the reset, not a derived field computed during assembly. By the ticket's own "config-only fields stay outside reset" rule, it correctly stayed out. The actual fix was to make it a per-call `assembleSource()` option (default `0`), cleared in reset, with `main()` threading the CLI-wired value through — mirroring exactly how `inputFileName` is handled.

**The rule:** **Before resetting a field, classify it: caller-supplied input (survives reset, threaded per-call) vs derived per-run state (cleared). The reset's call-site ordering decides which fix works.**

---

## 4. Surface the design fork — don't silently pick it

**What happened:** Once I knew the prescribed fix was wrong, there was a real fork: a full per-call fix (touches the CLI seam) vs a smaller sticky-config option vs revising the ticket. I had proof for each, but the choice affects a public seam. Rather than pick one, I brought the human the evidence and the three options via a structured question. They chose the full per-call fix.

**What I learned:** This is the architect/courier split. My job at that moment was to *deliver the decision-ready fork*, not to decide it. The temptation to "just do the right one" is strong when you've already done the analysis — but a seam-level decision is the maintainer's call, and silently choosing would have hidden the fact that the ticket needed revising at all.

**The rule:** **When implementation uncovers a fork the ticket didn't anticipate — especially across a public seam — stop and surface it with evidence; don't fold the decision into a commit.**

---

## 5. Pre-close discipline pays: the sibling-leak follow-up

**What happened:** Running the `next-best-action` checklist before closing, Q1 ("out-of-scope bug?") made me check whether other fields shared the omission. They did: `verboseModeOn`, `explainModeOn`, and `userName` are all set by `lcc.js` and absent from `resetAssemblyState()` with no `assembleSource` option — the identical leak shape. Filed as #1277 instead of expanding the #1238 diff.

**What I learned:** The fix for one instance of a pattern is the best moment to notice every other instance — but only if I deliberately look. The checklist's value isn't the obvious closing comment; it's the question that turns "I fixed the bug" into "what else looks like this bug?" And the answer goes in a new ticket, not the current diff (scope discipline).

**The rule:** **When you fix one instance of a pattern, scan for siblings and file them — same diff fixes one, a new ticket tracks the rest.**

---

## What landed

| Artifact | Change |
|---|---|
| #1265 | Issue-review readiness pass on #1238 (child of tracker #938) — verdict READY 14/15 |
| `src/core/assembler.js` | `-l`/`listingLoadPoint` made a per-call `assembleSource()` option, cleared in reset, threaded via `main()` (#1238) |
| `tests/new/assembler.unit.spec.js`, `assembler.cli.integration.spec.js` | First-ever `-l` coverage: no-leak reuse + CLI regression guard (#1238) |
| #1277 | Follow-up bug: `verboseModeOn`/`explainModeOn`/`userName` share the same reuse-leak omission |
| #1285 | Authority-path ticket for lesson #2 (RULES.md vs gotchas decision) |

## Open threads

- #1277 and #1285 are open and unclaimed.
- The naive-fix regression had no test before this session; #1277's work should add `-v`/`--explain` coverage before changing their reset behavior.

## Related artifacts

- Issues #1238, #1265, #1277, #1285; tracker #938
- `docs/research/claude-bugs-audit-2026-06-06.md` (the audit that graduated #1238)
