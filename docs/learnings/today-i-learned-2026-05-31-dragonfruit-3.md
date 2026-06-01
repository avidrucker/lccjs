# Today I Learned — 2026-05-31 (DRAGONFRUIT, session 3)

An afternoon/evening session: closed #263 (OG LCC blank-.e research), #311 (Guard 2
keyword check), and #346 (Guard 1 false-positive fix). Three DEV puzzles plus one
RESEARCH, each producing concrete non-obvious findings.

---

## 1. OG LCC leaves a partial `.e` on *every* assembly error — not just undefined labels

**What happened:** OG BUG #10 in `parity_deviations.md` documented the blank-`.e`
footgun for the undefined-label case. The #263 scope question was: is it specific to
undefined labels, or universal? After probing 8 distinct error types (undefined label,
range error, bad register, bad directive, missing operand, duplicate label, no-comma
negative immediate, valid control), every single error case left at least a partial
`.e` on disk.

Two sizes correlate with which pass the error fires in:
- **Pass-2 errors** (most types): 2-byte `.e` — the full `6f 43` magic header
- **Pass-1 errors** (duplicate label): 1-byte `.e` — just `6f`, the first magic byte

Both cases also write `.lst` and `.bst`. Executing the 2-byte blank `.e` triggers
"Possible infinite loop" and ~100 MB of `brz` trace output.

**Why it matters:** The footgun is broader than documented. Any build script that
ignores exit codes and runs the `.e` after a failed assembly will hang — for any error
type, not just undefined labels. LCC.js's all-or-nothing output is the correct design.

**What to do:** Frame the upstream report (ticket #264/WRITER) as a *general* finding
with the undefined-label repro as the clearest entry point, not as a label-specific bug.

---

## 2. OG LCC requires cwd + basename invocation — absolute paths produce "Bad command line switch"

**What happened:** The probe script initially called `$ORACLE /abs/path/to/file.a`.
Every invocation returned exit 2 and "Bad command line switch: /abs/path/..." — even a
simple `/tmp/valid_test.a`. Reading `tests/helpers/runOracle.js` revealed the
convention: the oracle must be invoked with `cwd` set to the file's directory and only
the **basename** as the argument. A `name.nnn` file must also exist in `cwd`.

**Why it matters:** Any probe or test that calls the oracle with an absolute path will
silently get exit 2 rather than running the assembly. The failure looks like a path
error, not a usage error, and the exit code (2 vs 1) is different from an assembly
error.

**What to do:** Always invoke the oracle via `spawnSync(oraclePath, [basename], { cwd: dir })`.
Copy the pattern from `runOracle.js` rather than improvising.

---

## 3. The velocity commit must reference `Closes #N` — don't layer it on top of the close commit

**What happened:** For #263, I committed the research doc with `Closes #263` in the
message, then committed the velocity CSV row separately on top. `close.js` checks
`HEAD`'s commit body for `Closes #N` — the velocity commit was HEAD, so it blocked.
I soft-reset (`git reset --soft HEAD~1`) to unstage the velocity commit, then included
`Closes #N` in the velocity commit's body instead.

**Why it matters:** Close.js's "HEAD must reference Closes #N" check is intentional —
it proves the agent authored the close, not the tool. But it means the velocity CSV
commit must be the HEAD commit and must include `Closes #N`, OR both commits must
include it (GitHub is idempotent about closing).

**What to do:** Either include the velocity CSV in the same commit as `Closes #N`, or
include `Closes #N` in the velocity commit's body. Don't split them with the velocity
commit on top and no issue reference.

---

## 4. Regex-from-end extracts simple trailing CSV fields without a full parser

**What happened:** Guard 1's fix (#346) needed to extract the `agent` column from CSV
rows. The `notes` field (column 12) can contain commas and is quoted, making a naive
`fields[13]` unreliable. But `agent` (col 13) and `model` (col 14) are always simple
identifiers — no commas, no quotes. Anchoring a regex to `$` extracts them cleanly:
`row.match(/,([A-Za-z][A-Za-z0-9]*),([A-Za-z0-9.-]*)$/)`.

**Why it matters:** This avoids a full CSV parser (which would be overkill for a
machine-generated, well-structured file) while correctly handling the one messy field.
The pattern generalises: when a CSV row ends with N simple, predictable fields, working
from the right is more robust than counting columns from the left through free-text.

**What to do:** When extracting a late column from a CSV row with an earlier free-text
field, check if the target columns are simple enough to anchor from the end rather than
parsing the full row.

---

## 5. The SHA-rewrite issue consistently orphans the worktree — cleanup does not happen automatically

**What happened:** BANANA s3 noted that after the close.js SHA-rewrite error (#350),
"the worktree was cleaned up" in their observed case. In two of my closes (#311 and
#346), the opposite happened: the error fired and the worktree was **not** removed — I
had to manually run `git worktree remove`, `git branch -D`, and `git pull --ff-only`
each time.

**Why it matters:** The inconsistency between BANANA's and my observations means the
cleanup-after-stale-SHA path is non-deterministic or timing-dependent. The safe
assumption is that cleanup will *not* happen automatically, and the manual teardown
sequence is always needed after this error. The `--keep` flag is not needed; the
worktree simply persists and the agent must clean it up.

**What to do:** After seeing "push reported success but SHA is NOT on origin/main",
verify the commit IS on origin/main (`git log --oneline origin/main | head`), then
manually tear down: `git worktree remove .claude/worktrees/<branch>`,
`git branch -D <branch>`, `git pull --ff-only origin main`. Filed as #350 for a
structural fix.
