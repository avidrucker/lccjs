# TIL 2026-06-16 — APPLE

**Context:** A long orchestration-and-implementation session. I ran `fruit-agent-orchestrate` twice for an 11-agent, three-runtime roster (7 Claude / 2 Codex / 2 Hermes), then closed two tickets end-to-end — #1271 (apply the `runtime:hermes` label) and #1246 (content-inference for the `label-area` workflow) — and filed three follow-ups (#1420, #1427) plus this TIL. The throughline: most of the value came from *routing by runtime* and from *surfacing decisions* rather than guessing.

---

## 1. The orchestration skill has no concept of runtime — I was the router

**What happened:** The user added Codex (HONEYDEW, INCABERRY) and Hermes (JACKFRUIT, KIWI) agents alongside the seven Claude fruits. I routed Hermes-only verification tickets (#1077/#1080–84) to the Hermes agents and code refactors to Codex. It felt like the skill did this — it didn't. A `grep -niE 'runtime|hermes|codex'` against both copies of `fruit-agent-orchestrate/SKILL.md` returned **zero matches**. The roster is hard-coded to the seven Claude fruits; assignment is by `area:*` cluster + role only. The runtime routing was entirely my own reasoning layered on top.

**What I learned:** When a skill produces a good result, that does not mean the skill *contains* the logic. The quality can be coming from the model improvising over a gap in the skill. That improvisation is invisible until something probes it (here, a literal grep) — and it doesn't survive into the next session or a less-capable agent.

**The rule:** **Before crediting a skill for an outcome, grep the skill for the mechanism — if it's not in the text, it's model improvisation and belongs in a ticket, not in your confidence.** (Filed as #1420.)

---

## 2. #1271 closed the *label*, but left data with no consumer

**What happened:** #1271 asked to create `runtime:hermes` and apply it to the Hermes-only tickets. The label already existed; I applied it to the 6 open tickets and closed. But closing it produced a half-finished state: the label is now machine-readable, yet **nothing reads it** — the orchestration skill (lesson 1) still routes by hand. A "machine-readable signal" with no consumer is inert.

**What I learned:** A deliverable framed as "make X available" can pass its own acceptance criteria while delivering no behavior change, because availability ≠ consumption. The gap is easy to miss precisely because the ticket is genuinely "done."

**The rule:** **When a ticket only *produces* a signal (a label, a flag, a field), check whether anything *consumes* it before calling the loop closed — and if not, file the consumer ticket in the same breath.** (Did so: #1420.)

---

## 3. "No YAML" has a platform-mandated exception — and a thin-shim escape hatch

**What happened:** I assigned #1246 (improve `label-area.yml`) and the user challenged it against the project's "don't default to YAML" preference. The file is a **GitHub Actions workflow** — GitHub only reads workflows as YAML; there is no alternative format. So the rule (which is about formats *we choose* for config/spec) doesn't apply. But the *spirit* still can: I kept the workflow YAML a thin shim (`checkout` → `github-script`) and put the actual inference in a pure, unit-tested Node helper (`scripts/infer-area-label.js`). Logic in JS, YAML minimal.

**What I learned:** A format preference can have hard external exceptions, and the right move isn't to abandon it but to honor its *intent* within the constraint — push the logic out of the mandated format into a testable seam.

**The rule:** **When a rule's format is forced by the platform, satisfy the rule's intent instead: keep the mandated file a thin shim and move the real logic into a zero-dep, testable module.**

---

## 4. A scoped `permissions:` block silently defaults everything else to `none`

**What happened:** Rewiring `label-area.yml` to a thin shim required `actions/checkout`. The existing `permissions:` block granted only `issues: write`. Once you specify *any* `permissions:` in a workflow, every scope you *don't* list is set to `none` — so `actions/checkout` would have failed for lack of `contents: read`. I added it explicitly.

**What I learned:** `permissions:` is allow-list-with-implicit-deny, not additive. An existing narrow block is a trap when you add a step that needs a new scope — the failure only shows up at CI run time, not locally.

**The rule:** **Whenever you add a workflow step, re-derive the full set of token scopes it needs and add every missing one to `permissions:` — a present block grants nothing it doesn't name.**

---

## 5. Surface an acceptance-criteria tension as a fork; don't resolve it silently

**What happened:** #1246's criteria pulled two ways on one case: AC1 said "uncategorized *only* when nothing matches" (always pick a lane when a rule matches); AC4 said "ambiguous/low-confidence → uncategorized." On a **tie** between two areas these conflict. I implemented the conservative reading (tie → uncategorized), but instead of just shipping it, I presented the fork to the reporter with both behaviors previewed and a recommendation. They ratified conservative.

**What I learned:** When two acceptance criteria genuinely contradict on an edge case, picking one silently is a coin-flip dressed as a decision. The reporter owns that call. A one-line policy (the tie-break) is exactly the kind of thing worth a 30-second confirmation rather than a post-hoc "I assumed…".

**The rule:** **When acceptance criteria conflict on an edge case, implement the safer reading but surface the fork to the reporter with both outcomes shown — ratify, don't assume.**

---

## 6. Let live data reframe a request before filing it

**What happened:** The user asked to file a ticket assessing how `inferArea` categorizes "20+ uncategorized tickets," and asked the count "coincidentally." The count was **1** (#1296). So the requested 20+ sample doesn't exist. Rather than file the ticket as literally asked (and have it be unworkable), I reframed it as a **backtest against 20+ already-labeled issues** — strip the human label, infer, compare to ground truth — which is both feasible now and stronger. Filed as #1427 with the count finding baked into its Context.

**What I learned:** A filing request can rest on a premise that one cheap query falsifies. Checking the premise *before* writing the ticket turned an unworkable ask into a better-scoped one.

**The rule:** **Run the cheap count/probe that a filing request assumes, before writing the ticket — if the premise is false, reframe the ticket around what's actually true and say why.**

---

## What landed

| Artifact | Change |
|---|---|
| `scripts/infer-area-label.js` | New pure `inferArea(title, body, labels)` — content→`area:*` inference (#1246) |
| `tests/new/infer-area-label.unit.spec.js` | 21-case unit test over real titles + edge cases (#1246) |
| `.github/workflows/label-area.yml` | Rewired to thin shim; `runtime:hermes` routing precedent; `contents: read` added (#1246) |
| `runtime:hermes` label | Applied to #1077/#1080–84 (#1271) |
| #1420, #1427 | Follow-ups filed (consumer for the runtime label; inferArea accuracy backtest) |
| `docs/orchestration-review-2026-06-16.md` | Orchestration-efficacy review (round-1 vs round-2) |

## Open threads

- **Efficacy gate (#1211/#810):** two orchestration rounds logged; round-1's slate had near-total follow-through (assigned tickets closed or in-flight by the routed agent). This is sample #2 — still not a trend. Needs a sustained assignment→close rate to claim improvement.
- **Authority path:** the six rules above are narrative-only. They map onto existing tickets (#1420, #1427) for the mechanism gaps, but the *general* lessons (lessons 3–6 especially) have no `RULES.md` home yet — candidate for a future RULES promotion if they recur.

## Related artifacts

- Issues #1271, #1246 (closed this session); #1420, #1427 (filed); #1211 (orchestration tracker); #1058 (live-event confirmation)
- `docs/orchestration-review-2026-06-16.md`
