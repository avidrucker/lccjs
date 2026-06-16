# TIL 2026-06-15 — APPLE (session 2)

**Context:** Second APPLE session today (see [session 1](./today-i-learned-2026-06-15-apple.md) for the interpreter-architecture work). This session worked tracker #1180 — triage the external `claude-bugs-audit-2026-06-06.md` into actionable tickets — by graduating each finding into its own verify-first child and working them one at a time: #1377, #1380, #1389, #1397, then filing #1402/#1403/#1404 and committing the audit doc. The recurring theme: an external audit's claims are *hypotheses*, and verifying them changed what the right action was almost every time.

---

## 1. An external audit's headline is a hypothesis, not a finding

**What happened:** The audit listed four P2 "robustness" bugs. When I actually read the code:

- **div/rem by zero** (#1377): the audit feared a silent `0`. But `raiseRuntimeError` already `throw`s, so the divide is unreachable — the acute bug was **refuted**. The real gap was missing *test coverage* for `rem`.
- **`parseObjectModuleBuffer` off-by-one** (#1380): the audit called the bounds check off-by-one. Working it out, `offset + 1 >= buffer.length` is exactly correct for a 2-byte read — **refuted**. The audit's own parenthetical even agreed with the code. Again, the residual was a *test*, not a fix.
- **linker `error()` divergence** (#1389): a real asymmetry, but **intentional** and oracle-matching — a *documentation* deliverable, not a fix.

**What I learned:** Three of four "bugs" weren't live bugs. If I'd implemented the prescribed fixes on faith, I'd have written wrong code or churned correct code. The verify-first step (read the actual code + existing tests before framing the ticket) is what turned each note into the *correct* deliverable (test / doc / refute) instead of the *assumed* one.

**The rule:** **Treat an external audit finding as a claim to be reproduced or refuted, never a confirmed defect — read the code and existing tests before you write the ticket.** (Authority path: #1285 tracks promoting "verify a ticket's prescribed fix mechanism before implementing" to RULES.)

---

## 2. A prescribed fix can break a contract the auditor couldn't see

**What happened:** P2.4 (#1397) said the unconditional `console.log('Starting assembly pass 1')` banners were test noise — "gate them behind `verboseModeOn`." But the `#515` bp golden is the *oracle's own captured stdout*, and its first two lines are those banners; `parity_deviations.md` tracks them. **The banners are oracle-parity output.** Gating them behind verbose would have broken the default `lcc <file>.a` parity — and a "committed == current-output" drift test (which I'd considered) would have *locked in* behavior that's under review.

I surfaced the fork with `AskUserQuestion` instead of picking. The chosen fix kept parity: route the banners through a null-default `onProgress` hook that the CLI (`main()`) wires to `console.log`, so the pure seam goes silent for in-process callers while the CLI still prints them. Verified with real `lcc.js`/`assembler.js` runs, not just source reading.

**What I learned:** The thing that looks like "obvious noise to delete" can be a load-bearing contract elsewhere (here: byte-for-byte oracle parity). The prescribed *mechanism* (gate behind verbose) and the *goal* (quiet the seam) were separable — and only one of them was safe.

**The rule:** **Before applying a prescribed fix, find what depends on the current behavior (parity goldens, downstream consumers); if the mechanism risks a contract, separate goal from mechanism and surface the fork.**

---

## 3. The "orthogonality trap": tooling that captures a behavior is coupled to any open question about that behavior

**What happened:** For the `SEXT_PARITY_TABLE` provenance note (#1402) I confidently told the user it was "orthogonal to the semantics question (#159) and actionable now" — a generator just black-box captures the oracle, no ruling needed. The user pushed back: *why do any `sext` work while we're waiting on Prof. Dos Reis?* They were right. A provenance generator can only capture the **current** oracle's `sext` output — which is exactly what #159 asks him to rule on. So in 2 of 3 outcomes the work is premature or thrown away, and a drift test would lock in the suspected bug. I re-scoped #1402 to **blocked-by #159** and logged the confidently-wrong claim as a behavioral error (row 306).

**What I learned:** "Orthogonal" was wrong *reasoning*, not just a wrong conclusion. Capturing, verifying, or locking a behavior is inherently *coupled* to whether that behavior is correct. When correctness is under open review, building tooling around it isn't neutral groundwork — it's building on sand.

**The rule:** **If a behavior's correctness is under open review, tooling that captures/verifies/locks it is blocked behind that review — not orthogonal to it.** (Authority path: fresh evidence for #1285; also belongs in `do-this-not-that.md`.)

---

## 4. Untracked files don't carry into worktrees — and collide at close

**What happened:** #1403 was "commit the untracked audit doc." But a fresh worktree is checked out from a committed state, so the untracked `docs/research/claude-bugs-audit-2026-06-06.md` **wasn't there**. I had to `cp` its content from the main checkout into the worktree before I could stage it. Then at `npm run close`, the fast-forward of the main checkout was *skipped* — the still-untracked copy on main collided with the now-tracked incoming file. I resolved it by `mv`-ing the redundant untracked copy aside (not `rm`) and `git merge --ff-only`.

**What I learned:** "Commit this untracked file" is a two-checkout problem: the content must be brought into the worktree, and the original untracked copy on main becomes a fast-forward obstacle that needs moving aside afterward.

**The rule:** **To commit an untracked file via a worktree: copy its content into the worktree first, and at close expect the untracked copy on main to block the fast-forward — `mv` it aside, never `rm`.**

---

## 5. The read-before-write precondition caught a same-day TIL clobber

**What happened:** Writing *this very TIL*, my first `Write` went to `today-i-learned-2026-06-15-apple.md` — and failed with "File has not been read yet." That file already existed: a *different* APPLE session earlier today had committed its own TIL there. The precondition stopped me from silently overwriting a committed file; the convention is a `-2` suffix for a second same-day session.

**What I learned:** The "read before overwrite" guard isn't bureaucracy — here it was the only thing standing between me and erasing a teammate-session's committed work. Multi-agent + same-fruit-name-reused-across-sessions makes filename collisions real.

**The rule:** **A second same-day session by the same agent writes `today-i-learned-DATE-agent-2.md`; trust the read-before-write failure as a clobber alarm, not an annoyance.**

---

## What landed (this session)

| Artifact | Change |
|---|---|
| `tests/.../interpreter-runtime-errors.*` | rem-by-zero regression coverage (#1377) |
| `tests/new/linker.unit.spec.js` | truncated-module bounds tests; off-by-one refuted (#1380) |
| `docs/project-gotchas.md §9` + `assembler.js:40` | documented `REPORT_MULTI_ERRORS` asymmetry (#1389) |
| `src/core/assembler.js` + `assembler.unit.spec.js` | `onProgress` hook; seam silent, CLI parity preserved (#1397) |
| `docs/research/claude-bugs-audit-2026-06-06.md` | committed + annotated with lineage (#1403) |
| Tickets filed | #1378, #1384, #1402, #1404; tracker #1180 closed |

## Open threads

- #1402 (SEXT provenance) is parked behind #159 (Prof. Dos Reis ruling) — the only hard blocker in the family.
- #1352 / #1404 (god-object spikes) and #1378 / #1384 (robustness) remain actionable.

## Related artifacts

- [TIL 2026-06-15 APPLE (session 1)](./today-i-learned-2026-06-15-apple.md)
- Tracker #1180; blocker #159; rule-promotion ticket #1285
- Process footgun: batching ≥2 state-changing Bash calls trips the stale-read hook — serialize them. Issueless PM velocity rows need `velocity:log --from-main`.
