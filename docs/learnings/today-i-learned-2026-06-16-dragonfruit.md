# TIL 2026-06-16 — DRAGONFRUIT

**Context:** A short three-ticket docs session on the `area:web` then `area:toolchain`
lanes: a template-literal gotcha note (#1409), a correction of a stale oracle-parity
claim in `CLAUDE.md` plus a new stdout-mirroring convention (#1063), and a follow-up
ticket I filed (#1424) for two minor inaccuracies I surfaced but deliberately left out
of #1063's scope.

---

## 1. "Correct the stale doc" means verify the *new* claim against the code first

**What happened:** #1063 asked me to replace a sentence in `CLAUDE.md` that said the
oracle suites *"auto-skip when `LCC_ORACLE` is unset."* The ticket asserted this was stale
since the #692 golden-cache migration. It would have been easy to just paste the ticket's
suggested replacement — the reporter had already written the corrected wording. Instead I
opened `tests/helpers/env.js` and the `*.oracle.e2e.spec.js` files and traced the actual
skip logic: `assertOracleConfigured()` is consulted **only** inside the
`GOLDEN_AUTO_UPDATE=1` regen branch, and a case skips solely when its golden files are
missing or mismatched — there is no top-level binary-gated `describe.skip` anywhere. The
ticket's claim held up, so the correction shipped with a "verified against `env.js` +
the specs" note in the closing comment.

**What I learned:** A docs-correction ticket carries *two* claims — that the old text is
wrong, and that the proposed new text is right. The reporter's prescribed replacement is a
suggestion, not a verified fact; correcting prose to match a second unverified assertion
just moves the staleness. Reading the code took two minutes and let me close with evidence
instead of trust.

**The rule:** **Before rewording a doc to match a ticket's "corrected" claim, confirm the
new claim against the code — a prescribed fix is still a claim to verify** (cf.
`docs/do-this-not-that.md` "Verify before acting"; the prescribed-fix-can-be-wrong lesson).

---

## 2. Scope the fix narrow; file the things you noticed, don't fold them in

**What happened:** While in `CLAUDE.md` for #1063 I noticed two *adjacent* inaccuracies the
ticket didn't mention: line 63 still says the suites *"run both and diff the output"*
(stale in the same way the line-66 fix was), and the #1063 body referenced "10
`*.oracle.e2e.spec.js` suites" when the repo has 9. The tempting move was to fix all of it
in one pass since I was right there. I didn't — I kept the diff to the one sentence the
ticket scoped, wrote the corrected line-66 prose count-free (so no fragile number), and
listed both extras as FYIs in the closing comment. When the human then asked me to file
them, I opened #1424 (one ticket covering both) rather than reopening #1063.

**What I learned:** "I'm already in the file" is the exact rationalization rule 12 (one
deliverable per close; out-of-scope changes get their own ticket) exists to stop. The
follow-up ticket is cheap and keeps each close auditable against its stated "Should have."
I also avoided baking the count "9" into the prose at all — a number in docs is a future
staleness magnet, so count-free wording is the lower-maintenance fix.

**The rule:** **Adjacent inaccuracies you spot mid-task become a follow-up ticket, not extra
diff — and prefer count-free prose over a hardcoded number that will go stale** (RULES.md
rules 10 & 12).

---

## 3. A label the orchestrator asks for may not exist yet — create it, then apply

**What happened:** The human asked me to file #1424 and mark it `tiny`. `gh label list`
showed no `tiny` label (only `good first issue` was close). Applying a non-existent label
via `gh issue create --label` would have failed the whole create. So I ran
`gh label create tiny --description "Quick win — trivial scope, a few minutes of work"
--color c2e0c6` first, then filed with `--label "tiny,..."` and verified all four labels
landed via `gh issue view --json labels`.

**What I learned:** An explicit human instruction to use a label is also implicit
authorization to create it if missing — but the ordering matters: create-then-apply, and
verify, because `gh` rejects an unknown label silently-ish (the create call fails as a
whole). Don't assume the project's label vocabulary is fixed.

**The rule:** **When told to apply a label, check it exists; create it first if not, then
verify it actually attached.**

---

## 4. `velocity:log` refuses to run from `main` — pass `--from-main` for worktree-less PM rows

**What happened:** After filing #1424 (a pure PM action with no worktree of its own — I'd
already closed the #1063 worktree), I ran `npm run velocity:log` from the main checkout. It
refused: *"running from main checkout … Run this from inside the worktree instead. Pass
`--from-main` to override (e.g. a PM row with no worktree of your own)."* Re-running with
`--from-main` inserted the row into the DB and (correctly) skipped the CSV export, noting it
would be included at the next worktree-close export.

**What I learned:** The guard exists so per-puzzle rows get committed with their worktree's
close commit, not stranded on a dirty main. But issueless/worktree-less PM rows are a
legitimate exception the tool explicitly supports — `--from-main` is the sanctioned path,
and it deliberately defers the CSV export rather than writing to main.

**The rule:** **Log a worktree-less PM/triage velocity row with `npm run velocity:log --
--from-main '{…}'`; the DB row lands now and the CSV export rides the next worktree close.**

---

## What landed

| Artifact | Change |
|---|---|
| `docs/project-gotchas.md` | New §10: backtick / `${` inside `build-site.js` embedded-script template literals closes the literal early (#1409) |
| `CLAUDE.md` | Replaced the stale oracle-suite "auto-skip" sentence with golden-cache-accurate prose (#1063) |
| `docs/pitfalls.md`, `docs/do-this-not-that.md` | Added the "terminal stdout must mirror into the `.lst` Output section or be debug-gated" convention (#1063) |
| GitHub `tiny` label + #1424 | Created the `tiny` quick-win label; filed the two surfaced doc-accuracy nits as a follow-up |

## Related artifacts

- Issues #1409, #1063, #1424
- Sibling: [TIL 2026-06-15 — APPLE (session 2)](./today-i-learned-2026-06-15-apple-2.md) — "a prescribed fix can break an invisible contract" (#1397), same verify-before-trust theme
- `docs/do-this-not-that.md` — "Verify before acting", "Velocity logging"
- RULES.md rules 6, 10, 12 (scope discipline + file-found-work-as-a-ticket)
