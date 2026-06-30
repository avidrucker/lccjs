# TIL 2026-06-29 — APPLE (session 3)

**Context:** A four-ticket arc across both ports: executed a handoff to finish `pmtools#103` (ice cross-port byte-parity + CONTRACT.md), created the 15-epic roadmap for `lccjs#1217`, built the `npm run audit:closes` detector for `lccjs#1234`, and groomed-then-ran the `lccjs#1448` classifier-authorization spike. The throughline: where my *recommendation* met the *human's reserved decision*, and where running the real thing beat reasoning about it.

---

## 1. Live verification beats unit-tests-plus-source-reading — every time

**What happened:** Building the `audit:closes` detector (#1234), my pure `classifyClose()` seam had 11 green unit tests. I almost shipped on that. Instead I ran the real CLI against the last 12 closed issues — and #1530 came back `n/a` (not a puzzle close) when it should have been `missing` (puzzle close, no audit line). The cause: its closing comment was ``Closed in `7727ca0` `` — a **backtick-wrapped sha** — and my `CLOSE_RE = /closed in\s+[0-9a-f]{7,40}/i` choked on the backtick. My unit fixtures all used bare shas (`Closed in deadbeef`), so they were green *and wrong about the real data shape*.

**What I learned:** Unit tests only prove the code does what I *assumed* the inputs look like. They can't catch a wrong assumption about the input format itself — only contact with real data does. This is the same lesson the showcase work learned the hard way (#985/#986/#987: "source reading is not sufficient"), now in a non-UI context. I fixed the regex to `\b\W*` between phrase and sha, added a backtick fixture, and the live run immediately reclassified #1530/#1531 correctly — and the tool found 4 real audit-line omissions on its first real run.

**The rule:** **Before shipping a detector/parser, run it against real production data, not just fixtures — the bug you can't unit-test is the one in your assumption about the input's shape.** (Authority: reinforces the live-verify discipline in `docs/do-this-not-that.md` / #985–#987.)

---

## 2. When the human reserves a decision, my recommendation is an input, not the answer

**What happened:** Twice in one session my well-reasoned recommendation was *not* what the human chose:
- **#1217** (epic taxonomy): I recommended a **12-epic** set (Education as a roadmap section, debt categories as labels). The human picked the **maximal 15** — every initiative its own epic.
- **#1448** (classifier authorization): I researched it, concluded **(a) allowlist `gh issue create`** was the clean fix, and laid out the trade-off. The human chose **(b) keep it approval-gated** and asked to be prompted each time.

In both cases I had *surfaced* the decision (AskUserQuestion for #1217; a free-text ask for #1448) rather than acting on my recommendation — so the divergence was a clean hand-off, not a correction.

**What I learned:** On a genuinely reserved decision, the value I add is a sharp recommendation *with its trade-off*, not the decision itself. Had I auto-executed my #1448 "(a) allowlist" conclusion, I'd have broadened a permission the owner deliberately keeps narrow. The recommendation being *technically* better (less friction) was irrelevant — the owner's goal was the deliberate checkpoint, and **the convenient engineering answer is not automatically the right answer.**

**The rule:** **Surface reserved decisions with a recommendation + trade-off, then defer; "my analysis says X" never upgrades to "so I did X" on a human-owned call.** (Authority: #1448 landed in `docs/issue-commenting-policy.md`; memory `feedback-ask-before-filing-children`.)

---

## 3. `assess-goal` + `yegor-personas` is a precise ticket-grooming combo

**What happened:** Asked to take #1448 to 15/15, I ran the goal-review skill first (it was 13/15), then `assess-goal` and `yegor-personas`. `assess-goal` scored the ticket's goal **Mixed (2.5/5)** — it had tangled the *spike-decision* with the *implemented-fix*. `yegor-personas` convened on the real fork ("one spike or spike+DEV?") and converged spike-only: `spikes` + `microtasks` (≤60m budget) settled it objectively, `architect` backed the decomposition, and the `REQ` voice caught the irony that *a ticket about acceptance-criteria-as-authorization had under-specified acceptance criteria.*

**What I learned:** The two skills do different jobs that compose well: `assess-goal` diagnoses whether the *objective* is well-formed (SMART↔VAPID axes); `yegor-personas` resolves a *structural fork* (scope/decomposition) by authority, not vote. Used together they turned a vague "make it better" into three specific edits (explicit Acceptance, spike-only scoping, numbered questions) that moved the two weak rubric axes from 2→3.

**The rule:** **For a fuzzy ticket, run `assess-goal` on the objective and `yegor-personas` on the scope fork — diagnose the goal and the decomposition separately, then edit.**

---

## 4. The cross-port close-cwd footgun (lccjs ≠ pmtools)

**What happened:** Fresh off a pmtools close (`pmtools close <N>` runs from the **main root**), I tried `npm run close` for lccjs#1217 from the main root too — rejected: *"current branch main is not a worktree branch."* lccjs `npm run close` must run **from inside the worktree**. One wasted attempt.

**What I learned:** The twin-port harnesses invert this one detail, and the muscle memory from one repo actively misfires in the other. Folded the contrast into the `use-npm-run-close` memory so the next cross-repo session doesn't repeat it.

**The rule:** **lccjs → close from the worktree; pmtools → close from the main root. Don't carry one repo's close-cwd habit into the other.**

---

## What landed

| Artifact | Change |
|---|---|
| `pmtools tests/integration.sh` + `CONTRACT.md` | ice cross-port byte-parity block (updated_iso neutralized) + `### ice schema` (#103) |
| `lccjs docs/research/952-initiative-overview.md` + 15 EPIC issues + index | refreshed initiative taxonomy → #1536–#1550 + index #1551 (#1217) |
| `lccjs scripts/audit-closes.js` + `npm run audit:closes` + tests | post-hoc detector for missing `error self-audit:` lines (#1234) |
| `lccjs docs/issue-commenting-policy.md` | "Acceptance criteria are not authorization" — issue creation stays approval-gated (#1448) |

## Related artifacts

- Sibling sessions today: [TIL APPLE](./today-i-learned-2026-06-29-apple.md), [TIL APPLE-2](./today-i-learned-2026-06-29-apple-2.md)
- Issues #103, #1217, #1234, #1448 · epics #1536–#1551
- Memory: `feedback-ask-before-filing-children`, `use-npm-run-close` (cross-port contrast)
