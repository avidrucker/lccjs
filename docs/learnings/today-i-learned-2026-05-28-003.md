# Today I Learned — 2026-05-28-003

Date: 2026-05-28
Context: PM/QA session — answered "how are our tests looking?", then triaged and
filed the highest-value missing test coverage as scope tickets. Landed #171
(linker relocation/output-format coverage) and #172 (picture.js/hexDisplay.js
extract-then-test). Confirmed the plus/ gap was already #166 and did not
duplicate it.

---

## 1. "File these as puzzles" means a GH ticket, not an `@todo` in source — yet

The generic `yegor-pdd` skill says: write the `@todo #N:Mm/ROLE` marker *at the
exact code site*, now. Following that literally here would have been wrong. This
project's *documented* convention (the body of #166 and the header comment of
`scripts/puzzle-status.js`) is the opposite for scope tickets:

- the **parent ticket is a GitHub issue**, and
- the child `@todo` marker is dropped **at the file head only when the puzzle is
  claimed** into a worktree — never at filing time.

Two structural facts make this load-bearing, not stylistic:
- `.pddignore` excludes `*.md` and `docs/**`, so doc/test-coverage "puzzles" are
  *not* pdd-scanned at all — they are GitHub-tracked instead. A marker in a doc
  would be invisible to the scanner.
- `puzzle-status.js` derives *claimed / orphaned* state by joining markers ↔
  worktrees ↔ issues. A marker sitting in source with no worktree reads as an
  idle, grabbable puzzle — so pre-seeding five markers for one cohesive effort
  would lie to the reconciler.

**The rule:** when a project documents its own PDD convention, that overrides the
skill's default phrasing. Filing = the GH issue in BDD shape; markers come at
claim. I applied no `pdd-tracked` label for the same reason — it means "marker
exists in source," which isn't true until claim.

## 2. Read the tracker before filing — the backlog moves under you

The user asked for "a research ticket for `src/plus/`." I was one `gh issue
create` away from filing it when `gh issue list` showed **#166 already covered it**
— a scope ticket filed earlier *the same day* by a parallel agent, already
enumerating per-file child puzzles. With three other worktrees live (164, 165,
til-002), the backlog is a moving target; checking it first turned a duplicate
into a one-line "already tracked, here's the link." Same check confirmed #171/#172
had no existing twin (searched open *and* closed).

## 3. "Highest-value test" = risk × testability, not coverage %

The user's intuition was to test linker, picture, and hexDisplay. A 10-minute
read of the actual modules reordered the value:

- `picture.js` / `hexDisplay.js` look like easy wins but are **zero-export CLI
  scripts** — all logic inline with `fs`/`console`/`process.exit`. They can't be
  unit-tested without a refactor first, and their failure mode is *visible* output
  (easy to eyeball). Refactor-gated + low-risk = lower ROI than they appear.
- The real prize was the **linker relocation math** (`adjustExternalReferences`,
  `adjustLocalReferences`): already pure and exported, but only its *error paths*
  are tested — the actual bit-mask address arithmetic is unasserted, and its
  failure mode is *silent* machine-code corruption that still loads and "runs".

Coverage % alone would have ranked all three equally as "0% / undertested." The
ordering came from asking *how does this fail, and how cheap is it to assert?*

## 4. Severity follows failure-visibility, not size

#171 → `severity:medium`: silent corruption, and the 3-demo oracle e2e only
catches gross mismatches without localizing them. #172 → `severity:low`: dev
tools whose output a human reads directly. The bigger file count (#172 touches two
files + a refactor) did not raise its severity — what a wrong result *does to the
user* did.

---

## What landed

| Artifact | Change |
|---|---|
| [#171](https://github.com/avidrucker/lccjs/issues/171) | Scope ticket — linker relocation + multi-module + `createExecutable` byte-format coverage; 5 child puzzles ≤60m; `testing`/`scope`/`severity:medium`/QA |
| [#172](https://github.com/avidrucker/lccjs/issues/172) | Scope ticket — extract+cover `picture.js`/`hexDisplay.js` pure helpers; 4 child puzzles ≤60m; `testing`/`scope`/`severity:low`/DEV+QA |
| — | Confirmed `src/plus`/`src/extra` gap = existing #166; **not** duplicated |

No source files touched, no markers dropped, no velocity rows (filing ≠ closing).

## Related artifacts

- `scripts/puzzle-status.js` — the marker ↔ worktree ↔ issue reconciler whose
  contract drove lesson 1.
- `.pddignore` — why doc puzzles are GH-tracked, not pdd-scanned.
- #166 — the prior-art scope ticket whose body documents the "marker on claim"
  convention.
