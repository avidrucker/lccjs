# Today I Learned — 2026-05-29 (APPLE, session 2)

Date: 2026-05-29
Agent: APPLE
Context: A shorter second session, triage-driven. Closed **#168** (debug/format
unit tests), **#167** (extracted the duplicated CLI exit scaffolding into
`src/utils/cliExit.js`, −67 lines across 8 entry points), ran a spike on the
claim auto-fruit collision (**#193**) and graduated it into **#194/#195**, then —
at the user's request — ran a **self-audit of my own PDD/Yegor process adherence**
(**#203**). The audit is the spine of this session's lessons: it caught
discipline gaps I'd have sworn I was following.

---

## 1. "I followed the protocol" is a hypothesis — test it against artifacts, not memory

Asked to self-assess, my first instinct was to recall what I did. That would have
graded me generously. The honest signal came from **cross-checking against git**:
commit timestamps proved my `actual_min` logging was honest (good), but they also
proved **no commit ever flipped a marker to `@inprogress`** — the "claimed" signal
never reached `main` on any task, something I'd have *claimed* I did. Memory
self-confirms; artifacts don't.

**The rule:** audit process adherence against the durable record (git log, the
CSV, the diff), never against self-report. Treat "I did X" as a claim to verify,
especially when X is a step that leaves a trace.

## 2. Parallelizing calls can silently violate an *ordering* constraint

I batched `date` and `gh issue view <N>` in one parallel tool block every time —
efficient, and wrong. The protocol wants the **C estimate set *before* reading the
issue** (a blind forward prediction). Collapsing the two steps for throughput leaked
the spec before the prediction, quietly destroying the calibration signal on three
straight tasks.

**The rule:** parallelism is for *independent* work. When a protocol imposes an
order — predict, *then* read — keep the steps separate even when the tool calls
*could* run together. Speed that breaks a sequencing invariant isn't speed.

## 3. A step the *whole fleet* skips is doc-drift, not a discipline failure

The `@todo`→`@inprogress`-on-`main` flip: I skipped it — but so did banana (she
got the same `"consider flipping"` nudge on #152). When *every* agent misses the
same step, the cheap explanation ("agents are sloppy") is probably wrong. The real
cause: `puzzle:status` now reads the *worktree* as the claim signal, so the
on-`main` flip became redundant ceremony. That reclassifies the finding from
"discipline" to "stale doc," with a different fix (reconcile the doc, → #201).

**The rule:** cross-agent consistency in a "violation" is evidence about the
*rule*, not the agents. A step nobody performs is a candidate for deletion, not
enforcement.

## 4. Fixing *when* you predict doesn't fix *what you predict from*

The audit task itself (#203) was the experiment: I set its C estimate **before**
doing any analysis (the corrected ordering from lesson 2) — and it was *still* **9×
high** (35m predicted, 4m actual). So the read-ordering bug (F1) and the
over-padding bias (F5) are **independent**. The padding comes from anchoring on the
marker's *human* cap (30/60m) instead of my own recent actuals (TEST≈2m, DEV≈5m,
SPIKE≈4m).

**The rule:** when two defects look like one, isolate them with a controlled case.
Here, correcting the timing while holding everything else fixed proved the anchor
was the real culprit — and that fixing F1 alone would have left a 9× error standing.

## 5. A spike's best output is often the non-obvious *negative* result

For #193 the cheap finding ("identity is worktree-scoped") was already in banana's
report. The finding that earns the spike its 45 minutes was the **negative** one:
reconciling the code to its own header comment (scan *all* `<fruit>/*` branches)
**would not fix it**, because the close protocol deletes the branch too — so only a
session-lifetime artifact closes the gap. That's the result that stops the
implementer from shipping a plausible non-fix.

**The rule:** in a spike, actively hunt for why the *tempting* fix fails. Ruling out
the obvious-but-wrong path is usually worth more than restating the problem.

## 6. Match the container to the finding — not every finding is a ticket

The #193 spike and the #203 audit each produced a *mix* of outputs, and routing
them by type mattered: code fix → ticket (**#194**), doc fix → ticket (**#195**),
**behavior** fixes → a **feedback memory** (pre-flight checklist, no ticket),
doc-*drift* → fold into the **existing** #201 rather than file a near-duplicate.
Filing everything as tickets would have buried the behavior fixes where they'd
never fire, and duplicated #201.

**The rule:** sort findings by their nature before filing. Tickets are for
code/doc *work*; persisted memory is for *behavior* changes; an existing ticket is
the home for same-class drift. The container determines whether the fix actually
gets applied.

---

## What landed

| Artifact | Change |
|---|---|
| [#168](https://github.com/avidrucker/lccjs/issues/168) | **Closed** — `tests/new/debug.format.unit.spec.js`, 12 characterization cases for `h4`/`REG_NAMES`/`REG_ALIASES`. |
| [#167](https://github.com/avidrucker/lccjs/issues/167) | **Closed** — extracted the duplicated `isTestMode` + exit helpers into `src/utils/cliExit.js`; 8 entry points import it; −67 lines; `interpreterplus` keeps its `resetProcessStdin` wrapper. Full suite green. |
| [#193](https://github.com/avidrucker/lccjs/issues/193) | **Closed** (spike) — `docs/research/claim-fruit-session-scope.md`; identity is worktree- not session-scoped; recommended mandatory `--as` now + a session-sentinel branch if it recurs. |
| [#194](https://github.com/avidrucker/lccjs/issues/194) / [#195](https://github.com/avidrucker/lccjs/issues/195) | **Filed + graduated** — DEV session-sentinel fix (marker in `claim.js`) and WRITER docs fix (marker in `TODOS.md`). |
| [#203](https://github.com/avidrucker/lccjs/issues/203) | **Closed** (research) — `docs/research/process-adherence-self-audit-2026-05-29.md`; 6 adherence findings; behavior fixes persisted to the `process-adherence-fixes` agent memory. |

## Open threads for tomorrow

- **#188 keeps accreting concrete children** (#193, #194, #195, #201 are all
  instances of the multi-agent-coordination gap). It now has enough real cases that
  **re-scoping #188 as a spike** is high-leverage — the next-best move in this area.
- **F2 doc-drift** (the vestigial `@inprogress` flip) is proposed to **fold into
  #201**, not be filed separately — awaiting a go-ahead.
- **Tooling gap surfaced by this very doc:** `npm run claim` is issue-centric, so
  there's no clean worktree path for *non-issue* closeout edits (TIL, velocity,
  triage cleanup). Today I treated those as a main-branch carve-out limited to
  *zero-contention, uniquely-named* files (this TIL) — explicitly **not** the hot
  `TODOS.md`, which is what made my session's F3 edits a real violation. That
  distinction (safe-unique-file vs hot-shared-file) is worth writing into the
  worktree convention.

## Related artifacts

- `docs/research/process-adherence-self-audit-2026-05-29.md` — the #203 audit this
  TIL distills.
- `docs/research/claim-fruit-session-scope.md` — the #193 spike (lesson 5's negative
  result).
- [TIL 2026-05-29 (apple)](./today-i-learned-2026-05-29-apple.md) — session 1; its
  lesson 2 ("escalate the pattern, don't polish the workaround") is the same reflex
  that drove this session's self-audit.
- Agent memory `process-adherence-fixes` — the behavior-change checklist (lessons
  1–4, 6) in applied form.
