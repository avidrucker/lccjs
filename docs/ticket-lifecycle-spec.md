# lccjs ticket-lifecycle spec — the authoritative end-to-end phase contract

> **Status:** authoritative for the **lccjs** side of the cross-repo parity pair
> (lccjs#1487 ↔ pmtools#92). Derived **only** from this repo's own code/scripts
> (the independence rule — see below). The pmtools column of the reconciliation
> table is a *comparison target*, confirmed by an **independent verifier**, not by
> the author.
>
> **Companion:** [`docs/claude_workflow.md`](./claude_workflow.md) is the prose
> protocol an agent reads to *do* the work. This file is the *normalized spec*:
> every phase reduced to `trigger · invocation · inputs · outputs/side-effects ·
> guards · exit codes · ordering`, so the two repos' lifecycles can be diffed
> field-by-field.

## Why this exists (lccjs#1487)

The same agentic ticket lifecycle runs in lccjs and pmtools, but through different
invocation surfaces (`npm run <cmd>` vs `pmtools <cmd>`). Until now there was no
single end-to-end description of every phase, and no verification that the two
repos enforce the **same phases, guards, inputs, outputs, and ordering**. This
spec fixes the lccjs half; the reconciliation table proves parity field-by-field.

**The only sanctioned divergence is the invocation surface.** Every other
dimension — phases, guards, side-effects, exit codes, ordering — must be
identical. Anything else that differs is a **finding** (see
[§Candidate divergences](#candidate-divergences-to-confirm-in-the-cross-check)),
filed as its own follow-up ticket once confirmed — never silently "reconciled."

## The independence rule (this is the deliverable, not a nicety)

- This spec was authored from **lccjs's own code/scripts only**
  (`scripts/preflight.js`, `scripts/claim.js`, `scripts/velocity-log.js`,
  `scripts/close.js`, `scripts/release.js`, the `npm run` wiring in
  `package.json`, and `docs/claude_workflow.md`). The pmtools sibling's docs/code
  were **not** read while drafting.
- A **different agent** runs the field-by-field cross-check against pmtools#92's
  independently-authored spec. The verifier ≠ the author, and both are named in
  the closing comment.

## Source map (every claim below is traceable)

| Phase | Script / source | Key symbols |
|---|---|---|
| Preflight | `scripts/preflight.js` | `preflightIssueGate`, `preflightEvidence`, `main` |
| Claim | `scripts/claim.sh` → `scripts/claim.js` | `resolveIdentity`, `shouldBlockClaim`, `shouldBlockUncategorized`, `assessBaseStaleness`, `findLiveWorktreeForIssue`, `findSameIssueCollision`, `classifyClaimPushResult`/`claimPushAction`, `flipMarker`, `main` |
| Velocity | `scripts/velocity-log.js` | `VALID_ROLES`, CWD guard, UNIQUE constraint, `exportCSV` |
| Close | `scripts/close.js` | `branchGuardError`, `findClosingCommitSha`, `checkVelocityTicketMatch`, `checkKeywordMatch`, `checkVelocityRowExists`, `checkMarkerDeleted`, `tryLand`, `shouldCleanup`, `deleteClaimRef`, `main` |
| Release | `scripts/release.js` | claim-ref delete (reused from close), data-loss guard, detached teardown |
| Wiring | `package.json` `scripts` | `claim`/`preflight`/`velocity:log`/`close`/`release` |

`npm run` arg-forwarding quirk: `claim`, `preflight`, `velocity:log`, `close`,
`release` all need the `--` separator so npm forwards flags/positionals to the
script (`npm run close -- N`). `claim` is invoked through a `bash` shim
(`scripts/claim.sh`) **specifically** so npm can't swallow `--as`/`--base`
(#315); invoked that way the bare `npm run claim 1487 --as grape` also works.

---

## The lifecycle phases

Numbered `L0..L8`. The close phase (L7) expands into an ordered guard subsequence
`C1..C17` (the analogue of pmtools' numbered close-guard list).

### L0 — Orchestrate / assignment

- **Trigger:** human orchestrator (or the `fruit-agent-orchestrate` skill) assigns
  an open issue to a named agent identity (a *fruit*: apple, banana, … grape).
- **Invocation:** none mechanized; a planning/triage step.
- **Inputs:** the open backlog.
- **Outputs / side-effects:** an `(agent, issue)` assignment. No repo or DB write.
- **Guards:** none mechanized. Convention: epics/trackers are never claimed as a
  unit (R019); a >60m ticket is decomposed first (R017); a fuzzy ticket is
  spike-gated first (R018).
- **Exit codes:** n/a.
- **Ordering:** precedes L1.

### L1 — Verify issue OPEN

- **Trigger:** before any claim.
- **Invocation:** `gh issue view <N>` (manual). Also mechanized downstream: the
  OPEN/CLOSED state is read again inside L2 (`preflightIssueGate`) and L3
  (`shouldBlockClaim`).
- **Inputs:** issue number, `gh`.
- **Outputs / side-effects:** confirmation only.
- **Guards:** live-state-vs-request reconciliation (R022) — a CLOSED issue means
  the work likely already shipped; stop and reconcile.
- **Exit codes:** n/a (manual).
- **Ordering:** precedes L2/L3. Offline `gh` ⇒ best-effort proceed (consistent
  across all phases).

### L2 — Preflight (`npm run preflight -- <N>`)

- **Trigger:** picking up a ticket, before claiming. Front-loads the
  start-of-task steps that otherwise get skipped (#1036).
- **Invocation:** `npm run preflight -- <N>` → `node scripts/preflight.js <N>`.
- **Inputs:** issue number; `git`, `gh`, `date`.
- **Outputs / side-effects:**
  - Stamps `started_iso` (`date '+%Y-%m-%dT%H:%M:%S%z'`) to a session scratch
    file `~/.lccjs/preflight-<N>.iso` — the real captured timestamp the closing
    velocity row reads (#652).
  - Prints `git status --short`, `git worktree list`, the issue body + comments
    (fetched as JSON so it survives non-TTY piping), and in-repo **evidence**
    (`docs/logs/<M>-*`, `docs/research/<M>-*`) for every `#M` the issue
    references (#1131).
- **Guards:** OPEN-state gate (`preflightIssueGate`) — `die` if state ≠ OPEN;
  `null`/empty state (gh offline) ⇒ warn + proceed. Does **not** claim and does
  **not** touch claim/close (deliberately additive).
- **Exit codes:** `0` success · `1` not-OPEN or bad usage (non-numeric issue).
- **Ordering:** L2 precedes L3 (claim). Reading evidence before forming findings
  is mandatory (R020).

### L3 — Claim (`npm run claim -- <N> --as <fruit>`)

- **Trigger:** start of work on a verified-OPEN issue.
- **Invocation:** `npm run claim -- <N> --as <fruit>` → `bash scripts/claim.sh`
  → `node scripts/claim.js`. Identity precedence: `--as` > `CLAUDE_AGENT_NAME` >
  branch-inferred > **auto (disabled → `die`)** (#386).
- **Inputs:** issue `N`; identity; `--base` (default `main`); optional slug
  (else derived from issue title via `gh`).
- **Outputs / side-effects:**
  - Creates branch `<fruit>/issue-<N>-<slug>` and worktree
    `.claude/worktrees/<fruit>-issue-<N>` (off `base`).
  - **Cross-clone claim ref:** fabricates a per-agent-unique commit via
    `git commit-tree` off the base tree and pushes it to
    `refs/claims/issue-<N>` on `origin` (server-authoritative claim; #1038).
    Uniqueness (pid + hi-res stamp) makes a real collision reject
    non-fast-forward rather than silently "Everything up-to-date" (#1018).
  - Copies repo-root `.env` into the worktree (oracle tests, best-effort).
  - **Marker flip:** rewrites the first live `@todo #N:<est>/<ROLE>` →
    `@inprogress #N` **in the worktree, uncommitted** (`flipMarker` /
    `applyMarkerFlip`). Left unstaged for the agent's own commit. `@inprogress`
    is invisible to the `pdd` scan, so it signals "claimed" without staying a
    live puzzle. (No marker present ⇒ skip, not an error.)
  - Auto-mode only: stakes a `<fruit>/session` sentinel branch (keeps a fruit
    "taken" across worktree teardowns, #194).
  - Warns about orphaned worktrees (CLOSED-issue branches) and stale claim refs,
    with manual-sweep hints — **non-blocking**.
- **Guards (ordered in `main()`):**
  1. Identity required — `die` if `source === 'auto'` (#386). Unknown fruit name
     ⇒ notice only, proceeds (#1184).
  2. CLOSED-state block — `shouldBlockClaim`; `--force` bypass (#227).
  3. Lane gate — `shouldBlockUncategorized`: no real `area:*` label (only
     `area:uncategorized` or none) ⇒ `die`; `--allow-uncategorized` bypass
     (#1151).
  4. Base ref resolves — else `die`.
  5. Stale-main guard — `assessBaseStaleness`: local `main` behind
     `origin/main` ⇒ `die`; `--allow-stale-main` bypass (#228).
  6. Live-worktree guard — `findLiveWorktreeForIssue`: issue already a live
     worktree ⇒ `die`; `--force`/`--dry-run` bypass (#629).
  7. Same-issue collision rollback — `findSameIssueCollision`: a different branch
     for the same issue appeared post-`worktree add` ⇒ roll back + `die`;
     `--force` bypass (#1017, single-clone TOCTOU).
  8. Cross-clone claim verdict — `classifyClaimPushResult` → `claimPushAction`:
     `CONFLICT` ⇒ rollback + `die`; `TRANSIENT` (offline/auth) ⇒ warn + proceed;
     `OK` ⇒ ours. `--force` stakes the ref but never blocks (#1037/#1038).
- **Exit codes:** `0` success · `1` any `die` (incl. usage). **No distinct
  usage-vs-operational code.**
- **Ordering:** L3 precedes L4. The claim is the only step that stakes the
  worktree + the remote claim ref.

### L4 — Work (in the worktree)

- **Trigger:** post-claim.
- **Invocation:** none (the development itself).
- **Inputs:** the claimed worktree.
- **Outputs / side-effects:** code/doc changes; new PDD `@todo` puzzles for
  deferred sub-problems (`yegor-pdd`); tests (TDD; the pure-seam vs CLI-wrapper
  boundary). All commits **must** originate from a worktree (R004).
- **Guards:** scope discipline (R006, R012) — do only the scoped work; file a
  ticket for anything else.
- **Exit codes:** n/a.
- **Ordering:** between L3 and L5.

### L5 — Velocity log (`npm run velocity:log -- '<json>'`)

- **Trigger:** before the closing commit (R005). Every closed ticket gets a row.
- **Invocation:** `npm run velocity:log -- '<json>'` → `node scripts/velocity-log.js`.
- **Inputs:** a JSON row object. **Required:** `role`, `agent`. `ticket` nullable
  (issueless PM/triage rows). Deltas derived: `delta_h = h_min − actual_min`,
  `delta_c = c_min − actual_min`.
- **Outputs / side-effects:** `INSERT` (or `--update-id` UPDATE) into the
  `velocity` table of `~/.lccjs/lccjs.db` (WAL); then auto-exports the read-only
  mirror `docs/puzzle-velocity.csv` (`exportCSV`).
- **Guards:**
  - Required-field validation (`die` on missing `role`/`agent`).
  - `ticket` must be a positive integer when present.
  - `role` ∈ closed vocabulary {DEV, TEST, WRITER, RESEARCH, SPIKE, ARC, PM,
    COMBO, DATA, CHORE, REVIEW} ⇒ `die` if unknown.
  - `model` non-canonical ⇒ **notice only**, recorded anyway (#1184).
  - **CWD guard (#312):** logging from the main checkout while worktrees are
    active ⇒ `die` *before any insert* (no partial state); `--from-main` bypass.
  - `UNIQUE(ticket, agent, started_iso)` ⇒ `die` "duplicate" (use `--update-id`).
- **Exit codes:** `0` success (prints inserted/updated row id) · `1` missing
  arg / invalid JSON / validation / CWD guard / DB error.
- **Ordering:** L5 precedes L6; close.js **Check A** (C8) later re-verifies the
  DB row exists. `closed_commit` is left **empty** (the rebase rewrites the SHA).

### L6 — Closing commit (`Closes #N`)

- **Trigger:** work complete + velocity row logged.
- **Invocation:** plain `git` (close.js does **not** author the commit).
- **Inputs:** the staged changes.
- **Outputs / side-effects:** **one** commit (R013) carrying: the source-marker
  deletion (`@inprogress`/`@todo #N`), the exported `docs/puzzle-velocity.csv`,
  and a `Closes #N` footer.
- **Guards:** one deliverable per close (R012); commit message conventions
  (Conventional Commits; never an issue-number scope; one type per commit).
- **Exit codes:** git's own.
- **Ordering:** L6 precedes L7. A dirty tree aborts L7 (`treeIsClean`).

### L7 — Close: land + teardown (`npm run close -- <N>`)

- **Trigger:** the `Closes #N` commit exists.
- **Invocation:** `npm run close -- <N>` (exec `node scripts/close.js`) from
  inside the worktree, **or** `node scripts/close.js <N> --branch <branch>` from
  the main root (avoids the cosmetic getcwd error; see footnote).
- **Inputs:** issue `N`; current branch (or `--branch`); `--max` retries
  (default 5); skip-flags.
- **Outputs / side-effects:** lands the close commit on `origin/main` (loop
  fetch/rebase/push), closes the issue, deletes the claim ref, tears down the
  worktree + branch, syncs the main checkout.
- **Boundary invariant:** close.js **never authors a commit**; it only pushes
  what is already committed, and only tears down **after** the commit is
  confirmed on `origin/main` (`shouldCleanup`). This single chokepoint makes
  "tear down after a failed push" structurally impossible (the #200 incident).
- **Exit codes:** `0` success (`CLOSE OK …`) · `1` any `die` (usage, guard
  failure, lost-the-race exhaustion, gate refusal). **No distinct
  usage-vs-operational code.**

The L7 ordered guard subsequence (authoritative, from `close.js main()`):

| Step | Guard / action | Behaviour | Skip flag |
|---|---|---|---|
| **C1** | Arg/usage gate | non-numeric/missing issue ⇒ `die` (exit 1) | — |
| **C2** | Branch guard (`branchGuardError`) | branch must be a worktree branch for #N (legacy `<agent>/issue-N` or `br-<agent>/<proj>-<lang>-issue-N`); mismatch ⇒ `die` | — |
| **C3** | Resolve worktree path; `chdir` into it if `--branch` | `die` if worktree missing | — |
| **C4** | Find closing commit (`findClosingCommitSha`, `origin/main..HEAD`) | absent ⇒ recovery path (`findClosingCommitOnMain`; if landed **and** issue not OPEN ⇒ already-closed clean path: `deleteClaimRef` + tracker scan + teardown); else `die` "no unpushed Closes #N" | — |
| **C5** | Scope audit (`git diff --stat` merge-base..HEAD) | **informational, non-blocking** | `--skip-scope-audit` |
| **C6** | Guard 1 — velocity ticket match (`checkVelocityTicketMatch`) | HEAD's CSV row(s) for this agent must record #N; mismatch ⇒ `die` | `--skip-ticket-match` |
| **C7** | Guard 2 — keyword match (`checkKeywordMatch`) | closing subject shares ≥1 keyword with issue title; mismatch ⇒ `die`; gh offline / no keywords ⇒ warn + skip | `--skip-keyword-check` |
| **C8** | Check A — velocity row in DB (`checkVelocityRowExists`) | no row for #N ⇒ `die`; DB/driver absent ⇒ warn + skip | `--skip-velocity-check` |
| **C9** | Check B — marker deleted (`checkMarkerDeleted`) | any `@todo`/`@inprogress #N` in `*.js`/`*.ts`/`*.mjs` ⇒ `die` | `--skip-marker-check` |
| **C10** | Rebase/merge-in-progress guard | in progress ⇒ `die` | — |
| **C11** | Clean-tree guard (`treeIsClean`) | dirty ⇒ `die` | — |
| **C12** | Land loop (`tryLand` × `--max`) | fetch → rebase `origin/main` (auto-resolve **velocity-CSV-only** and **learnings-README** conflicts; union-only/blocking ⇒ abort + `die`) → push `HEAD:main`; `race` ⇒ retry, `rejected-other` ⇒ `die`, exhausted ⇒ `die`. Commit stays safe + local on every failure path. | `--max N` |
| **C13** | **THE GATE** (`shouldCleanup ⇐ onOriginMain(landedSha)`) | landed SHA must be on `origin/main`; else `die` (refuse teardown) | — |
| **C14** | `deleteClaimRef(N)` | delete `refs/claims/issue-N`; best-effort + idempotent (absent/offline ⇒ no-op); runs **before** the `--keep` return | — |
| **C15** | Verify issue closed | if `gh` still shows OPEN ⇒ `gh issue close` explicitly | `--no-verify-issue` |
| **C16** | Parent-tracker scan (`scanParentTrackers`) | hint per unchecked box referencing #N; `--update-trackers` auto-checks | — |
| **C17** | Teardown | `--keep` ⇒ report + return (no teardown). Else `chdir(root)` → `git pull --ff-only origin main` → report → **detached** subprocess removes worktree + `branch -D` + `worktree prune` (deferred so npm/shell can exit before the dir vanishes, #533/#541) | `--keep` |

> **Operational footnote (not a guard):** an `exit 1` printed *after* `CLOSE OK`
> when run from inside the worktree is the **caller's shell** hitting getcwd on
> the now-removed dir — cosmetic, not a tool failure (`docs/errors.csv` row 129).
> Run from the main root with `--branch` to avoid it. Do **not** re-run close on
> the basis of that exit code; trust `CLOSE OK` in stdout.

### L8 — Post-close comment

- **Trigger:** after `CLOSE OK`.
- **Invocation:** `gh issue comment <N> --body "…"` (close.js prints the prompt).
- **Inputs:** the landed SHA.
- **Outputs / side-effects:** an append-only issue comment with **past-tense**
  headings ("What changed:"); the mandatory **pre-close error self-audit**
  statement (R021 `copper-civet`): *"error self-audit: N row(s) logged"* or
  *"…: no loggable errors this session."*; any deferred-scope/finding ticket
  numbers (R010); tracker checkbox update if applicable.
- **Guards:** no PII in comments (R015). Comment, don't body-edit (race-safe).
- **Exit codes:** `gh`'s own.
- **Ordering:** terminal phase.

### L-rel — Release / abandon (`npm run release <N>`) — the non-closing exit

- **Trigger:** work deferred / mis-scoped; abandon the claim **without** closing.
- **Invocation:** `npm run release -- <N> [--force]` → `node scripts/release.js`.
- **Outputs / side-effects:** (1) delete `refs/claims/issue-N` (reuses close.js's
  refspec + classifier; idempotent); (2) detached teardown of worktree + branch +
  prune; (3) **leave the GitHub issue OPEN** — no commit, no push, no
  `gh issue close`. The uncommitted `@inprogress` flip lives only in the worktree,
  so teardown discards it and `main` keeps its `@todo #N` (no explicit revert).
- **Guards:** data-loss guard — refuse if the branch has commits not on
  `origin/main` **or** the worktree is dirty, unless `--force` (prints what would
  be lost).
- **Exit codes:** `0` success / nothing-to-do · `1` bad args or guard refusal.

### Sweep (no first-class command in lccjs)

lccjs has **no** `sweep` command. Stale-claim-ref and orphaned-worktree cleanup
is surfaced as **warnings emitted at claim time** (`warnStaleClaimRefs`,
`warnOrphanedWorktrees` in `claim.js`) with manual git hints
(`git push origin :refs/claims/issue-N`; `git worktree remove … --force`). See
[§Candidate divergences](#candidate-divergences-to-confirm-in-the-cross-check).

---

## Reconciliation table (lccjs ↔ pmtools)

The **lccjs** column is authoritative (derived from this repo's scripts above).
The **pmtools** column is the comparison target; entries marked _(confirm)_ are
to be verified by the independent verifier against pmtools#92's spec — they are
**not** asserted by this author (independence rule). The expected result for
every row is **identical except the invocation surface**.

| Phase | Field | lccjs | pmtools (comparison target) |
|---|---|---|---|
| L0 Orchestrate | invocation | (planning) | (planning) — _confirm_ |
| L1 Verify OPEN | invocation | `gh issue view N` | `gh issue view N` — _confirm_ |
| L1 | guard | reconcile live state vs request (R022) | _confirm_ |
| L2 Preflight | invocation | `npm run preflight -- N` | `pmtools preflight N` — _confirm_ |
| L2 | side-effect | stamps `~/.lccjs/preflight-N.iso`; prints status/worktrees/issue/evidence | started-stamp + start-of-task reads — _confirm path/contents_ |
| L2 | guard | OPEN-state gate; offline ⇒ warn+proceed | _confirm_ |
| L2 | exit codes | `0`/`1` | _confirm (see exit-code divergence below)_ |
| L3 Claim | invocation | `npm run claim -- N --as <fruit>` | `pmtools claim N …` — _confirm_ |
| L3 | identity | `--as` > `CLAUDE_AGENT_NAME` > branch > auto(disabled) | _confirm precedence_ |
| L3 | worktree | `.claude/worktrees/<fruit>-issue-N`, branch `<fruit>/issue-N-slug` | _confirm naming_ |
| L3 | claim ref | `refs/claims/issue-N` via `commit-tree` push | _confirm (handoff says pmtools also uses `refs/claims/*`)_ |
| L3 | marker flip | `@todo #N:<est>/<ROLE>` → `@inprogress #N`, uncommitted in worktree | _confirm_ |
| L3 | guards (order) | identity → CLOSED → lane → base → stale-main → live-wt → same-issue → cross-clone | _confirm same set + order_ |
| L3 | exit codes | `0`/`1` (no usage/op split) | _confirm (see divergence below)_ |
| L4 Work | conventions | worktree-only commits; TDD; PDD puzzles | _confirm_ |
| L5 Velocity | invocation | `npm run velocity:log -- '<json>'` | `pmtools velocity log '<json>'` — _confirm_ |
| L5 | store | `~/.lccjs/lccjs.db` `velocity` table; CSV mirror `docs/puzzle-velocity.csv` | _confirm DB path + mirror_ |
| L5 | required fields | `role`, `agent` (ticket nullable) | _confirm_ |
| L5 | role vocab | closed set (11 roles) ⇒ die on unknown | _confirm same set_ |
| L5 | CWD guard | die from main while worktrees active; `--from-main` bypass | _confirm_ |
| L5 | uniqueness | `UNIQUE(ticket, agent, started_iso)` | _confirm key_ |
| L6 Commit | shape | one commit: marker-delete + CSV + `Closes #N` (R013) | _confirm_ |
| L7 Close | invocation | `npm run close -- N` / `close.js N --branch <b>` | `pmtools close N` — _confirm_ |
| L7 | authoring | close never authors the commit | _confirm_ |
| L7 | guard order | C1..C17 above | _confirm field-by-field vs pmtools' numbered close list_ |
| L7 | land model | loop fetch/rebase/push; gate on `origin/main` before teardown | _confirm_ |
| L7 | conflict auto-resolve | velocity-CSV-only + learnings-README | _confirm same set_ |
| L7 | claim-ref delete | `git push origin :refs/claims/issue-N`, idempotent | _confirm_ |
| L7 | teardown | detached subprocess after gate | _confirm_ |
| L7 | exit codes | `0`/`1` (no usage/op split) | _confirm (see divergence below)_ |
| L8 Post-close | invocation | `gh issue comment N` (past-tense + error self-audit) | _confirm_ |
| L-rel Release | invocation | `npm run release -- N [--force]` | `pmtools release N` — _confirm_ |
| L-rel | semantics | delete claim ref + teardown, issue stays OPEN | _confirm_ |
| Sweep | command | **none** — claim-time warnings + manual git | `pmtools sweep` (first-class) — _confirm (candidate divergence)_ |

---

## Candidate divergences (to confirm in the cross-check)

These are differences this author **cannot** confirm without reading pmtools
(forbidden while drafting). The verifier confirms each against pmtools#92's spec;
every **confirmed** divergence beyond the invocation surface is filed as its own
follow-up ticket and linked to lccjs#1487 (acceptance criterion 4).

1. **Exit-code convention.** lccjs scripts use a **uniform `exit 1` via `die()`**
   for *every* failure — usage errors and operational failures alike (verified in
   `claim.js`, `preflight.js`, `velocity-log.js`, `close.js`, `release.js`). The
   handoff reports pmtools distinguishes **usage error → 2** from **operational →
   1** (success → 0). If pmtools really returns `2` on a usage error where lccjs
   returns `1`, that is a divergence **beyond** the invocation surface → file it.
2. **Sweep as a phase.** lccjs has **no `sweep` command**; stale-claim/orphan
   cleanup is folded into claim-time warnings + manual git. The handoff lists
   `pmtools sweep` as a first-class command. If pmtools mechanizes sweep as its
   own command, that is a structural (not invocation-surface) difference → file
   it (or file a lccjs ticket to add a `sweep` command for parity).
3. **Close-guard count/order.** The handoff says pmtools' close is a numbered
   **13-step** guard sequence; lccjs's is the **C1..C17** sequence above. The
   counts differ partly because of presentation granularity (e.g. lccjs splits
   "find closing commit + recovery" and "scope audit" into separate steps). The
   verifier must confirm the *effective* guards, their *semantics*, and their
   *ordering* match — not merely the step count. Any guard present on one side
   and absent on the other → file it.

These are **candidates**, deliberately not pre-filed: a divergence is only
"found" once confirmed against the real pmtools spec, which is the verifier's
step. Pre-filing on secondhand (handoff) facts would violate the independence
rule.

---

## Verification log

- **Author (lccjs side):** agent **GRAPE** — derived from lccjs scripts only;
  did not read pmtools while drafting.
- **Independent verifier (different agent):** _pending_ — must diff this spec
  field-by-field against pmtools#92's independently-authored spec, confirm parity
  (only the invocation surface may differ), and file each confirmed divergence as
  a follow-up ticket linked to lccjs#1487.
- **Lockstep:** lccjs#1487 and pmtools#92 close **together**, only after both
  specs match and both have been independently verified. Neither closes alone.
