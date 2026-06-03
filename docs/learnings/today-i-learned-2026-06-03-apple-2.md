# Today I Learned — 2026-06-03 (APPLE-2)

**Date:** 2026-06-03  
**Agent:** APPLE  
**Context:** Decision-issue audit (#549) — reviewing five open `decision`-labeled issues
to confirm block status or post rulings so downstream work can proceed.

---

## 1. A "blocked" label can go stale when its dependency closes

Issue #40 (OB-008, `mov` rejecting negatives) had two sequential blockers recorded in
comments: first Charlie's range decision for `mov` (#31), then Prof. Dos Reis's reply.
But #31 closed months ago with Charlie's ruling confirmed. Nobody updated #40's block
context, so the issue still looked like it was waiting on Charlie — when actually the
block had evolved: the decision is made, only a human email-send step remains.

**The rule:** when a dependency issue closes, check whether any issue that names it as
a blocker has been updated. A stale block comment leaves the next agent confused about
what's actually needed.

---

## 2. "human-decision-required" is a hard gate — don't approximate with a research comment

Issue #518 (ARC: validate ct=0 shift decision) has three well-formed proofs in its body
and a comment already pinging Charlie. An AI agent reviewing the audit is tempted to
"confirm" the proofs as a de-facto ruling. That would be wrong: the label exists because
the decision has ISA-level implications (hardware behavior, course spec) that only the
architect can weigh. A confirmation comment from an AI agent would look like a ruling
but carry no authority.

**The rule:** when `human-decision-required` is set, the correct audit output is
confirming the block is still valid and the decision package is ready — not approximating
the decision itself.

---

## 3. A ticket that says "deferred" is not waiting for a decision — it's already decided

Issue #234 (inline estimate analysis) was labeled `decision` but its body opens with
"**deferred** — address only in a dedicated estimate/calibration session." The behavior
fix (no inline analysis during normal work) was captured in agent memory at filing time.
The decision is made; the ticket is open only as a tracker for the deferred calibration
work.

Auditing this as "needs a ruling" would be wrong — the ruling was the act of filing the
ticket. The right audit output is confirming the decision is in effect and the remaining
work is correctly deferred.

**The rule:** check whether a `decision` label means "we need to decide" or "we decided,
and the ticket tracks what follows." The body usually makes this clear.

---

## What landed

| Issue | Action |
|---|---|
| [#518](https://github.com/avidrucker/lccjs/issues/518) | Block confirmed valid; awaits Charlie architect sign-off. |
| [#234](https://github.com/avidrucker/lccjs/issues/234) | Decision already in effect; ticket correctly deferred. |
| [#225](https://github.com/avidrucker/lccjs/issues/225) | Rule confirmed (tracker → no row; scope-spike → one row; spike → one row; child → one row). Implementation phase can proceed. |
| [#159](https://github.com/avidrucker/lccjs/issues/159) | Block confirmed valid; awaiting Prof. Dos Reis reply. |
| [#40](https://github.com/avidrucker/lccjs/issues/40) | Block context updated: #31 closed, Charlie's decision made; current block is human email-send only. |
| [#549](https://github.com/avidrucker/lccjs/issues/549) | This audit. |
