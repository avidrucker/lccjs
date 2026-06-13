# TIL 2026-06-13 — BANANA

**Context:** My first assigned ticket this session was the test-runner CLI surface (#1092, parent SPIKE #1044). Rather than building it blind, the human had me run `issue-review-skill` first, then we walked the full yegor-pm loop — review → architect ruling → record on the tracker → courier build → close — and finally routed the loose ends to siblings #1093 (e2e) and #1094 (docs). These are the lessons that crystallised.

---

## 1. The architect ruling is the reporter's, and it happens *before* — never *inside* — the build

**What happened:** My issue review of #1092 surfaced exactly one real gap: should `lcc --test` accept JSON only, or dispatch by file extension so the open fenced reader (#1114) could drop in later? My instinct was "take it as-is and decide while coding." When the human asked how yegor-pm would advise, the `yegor-architect` skill answered sharply: *never mix architect mode (design in writing) and courier mode (execute) in one session.* So instead of improvising, I posed the decision to the human, they ruled (extension-dispatch seam), I recorded the ruling as a comment on #1092, and only **then** switched to courier mode and implemented.

**What I learned:** "Buildable" and "ready to build" are different states. #1092's dependencies were all closed, so it was buildable — but an open interface decision meant it wasn't ready until the design was *ruled and written down*. The reviewer's job (`yegor-review`) is to reject-by-default; a missing interface decision is a legitimate reason to bounce a ticket back for one sentence, not to "figure it out in the diff."

**The rule:** **An open design question is resolved by the reporter, in writing on the ticket, before any code — if you'd otherwise decide it mid-implementation, stop and get the ruling first** (anchors to `yegor-architect`, `yegor-tickets`).

---

## 2. Verify repo state over ticket prose — a *closed* sibling can hide the real question

**What happened:** The ticket said "calls the loader + runner cores (sibling children)" and `--test <spec.json>`. My first framing of the design question was wrong: I assumed `.yaml` should be reserved for the restricted-YAML front-end #1095. A 30-second check (`gh issue view 1095`) showed #1095 was closed **NOT_PLANNED** — YAML was *rejected* by the #1103 format research. The real choice was narrower and cleaner: JSON now (#1090, shipped) + fenced later (#1114, open). Reading `src/testrunner/` directly also gave me the exact signatures the ticket only gestured at: `loadTestSpec(buffer, baseDir)` and `runTestSpec(spec)`.

**What I learned:** Ticket text is a snapshot that drifts; the repo and the issue *states* are ground truth. A sibling being *closed* is not neutral information — `NOT_PLANNED` vs `COMPLETED` changes the design. I nearly anchored a recommendation to a dead ticket.

**The rule:** **Before ruling on a design question, read the actual code and the real `gh issue view` state of every sibling — including closed ones, where `stateReason` is part of the answer** (anchors to `feedback_claim_and_evidence_before_findings`).

---

## 3. Build the seam now with a typed-error default that names the follow-up — so the next ticket is a drop-in

**What happened:** The ruling was "extension-dispatch seam, JSON arm only." Concretely that became a `loadSpec(specPath)` with a `switch` on `path.extname`: a `.json` arm wired to `loadTestSpec`, and a `default:` that throws `TestSpecError("Unsupported test-spec format '.yaml': only .json is supported today (fenced format: #1114).")`. ~2 extra lines over a JSON-locked version.

**What I learned:** This is the difference between #1114 being a one-line drop-in (`default:` → `loadFencedSpec`) versus a CLI rewrite that re-touches `parseArguments` and `main()`. The typed-error default does double duty: it's correct runtime behaviour *and* a signpost — the error message itself cites the ticket that will fill the arm. It keeps #1114 inside the ≤60m `yegor-microtasks` cap.

**The rule:** **When a follow-up is already filed, leave it a typed seam, not a TODO — a `default:` arm that throws and names the ticket beats both gold-plating and a future rewrite** (design craft; anchors to `yegor-microtasks`).

---

## 4. Route follow-up info to live consumers, not the closed parent

**What happened:** After closing #1092 I had three "attention" points to log. The tempting move was a comment on #1092. But #1092 was now CLOSED — nobody opening #1093 (e2e) or #1094 (docs) scrolls a closed sibling. So the observable-contract note (reporter format, six exit paths) went on **#1093**, the doc-surface spec went on **#1094**, and the two pre-existing test reds needed nothing (already in the close comment).

**What I learned:** `yegor-tickets` ("if it isn't in the tracker, it didn't happen") has a corollary I'd been underweighting: *which* ticket. Information has a consumer; it belongs where that consumer will actually read it. A closed ticket is a write-only archive.

**The rule:** **Log forward-looking info on the OPEN ticket whose worker needs it, never on the closed parent that spawned it** (sharpens `yegor-tickets`).

---

## 5. Confirm a pre-existing red is already tracked before you report — or file — it

**What happened:** `npm test` showed two failures (`site-curation.spec.js` — missing `ignore` devDep; `puzzle-velocity-csv` — a model-less row). Both were in files I never touched. Before reporting them as "pre-existing and unrelated," I searched `gh issue list --state all` and found them already tracked: #1214 and #1215/#1133. So I filed nothing and cited the existing numbers.

**What I learned:** "Pre-existing red, not my change" is the start of the diligence, not the end. The honest report names the tracking ticket; the dishonest one either implies I broke it or double-files a duplicate.

**The rule:** **A red you didn't cause still gets a 10-second `gh issue list --state all` search — cite the existing ticket, don't re-file** (anchors to `feedback-search-closed-issues-before-filing`).

---

## What landed

| Artifact | Change |
|---|---|
| `src/cli/lcc.js` | `--test <spec.json>` surface: `loadSpec` dispatch seam, `runTestMode`, PASS/FAIL reporter + first-diff block, exit codes 0/1/2 (#1092) |
| #1092 | Design-ruling comment (JSON-dispatch seam) + close comment |
| #1093, #1094 | Observable-contract / doc-surface hand-off comments |

## Open threads

- The reporter's first-diff format (first-differing-line + `JSON.stringify`'d expected/actual) was my courier-time call. If a full unified diff is preferred, it should change *before* #1094 freezes it into the teacher/student guide.

## Related artifacts

- Issue #1092 (closed), siblings #1093, #1094, follow-up #1114; parent SPIKE #1044
- `docs/research/1044-yaml-test-runner-scope.md`
