# Claude Workflow — what an AI agent does for each puzzle

**Why this file exists (vs. `CLAUDE.md`):** `CLAUDE.md` is the lean, always-in-context
orientation loaded every session — it points here but deliberately does *not* duplicate
the protocol. This doc is the full, on-demand reference for the project's
Puzzle-Driven-Development process: read it before doing puzzle work, and treat it
as the authority when a quick summary and the detail disagree. It also serves human
reviewers asking "what happened / what should happen next." When the protocol changes,
this doc is the single source of truth to update (see "When this document is wrong" below).

This doc describes what a Claude (or any AI agent following the project's
conventions) does at each phase of working on a "puzzle" — a single bounded
piece of work tied to a GitHub issue and time-tracked in
[`puzzle-velocity.csv`](./puzzle-velocity.csv).

It is intentionally short. Detailed protocols live in their own files:

- [`puzzle-lifecycle.md`](./puzzle-lifecycle.md) — the plain, step-by-step lifecycle: how a puzzle becomes a GitHub issue here (issue-first, not 0pdd) and how the `@todo` marker signals "done"
- [`puzzle-velocity.md`](./puzzle-velocity.md) — the time-tracking protocol + column reference + calibration history
- `~/.claude/skills/puzzle-velocity/SKILL.md` — the skill that auto-triggers the protocol when an agent picks up or closes a puzzle
- [`glossary/README.md`](./glossary/README.md) — the entry conventions for writing glossary definitions
- Memories at `~/.claude/projects/-home-avi-Documents-Study-JavaScript-lccjs/memory/` — feedback / project / reference notes the user has confirmed

If you're a human reviewer wondering "what happened" or "what should happen
next," start here.

---

## The four phases

```
                    ┌──── At start ─────┐
                    │  pick up ticket   │
                    │  capture H, C, t₀ │
                    └─────────┬─────────┘
                              ▼
                ┌──── While continuing ─────┐
                │   do the work             │
                │   surface findings        │
                └──────────┬────────────────┘
                           ▼
              ┌──── Maybe paused ─────┐
              │  user pivots / waits  │
              └─────────┬─────────────┘
                        ▼
                ┌──── At close ─────┐
                │  capture t₁       │
                │  one-commit close │
                │  velocity row     │
                └────────┬──────────┘
                         ▼
                    next puzzle
```

---

## Session orientation (responding to a readiness greeting)

When a session opens with an agent-readiness greeting — _"you are agent BANANA. are
you ready to work?"_ or any variant — the correct response is:

1. **Reply with a short confirmation** ("Ready." or similar, one line).
2. **Stop.** Wait for the first explicit task assignment.

**Do not** invoke puzzle-triage, fruit-agent-orchestrate, or any other skill
speculatively. A greeting is not an implicit request to triage the backlog, list
available issues, or orchestrate work. Skills fire only on explicit user requests:
a specific trigger phrase, a `/skill-name` invocation, or an unambiguous directive
("what should I work on?", "/fruit-agent-orchestrate").

This rule applies even if the agent would "naturally" want to orient itself by
checking the backlog. Orientation is the user's job to trigger — the agent's job
is to be ready when asked (#377).

---

## At start (picking up a puzzle)

> **Investigation and research requests are tickets too.** "File a ticket to investigate X", "look
> into Y", "audit Z" are *work*, not pre-work — they get the same claim → start-timestamp → work
> sequence as any puzzle. **Scope or claim before producing findings;** never run `gh`/`git`
> forensics on `main` and publish conclusions before a worktree exists. Carve-out: if the request is
> genuinely just "file the issue" with no findings yet, filing the issue without a claim is fine —
> the moment you start *producing findings*, that's claimable work. (#1122: an agent asked to *file*
> an investigation ticket did the whole investigation inline on `main` first — no claim, no start
> timestamp — and filed inaccurate findings because it never read the evidence that already existed.)

**Pre-claim checklist (run all three before `npm run claim`):**

```bash
gh issue view <N>   # 1. confirm the issue is still OPEN
git status          # 2. confirm main is clean — untracked files don't carry into worktrees
```

3. Have your fruit identity ready — **always pass `--as <fruit>`**:
   ```bash
   npm run claim -- <N> --as <fruit>   # correct
   # NOT: npm run claim -- <N>         # ← missing --as causes an immediate fatal error
   ```

