# Do This, Not That

Evergreen agent-facing preferences for common tool and command choices in this repo. Each entry names a concrete pattern, the alternative to avoid, and a one-line rationale.

**Scope:** workflow and tooling preferences — not assembly-level surprises (those belong in [`pitfalls.md`](./pitfalls.md)) and not per-session lessons (those belong in [`docs/learnings/`](./learnings/)). This doc is the *distillation* of those, not a duplicate. When a TIL lesson generalises, promote it here.

---

## File enumeration

**Prefer `git ls-files` over `find` for project-internal file enumeration**

- **Do:** `git ls-files | grep -E '\.sh$'`
- **Don't:** `find . -name "*.sh" -not -path "./node_modules/*" -not -path "./.claude/*" …`
- **Why:** `git ls-files` returns only tracked files, so `.gitignore` handles all exclusions automatically — no growing exclusion list, no risk of picking up generated artifacts or worktree junk.

---

## Tool pacing

**Run tools one-at-a-time; read the real result before firing the next call**

- **Do:** run a single Bash call, read the output, then decide the next step.
- **Don't:** batch multiple state-changing calls in one turn and narrate expected outcomes ("PATCH OK", "tests pass", "pushed") before any result arrives.
- **Why:** batching causes confabulated state — agents report success for commands that haven't run yet. Every multi-turn session that went badly in this repo traces to this pattern (T1-A, 6 independent sightings across 5 agents).

---

## Issue filing

**File sibling issues sequentially; verify each with `gh issue view N` before writing the marker**

- **Do:** `gh issue create …` (wait for response, note number) → write `@todo #N` → `gh issue create …` (next sibling) → write `@todo #N`.
- **Don't:** create sibling issues in parallel background jobs, then write markers.
- **Why:** GitHub assigns issue numbers by HTTP arrival order, not submission order. Parallel creation races the number assignment, producing mis-matched `@todo #N` markers.

---

## Closing commits

**Convert any "deferred" or "out of scope" closing prose into a ticket before committing**

- **Do:** scan your draft closing comment for sentences describing work not done → file a ticket for each → replace the prose with `Deferred: #N`.
- **Don't:** write "out of scope: X would need Y" in the closing comment and stop there.
- **Why:** closing comment prose is invisible to agents and `puzzle:status`. The tracker is the only shared memory that survives context compaction, worktree teardown, and agent rotation. Prose in a comment is silently dropped work (Rule 10, `RULES.md`).

---

**Use past-tense headings in closing comments so readers can tell what was done vs. what is proposed**

