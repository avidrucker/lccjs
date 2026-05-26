# Learnings — adopting Puzzle Driven Development on lccjs

Date: 2026-05-26
Branch where this work landed: `improve-docs-branch-2026-may-25-01`

## Why we adopted PDD

The repository had accumulated ~35 unstructured `TODO:` comments across
`src/core`, `src/plus`, `src/extra`, `src/utils`, and a handful of test
files. Some referenced parity questions; some were "inspect to make
sure" reminders; some were small feature gaps. None had a parent
ticket, none had an estimate, and none were tracked outside the source.

In parallel, the May 2026 code review (`docs/init_code_review.md`)
surfaced ~26 concrete bugs (later catalogued in `open_bugs.md` as
OB-001..OB-026), most of which had no inline marker in the code at
all. So the project had two complementary visibility gaps:

1. **TODOs without tickets** — work flagged in the code, invisible to
   any tracker.
2. **Bugs without code markers** — work tracked in `open_bugs.md` /
   `init_code_review.md`, invisible when reading the source.

Yegor Bugayenko's PDD is a methodology specifically designed to close
both gaps: every deferred sub-problem becomes a `@todo #N:Mm/ROLE`
comment **at the exact code site**, referencing a parent ticket in
the issue tracker. Removing the comment closes the ticket on the next
scan. PDD is implemented by a small Ruby gem (`pdd`) that emits an
XML report.

We chose the canonical path (GitHub Issues + `pdd` CLI in a pre-push
hook) rather than a pragmatic compromise (a local doc as registry,
no CLI). The full Yegor research is captured in commit messages and
the prior conversation; the key reasons:

- The repo is public on GitHub and already had Issues enabled (with
  21 prior issues from earlier work).
- GitHub Issues integrates with `gh issue create`, auto-close on
  commit references, label filtering, and other tooling that gives
  the methodology a multiplier.
- The Ruby gem turned out to be one `gem install` away once
  `libmagic-dev` was on the box. Negligible setup cost.

## Architecture of the layering

```
┌─────────────────────────────────────────────────────────────────┐
│  open_bugs.md         — human-readable bug catalogue with stable │
│                         OB-NNN IDs. Description, severity, fix.  │
│                         Cross-references each entry to GH #.     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Issues #31..#65  — the actual ticket tracker per Yegor's │
│                            "if it isn't in the tracker it didn't │
│                            happen" rule. Labels: pdd-tracked +   │
│                            severity:{high,medium,low} + bug /    │
│                            cleanup / refactor / documentation /  │
│                            testing / enhancement.                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  @todo puzzles in source — one-line markers at the exact stub    │
│                            site, format @todo #N:Mm/ROLE blurb.  │
│                            Picked up by `pdd` CLI.               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  `npm run puzzles`     — runs pdd, writes puzzles.xml (gitignored)│
│  pre-push hook         — blocks pushes that include malformed    │
│                          puzzles (bypass with --no-verify).      │
└─────────────────────────────────────────────────────────────────┘
```

The three layers each answer a different question:
- **`open_bugs.md`** — "what's the catalogue of known defects in
  enough detail to read end-to-end?"
- **GitHub Issues** — "what's the queue of work, with comments,
  labels, and an auditable history?"
- **Inline `@todo`s** — "if I'm staring at this function right now,
  what's owed here?"

## How we decomposed in practice

- 26 entries in `open_bugs.md` (OB-001..OB-026) plus 6 we discovered
  during the conversion pass (OB-027..OB-032) → **32 GitHub issues**.
- Two OB- entries needed sub-decomposition to stay under Yegor's
  60-minute cap:
  - OB-003 (linker error propagation) split into #33 add-test,
    #34 make-error-throw, #35 update-doc.
  - OB-020 (`-l<hex loadpt>` flag) split into #52 consolidate-helper,
    #53 wire-flag.
- 35 existing TODOs in code collapsed to **16 canonical `@todo`
  puzzles** after applying the "don't pile puzzles like bookmarks"
  anti-pattern: the 5 `loadPoint = 0` sites and 10 `evaluateImmediate`
  sites each retain one canonical puzzle; the redundant duplicates
  were stripped (with the GH issue body listing all affected sites).
- 18 OB- entries had no pre-existing TODO; each got a new inline
  `@todo` immediately above the cited code → another 18 puzzles.
- **Net: 34 puzzles across 31 distinct tickets**, scanned cleanly
  by `pdd` (0 errors).

The 4 GH issues without an inline `@todo` are intentional:
- **#33** (OB-003a) and **#35** (OB-003c) are dependencies of #34
  and are referenced from #34's puzzle text.
