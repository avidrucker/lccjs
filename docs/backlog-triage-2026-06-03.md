# Backlog triage — 2026-06-03

Full open-issue sweep fulfilling #273 §3. Surveyed all 37 open issues (as of 2026-06-03).
Owner decides closes; this doc flags and organizes.

---

## 1. Close now — tracker children all resolved

| # | Title | Reason |
|---|-------|--------|
| #144 | Demo research questions: sext, jmp mnemonics, cea, gameSnake memory-leak | All 4 children closed (#150 ✓, #151 ✓, #152 ✓, #153 ✓). Tracker body still shows them unchecked but they are CLOSED on GitHub. |

**Action:** Owner closes #144 as complete.

---

## 2. Close-wontfix — pre-PDD legacy, superseded, or no actionable scope

| # | Title | Reason |
|---|-------|--------|
| #10 | Potentially create a syscall table | No body, no estimate, no PDD structure. Pre-PDD (Jan 2025). No one has expressed interest in 17 months. If ever wanted, re-file with a proper spec. |
| #11 | Add tetris with color symbol table and shape table based on rand values | No body, aspirational. Pre-PDD (Jan 2025). Can be re-filed as a real ticket if someone commits to it. |
| #27 | Update project to-do's, issues, readme | Pre-PDD vague catch-all (Aug 2025). #273 itself names it as a candidate to close once superseded. The PDD/tracker system has entirely replaced this kind of omnibus. |

**Action:** Owner closes #10, #11, #27 as wontfix.

---

## 3. Needs owner decision — unclear direction or scope

| # | Title | Issue | Recommendation |
|---|-------|-------|----------------|
| #5 | Cursor does not hide sometimes on Windows machine | Windows is not officially supported. Over 17 months old with no progress or Windows-specific test path. | Owner decides: in-scope (keep) or out-of-scope (close). |
| #12 | Browserify the lcc.js proof of concept | Has an old `browserify` branch with progress (early 2025 screenshots). Project has since grown significantly (LCC+, linker, multi-module). Branch is likely stale. | Owner decides: revive as a formal tracked effort or close. |

---

## 4. Label correction needed — blockers resolved

| # | Title | Stale label | Fix |
|---|-------|-------------|-----|
| #264 | WRITER: blank-.e-on-failed-assembly report/writeup | `blocked` (by #263) | #263 is now CLOSED. Remove `blocked` label; ticket is now available. |

**Action:** Remove `blocked` label from #264 so agents see it as AVAILABLE.

---

## 5. #273 §1 & §2 — tracker body needs checkbox updates

#273's body still shows §1 and part of §2 children as unchecked, but all are now closed:

| § | Issue | Status |
|---|-------|--------|
| §1 | #219 reconcile TODOS.md | CLOSED |
| §1 | #170 reconcile open_bugs.md | CLOSED |
| §1 | #230 agent-identity precedence | CLOSED |
| §2 | #218 parity backlog | CLOSED |

§2 remaining: #220 (open), #144 (all children closed — see §1 above).
§3: fulfilled by this triage document.
§4: #225 (open, valid), #234 (open, valid).

---

## 6. Blocked and valid — waiting on external events or prerequisite tickets

| # | Title | Blocker |
|---|-------|---------|
| #19 | Remove outdated/unused scripts | Unclear (no body); needs investigation |
| #40 | [OB-008] Track upstream: cuh63 6.3 mov rejects negatives | Blocked on Prof. Dos Reis reply |
| #159 | Act on Prof Dos Reis's reply re: `sext` semantics | Blocked on Prof. Dos Reis reply |
| #252 | Decomplect (H1b): lift trace + register-diff display | Blocked on #246 architecture decision (note: #246 is CLOSED — check whether this unblocks #252) |
| #255 | Decomplect (H4): group interpreter constructor state | Blocked on #246 decision (same note as #252) |
| #427 | Tracker: Tier 2 — velocity analytics, M2, H5 | Blocked on #426 (Tier 1) |
| #428 | Tracker: Tier 3 — N2, M4, DDD linker/lcc.js | Blocked on #427 |
| #429 | Tracker: Tier 4 — interpreter decomplect, experiments | Blocked on #428 |
| #430 | Tracker: Tier 5 — aspirational research | Blocked on #429 |
| #477 | feat: add joke mnemonic `etc` | Blocked (external file dependency) |

**Side-note on #252 / #255:** their stated blocker (#246) is CLOSED. Their `blocked` labels may be stale — the blocking dependency was the research/spike, which is done. Whether the work itself is now unlockable depends on the Tier tracker sequence (#426+). Owner or Tier 1 lead should verify.

---

## 7. Decision-gated — valid, but only owner can unblock

| # | Title | Decision needed |
|---|-------|----------------|
| #225 | Define which issues earn a velocity CSV row | Policy decision on logging scope |
| #234 | Estimate-vs-actual analysis surfacing | When/whether to run dedicated calibration sessions |
| #517 | ARCHITECT: follow-up decisions for #512 shift-count masking | 4 architectural questions from #512 |
| #518 | ARC: validate ct=0 shift decision | Feeds #512 range-check |
| #550 | HUMAN REVIEW: audit results from #532 | Three red flags needing owner action |

---

## 8. Active trackers — valid, self-managing

| # | Title | State |
|---|-------|-------|
| #220 | Core behavior + test-coverage backlog | Active; no children filed yet |
| #273 | This tracker | Being closed by this triage |
| #426 | Tier 1 — research program | Active; children in flight |

---

## 9. Humans-only / PM

| # | Title | Status |
|---|-------|--------|
| #507 | PM: send long-line silent-split report to Prof. Dos Reis | Awaiting human action; labeled `humans-only` |

---

## 10. Valid, available (keep as-is)

These issues are valid, correctly labeled, and do not need grooming:

| # | Title | Note |
|---|-------|------|
| #15 | Implement extra flags for verbose error messages | Well-specified; low priority |
| #99 | [Proposal] lcc -i: support .bin files | Explicitly deferred; proposal |
| #100 | [Proposal] lcc -i: support .hex files | Explicitly deferred; proposal |
| #202 | Research: assess gameSnake.ap code quality | Valid research spike |
| #264 | WRITER: blank-.e writeup | Unblocked (see §4 above); available |
| #272 | Design: off-TTY contract for interactive LCC+ | Valid research/design |
| #288 | Research: retire enrich.py | Valid post-migration task |
| #297 | Puzzle-ticket-resolution workflow is unmapped | Valid research |
| #349 | DEV: PostToolBatch serial-tool-use guard | Valid with findings from #316 |
| #422 | DEV (H6): picture.js / hexDisplay.js refactor | Valid, coordinates with #172 |
| #450 | No in-browser LCC highlighting on github.com | Valid proposal; Tampermonkey path |
| #554 | Inline comments cite closed issues | Valid cleanup, CLAUDE.md-backed |

---

## Summary

| Disposition | Count | Issues |
|-------------|-------|--------|
| Close — tracker complete | 1 | #144 |
| Close-wontfix | 3 | #10, #11, #27 |
| Needs-decision (scope) | 2 | #5, #12 |
| Label fix (remove blocked) | 1 | #264 |
| Blocked/valid | 10 | #19, #40, #159, #252, #255, #427–430, #477 |
| Decision-gated | 5 | #225, #234, #517, #518, #550 |
| Active trackers | 3 | #220, #273, #426 |
| Humans-only | 1 | #507 |
| Valid/keep | 12 | #15, #99, #100, #202, #264, #272, #288, #297, #349, #422, #450, #554 |
| **Total surveyed** | **37** | |

No duplicates found.