- **Do:** use headings that are unambiguously retrospective — e.g. **"What was found:"**, **"What was done:"**, **"What changed:"**, **"How it was solved:"**, **"Tests added:"**.
- **Don't:** use tense-neutral labels — e.g. `Fix:`, `Root cause:`, `Approach:` — on their own, these read equally well as a to-do list or a retrospective.
- **Why:** a skimming reader cannot tell from `Fix: run in two stages…` whether the fix is already shipped or is a next-action prescription. Past-tense headings eliminate that ambiguity at a glance. (#812)

| Ambiguous | Unambiguous |
|---|---|
| `Fix:` | `What was done:` / `Fixed:` |
| `Root cause:` | `What was found:` |
| `Approach:` | `How it was solved:` |
| `Changes:` | `What changed:` |
| `Tests added:` | (already clear — keep as-is) |
| `Notes:` | (already clear — keep as-is) |

---

## Issue commenting

**Comment only when required or explicitly permitted — never for progress or intermediate findings**

- **Do:** post a closing comment (required at every close), a blocking-discovery note (required when you find the issue is blocked by something not in the body), or a brief research finding that directly answers an open question in the issue body (permitted).
- **Don't:** post progress updates ("I'm working on this", "halfway done"), intermediate findings that don't change status or scope, or anything whose content belongs in the commit message.
- **Why:** issue threads pollute fast. In orchestrated sessions, multiple agents independently deciding to comment on the same event produces agent-chatter that drowns signal. Prohibition is the only reliable defense. Full policy and solo/orchestrator authorization rules: [`docs/issue-commenting-policy.md`](./issue-commenting-policy.md). (#848)

---

## Worktree discipline

**Verify the target issue is open before starting the claim flow**

- **Do:** `gh issue view N --json state,title` as the very first action after receiving an issue number — before capturing timestamps, running `npm run puzzle:status`, or checking worktrees.
- **Don't:** begin the claim flow (start timestamp, puzzle:status, worktree list) and discover the issue is closed only when you finally read the issue body.
- **Why:** A closed issue discovered after the start-timestamp was captured means wasted wall-clock in your velocity row. The check costs one command and catches this before anything is committed.
- **Corollary (multi-agent sessions):** In a session with active concurrent agents, re-run `gh issue view N --json state` immediately before `npm run claim` — the check→claim window must be zero or near-zero intermediate steps. Another agent can close the issue in the seconds between your initial check and the claim attempt. (#833)

**Check a ticket's `Blocked by:` field and parent tracker before picking up or recommending work**

- **Do:** Before claiming or suggesting a ticket, read its issue body for `Blocked by:` entries and view the parent tracker for any open gate issues.
- **Don't:** immediately start or recommend work on a ticket because its description looks actionable.
- **Why:** An unresolved blocker gate (e.g., a human-decision issue in the parent tracker) means the ticket can't be closed even if the code is done. Surfacing this before the claim saves a wasted cycle.

**Always pass `--as <fruit>` to `npm run claim`; never use a bare positional name**

- **Do:** `npm run claim -- 799 --as grape`
- **Don't:** `npm run claim -- 799` (missing `--as`) or `npm run claim 799 grape` (positional name)
- **Why:** The `--as` flag has been required since auto-naming was disabled in #386. Positional identity was removed; bare names produce an immediate error, costing a wasted round-trip.

**Check `git status` on main before `npm run claim`**

- **Do:** `git status` → if any file your ticket will touch is untracked or modified, commit or stash it first, then claim.
- **Don't:** run `npm run claim` immediately without inspecting main.
- **Why:** `git worktree add` branches from the last *committed* state. Untracked files on main are silently absent in the new worktree. The worktree looks like a clean copy — it just happens to be missing whatever was floating uncommitted.

**Use `npm run close <N>` — never hand-push to main**

- **Do:** commit `Closes #N`, then `npm run close <N>`.
- **Don't:** manually push to main or skip the close script.
- **Why:** `npm run close` runs the teardown gate, removes the worktree, and deletes the branch. Bypassing it leaves stale worktrees and branches, and can push mid-rebase.

**Use `git -C <path>` to inspect a worktree; never use a bare `cd` to enter one mid-session**

- **Do:** `git -C /path/to/worktree log --oneline -3`
- **Don't:** `cd /path/to/worktree && git log …` (then forget to return)
- **Why:** a bare `cd` changes the persistent shell cwd for the entire conversation. All subsequent `git`, `npm run claim`, and `git pull` commands run from the wrong directory. `git pull` silently reports "Already up to date" on the feature branch instead of on main — false confirmation. (#819)

**Treat a stale-worktree warning from `npm run claim` as an action item, not a notice**

- **Do:** when `npm run claim` prints `⚠ stale worktree: "<branch>" references CLOSED issue #N`, immediately run the two cleanup commands printed in the warning before proceeding with the claim.
- **Don't:** acknowledge the warning and continue without cleaning up.
- **Why:** the orphaned worktree and branch persist indefinitely — each subsequent `npm run claim` prints the same warning; it is not self-healing. Running the cleanup commands takes seconds and removes the noise for all future agents. (#819)

---

## Parallel agent assignment

**Treat `src/utils/` as a single-owner cluster — never assign two concurrent tickets that both write to it**

- **Do:** Before assigning tickets to parallel agents, check whether both scopes touch `src/utils/`. If so, serialise them.
- **Don't:** let two agents work concurrently on any file under `src/utils/` (errors.js, formatters.js, hex-display helpers, etc.).
- **Why:** `src/utils/` is imported across core, plus, and cli — any concurrent edit produces a line-level conflict on rebase even when the worktrees are otherwise independent. All other `src/` files (assembler, interpreter, linker, plus subclasses, ilcc) are safe for concurrent assignment when the tickets target different files. (#826)

**Within a single script file, serialise — close the fix ticket before assigning the companion test ticket**

- **Do:** When a fix and its companion test ticket both target the same script file (e.g. `scripts/claim.js`), close the fix first, then assign the test.
- **Don't:** assign fix and test to concurrent agents when both write to the same file.
- **Why:** Two concurrent edits to the same file produce line-level conflicts on rebase regardless of content. The test may also rely on behaviour the fix changes — concurrent work makes the test stale on merge. `scripts/claim.js` is the highest-churn script; fix+test pairs recur. (#826)

**Run the three-question write-safety check before claiming any ticket**

- **Do:** Ask: (1) What files will I write to? (2) Is any live worktree (`git worktree list`) writing to the same file? (3) Is this a hot file — `docs/puzzle-velocity.csv`, `docs/learnings/README.md`, `src/utils/`, or a script file with a concurrent companion ticket — that active agents write to regardless of their own ticket scope?
- **Don't:** assume a ticket is conflict-free because it touches a different feature area from current in-flight work.
- **Why:** If question 2 or 3 fires, serialise or assign both tickets to the same agent sequentially. Two unrelated tickets can still conflict on hot shared files. `.claude/skills/<skillA>/` and `.claude/skills/<skillB>/` are always safe to assign concurrently — no shared files exist between skill directories. (#826)

---

## Non-interactive rebase

**Use `GIT_EDITOR=true git rebase --continue` and issue it as a separate command**

- **Do:**
  1. `git add <file>` (verify exit 0)
  2. `GIT_EDITOR=true git rebase --continue` (separate invocation)
- **Don't:** `git rebase --continue --no-edit` (flag does not exist for rebase); don't chain as `git add <file> && git rebase --continue` without `GIT_EDITOR=true`.
- **Why:** `--no-edit` is rejected by git immediately. Chaining with `&&` without `GIT_EDITOR=true` fires an interactive editor prompt mid-chain, leaving the rebase in a confused state. Two separate commands let you confirm the stage before continuing.

---

## Oracle invocation

**Wrap all lcc.js / assembler / interpreter / oracle calls with `scripts/lccrun.sh [secs]`**

- **Do:** `scripts/lccrun.sh 5 node ./src/core/assembler.js foo.a`
- **Don't:** call `node ./src/core/assembler.js foo.a` bare.
- **Why:** bare calls hang indefinitely if `name.nnn` is absent or stdin is not a TTY. `lccrun.sh` sets a timeout so a hung process doesn't block an agent turn.

**Invoke the oracle binary with `cwd` set to the source file's directory; pass only the basename**

- **Do:** `{ cwd: '/path/to/dir' }` + argv `['lcc', 'foo.a']`
- **Don't:** pass an absolute path as the filename argument.
- **Why:** the OG LCC binary returns `"Bad command line switch"` and exits 2 on absolute paths. The failure looks like a path error and is silent in the output.

---

## Velocity logging

**Log a velocity row for every puzzle — including PM, RESEARCH, and SPIKE tasks that change no files**

- **Do:** `npm run velocity:log -- '{…}'` after every closed ticket, regardless of role.
- **Don't:** skip the row for "no-code" work.
- **Why:** "no worktree needed" ≠ "no logging". Skipping PM/RESEARCH rows gaps the calibration data and makes throughput stats misleading.

**Capture the start timestamp and set C before reading the issue; use canonical model short-form and fixed role codes**

- **Do:** run `date '+%Y-%m-%dT%H:%M:%S%z'` the moment a task is assigned — before the issue number is known, before reading the body. Then set `c_min` as your honest forward-looking estimate. Use `sonnet-4.6` (not `claude-sonnet-4-6`). Use `COMBO` for refactor+test, not a compound string.
- **Don't:** set `c_min` or capture `started_iso` retroactively, use the full model ID, or invent role codes.
- **Why:** retroactive timestamps produce approximate rows that gap calibration data. The CSV test enforces canonical values; non-canonical strings fail validation and the row is rejected. (#819)

---

## GitHub GraphQL queries

**Always include `first:` or `last:` on every connection field in a GraphQL query**

- **Do:** `labels(first:10) { nodes { name } }`, `issues(first:100) { nodes { number } }`
- **Don't:** `labels { nodes { name } }` — omitting the pagination argument.
- **Why:** GitHub rejects connection fields without a pagination bound, returning exit code 1 with `"You must provide a first or last value…"` The `sh(…, allowFail=true)` wrapper catches the non-zero exit and returns `null`, which surfaces as `[puzzle-status] gh unavailable` — completely hiding the real cause. (#830)

**After a `gh api graphql` call returns null, check stderr/stdout before assuming gh is offline**

- **Do:** When debugging a "gh unavailable" report, run the raw `gh api graphql` command manually and inspect both stdout (the JSON response body) and stderr (the human-readable error).
- **Don't:** immediately assume gh auth is broken — a silent null from `sh()` can equally mean the query itself is malformed.
- **Why:** `gh api graphql` writes a full JSON error body to stdout on validation failures, but the `sh()` helper only returns `null` on non-zero exit, discarding that context.

---

## Grammar / parser patterns

**Before adding a negative lookahead to prevent a false match, check whether the competing rule already excludes the overlap**

- **Do:** read both rules' match patterns and determine whether their character classes can actually co-occur at the same position.
- **Don't:** add a negative lookahead as a precaution without checking first.
- **Why:** lookaheads add complexity and can slow regex engines. The conflict often doesn't exist — the competing rule's own word-boundary or character-class already makes it impossible.

---

## New OP_EXT instructions (LCC+ extended opcodes)

**After wiring a new eopcode: grep every decode site and verify field-mask widths match the executor**

- **Do:** after adding encoder + executor entry, grep for `0x001F` / `0x000F` / `ir &` patterns in the disassembler and listing printer; confirm masks are consistent.
- **Don't:** assume the disassembler is updated when only the encoder and executor are touched.
- **Why:** a narrower mask in the disassembler won't crash — it silently maps the new instruction onto a recycled name. Any eopcode ≥ 16 decoded with a 4-bit mask (`0x000F`) lands in wrong territory with no error.