- **#40** (OB-008 cuh63 6.3 mov regression) has no LCC.js code site
  — it's an upstream tracker.
- **#53** (OB-020b) is the follow-up to #52 and is referenced from
  #52's puzzle text.

## Resolution lifecycle

PDD's elegant feature is that resolution is a code-deletion, not a
state-machine transition:

1. Pick a ticket (say #32, OB-002 disassembler `imm9` mask).
2. Implement the fix. Tests pass.
3. **Delete the `@todo #32:...` comment** from the source.
4. Next `pdd` scan no longer finds the puzzle. The hook lets you push.
5. Manually close GH issue #32 with a one-line outcome comment
   referencing the commit. (`0pdd.com` would automate this step, but
   it's marked broken as of Feb 2024 per Yegor's own README.)

Step 5 is the one place we play "0pdd manually". For solo work on a
small repo this is fine; if the project ever grows collaborators, a
small `gh`-based script could pipe pdd's XML output to issue closures
automatically.

## Choices that deviated from strict canonical Yegor

- **30-day stale rule.** The skill description mentions it; Yegor's
  own writings don't. We adopted the spirit (review and resolve, don't
  let puzzles drift) but didn't formalize a deadline. Revisit if it
  becomes useful.
- **`#OB-001` style vs. pure numeric IDs.** Yegor's examples use bare
  numbers (`#234`), but his README also shows `#TEST-21`-style IDs.
  The `pdd` parser is agnostic. We use **GH issue numbers** (`#31`,
  `#52` etc.) in the puzzle text because GitHub auto-closes on commit
  references; the OB-NNN ID lives in parentheses in the puzzle blurb
  as a stable cross-reference into `open_bugs.md`.
- **Custom labels.** Created `pdd-tracked`, `severity:high`,
  `severity:medium`, `severity:low` to make filtering easy without
  having to read each body. Yegor doesn't prescribe labels.

## Day-to-day usage

```bash
# Scan the codebase for puzzles; writes puzzles.xml (gitignored)
npm run puzzles

# Inspect what's owed where
grep -n "@todo #" src/

# Resolve a puzzle: edit the code, delete the @todo comment, then
# update the corresponding GitHub issue.
gh issue close 32 --comment "Closed by <commit-sha> — mask is now 0x1FF; round-trip test added."

# Pre-push hook is auto-installed via:
ln -sf ../../scripts/git-hooks/pre-push .git/hooks/pre-push
# Override one push if you really need to:
git push --no-verify
```

## Tooling pinning

- **Ruby**: 3.2.3 (from apt on Ubuntu/Mint).
- **pdd gem**: 0.24.2, installed via `gem install --user-install pdd`.
  Symlinked into `~/.local/bin/pdd` so `npm` picks it up without
  shell-config changes.
- **System dependency**: `libmagic-dev` (`sudo apt install
  libmagic-dev`) is needed for the `ruby-filemagic` transitive
  dependency to compile its native extension.

## General lessons (transferable to other projects)

1. **Two-layer tracking is worth the effort.** A bug catalogue
   (`open_bugs.md`) is for humans; an issue tracker is for tooling;
   inline `@todo`s are for whoever is staring at the code right now.
   Each carries different load.

2. **Decompose before you create tickets.** When OB-003 became 3
   tickets and OB-020 became 2, the resulting per-puzzle estimates
   were realistic. Without decomposition, a 90-minute "fix the
   linker" puzzle would have rotted in the backlog.

3. **Anti-pattern: bookmark-piling.** When 10 sites all need the same
   fix, don't write 10 identical puzzles. One canonical puzzle plus
   a complete site list in the ticket body is cleaner and Yegor-faithful.

4. **The `gh` CLI plus a small bash loop is enough.** No need for
   issue-tracker integrations or org-wide automation. 32 issues
   created in ~2 minutes of script execution.

5. **A pre-push hook is the lowest-friction enforcement point.**
   Doesn't require CI changes, doesn't slow down `npm test`, surfaces
   problems exactly when you'd otherwise lose visibility (right
   before you publish work).

## Related artifacts

- `package.json` — the `puzzles` script.
- `scripts/git-hooks/pre-push` — the hook (install via symlink).
- `open_bugs.md` — the catalogue, with GH cross-references.
- `current_issues.md` — broader living index, points at `open_bugs.md`
  for the bug subset.
- `docs/init_code_review.md` — May 2026 snapshot review that seeded
  most OB- entries.
- `docs/cuh63-mov-immediate-bug-report.md` — upstream report linked
  from OB-008 / GH #40.
- `public_experiments/mov_mvi_parity/` — runnable reproductions.
