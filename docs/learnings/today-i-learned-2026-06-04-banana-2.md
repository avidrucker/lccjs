# TIL 2026-06-04 — BANANA session 2

**Context:** Three tickets closed in a second BANANA session on 2026-06-04: #719 (formally
retire the full-corpus C-overshoot power study), #776 (dated test suite output snapshot),
and #771 (SVG favicon for the docs site). All three were PM/DATA/DEV work with no source
code changes.

---

## 1. Confirming file-level isolation before claiming a "conflicting" ticket

**What happened:** #771 (favicon) arrived with a warning: "wait until FIG's #772 is merged
if both touch the same HTML file." Before claiming, I ran `git diff --name-only` on FIG's
active worktree. FIG's #772 modifies `docs/site/showcase/index.html`; #771 needs
`docs/site/index.html`. Different files — no conflict at all.

**What I learned:** The original assignment was written conservatively without knowing which
exact HTML file each ticket touched. A 30-second diff check resolved the ambiguity and
removed a blocker that didn't exist. Waiting would have been wasted time.

**The rule:** Before deferring on a claimed conflict warning, verify the actual overlapping
files — `git diff --name-only` on the other agent's worktree takes seconds and may show
there is no conflict.

---

## 2. "Not feasible" needs a written record to stay decided

**What happened:** Q29r (#706) calculated that the full-corpus C-overshoot powered study
requires n=1,969 rows — 4.1× the 477-row corpus, ~47 months away at current logging rate.
The finding was solid but existed only in the issue thread. #719 was specifically about
writing it into `docs/puzzle-velocity.md` so the conclusion survives beyond that ticket.

**What I learned:** A decision that lives only in a closed issue is effectively invisible to
future agents. Any future agent scanning calibration docs would see no note about why the
full-corpus experiment wasn't running, and might propose it again from scratch. The cost of
writing a paragraph is trivial; the cost of re-doing the power analysis is not.

**The rule:** When a research ticket concludes "not feasible / not recommended," the finding
must be written into a durable doc (not just closed with a comment) before the ticket closes —
otherwise the decision evaporates.

---

## 3. Test suite snapshot: interpreting oracle "passes" correctly

**What happened:** Running `npm run test:oracle` with `LCC_ORACLE` unset returned
"124 passed, 0 failed." On a cold read that looks like 124 real passing tests. In fact all
124 auto-skipped — Jest reports skipped tests as passing, so the suite looks green regardless
of whether the oracle binary is present.

**What I learned:** The oracle suite pass/fail count is only meaningful when `LCC_ORACLE` is
set. Without it, "124 passed" is a misleading green — it means "124 tests were skipped and
none failed to skip." The snapshot doc needed an explicit note explaining this so future readers
don't mistake an unguarded green for a real parity confirmation.

**The rule:** When documenting test output, note the preconditions that gate a suite's
meaningfulness — an auto-skip green and a real green look identical in Jest summary output.

---

## 4. Playwright tests picked up by Jest will error, not skip

**What happened:** `npm run test:all` runs all tests including `tests/browser/`. One file
(`playground.e2e.spec.js`) uses Playwright's `test.describe` API but was picked up by Jest,
which threw: *"Playwright Test needs to be invoked via 'npx playwright test'"*. The suite
failed to run at all — not a skip, a hard error.

**What I learned:** Playwright's `test` global is incompatible with Jest's runner; when Jest
encounters it, the entire spec file fails to load rather than gracefully skipping. The fix is
to either exclude the file from Jest's `testMatch` pattern or move it to a dedicated directory
that Jest doesn't scan. This is distinct from the browser suite timeout failures (those need a
running server); this failure happens before any test executes.

**The rule:** Playwright specs must be excluded from Jest's `testMatch` glob — mixing them
in the same directory causes hard load errors, not skips. File a DEV ticket to add the
exclusion rather than treating it as a known failure.

---

## 5. SVG favicon requires exactly one asset and one HTML tag

**What happened:** #771 needed a favicon for `docs/site/index.html`. The full solution was:
create `docs/site/favicon.svg` (a 32×32 chip icon with dark background and green "LCC" text)
and add `<link rel="icon" type="image/svg+xml" href="favicon.svg">` to `<head>`. That's it —
no ICO conversion, no multiple sizes, no manifest required for modern browser support.

**What I learned:** SVG favicons have excellent modern browser coverage and need none of the
legacy multi-format scaffolding (`favicon.ico`, `apple-touch-icon.png`, etc.). For a developer
tool targeting modern browsers, SVG-only is the right tradeoff: one file, one tag, done.

**The rule:** For a developer-tool docs site targeting modern browsers, an SVG favicon is
sufficient — one asset + one `<link rel="icon" type="image/svg+xml">` tag, no ICO fallback
needed.

---

## What landed

| Artifact | Change |
|---|---|
| `docs/puzzle-velocity.md` | Added "Full-corpus C-overshoot study: retired" subsection (Q29r finding) (#719) |
| `docs/test-suite-snapshot-2026-06-04.md` | New file: dated output of all three suite tiers with failure/skip notes (#776) |
| `docs/site/favicon.svg` | New SVG favicon: dark chip, green LCC text (#771) |
| `docs/site/index.html` | Added `<link rel="icon" type="image/svg+xml" href="favicon.svg">` (#771) |

## Open threads

- Playwright/Jest exclusion fix is untracked — file a DEV ticket (child of #774 or standalone)
- `close.e2e` message regex mismatch and velocity-csv model backfill (ids 464, 534, 544, 556) are pre-existing failures documented in the snapshot but not yet ticketed
