# TIL 2026-06-29 — GRAPE

**Context:** A long session that started with a cross-repo parity deliverable (#1487, the lccjs↔pmtools ticket-lifecycle spec) and turned into a run of process work: unsticking a ticket no single agent could close, then promoting three recurring `docs/learnings/` lessons into hard `RULES.json` rules (#1486, #1319, #1285) and filing a spike to extract the rules system itself (#1521). The throughline: the rules I added kept paying off on the very next ticket.

---

## 1. A ticket no single agent can close is a framing defect — close your half, split the rest

**What happened:** #1487 asked me to author the lccjs lifecycle spec AND prove byte-parity with pmtools#92, with acceptance demanding *"independent verification by a DIFFERENT agent"* and a *lockstep* close of both repos. I authored the spec cleanly — but then there was no legal way for me, as the sole author, to *close* it: I can't be my own independent verifier (yegor-simba/review: the owner doesn't report completion), I can't self-bless a merge to `main` (yegor-merge-gate + Rule `emerald-quokka`/R008), and a verifier subagent I spawn is exactly the "looks the same to me" rubber-stamp the ticket warns against. So the work sat **authored but not closed** — stranded mid-way.

The human named the real problem: *"individual agents can't take and close a single ticket … we need to be able to close tickets and file follow-ups so work doesn't get stuck mid-way."* I ran it through a `yegor-personas` council, which converged on: the author closes the **single-agent deliverable**, and the cross-agent part (independent verification + lockstep) becomes its **own follow-up ticket**. With the reporter's authorization I amended #1487's acceptance (redlining the moved items non-destructively), closed it on the authored-spec deliverable, and filed #1518 for the verification + #1513 for the root-cause diagnosis.

**What I learned:** A correct application of the discipline (independence, no self-merge, reporter-closes) can *still* produce a stuck state — and that stuck state is itself the bug, not a virtue. The fix isn't to bend a rule; it's to recognize the ticket was framed with no single-agent completion path and **re-cut the deliverable** so each agent can always either close something or file a follow-up. Never leave work parked "authored but open."

**The rule:** **A ticket with no single-agent close path is a decomposition defect — close the single-agent half and split the cross-agent/cross-repo rest into a follow-up; the reporter (usually present) can authorize amending the acceptance.** Captured in the `feedback-no-stranded-mid-way-tickets` memory; root-cause tracked in #1513.

---

## 2. Promote a recurring `docs/learnings/` lesson to a hard rule — then watch it pay off the same session

**What happened:** Three back-to-back process tickets each promoted a long-recurring lesson from `docs/learnings/` + memory into `RULES.json` (which renders the committed `RULES.md` via `npm run rules:render`; rules carry a stable `color-animal` stem id + a `text_sha` content hash for versioning):

| Rule | id | Lesson |
|---|---|---|
| #1486 | `teal-heron` (R030) | verify live state, don't assert from memory |
| #1319 | `crimson-otter` (R031) | scope-overrun gate: "did the user ask for THIS?" |
| #1285 | `olive-falcon` (R032) | verify a prescribed fix's *mechanism*, not just that the bug is real |

The striking part wasn't the authoring — it was that **each rule immediately caught something in the next ticket**:

- `teal-heron` (verify live state): #1319's body said *"Blocked by #1185 — do not start."* Instead of trusting it, I re-queried — #1185 was **CLOSED** and I'd literally *used* its tooling minutes earlier. The "blocker" was stale. The same check caught that the ticket's suggested `legacy_id: R027` was already taken (I'd just minted up to R030), so I used R031.
- `olive-falcon` (verify the prescribed fix): #1285 *prescribed* "add a RULES rule," and its acceptance demanded a human placement decision. Rather than auto-minting, I probed the prescription, found the lesson was borderline (universal kernel vs task-specific mechanic), and **surfaced the fork** via `AskUserQuestion` instead of silently choosing — which is precisely what the rule says to do.

**What I learned:** The authority-path rule (#548 — a lesson that lives only in `docs/learnings/` expires) isn't bureaucratic overhead; a promoted rule starts *working* immediately because it's re-read every task. And the most convincing test of a freshly-minted rule is whether you'd have violated it on the very next ticket without it. I would have, twice.

**The rule:** **When a lesson keeps recurring across sessions, stop re-learning it — promote it to `RULES.json` (or file a ticket to), because a rule in the constantly-re-read ruleset pays off on the next task, not someday.** All three rules are now in `RULES.md`.

---

## 3. The inclusion criterion is a real gate — not every good lesson belongs in `RULES.md`

**What happened:** #1285's acceptance explicitly asked for a *human decision*: RULES rule vs `docs/project-gotchas.md` entry vs decline. The "verify a prescribed fix" lesson has two layers — a **universal kernel** (don't implement a prescription blindly; surface design forks) and a **task-specific mechanic** (probe call ordering / affected code paths, the #1238 exemplar). The inclusion criterion in `RULES.json`'s preamble explicitly relegates task-type-specific guidance to `pitfalls.md`/`project-gotchas.md`. So I split it: the universal kernel became the rule *text*; the code-mechanism detail and the #1238 exemplar went in the rule's `comment`, per the #842 lean-text/comment split.

**What I learned:** "This is a true and useful lesson" is necessary but not sufficient for a `RULES.md` slot. The bar is *universal* — violating it on a *random* task must be plausible and harmful. A DEV-flavored mechanic fails that bar even when the principle behind it passes; the move is to extract the universal kernel and route the specifics to the task-type doc.

**The rule:** **Before minting a rule, separate its universal kernel from its task-specific mechanics — the kernel earns the lean `RULES.md` text, the mechanics go in the comment + `project-gotchas`/`pitfalls`.**

---

## What landed

| Artifact | Change |
|---|---|
| `docs/ticket-lifecycle-spec.md` | New authoritative lccjs ticket-lifecycle spec (#1487, closed on the single-agent deliverable) |
| `RULES.json` / `RULES.md` | +3 rules: `teal-heron` (R030, #1486), `crimson-otter` (R031, #1319), `olive-falcon` (R032, #1285) — 22→25 active |
| Filed #1513 | Root-cause: why a ticket can have no single-agent close path |
| Filed #1518 | The split-out independent parity verification + lockstep close |
| Filed #1521 | Spike: extract the rules mint/render system into a config-driven tool (named `rulesmith`) |

## Open threads

- #1518 needs a *different* agent (not GRAPE) to do the independent lccjs↔pmtools parity verification once pmtools#92's spec is ready.
- #1513 (root-cause of the stuck mid-way state) wants an *impartial* agent — GRAPE has a stake (hypothesis B is GRAPE's own interpretation).
- #1521 (`rulesmith`) is scoped but unstarted; design questions (repo shape, per-project config, JSON-vs-markdown) are the spike's job.

## Related artifacts

- Issues #1487, #1486, #1319, #1285, #1513, #1518, #1521
- Rules `teal-heron` (R030), `crimson-otter` (R031), `olive-falcon` (R032) in `RULES.md`
- Memory: `feedback-no-stranded-mid-way-tickets`