If any file your ticket will touch is untracked or modified on main, commit or stash it first — branching from a dirty main means the worktree starts from a stale committed state. See [`docs/do-this-not-that.md`](./do-this-not-that.md) for the full `--as` rule. (#469, #386, #895)

**Before reading the issue:**

1. Capture the start timestamp:
   ```bash
   date '+%Y-%m-%dT%H:%M:%S%:z'
   ```
   Time starts the moment context-gathering begins, *not* the moment work begins. Reading the issue counts as start.

2. If the ticket has no C (Claude) estimate yet, set one now — before reading anything substantive about the task. This is a *forward-looking* prediction; the point is to track how my expectations align with reality.

**Then:**

3. Read the ticket body and all comments via `gh issue view <N> --comments`.

   > **If the orchestrator briefing contradicts the issue body, surface the conflict before starting work.** The issue body is the spec; the briefing is a hint. One sentence to the user ("your briefing says X, the issue says Y — implementing Y; confirm if wrong") prevents silent misalignment.

   > **An orchestrator briefing is a point-in-time snapshot — re-validate OPEN before claiming.** The assignment list was triaged when the orchestrator ran; in parallel operation an assigned `#N` may have CLOSED in the interval (the `fruit-agent-orchestrate` output now carries a `⏱ Triaged as of <ISO>` banner for exactly this reason). Step 1 above (`gh issue view <N>` → confirm OPEN) is the guard — never skip it because the briefing "just" handed you the ticket. (#1159)

   > **For a grooming/PM ticket, re-verify its *referenced* tickets at execution time — not just the assigned ticket at claim time.** #1159 guards the ticket you were handed; it does **not** guard the `#N`s that ticket *grooms*. When a PM/hygiene ticket's content **is** dependency metadata about another ticket X — the open/closed state of X's blockers — re-resolve **every referenced `#N`** (`gh issue view N --json state`) immediately before you edit or close, because sibling agents may be closing those very deps *during* your task. The assigned ticket can stay OPEN the whole time while the facts it grooms rot underneath you. Repro: grooming #1102's dependency block went stale twice in one session as #1005 (closed 08:39) then #1100 (closed 10:46) landed while #1102 itself never closed. (#1243, extends #1159 from claim-time/self to execution-time/referents)

   > **If this is a tracker ticket, verify each child's live state** — do not trust the checkboxes in the body. Run `gh issue view N --json state -q .state` for each `#N` listed. Tracker bodies are frozen snapshots; GitHub does not auto-check boxes when children close. See [`docs/do-this-not-that.md`](../docs/do-this-not-that.md) → "Don't trust unchecked boxes." (#904, #906)

4. Read referenced docs / source files needed for context.
5. **Sweep existing in-repo evidence before forming conclusions.** For any subject ticket `#M` your work investigates, check `docs/logs/*M*`, `docs/research/*M*`, the subject's GitHub comments, and any artifact it produced *before* reconstructing the story from `git`/`gh` alone. A captured work log or prior findings doc is primary source; git archaeology is the fallback. (#1122: a review called a stale-HEAD timing bug a "confabulation" purely because `docs/logs/1076-honeydew-ticket-work-log.md` was never opened.)
6. **Verify the repro before writing any code.** Run the exact commands or steps from the issue's "Have" section and confirm the bug or gap is still present. If the described state is already absent — the fix landed in a sibling branch, the feature already exists, or the condition no longer triggers — **stop and investigate** before proceeding; do not assume the issue is live without checking. Only proceed to implementation once a hands-on repro confirms the "have" state. If the issue is already resolved, the closing commit is a `chore:` or `docs:` noting the discovery (the close sequence and velocity log still apply).
7. (Optional) `TaskCreate` if the puzzle has 3+ distinct sub-steps worth tracking.
8. Pick the smallest concrete first step and start.

**What I do *not* do at start:**

- I don't expand scope ("while I'm here, let me also …"). The scope is fixed at the ticket body.
- I don't take destructive setup steps (force-pushing, dropping branches, deleting files) without explicit user authorization.
- I don't speculatively decompose work I haven't started. Decomposition happens when I see the work is too big — not as a default.

---

## While continuing (doing the work)

- **Stay in scope.** Anything outside the ticket gets logged as a finding, not pursued.
- **Tracker tickets require a child issue before any work.** If the assigned ticket is a tracker (body says "stays open until children resolve"), file a concrete child issue for the chosen sub-item *before* claiming a worktree or starting work. Velocity is logged on the child; the tracker stays open. No exceptions for small or obvious items. (RULES.md #12)
- **Surface findings as I notice them — file tickets immediately and unilaterally.** Open questions, unexpected behaviour, brittle code, or deferred work discovered mid-task all become GitHub issues, filed without asking permission. The tracker is the only shared memory that survives context compaction and agent rotation; if something isn't filed, it disappears. Filing is not a destructive action — a wrong ticket can be closed immediately. Cite the new number inline and move on: "Filed #N for X — continuing." Do **not** ask "should I create a ticket?" or "want me to file an issue?" (#511)
- **Dedup before filing — search the queue first.** "File immediately" does *not* mean "skip the 5-second check that it isn't already tracked." Before `gh issue create` for a newly-discovered defect, run `npm run file-issue -- --title "<your title>"`: it searches all open+closed issues by title-term overlap and **blocks (exit 2)** when a likely duplicate exists, listing the candidates. If one matches, comment on it instead of filing a new ticket; if it's a genuine new issue, re-run with `--create` (add `--body-file`/`--label`) or `--force`. This is the guard for the #1104/#1128 collision, where three actors converged on one defect and a duplicate was filed. (#1253, residual of #1134 facet 2)
- **Pre-state decision criteria when filing a RESEARCH or triage ticket.** When the deliverable is to classify or triage a set of items, write the decision rule into the issue body so the executing agent does lookups, not judgment calls. A criteria block makes triage mechanical (the #933 triage processed 14 items in ~2 minutes this way). Example:
  ```
  **Decision criteria:**
  1. Fix to an existing artifact → DATA or STATS ticket
  2. New analysis → RESEARCH or SPIKE ticket
  3. Blocked on data volume → explicit defer with threshold (e.g. "revisit at day 14")
  4. Already covered → link and close
  ```
  An author who states the criteria up front has already made the judgment calls; the triage agent should not have to re-derive them. (#1001)
- **Issue titles must use `ROLE:` prefix — commit format is prohibited.** (#641) Every issue title must begin with an uppercase role word followed by a colon and a space: `ROLE: short description`. The commit-message format (`type(scope): description`) is **never** valid as an issue title — do not write `fix(linker): …` or `docs(learnings): …` in a GitHub issue title.

  Canonical role vocabulary (use exactly as shown):

  | Role | When to use |
  |------|-------------|
  | `DEV` | Implementation work, bug fixes, refactors |
  | `TEST` | Adding or fixing tests |
  | `WRITER` | Documentation, workflow, RULES.md edits |
  | `PM` | Project management, triage, tracker upkeep |
  | `SPIKE` | Time-boxed research with a concrete deliverable |
  | `ARCHITECT` | Design decisions, ADRs (not `ARCH` or `ARC`) |
  | `RESEARCH` | Open-ended investigation, no immediate code change |
  | `REVIEW` | Code or PR review tasks |
  | `TIL` | Today-I-Learned entries (exempt from strict `ROLE:` format — use `TIL YYYY-MM-DD AGENT — description`; see #640) |

  Non-standard prefixes seen in the wild and their canonical mappings: `AUDIT:` → `REVIEW`, `DECISION:` → `ARCHITECT`, `Q:` → `SPIKE`, `HUMAN REVIEW:` → `REVIEW`, `Tracker:` → `PM`. Full scannable reference: [`docs/issue-title-convention.md`](./issue-title-convention.md) (#657).

- **Severity label calibration — apply one `severity:*` label when filing any issue.** The three labels are `severity:high`, `severity:medium`, and `severity:low`. Use this decision tree: (#643)

  1. **Start at `severity:medium`** if the ticket is `DEV` or `TEST` and affects runtime behavior, user-visible output, or correctness.
  2. **Escalate to `severity:high`** if it blocks other work, causes data corruption, produces broken output, or is a public-API regression.
  3. **Drop to `severity:low`** only if the ticket is cosmetic, docs, PM, TIL, or a refactor/cleanup with no user-visible change.

  | Label | When to use |
  |-------|-------------|
  | `severity:high` | Data corruption, broken output, blocking regression, public-API breakage |
  | `severity:medium` | **Default for any DEV or TEST ticket** that affects runtime behavior, user-visible output, or correctness |
  | `severity:low` | Docs, PM, TIL, refactor/cleanup with no user-visible change, cosmetic issues |

  When in doubt: `DEV` → `severity:medium`, `WRITER`/`PM`/`TIL` → `severity:low`.

- **Area label — apply one `area:*` label when filing any issue.** Every `gh issue create` must include at least one `--label area:*` so the issue lands in a lane (`area:process`, `area:toolchain`, `area:web`, `area:education`, `area:architecture`, `area:lcc-non-core`). If none clearly fits, use `area:uncategorized` (the explicit "needs an area before work begins" placeholder) rather than omitting the label — an unlabelled issue is invisible to area-based triage and orchestration. (#1014) **`npm run claim` now hard-blocks** an issue with no real `area:*` label (only `area:uncategorized` or none) — assign a lane first, or pass `--allow-uncategorized` (alias `--no-lane-check`) as an explicit human bypass. (#1151)

- **Research findings go in issue comments, not TIL docs.** When a research ticket or spike produces findings, post them as a comment on the originating GitHub issue — not as a `docs/learnings/today-i-learned-*.md` file. Only write a TIL entry when: (a) the user explicitly asks ("write a TIL", "add to learnings"), or (b) the knowledge is durable, genuinely cross-ticket, and belongs in a persistent learning log rather than on one ticket. When in doubt, use the issue comment. (#437) When a TIL entry IS appropriate, treat it as work: file an issue, claim a worktree, commit from it, log velocity, and close via `npm run close` — RULES.md 4, 5, 8, 9 apply unconditionally. (#469)
- **Verify every `#N` before posting a comment that references it.** A research or audit comment that cites child tickets ("Filed #N for X") must use the *actual* numbers the tickets received, not the placeholders guessed while drafting. Create the child issues first, capture their real numbers from the `gh issue create` output, then write the comment. Confirm with `gh issue list --limit 5` (or `gh issue view N`) that each `#N` resolves to the intended issue — `gh` has no edit shortcut, so a wrong number means delete-and-repost. (#996)
- **Correcting a sibling issue's description.** If I find a factual error in *another* issue's description (wrong cross-ref, stale dependency, outdated premise), I do **not** silently rewrite the body. I redline it: `~~strikethrough~~` the wrong text in place, add a `> ⚠️ **SEE COMMENTS FOR CORRECTIONS**` banner at the top, and post the correction as a comment — so the original stays visible and the fix is additive. The `yegor-tickets` skill owns this convention (#300).
- **Issue commenting policy** — [`docs/issue-commenting-policy.md`](./issue-commenting-policy.md) is the canonical reference for when to comment or open issues. Quick summary: **required** — closing comments (step 3 of "At close" below) and blocking discovery; **permitted** — spike findings that directly answer an open question, scope-exclusion notes; **prohibited** — progress updates, intermediate findings, anything that duplicates the commit message. Solo agents must not open new issues without PM authorization or an explicit workflow step naming it. Orchestrators must document per-phase comment authorization in their workflow script. `gh issue comment *` is pre-authorized in `settings.json`; `gh issue create` is not. (#848)
- **Verify as I go.** For code changes: assemble, run tests, exercise the change. For doc changes: re-read for accuracy and link sanity. For research: cite source line numbers so the reasoning is checkable.
- **Register first-use skills in `docs/skills.md` in the same session.** If I invoke a skill that has no entry in `docs/skills.md`, add one before closing. Skills adopted silently leave the inventory perpetually behind usage. (#929)
- **Wrap tool invocations with `lccrun.sh`.** Any shell call to `lcc.js`, `interpreter.js`, `linker.js`, or the oracle binary (`$LCC_ORACLE`) that could read from stdin **must** go through `scripts/lccrun.sh`:
  ```bash
  scripts/lccrun.sh [<secs>] node src/cli/lcc.js <file>.a       # default 30 s
  scripts/lccrun.sh [<secs>] "$LCC_ORACLE" probe.a
  ```
  Bare invocations block indefinitely when `name.nnn` is absent and stdin is not a TTY (agent FIG, 2026-06-01: 28 min at 99.9% CPU). The runner kills the full process group on timeout and exits 124. Only skip the runner for `assembler.js` or `linker.js` invocations that provably never reach the interpreter (i.e., `--assemble-only` / `-o` output and no `-i` flag).
- **Use TaskUpdate** to mark sub-steps complete if I created tasks. Cleaning up the task list is part of the work.
- **Brief, accurate status updates** — one sentence at key moments, not a running monologue.
- **Tool-failure discipline.** Any `tool_use_error` from Edit/Write/Bash means the operation **did not happen** — treat it as a hard block, not advice. Two real failure modes have shipped broken state in this project:
  - *Stale read* (`File has been modified since read`) — another agent touched the file between my Read and Edit. The file is unchanged from its pre-Read state; my intended edit is lost.
  - *Classifier outage* (`Opus temporarily unavailable, auto mode cannot determine safety`) — the Edit's safety check couldn't run. Write/Edit returns an error; the file is unchanged.
  Do NOT `git add` a file I just edited unless I've confirmed the edit applied — re-read, grep for the new content, or check `git diff`. A successful tool result for the *next* call after an error does NOT retroactively apply the failed one. This pattern shipped raw conflict markers in lccjs commit `cb798a7` (#139 close); followup `a19d115` cleaned it up. The puzzle-velocity skill 0.4.0 has a grep guard for the rebase-conflict variant specifically; this rule is the general case.

**If I'm working in a `git worktree`** (because of parallel-agent activity):

- **I claim under a self-assigned agent identity** — sync `main` first (`git pull --ff-only origin main`), then `npm run claim -- <issue> --as <fruit>`. Identity precedence: `--as <fruit>` > `CLAUDE_AGENT_NAME` (export at launch) > `auto` (first-claim of a session, race-safe). Full contract: `docs/design-agent-worktree-identity.md`.
  - **`auto` is only safe for the first claim of a solo session.** When the human launches ≥2 agents in parallel (fan-out), identities must be pre-assigned before any agent claims: `npm run claim -- <N> --as apple` (or set `CLAUDE_AGENT_NAME=apple` at session launch). Bare `auto` in a multi-agent context risks handing the same fruit to two different sessions (#193).
- The worktree lives at `.claude/worktrees/<fruit>-issue-<N>/` on branch `<fruit>/issue-<N>-<slug>`. **Worktree and claim names must use only `[A-Za-z0-9._-]`** — a `/` in the name becomes `+` on disk and can interfere with other tooling (see `docs/design-agent-worktree-identity.md` for the naming contract). (Legacy worktrees used `worktree-issue-<N>`; both still carry `issue-<N>`, so `puzzle:status` recognises either — it just can't attribute the legacy ones to an agent.)
- I work in the worktree, not in the main checkout.
- All file edits and commits happen in the worktree.
- I push using the trunk-based pattern: `git push origin HEAD:main` (after rebase).
- **I flip the puzzle's marker from `@todo` to `@inprogress`** the moment I check it out, so the marker on `main` reads as *claimed*, not idle. `pdd` ignores `@inprogress` (it matches only `@todo`), so this keeps the gem's count clean while signalling other agents to keep off. At close the marker is deleted as usual; if I abandon the work, I flip it back to `@todo`.
- **`npm run puzzle:status`** reconciles every marker against live worktrees and GitHub issue state — it shows each puzzle as `AVAILABLE` / `CLAIMED` / `IN-PROGRESS` / `LOCKED` (a clustermate is in progress) / `BLOCKED` (a `blocked` label or an open `blocked_by` dep) / `STALE`, and attributes claimed/in-progress rows to the owning agent (`… by apple`) when the worktree branch carries a fruit identity. Run it before grabbing a puzzle (don't grab a `CLAIMED`/`IN-PROGRESS` one) and after closing (a `STALE` row means a marker outlived its closed issue — delete it). `-- --strict` exits non-zero on any stale marker, for gating.
- **I remove my worktree when I finish** (this is mandatory, not optional — see "At close" below). A worktree left on disk after the issue is closed is cruft: it looks like a live claim to other agents and to `puzzle:status`, but no one is in it. The owning agent cleans up its own worktree; do not assume someone else will.

---

## What NOT to post publicly

GitHub issues, PR comments, and commit messages are **public and indexed by web crawlers**. Never include any of the following in issue bodies, comments, or commit messages:

- **Personal email addresses** — use placeholders: `[your email]`, `[Prof. Dos Reis's email]`, `[sender email]`.
- **Credentials and tokens** — API keys, passwords, OAuth tokens, personal access tokens, `.env` values.
- **Phone numbers** — any telephone or SMS contact details.
- **Other PII** — anything that uniquely identifies a real person and that they have not already published themselves in this context.

**The distinction for email addresses:**
- Repo *files* intended as offline artifacts (e.g. `docs/cuh63-*.md`, PDFs for external distribution) → real author attribution email is acceptable there.
- Inline *issue/comment text* → always use a placeholder, never the real address.

When drafting an email template or message for review in an issue, replace every real address with a bracketed placeholder before posting. Cite this section if declining to include a real address in public-facing content.

Triggered by #507 (personal email in a review comment); rule documented in #537.

**GitHub handle validation:** Before mentioning a GitHub handle in an issue or comment, verify it resolves with `gh api /users/<handle>` — a 404 means the handle doesn't exist and the @-mention will silently not send a notification. Collaborator handles live in one place — the `CONTRIBUTOR_*` registry in `.env.example` (e.g. Charlie = `@ItBeCharlie`), summarized in `CLAUDE.md` → "Collaborators". Don't re-list handles here; this avoids the drift that left two different (both 404) handles recorded for Prof. Dos Reis. Rule documented in #635.

---

## While paused

A pause happens in two shapes:

**Brief pause (within the same session):**

- User asks a question, pivots, or wants me to wait for confirmation.
- I stop new work but keep my mental context.
- I don't commit in-progress prose — half-written work doesn't go into git.
- I don't restart from scratch when work resumes; the conversation context bridges it.

**Long pause (likely end-of-session, context compaction risk):**

- If significant work is uncommitted, I propose committing it as a draft with a clear "WIP" prefix — never with `Closes #N`.
- If the puzzle is more than half done but not closeable, I suggest writing a handoff doc via the `/handoff` skill so the next session/agent can resume cleanly.
- I don't try to force-close a puzzle that isn't actually done just to land *something*.

---

## At close (finishing the puzzle)

**Before the closing commit:**

1. Capture the finish timestamp:
   ```bash
   date '+%Y-%m-%dT%H:%M:%S%:z'
   ```
2. Final verification — does the change actually do what it should?
3. **Pre-close scope audit (mandatory):** Run `git diff origin/main` and verify every
   changed file and function falls within this ticket's "Should have." If any change
   is out of scope:
   1. File a ticket for it immediately.
   2. Revert or stash the out-of-scope change.
   3. Close this ticket with only the in-scope work.
   4. Pick up the newly filed ticket separately.

   Three failure modes to watch for: bug found mid-implementation (FM-1),
   discovery time absorbed without logging (FM-2), multi-fix bundled under one
   number (FM-3). See `docs/research/601-scope-discipline.md`.
4. **Pre-close finding audit (mandatory, all ticket types):** Before running `npm run close N`, answer:
   1. Did you notice any bug, regression, or process failure not in this ticket's scope? → File a ticket now.
   2. Does this close change anything that contradicts an open ticket, doc, or TIL entry? → Cross-reference or file a ticket.
   3. Is there a follow-up question or decision that needs routing to a human? → File a ticket with the `humans-only` label.

   Green-light only when all three are "no" or "filed #N for it." (Addresses C-1, C-2, C-3, E-2 from [`docs/research/orchestration-failure-modes.md`](./research/orchestration-failure-modes.md), #627. Skill enforcement layer: M7 / #644.)
5. **Research closes — file follow-up tickets for proposals.** If this is a research or spike ticket whose deliverable proposes concrete changes (new rules, doc updates, code modifications), file a follow-up DEV (or SPIKE) ticket for each distinct proposal before running the close sequence. A research close that ends with "here are N proposed changes" but no child issue is half-finished: the findings exist but have no path to implementation. Filing is not optional — a wrong ticket can be closed immediately. Cross-ref: scope-discipline failure mode taxonomy in [`docs/research/601-scope-discipline.md`](./research/601-scope-discipline.md), #615. (#621)
6. **Surface `/next-best-action` — run it only with explicit user go-ahead.** The pre-close finding checklist answers six questions (bug/regression, process recurrence, doc contradiction, closing loop, deferred decision/external routing, error self-audit) and catches the findings most likely to evaporate at close time. But it's a token-heavy 2–3 minute pass, so **do not auto-run it and do not auto-skip it by duration**: at close, flag that it applies and run it *only* once the user approves. Don't gate on how long the turn took — a sub-minute close can still hide a fileable finding; the cost control is the approval gate, not a duration heuristic. (#644, #1279)
7. **Pre-close error self-audit (mandatory — `copper-civet`):** Before the velocity log and closing commit, re-read your session history from the point you claimed the ticket to now and enumerate every loggable error (the `log-error` triggers — failed tool/Bash/git/`gh`/claim calls, hook blocks, denied permissions, schema/validation failures, *including* ones you retried and resolved). For each, confirm an `errors` row already exists (`sqlite3 ~/.lccjs/lccjs.db "SELECT id,error_type FROM errors WHERE ticket=N"`) or log it now via `npm run error:log`. Then state the outcome explicitly in your closing comment — one of *"error self-audit: N row(s) logged"* or *"error self-audit: no loggable errors this session."* This is the [Option D mechanism from #1117](#error-logging): `close.js` can't see the transcript, but you can, so the audit is yours to run. The explicit statement is what turns silence into a checkable acknowledgement — without it, "I hit no errors" and "I forgot to log" look identical (the #1108 repro). Reflexive case: if the audit catches an error you should have logged earlier, log it now (and, once #1118 lands, also log a `COMPLIANCE_FAIL` row recording that error logging was missed-then-caught).

**The close sequence** (full protocol in [`puzzle-velocity.md`](./puzzle-velocity.md)):

> **`npm run close` does not commit.** It only pushes what is already committed.
> All changes must be in a commit before step 3 — a dirty working tree aborts
> close immediately with `✗ working tree is not clean`.

```bash
# 1. Log the velocity row (validates + inserts into ~/.lccjs/lccjs.db,
#    then auto-exports docs/puzzle-velocity.csv)
npm run velocity:log -- '{"ticket":N,"role":"DEV","agent":"BANANA",...}'

# 2. One commit carries everything: delete the source marker + the exported CSV
#    (close will abort if anything is uncommitted — commit BEFORE step 3)
git add -A
git commit -m "... Closes #N"

# 3. Land + clean up — run this from inside the worktree (not a subdirectory,
#    not the main checkout). After teardown npm's process may print a getcwd
#    error; that is cosmetic — see step 5. (loops fetch/rebase/push until
#    landed on origin/main, removes worktree.)
#    Do NOT run `git pull` after close — close handles the main checkout sync.
npm run close N
```

**Multi-issue single-worktree close (#844):** When two issues must be closed from the same worktree (required when both modify the same file to avoid merge conflicts), there are two protocols depending on when the commits are made:

- **Protocol A — interleaved** (commit before each close): Commit A → `npm run close A --keep` (lands commit A, keeps worktree alive) → Commit B → `npm run close B` (lands commit B, tears down). The `--keep` flag skips teardown; the worktree survives for the second commit.

- **Protocol B — batch** (both commits already made): Run `npm run close <branch-issue>` — the issue whose number matches the worktree **branch** (normally the **first** issue claimed, e.g. branch `apple/issue-A` → `npm run close A`), **not** "the last-committed issue." `close.js` gates the close target against the branch name (`scripts/close.js:784` → `branch "…" does not match issue #N. Wrong worktree?`), so passing the last-committed *sibling* is rejected outright. The sibling issues still close: their commits land via their own `Closes #N` footers regardless of commit order, and GitHub auto-closes them on push. **Guard 1 caveat:** the velocity ticket-match guard (`checkVelocityTicketMatch`, `scripts/close.js:464`) inspects only HEAD's `docs/puzzle-velocity.csv` diff — in a batch close that row belongs to whichever sibling was committed *last*, not the branch-issue — so pass `--skip-ticket-match` when HEAD's velocity row records a different sibling. Post each sibling's closing comment manually afterward: `gh issue comment <sibling> --body "Closed in <sha>."` — do **not** attempt a second `npm run close <sibling>` after teardown (the worktree is gone; it will fail the branch check).

**Build-artifact tickets:** If the closing commit must include a generated file (e.g. from `npm run build:site`), run the build *before* step 1 (`velocity:log`) — so the artifact, the exported CSV, and the `Closes #N` marker all land in the same commit. If the artifact is rebuilt by CI on every push, prefer gitignoring it so no local artifact commit is needed at all. (`docs/site/` falls in this category: `pages.yml` already rebuilds it from source on every push to `main`, so it can safely be gitignored.) (#492)

**Fallback** (when `npm run close` is unavailable — `&&`-gate is mandatory so cleanup can't race ahead of a failed push):

```bash
git pull --rebase && git push && \
  git worktree remove .claude/worktrees/<fruit>-issue-N && \
  git worktree prune && \
  git branch -D <fruit>/issue-N-<slug>
```

**Leave `closed_commit` empty** in the velocity row — the `git pull --rebase` rewrites
the closing commit's SHA, so any SHA captured before the push orphans. Recover on demand:

```bash
git log --grep "Closes #N" -1 --format=%h
```

Do **not** `git commit --amend` to backfill the SHA — amend orphans the original.

**After the push:**

3. **Post a closing comment on the issue** — always, regardless of whether there is a tracker. For research tickets: 1–3 sentences summarising the finding and the DEV child (if filed). For DEV tickets: one line noting what changed and the commit SHA. Use an issue comment, not a body edit (comments are append-only; body edits race with parallel agents). If there is a tracker checkbox, update it in the same comment. **Use past-tense headings** so it is unambiguous that work is already done — e.g. "What was found:", "What was done:", "What changed:" — not tense-neutral labels like "Fix:" or "Root cause:" that read equally as to-do items (see [`do-this-not-that.md`](./do-this-not-that.md) → "Closing commits").
4. Mark any related TaskCreate tasks as complete via TaskUpdate.
5. **Worktree teardown + main sync** — handled automatically by `npm run close` (confirms commit on `origin/main`, removes worktree + branch, then fast-forward-pulls the main checkout). Do **not** run `git pull` after close — close handles the sync. (#352) To avoid the cosmetic getcwd error entirely, run `node scripts/close.js N --branch <branch>` from the main repo root instead of `npm run close N` from inside the worktree. If you run from inside the worktree, the getcwd error is cosmetic — the close itself still succeeded; verify via `CLOSE OK` in stdout and do **not** re-run close on that basis. close.js prints `Shell re-root: cd <path>` just before exit; use that path if you need to issue further commands from main. (#352, #360, #379, #413) If using the fallback path, confirm first (`git branch -r --contains HEAD` → `origin/main`), then run the `&&`-gated chain above. This is **mandatory**: a worktree left after close looks like a live claim to every other agent and to `puzzle:status`.
6. Report what changed in 1-2 sentences. Include the velocity Δ if it's interesting.

**What I do *not* do at close:**

- I don't squash commits or rewrite history once pushed.
- I don't force-push to `main`, ever, without explicit user authorization.
- I don't open a PR unless asked — the project uses trunk-based merges.
- I don't gold-plate. Once the ticket scope is met, I stop.
- I don't leave my worktree on disk after closing. Cleaning it up is part of closing (step 5), not a later chore for someone else.

---

## What I track in the velocity log

One row per closed puzzle, written via `npm run velocity:log`. Full column reference: [`docs/velocity-schema.md`](./velocity-schema.md).

---

## Error logging

When a non-trivial error occurs during puzzle work, log it to `~/.lccjs/lccjs.db` using `npm run error:log`. Full protocol: `~/.claude/skills/log-error/SKILL.md`. Schema reference: [`docs/errors-schema.md`](./errors-schema.md).

**Log when:** a tool call fails with work impact, `npm run claim` fails, a git/gh/DB operation fails, or a hook blocks a commit.

**Always log** — every error, misfire, and mistake, *including* those retried and resolved immediately. A single resolved conflict is noise; ten in a week is a pattern. Record how it was resolved in `notes`; resolution is not a reason to skip the row.

**Skip only when:** (a) the message is a purely informational warning with no work-plan impact (e.g. `[MODULE_TYPELESS_PACKAGE_JSON]`, deprecation notices — not errors), or (b) the identical error was already logged for this ticket this session.

```bash
occurred_iso=$(date '+%Y-%m-%dT%H:%M:%S%z')
npm run error:log -- '{"occurred_iso":"<occurred_iso>","agent":"CHERRY","model":"sonnet-4.6","ticket":<N>,"error_type":"<TYPE>","message":"<raw message>","context":"<JSON>"}'
```

Valid `error_type` values (15, mirroring `VALID_ERROR_TYPES` in `scripts/error-log.js`): `TOOL_DENIED`, `HOOK_BLOCK`, `CLAIM_FAIL`, `BASH_FAIL`, `GIT_FAIL`, `GIT_STATE`, `GH_FAIL`, `GH_INFO`, `DB_FAIL`, `FILE_FAIL`, `EDIT_PRECOND`, `SKILL_FAIL`, `NETWORK_FAIL`, `VALIDATION_FAIL`, `OTHER`.

Error logging is a **manual, deliberate step** — not a hook. Hooks can't tell transient noise from significant failures; agents can.

### Pre-close self-audit (the reliability mechanism — #1117)

Logging "at the moment of failure" is the ideal, but it is **easy to forget**: an agent
self-corrects a misfire, moves on, and the row never gets written. The discipline therefore
under-reports — it captures an error only when the agent both *notices* the trigger and
*remembers* the protocol mid-task. The #1108 repro: three loggable errors (a `CLAIM_FAIL`, two
`VALIDATION_FAIL`s, a `TOOL_DENIED`) went unlogged until a human asked "did you log your errors?",
then were backfilled as rows 49–51.

The fix (chosen as **Option D** in #1117) is a **mandatory pre-close transcript self-audit**, not an
automated hook and not a `close.js` gate. The reasoning: `close.js` runs as a plain script and cannot
see the conversation, so it can only check whether rows *exist* — it can never know whether errors
*occurred*. The agent, by contrast, has the full transcript and reliably reconstructs its misfires
when prompted. So the check belongs to the agent. The human's recurring "did you log your errors?"
prompt is internalized as a required close step rather than something a human has to ask.

**The audit, run before the velocity log at every close (`copper-civet`):**

1. Re-read your session from the point you claimed the ticket to now.
2. Enumerate every event matching the `log-error` triggers above — *including resolved ones*.
3. For each, confirm a row exists or log it now:
   ```bash
   sqlite3 ~/.lccjs/lccjs.db "SELECT id,error_type,message FROM errors WHERE ticket=N"
   ```
4. State the outcome explicitly in the closing comment — one of:
   - `error self-audit: N row(s) logged (#ids …)`
   - `error self-audit: no loggable errors this session`

The explicit statement is the point: it converts silence into a checkable acknowledgement, so a
clean session and a forgotten log no longer look identical in the record. (Cross-refs: the
`next-best-action` skill carries this as a checklist question; #1118 adds a `COMPLIANCE_FAIL`
`error_type` so a *forgotten-then-caught* episode is itself recordable.)

---

## PDD scan coverage & the `at_todo` placeholder

`npm run puzzles` runs the `pdd` gem over the repo to enforce that every real
puzzle marker is backed by a GitHub issue. **Scan coverage is `.pddignore` plus
`.gitignore`**: `scripts/run-pdd.sh` translates `.pddignore` lines into `pdd
--exclude` arguments and passes `--skip-gitignore` which, counter-intuitively,
*folds* `.gitignore` excludes in rather than skipping them. Both files are
load-bearing — `.pddignore` excludes docs and fixtures; `.gitignore` excludes
build artifacts (`*.e`, `*.o`, `*.hex`, `puzzles.xml`, etc.) that `.pddignore`
does not cover. Edit `.pddignore` for puzzle-scan policy; be aware that changes
to `.gitignore` also silently shift what the scanner sees. (#248)

The default policy is **scan all source, blacklist the rest**: code under `src/**`
and friends is scanned; `docs/**`, all `*.md`, fixtures, generated trees,
throwaway/experiment dirs, and the scanner's own files are excluded.

**Path-robustness (#224).** `pdd` compiles each `.pddignore` exclude into a
regexp built from the repo's *absolute* path and never escapes literal chars, so
a regex-special char in that path (notably the `+` that `EnterWorktree` puts in
`.claude/worktrees/<fruit>+<slug>` dir names) used to silently void *every*
exclude — the gate would then scan `docs/**`/`*.md` and false-fail on the first
uppercase keyword, forcing `git push --no-verify` (which also skips the #205
conflict-marker gate). `scripts/run-pdd.sh` now detects such a path and scans
through a special-char-free symlink instead, so the gate is correct from any
worktree (it prints a one-line `[run-pdd] note:` when it does). If it can't build
a safe path (e.g. a hostile `TMPDIR`) it fails loudly rather than mis-scan in
silence. So `+` in a worktree name no longer defeats this gate — though keeping
worktree/claim names to `[A-Za-z0-9._-]` is still good hygiene for other tooling.

**The substring trap.** `pdd` is a dumb, case-sensitive *substring* matcher. It
flags the bare uppercase keyword (`@todo`'s uppercase form, or `TODO` / `TODO:`)
**anywhere** in a scanned file — even buried inside a larger token. A stray
mention with no leading space aborts the *entire* scan with a parse error, not
just that line. So in a scanned (code) file you can never write the uppercase
keyword unless you mean a real puzzle.

**The `at_todo` placeholder (code files only).** When you need to *talk about*
the marker concept in a scanned code file — a comment explaining the puzzle
system, a variable, a doc-comment — write it lowercase: **`at_todo`**. Lowercase
is invisible to the matcher (verified: lowercase passes, uppercase aborts even
inside a token like `AT_TODO`). Rules:

- Use `at_todo` **only in scanned code files**, and only to *discuss* the concept
  — never as an actual obligation. A real puzzle is always the uppercase
  `@todo #N:Est/ROLE` form with a backing issue.
- In **non-scanned files** (`docs/**`, `*.md` — this very document) there's no
  matcher to dodge, so write the real keyword normally for readability.
- Don't invent uppercase variants (`AT_TODO`, `AT-TODO`, …) to "escape" the
  scanner — they all contain the uppercase keyword as a substring and will trip
  it. Lowercase `at_todo` is the one safe spelling.

## Concept glossary (one-liners)

- **PDD** — Puzzle-Driven Development. Unfinished work lives as a `@todo #N:Est/ROLE description` comment in code, tied to a GitHub issue.
- **Puzzle** — one such `@todo` + ticket pair. Cap is 60m human time.
- **`@inprogress`** — a `@todo` that's been checked out into a worktree. Same shape (`@inprogress #N:Est/ROLE`), but signals "claimed, don't grab." Invisible to the `pdd` gem; surfaced by `npm run puzzle:status`. Flip back to `@todo` if abandoned, delete on close.
- **`puzzle:status`** — `scripts/puzzle-status.js`, run via `npm run puzzle:status`. Joins markers × worktrees × issue state into AVAILABLE / CLAIMED / IN-PROGRESS / LOCKED (clustermate in progress) / BLOCKED (label or open `blocked_by`) / STALE. The authority on "what's safe to grab" and "what marker is orphaned."
- **`.pddignore`** — root file (gitignore-style) listing the globs the puzzle scanner skips. Read by `scripts/run-pdd.sh` alongside the repo `.gitignore` to form total scan coverage — both files are load-bearing (#248).
- **`at_todo`** — lowercase placeholder for *discussing* the marker concept inside a scanned code file without tripping the case-sensitive `pdd` substring matcher. Never an actual obligation; see "PDD scan coverage" above.
- **Spike** — a bounded research puzzle that produces findings, not code. Labeled `research` (not `pdd-tracked`).
- **Tracker** — a GitHub issue that doesn't represent a single work unit but tracks N child puzzles. Example: #108 tracked the 5 assembler.js spikes.
- **H / C** — Human / Claude time estimates. H drives the Yegor cap (discipline). C is my forward-looking forecast (calibration).
- **Worktree** — a separate working directory + branch for parallel-agent work. Lives at `.claude/worktrees/<fruit>-issue-<N>/` on branch `<fruit>/issue-<N>-<slug>`, claimed via `npm run claim`. The fruit (apple, banana, …) is the **agent identity** for the session. See `docs/design-agent-worktree-identity.md`.
- **Trunk-based** — agents push directly to `main` (with `git push origin HEAD:main` from a feature branch). No PRs by default.
- **velocity row** — a single record logged into `~/.lccjs/lccjs.db` (exported to `docs/puzzle-velocity.csv`) for one ticket: role, agent identity, H/C estimates, start/finish timestamps, and actuals. Written via `npm run velocity:log`.
- **pre-flight** — the discipline of capturing `started_iso` (`date '+%Y-%m-%dT%H:%M:%S%z'`) and running `gh issue view <N> --comments` *before* any work begins. Skipping it forces reconstructed timestamps, which is an honesty tax. The `--comments` flag is essential: research findings, corrections, and scope clarifications are posted as issue comments — omitting it leaves that context invisible (#652).
- **`at_todo` trap** — the anti-pattern where a doc, CSV field, or comment discussing the marker concept accidentally contains the live `@todo` substring, tripping the case-sensitive `pdd` scanner. Use the lowercase `at_todo` spelling (see above) in non-scanned files to discuss it safely.
- **phantom marker** — a `@todo` or `@inprogress` marker whose backing GitHub issue is already closed. Shows as `STALE` in `npm run puzzle:status`. Must be deleted from source; leaving it inflates the open-puzzle count and misleads other agents.
- **fruit identity** — the per-session agent name (APPLE, BANANA, CHERRY, …) used as the worktree branch prefix and the `agent` column in the velocity log. Assigned by the human orchestrator via `--as <fruit>` on `npm run claim`; never auto-named (#386).
- **`closed_commit`** — the git SHA of the closing commit. Left empty in the velocity row because `git rebase` rewrites the SHA before push, orphaning any pre-push capture. Recover post-push: `git log --grep "Closes #N" -1 --format=%h`.

---

## When this document is wrong

This doc reflects current convention. If the protocol changes (the skill bumps a version, the close sequence changes, etc.), update this doc in the same commit. Stale workflow docs are worse than missing ones.

If you (the user) see me doing something different from what's described here, call it out — either I have a reason and should explain it, or I'm drifting and should correct.
