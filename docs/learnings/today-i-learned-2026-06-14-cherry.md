# TIL 2026-06-14 — CHERRY

**Context:** A single threaded session that ran the full lifecycle of one ticket and its
follow-up: review → revise → implement → close. I reviewed #1114 (the fenced test-spec
reader) with `/issue-review-skill`, revised it, built `loadFencedSpec`, then built and
closed its CLI-wiring follow-up #1240, and finally chased down a test red that turned out
to already be fixed. Four lessons, all about *where the truth lives*.

---

## 1. Review a ticket against the shipped sibling code, not just its prose

**What happened:** #1114 asked for a pure seam `loadFencedSpec(text)` returning "the **same**
internal spec object" as the already-shipped JSON loader #1090. The prose read clean. But
opening the sibling — `src/testrunner/specLoader.js:38` — showed `loadTestSpec(buffer,
baseDir)` resolves `program` to an *absolute path via `baseDir`*. A one-argument
`loadFencedSpec(text)` *cannot* produce the same object: there is no `baseDir` to resolve
against. The contradiction was invisible in the ticket and obvious in the code.

**What I learned:** The issue-review rubric scores "context sufficiency" and "success
criteria," but the highest-value check isn't in the rubric — it's diffing the ticket's
claimed contract against the concrete code it claims parity with. "Same object as #1090" is
a *testable assertion about shipped code*, and shipped code is ground truth.

**The rule:** **When a ticket claims parity with existing code, open that code and verify the
claim is satisfiable before calling the ticket ready.** (Instance of the standing "test
against artifacts, not memory" discipline.)

---

## 2. Reproduce a worktree test red on *current main* before debugging it

**What happened:** Running the full suite inside my #1114 worktree, `puzzle-velocity-csv.unit.spec.js`
went red on six blank-`model` rows. I dug into the shared DB, confirmed the rows were real
(other agents' Codex-skill work), and was about to characterize it as a live bug. Then I ran
the same test on the *synced main checkout* — green, 6/6. The worktree had been cut from
`9cb2569`, a base *predating* #1215, which had already changed that test from hard-fail to
"notice-not-prevent." My worktree was running a months-old version of the test against
today's data. The "bug" was a stale-base artifact; once my closes rebased onto current
origin/main, it evaporated.

**What I learned:** A worktree freezes *both* the code under test and the tests themselves at
its base commit. A failure there can be a defect that `main` already fixed. The cheapest
disambiguation is one command: run the same test on current `main`.

**The rule:** **A test red inside a worktree is a hypothesis, not a finding — reproduce it on
current `main` first.** Filed as #1242 to land in `docs/do-this-not-that.md`.

---

## 3. A failing test's inline issue-reference is a hint, not an attribution

**What happened:** The failing test carried a comment citing `#940 tracks the isolation
fix`, so I initially blamed #940. But #940 (CLOSED) was a *different* bug entirely — the
worktree-guard masking `velocity-log.unit.spec.js` validation tests. The actual resolution
of what I saw was #1215. Trusting the inline reference would have had me re-open or comment
on the wrong ticket.

**What I learned:** Code comments referencing issue numbers drift like any other doc. The
number is a starting point for `gh issue view`, never a substitute for it. I nearly
mis-attributed root cause because a comment *sounded* authoritative.

**The rule:** **Verify an issue reference with `gh issue view` before attributing a cause to
it — adjacent issue numbers in comments are pointers, not proof.**

---

## 4. Defer the genuine design decision to its own ticket — and surface it to the human

**What happened:** Wiring `loadFencedSpec` into the CLI needed one real decision: how does
`lcc --test <spec>` tell a fenced file from a JSON one — extension, or content-sniff? I had
a strong default (content-sniff: `{` ⇒ JSON, else ⇒ fenced, since the two formats can't be
confused), but it changes how teachers/students name files. Rather than invent the
convention inside #1114's approved seam-only scope, I filed it as #1240 and put the choice
to the human via `AskUserQuestion`. The human picked content-sniff; I implemented it with
the ruling recorded as a ticket comment first.

**What I learned:** "It's a trivial choice, I'll just pick it" is exactly the rationalization
scope discipline exists to stop. A user-facing convention deserves a recorded decision, even
when one option is clearly better. Splitting the seam (#1114) from the wiring+convention
(#1240) also kept each commit's scope honest.

**The rule:** **A user-facing convention is a decision to record and route, not a default to
inline — split it into its own ticket and get the ruling in writing.** (Instance of the
standing scope-discipline rule.)

---

## What landed

| Artifact | Change |
|---|---|
| `src/testrunner/specLoader.js` | `loadFencedSpec(text, baseDir)` — bespoke-fenced reader, shared object shape (#1114) |
| `src/cli/lcc.js` | `loadSpec` now content-sniffs JSON vs fenced (#1240) |
| `tests/new/fencedSpecLoader.unit.spec.js` | 19 unit tests for the fenced grammar |
| `tests/new/lcc.test-spec-dispatch.integration.spec.js` | 5 dispatch tests incl. a real `lcc --test` e2e |

## Open threads

- #1242 — add the stale-base diagnostic to `docs/do-this-not-that.md` (authority path for lesson 2).
- #1093 / #1094 — remaining test-runner lane work (e2e mode matrix; teacher/student docs).
