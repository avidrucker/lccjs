# Today I Learned — 2026-05-31 (BANANA)

A long AM session: audited why the velocity spreadsheet kept getting corrupted,
designed and implemented a full migration from a hand-edited CSV to a SQLite
database as the single source of truth, repaired four malformed rows, and closed
six tickets including the RESEARCH session itself.

---

*For readers new to this repo: every piece of work gets a row in a time-tracking
spreadsheet (`docs/puzzle-velocity.csv`) recording what was done and how long it
took. Code changes go on a separate Git branch ("worktree") so multiple agents can
work in parallel without clobbering each other. A scanner (`npm run puzzle:status`)
searches every file in the repo for `@todo` markers to show which tickets are still
in progress.*

---

## 1. The root cause of recurring CSV corruption was the absence of a write path

**What happened:** The spreadsheet had accumulated rows with field counts of 26,
27, and 16 — where it should be 13 or 14. `stats/enrich.py` crashed on every run
because of these. Digging in revealed something surprising: `close.js` and
`claim.js` — the two main workflow scripts — do not append spreadsheet rows at all.
There is no append script anywhere in the project. Every agent was adding rows by
hand, each using a different method (Python `csv.writer` with the wrong options,
direct text editing), and each method introduced a different failure mode that
silently entered the file.

**Why it matters:** The spreadsheet had been "fixed" twice before (#186, #217) for
different symptoms (rebase conflicts, CRLF line endings, duplicate rows). Each fix
addressed a specific failure mode without eliminating the underlying cause: humans
writing to a format-sensitive file by hand, without any validation.

**What to do:** When a system keeps breaking in different ways, look for the missing
abstraction. Here, the missing abstraction was a validated write path — a script
that owns the format and rejects bad input before it reaches the file.

## 2. SQLite eliminates an entire class of errors that CSV tooling cannot

**What happened:** The repair options were: (a) add more validation to the CSV
append process, or (b) replace the canonical store with SQLite and make the CSV
a generated read-only export. Option (a) had been tried twice. Option (b) was
chosen.

With SQLite as the source of truth, format corruption at the write layer becomes
impossible. SQLite enforces the schema on every INSERT — you cannot write a row
with 26 fields into a 15-column table. The CSV is now exported by a script that
handles all formatting concerns (LF endings, quote-doubling, column order), so
agents never touch it directly.

**Why it matters:** The `merge=union` attribute on the CSV was added to handle
parallel agents appending rows at the same time. With an export-only CSV, that
entire class of concern disappears — two agents exporting the same database produce
an identical file, no conflict.

**What to do:** When you find yourself adding more and more guards around a
hand-edited file, consider whether the file should be generated instead.

## 3. The export script should be called automatically by the write script

**What happened:** The write script (`npm run velocity:log`) validates the JSON
input, INSERTs into SQLite, and then automatically calls the export script
(`npm run velocity:export`) to regenerate the CSV. This means "log a row" and
"update the CSV" are one atomic operation from the agent's perspective.

An early design option had the export as a separate manual step. That was rejected
because it creates a window where the database and the CSV are out of sync, and
agents can forget to run the export step before committing.

**Why it matters:** Every separate manual step is an opportunity for an agent to
forget it under pressure. Coupling the export to the write means the CSV is always
current after any INSERT.

## 4. Database location matters for multi-worktree workflows

**What happened:** The database needed to be accessible from any worktree at the
same time. Three locations were considered: inside the repo (`.claude/velocity.db`),
next to the stats scripts (`stats/velocity.db`), or in the user's home directory
(`~/.lccjs/velocity.db`). The home directory location was chosen because it:
- requires no `git rev-parse` resolution to find from a worktree
- survives `git clean` (the database is outside the repository entirely)
- needs no `.gitignore` entry

**Why it matters:** A database inside the repo would need a resolution step in
every script to find the repo root from an arbitrary worktree path. Outside the
repo, the path is always `~/.lccjs/velocity.db` — no resolution needed.

## 5. Run velocity-log from the worktree, not the main checkout

**What happened:** When closing ticket #277, the velocity row was logged by running
`velocity-log.js` from the main checkout instead of from the worktree. The script
exports the CSV relative to its own location (`__dirname`), so the main checkout's
CSV got updated but the worktree's CSV did not. The closing commit (made from the
worktree) needed the velocity row in the worktree's CSV.

The fix was to run `velocity-export.js` directly from the worktree after the
database insert had already happened, which correctly wrote the CSV to the
worktree's `docs/` directory.

**Why it matters:** Even though the database is shared (at `~/.lccjs/velocity.db`),
the CSV export path is relative. The script you run must be the one in the worktree
you're committing from.

**What to do:** When closing a ticket from a worktree, run `npm run velocity:log`
(or `npm run velocity:export`) from inside that worktree's directory, not from the
main checkout.

## 6. Atomic writes are non-negotiable for generated files

**What happened:** The original `enrich.py` opened its output file directly for
writing, then crashed mid-write when it encountered a malformed CSV row. This left
a partially-overwritten output file on disk — worse than no file at all, because
re-running the same bad input would make it worse again.

The rewrite uses the standard atomic pattern: build the full output in memory,
write to a temporary file, then `os.replace(tmp, dest)`. A crash at any point
leaves the previous output intact.

**Why it matters:** "Idempotent" means "safe to re-run on the same input." A script
that corrupts its output on failure is the opposite of idempotent — re-running it
makes the situation worse. This property matters especially for generated artifacts
that other tools depend on.

**What to do:** Any script that writes a file should write to a temp path first,
then rename. The rename is atomic on all major OS/filesystems — it either completes
or doesn't; there is no half-renamed state.

## 7. Plan phase-by-phase with the user for architectural decisions

**What happened:** After the initial research, the migration plan had six phases.
Rather than presenting the full plan and asking for one approval, each phase was
walked through one at a time, with explicit design decisions for each (where should
the database live? how does the export get triggered? what is the input format?).
Several decisions changed during this walk-through (SQLite location moved from
`.claude/` to `~/.lccjs/`; `id` column added to the CSV export).

**Why it matters:** Architectural decisions that seem small in a plan document can
have large downstream effects (a location change affects every script that opens
the database). Getting explicit confirmation at each decision point surfaces
disagreements before code is written.

**What to do:** For multi-phase work with architectural choices, walk through the
decisions phase by phase rather than front-loading everything into one approval.
The extra turns are cheaper than implementing the wrong design.
