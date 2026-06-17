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

## Cleanup in Bash calls

**Issue `rm`/cleanup as its own Bash call — never append it to a command that does real work**

- **Do:** run the substantive command (assemble, run tests, query the DB, generate a file) on its own; if scratch files need removing, delete them in a separate, later Bash call.
- **Don't:** append `&& rm scratch.tmp` (or a heredoc cleanup tail) to a command that also does the real work.
- **Why:** bundling cleanup into a substantive command triggers a permission denial for the *whole* command — the real work is rejected along with the `rm`. Four `TOOL_DENIED` rows share this exact root cause (one recurred ~4×, resolved each time by re-running the same command without the `rm` tail — audit #1007). Keeping cleanup separate avoids the denial regardless of how the broader scratch-file `rm`-permission *policy* (#968) is ultimately decided — this is the safe tactic, not a policy change.

---

## Waiting for background tasks

**Wait for the `<task-notification>` event; do NOT poll with `until grep`**

- **Do:** start `npm run close N` (or any long command) with `run_in_background: true`, then wait — the harness fires a `<task-notification>` when the task finishes. Read the output file after the notification arrives.
- **Don't:** write an `until grep -q "CLOSE OK\|conflict\|error\|failed" <file>; do sleep 3; done` polling loop to detect completion.
- **Why:** `grep` exits on the _first_ match. If the output file already contains the word `conflict` from an earlier rebase-conflict message — still in progress — the loop exits immediately, `cat` runs on partial output, and the monitor command reports failure (exit code 1). The close itself may still be running. Observed live in #918 / #927 (ELDERBERRY 2026-06-05). No polling is needed: the harness notifies you when the task is done.

---

## Adding an npm dep in a worktree

**Let install scripts run; never `--ignore-scripts`**

- **Do:** `npm install <pkg> --save-dev` in the worktree (let native builds run), then commit `package.json` + `package-lock.json` and run `npm install` on the main checkout to sync it.
- **Don't:** add `--ignore-scripts` to dodge Playwright's browser download — it also skips `better-sqlite3`'s native build, so `npm test` then reds ~16 db-touching suites with `Could not locate the bindings file` (install exits 0, so it looks like a regression but isn't).
- **Why:** see [`docs/project-gotchas.md`](./project-gotchas.md) §7. If you already ran `--ignore-scripts`, recover with `npm rebuild better-sqlite3`. (#1252 / #1256)

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
- **Why:** closing comment prose is invisible to agents and `puzzle:status`. The tracker is the only shared memory that survives context compaction, worktree teardown, and agent rotation. Prose in a comment is silently dropped work (`scarlet-lynx`, `RULES.md`).

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

## Scope discipline

**Before any read or action the request didn't name, ask "did the user ask for THIS?"**

- **Do:** before reading a file, producing a derived analysis, or taking an action (close, edit, relabel, comment on another ticket) that the literal request didn't ask for, ask "did the user ask for THIS specific read/action?" If not, don't — note it as a finding or file a ticket instead.
- **Don't:** expand a narrow request into adjacent work because it seems helpful or thorough — e.g. "file a ticket pointing at doc X" → also read and summarise X; "review #N" → also relabel its siblings.
- **Why:** over-*acting* is sometimes caught by the permission classifier, but over-*reading* is not (`Read` is auto-allowed), so unrequested derived work slips straight through to the user. The harm is rarely the read itself — it is the unasked summary/analysis that rides on it. Two user corrections on #1180 (errors row 70); the broader overstep pattern recurs (rows 68, 121, 130). Source: [`docs/research/1181-scope-overrun.md`](./research/1181-scope-overrun.md).

**A path named in a request is a referent, not an instruction to read it**

- **Do:** open a mentioned path only when the literal task needs its *contents*. "File a ticket pointing at doc X" needs X's *path* — don't open it. "Summarise / triage / process the findings in X" needs X's *text* — open it. Unsure? The deliverable decides: if X's text would not appear in (or shape) the output, the read is unrequested.
- **Don't:** treat a path appearing in the request as a cue to read the file.
- **Why:** reading a referenced artifact and then folding in an unasked summary is the single most common over-read shape (errors row 70 / #1180). Source: [`docs/research/1181-scope-overrun.md`](./research/1181-scope-overrun.md).

---

## Verify before acting

> The three levers below are the RULES.md rules `slate-jackal` (R027), `onyx-quokka` (R028), and `scarlet-narwhal` (R029), promoted from feedback memories per the [behavioral-error taxonomy](./research/1160-behavioral-error-taxonomy.md) §4. They are the modes with *no structural net* — no permission classifier or guard fires — so the discipline is the only thing that catches them.

**Read the available evidence before forming or publishing a finding (`slate-jackal`)**

- **Do:** claim the ticket, then read what already exists — `docs/logs/` work logs, prior `docs/research/` passes, the issue's own comments — *before* investigating, concluding, or filing. Gather the evidence the task depends on first.
- **Don't:** start a full investigation and publish findings before reading the evidence already on disk, or act before claiming.
- **Why:** acting before reading produced inaccurate findings — a stale-HEAD timing bug mischaracterised as "confabulation," a review artifact reported missing when the log showed it existed (errors row 59); and editing a file before verifying its version-control home (row 203). The evidence was there to be read; the haste is the error.

**Dup-search with `--state all`, not just open, before filing (`onyx-quokka`)**

- **Do:** `gh issue list --state all --search "<keywords>"` (or `--state all` on a list) before filing — closed-completed work counts as a duplicate too.
- **Don't:** check only open issues; an open-only scan treats same-day-completed work as if it never happened.
- **Why:** an open-only dup-search filed #1146-48 as duplicates of already-**completed** #1137-39, all closed the same day (errors row 67). The live deploy already reflected the finished work — which is also the next lever's tell.

**When live state contradicts the request, stop and reconcile before proceeding (`scarlet-narwhal`)**

- **Do:** when what you observe (issue state, deployed behavior, file contents) disagrees with what the request assumes, halt and reconcile the discrepancy — the request may be stale.
- **Don't:** trust the request's framing over the observed state and proceed as if the contradiction weren't there.
- **Why:** trusting a checklist/issue-body over live `gh` state reported already-closed issues as open/deferred (errors row 2); the completed-work deploy contradicted the file-3-dupes request (row 67). The contradicting signal was visible and disregarded both times.

---

## Probe the real CLI before asserting

**Probe the actual CLI output before asserting on it or filing a "bug"**

- **Do:** run the real `lcc`/`lccplus` command on a crafted input and read the actual exit code + stdout/stderr *first*, then write the assertion (or decide whether there's a bug at all).
- **Don't:** assert on — or file a bug against — expected CLI behavior inferred from reading the source or the in-memory seam.
- **Why:** running the CLI empirically first caught that the undefined-external link **exits 0** by OG-LCC parity (#1258 — nearly asserted a non-zero exit *and* nearly filed a spurious bug); that `spawnSync` drives the interactive `-i` debugger deterministically (#1259 — the "trickiest" case turned out fine); and that the `--explain` panel is ANSI-coloured (the assertion needs to strip it). The crafted-input probe is cheap; a spurious bug report is not.

**A unit-green seam is not proof the behavior reaches the user — verify end-to-end**

- **Do:** after the pure seam's unit test passes, exercise the behavior through the user-facing surface (e.g. `lcc badfile.e --explain`) and confirm it actually renders.
- **Don't:** treat a passing unit test on the pure seam as proof the user sees the behavior.
- **Why:** the `--explain` content passed its unit tests but never rendered via `lcc badfile.e --explain` — the CLI's own signature check short-circuited and a `catch` dropped the explain key (#1245/#1247). The seam was green the whole time; only end-to-end exercise surfaced the gap.

---

## Check current main before chasing a worktree test red

**When a test reds inside a worktree, reproduce it on current `main` before debugging or filing**

- **Do:** treat a worktree red as suspect until confirmed. A worktree cut from an old base carries that base's (possibly already-fixed) test files, so the FIRST diagnostic is `git fetch origin main` then check whether the failure still reproduces on current main — run the same test at `origin/main`, or do a `git merge-base HEAD origin/main` / rebase check — before you debug it or file a "failing test" bug.
- **Don't:** start debugging (or file a regression) against a worktree red without first ruling out that current main already fixed it.
- **Why:** during #1114 a pre-#1215 worktree base still carried the hard-failing model-backfill test that current main had already fixed; debugging or filing against it would have chased an already-closed problem. A stale base manifests as a phantom red. (TIL 2026-06-14 / RULES.md #548)

---

## Verify a decision's load-bearing premise

**Before ratifying or extending a prior recommendation, verify the premise it rests on**

- **Do:** when a decision builds on an earlier spike or recommendation, re-check its load-bearing premise yourself — especially "the system can't do X" claims. One grep can flip the decision.
- **Don't:** inherit a prior recommendation's premise unchecked and stack the next decision on top of it.
- **Why:** in #845 the #842 spike recommended Option C (JSON-as-companion) on the premise "the Claude Code harness can't load JSON, so RULES.md must stay authoritative." A quick grep showed RULES.md is **not** harness-auto-loaded either (no `@`-import anywhere) — the premise was false, and the recommendation flipped to Option B once checked. (TIL #1191 / #845)

---

## Ticket scoping & closure

**Split a workstream's research, decision, and implementation into separate tickets — put `human-required` on the *decision*, not the research**

- **Do:** when one effort has a "find out / inventory" phase, a "rule on it" phase, and a "build it" phase, file them as distinct tickets (research → decision → implementation), each closeable on its own. Tag `human-required`/`pair-work` on the *decision* ticket; leave the research ticket agent-closeable once its artifact (the doc, the inventory, the options) exists.
- **Don't:** braid all three into one ticket (e.g. "review which X belong, decide, and implement") — no one can then tell what state actually closes it.
- **Why:** a single ticket carrying research *and* a human decision can't be closed by the agent that finished the research, nor safely by the human until they reverse-engineer what "done" means. The #1123 cluster braided research + decision and spawned a redundant close-request ticket (#1154) purely to ask for the close. (#1123 / #1173)

**Give every ticket an explicit Definition of Done + who-may-close in its body**

- **Do:** end each ticket body with a close-criteria line — the concrete, verifiable condition that closes it (machine-checkable where possible), and whether an **agent** or a **human** may close it.
- **Don't:** rely on the title or implied scope to signal when it's done.
- **Why:** legible close-criteria are the only thing that lets a second agent (or the maintainer) close a ticket without re-deriving intent. Their absence is what turns "is this closeable?" into a recurring question and invites close-proxy tickets (below). (#1173)

**Never file a ticket whose only job is to request closing another ticket**

- **Do:** if a ticket looks done but you can't close it yourself (e.g. it's `human-required`), post the close-criteria + a readiness summary as a *comment on that ticket* and leave it for whoever may close it.
- **Don't:** open a new "PM: close #N" ticket to track the close request.
- **Why:** a ticket that exists only to ask for another's closure is a smell — it means the original lacked close-criteria. Fix the original (add the criteria) instead of wrapping it. #1154 was exactly this shape; it was closed as redundant the moment #1123 carried its own close-criteria. (#1154 / #1173)

---

## Issue commenting

**Comment only when required or explicitly permitted — never for progress or intermediate findings**

- **Do:** post a closing comment (required at every close), a blocking-discovery note (required when you find the issue is blocked by something not in the body), or a brief research finding that directly answers an open question in the issue body (permitted).
- **Don't:** post progress updates ("I'm working on this", "halfway done"), intermediate findings that don't change status or scope, or anything whose content belongs in the commit message.
- **Why:** issue threads pollute fast. In orchestrated sessions, multiple agents independently deciding to comment on the same event produces agent-chatter that drowns signal. Prohibition is the only reliable defense. Full policy and solo/orchestrator authorization rules: [`docs/issue-commenting-policy.md`](./issue-commenting-policy.md). (#848)

---

## Personal data in public channels

**Use a bracketed placeholder for any email, credential, or PII in issue/comment/commit text**

- **Do:** write `[your email]`, `[Prof. Dos Reis's email]`, `[sender email]` whenever an address, token, or other PII would otherwise appear in a GitHub issue body, comment, or commit message.
- **Don't:** paste a real email address, API key, password, OAuth/personal-access token, phone number, or other personally identifying detail into issue bodies, comments, or commit messages.
- **Why:** GitHub issues, comments, and commits are public and indexed by web crawlers — a leaked address or token is permanent even after deletion. Repo *files* meant as offline artifacts (e.g. `docs/cuh63-*.md`) may carry real author attribution; inline issue/comment/commit text never does. (origin #537, audit #1007; durable rule: `RULES.md` #22; full policy: `docs/claude_workflow.md` → "What NOT to post publicly")

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

**Don't trust unchecked boxes in a tracker body — verify each child's live state**

- **Do:** Run `gh issue view N --json state -q .state` for each child referenced in the checklist before reporting or acting on its state.
- **Don't:** Read a tracker's issue body, see `- [ ] #N`, and report the child as "open/deferred."
- **Why:** Tracker bodies are frozen snapshots. GitHub does not auto-check boxes when children close. A `[ ]` that was accurate yesterday may be wrong today. One API call per child costs ~1 second; trusting a stale box costs an agent cycle and publishes wrong information. (#904, #906)
- **Correction action:** If you discover a child is already closed after reporting it as open, post a correction comment on the tracker with the correct state immediately — do not leave the wrong information standing.

**Always pass `--as <fruit>` to `npm run claim`; never use a bare positional name**

- **Do:** `npm run claim -- 799 --as grape`
- **Don't:** `npm run claim -- 799` (missing `--as`) or `npm run claim 799 grape` (positional name)
- **Why:** The `--as` flag has been required since auto-naming was disabled in #386. Positional identity was removed; bare names produce an immediate error, costing a wasted round-trip.

**Check `git status` on main before `npm run claim`**

- **Do:** `git status` → if any file your ticket will touch is untracked or modified, commit or stash it first, then claim.
- **Don't:** run `npm run claim` immediately without inspecting main.
- **Why:** `git worktree add` branches from the last *committed* state. Untracked files on main are silently absent in the new worktree. The worktree looks like a clean copy — it just happens to be missing whatever was floating uncommitted.

**Point file writes at the worktree path — an absolute main-checkout path strands the file on `main`**

- **Do:** write new files to `.claude/worktrees/<agent>-issue-N/…` (the worktree's absolute path), or `cd` into the worktree so relative paths resolve there.
- **Don't:** call Write/Edit/Patch with the **main-checkout** absolute path (e.g. `/…/lccjs/docs/foo.md`) while working a claimed worktree.
- **Why:** the tools write to whatever absolute path they're given; being "in" a worktree doesn't redirect a main-checkout path. The file lands untracked on `main`, and the only symptom is a later `git add … did not match any files` in the worktree. Hit three agents in one day — FIG (#1130), INCABERRY (#1162), ELDERBERRY (#1167).

**Use `npm run close <N>` — never hand-push to main**

- **Do:** commit `Closes #N`, then `npm run close <N>`.
- **Don't:** manually push to main or skip the close script.
- **Why:** `npm run close` runs the teardown gate, removes the worktree, and deletes the branch. Bypassing it leaves stale worktrees and branches, and can push mid-rebase.

**Use `git -C <path>` to inspect a worktree; never use a bare `cd` to enter one mid-session**

- **Do:** `git -C /path/to/worktree log --oneline -3`
- **Don't:** `cd /path/to/worktree && git log …` (then forget to return)
- **Why:** a bare `cd` changes the persistent shell cwd for the entire conversation. All subsequent `git`, `npm run claim`, and `git pull` commands run from the wrong directory. `git pull` silently reports "Already up to date" on the feature branch instead of on main — false confirmation. (#819)

**Run `git worktree remove` from the main checkout; `git worktree prune` before retrying a failed remove**

- **Do:** prefer `npm run close <N>` — it tears the worktree down for you. When removing by hand, run `git worktree remove .claude/worktrees/<fruit>-issue-<N>` **from the main checkout** (or use `git -C <main-path> worktree remove …`). If it fails with `fatal: not a working tree` (exit 128), the worktree was already auto-pruned — run `git worktree prune` once, then retry; treat an already-gone worktree as success, not a new failure.
- **Don't:** run `git worktree remove` while the shell's cwd is *inside* the worktree being removed; don't re-run the same `remove` on an already-pruned worktree without `prune` first.
- **Why:** removing from inside the target yields `fatal: could not get current working directory` / `getcwd: cannot access parent directories` because the cwd vanishes mid-command. Retrying a remove on an already-pruned worktree yields `fatal: not a working tree` — that is a stale ref, not a live failure; `git worktree prune` clears it. Worktree-teardown failures are the single most recurring `GIT_STATE` pattern in the errors table — five rows across both shapes (audit #1007). This is the *teardown* counterpart to the `git -C` inspect rule above.

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

## Terminal stdout & golden parity

**Mirror new lccjs terminal stdout into the `.lst` Output section, or debug-gate it**

- **Do:** route new program output through the same surface the `.lst` `====== Output` section records (the assertion surface the golden suites diff), or gate purely-diagnostic output behind a debug flag.
- **Don't:** add a bare `console.log` / extra banner that writes to the terminal only, without it also landing in the `.lst` Output section.
- **Why:** the oracle-parity golden suites diff `.e`/`.lst`/`.bst` only. Terminal-only output the oracle never emits is **invisible to golden parity** — it can silently break oracle compatibility while every suite still passes. A stdout-capture assertion was deliberately *not* built into the suites (high-cost/low-yield — #1055 verdict); this convention is the belt-and-suspenders. (Narrow residual of the #931 failure class; origin #1055 item #4.)

---

## Velocity logging

**Log a velocity row for every puzzle — including PM, RESEARCH, and SPIKE tasks that change no files**

- **Do:** `npm run velocity:log -- '{…}'` after every closed ticket, regardless of role.
- **Don't:** skip the row for "no-code" work.
- **Why:** "no worktree needed" ≠ "no logging". Skipping PM/RESEARCH rows gaps the calibration data and makes throughput stats misleading.

**Capture the start timestamp and set C before reading the issue; use canonical model short-form and fixed role codes**

- **Do:** run `date '+%Y-%m-%dT%H:%M:%S%z'` the moment a task is assigned — before the issue number is known, before reading the body. Then set `c_min` as your honest forward-looking estimate. Use `sonnet-4.6` (not `claude-sonnet-4-6`). Use `COMBO` for refactor+test, not a compound string.
- **Don't:** set `c_min` or capture `started_iso` retroactively, use the full model ID, or invent role codes.
- **Why:** retroactive timestamps produce approximate rows that gap calibration data. Canonical short-form keeps the model column queryable. Note since #1184: a non-canonical `model` is no longer *rejected* — `velocity:log` records it and prints a one-line notice, and the CSV test reports (does not fail on) non-canonical values. Roles are still hard-rejected (a closed vocabulary). So canonical form is the convention to follow, not a gate that blocks you. (#819, #1184)

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
