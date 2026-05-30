# Research — reconciling `--as` vs `CLAUDE_AGENT_NAME`, and making the docs/memory guide agents to the right identity practice

**Issue:** [#223](https://github.com/avidrucker/lccjs/issues/223) · **Role:** RESEARCH · **Agent:** CHERRY · **Date:** 2026-05-30 (HST)

## Question

After #212 (`d1a4e28`) shipped `CLAUDE_AGENT_NAME`, there are two ways to pin a
session's agent identity: the older per-call `--as <name>` and the new
human-directed env var. How should the project's **memory / skills / docs** be
reconciled so current and future agents reliably "do the right thing" — set the
right identity, log velocity under it, and never silently mis-identify?

## TL;DR — the reconciled practice

There is **one** correct story; the three mechanisms are a precedence ladder, not
alternatives to choose between:

| When | Do | Why |
|---|---|---|
| Human named the agent at launch | Human `export CLAUDE_AGENT_NAME=<name>`; agent runs a **bare** `npm run claim -- <N>` | #212 default; identity flows into branch, `git worktree list`, and the velocity `agent` column with nothing to remember |
| Env var not set (or override one call) | Agent passes `--as <name>` every claim | per-call forced identity; the pre-#212 workaround, still the fallback |
| Genuine first claim, solo session, no human name | bare claim → `auto` | picks a fresh fruit; race-safe via detect-and-rollback |

Precedence (in `claim.js` `resolveIdentity()`): **`--as` > `CLAUDE_AGENT_NAME` > `auto`**.

**But all three are inert unless the agent is running the #212 `claim.js` from an
up-to-date `main` — which is the gap no current doc covers (see Finding 1).**

---

## Finding 1 (NEW, highest value) — `CLAUDE_AGENT_NAME` is silently inert on a stale local `main`

`scripts/claim.js` lives on `main` and is run from the local checkout. An agent
whose local `main` has **not** been fast-forwarded to include #212 runs the *old*
auto-only script, which never reads the env var — so the #212 fix is silently
re-disabled by version skew, reproducing the exact bug it closed.

**Reproduced live this session (#223 pickup):**

```
$ CLAUDE_AGENT_NAME=cherry npm run claim -- 223
  CLAIMED  ·  agent: apple  (auto)        # env var ignored → auto-picked 'apple'
```

Local `main` was at `d2ff450` (pre-#212); `grep -c CLAUDE_AGENT_NAME scripts/claim.js`
returned **0** locally but **7** on `origin/main` (`5b9c447`). After
`git pull --ff-only origin main`, the identical command returned `agent: cherry`.

Two compounding harms, not one:
1. **Mis-identification** — the agent is labelled `apple`, not its real name, in
   the branch, `git worktree list`, and the velocity CSV.
2. **Active collision risk** — `auto` can hand out a fruit belonging to a *live*
   agent (the open #194 gap), so stale-main doesn't merely mislabel, it can clobber
   another agent's identity.
3. **Stale base tree** — `claim.js` stakes from the local `main` ref, so the
   worktree is also built on an out-of-date tree (missing other agents' merged work),
   beyond just the identity issue.

**This is the crux of the research question:** the *tooling* fix (#212) is
necessary but not sufficient; the *process* must guarantee agents sync `main`
before claiming and know the env var exists. Neither is currently written down.

---

## Finding 2 — Identity guidance is restated in 6 places; #212 updated only 3

| # | Location | Mentions `CLAUDE_AGENT_NAME`? | State |
|---|---|---|---|
| 1 | `docs/design-agent-worktree-identity.md` (§"Human-directed identity", precedence table) | ✅ yes | **current** — the natural canonical source |
| 2 | `scripts/claim.js` header (l.18–44) | ✅ yes | **current** |
| 3 | `docs/claude_workflow.md` (l.98–99) | ✅ yes | **current** |
| 4 | memory `terminal-agent-name-vs-fruit` | ✅ yes (updated 2026-05-30) | **current** |
| 5 | memory `parallel-worktree-workflow` (step 2) | ❌ **no** — only `auto`/`--as` | **STALE** (predates #212) |
| 6 | `puzzle-velocity` skill — `agent` column rule | ❌ says "the worktree **fruit** name" | **misaligned** wording |

Guidance restated in N places drifts: #212 had to touch 3+ of these and *still*
missed #5 and #6. The durable fix is **one canonical source + cross-references**,
not N hand-maintained copies (see Recommendation R5).

---

## Finding 3 — The "branch namespace is the source of truth" claim is still wrong in 2 places

Both `claim.js` header (l.38–39) and `design-agent-worktree-identity.md` (l.36,
l.70–74) assert *"a fruit is taken iff a `<fruit>/*` branch exists — git's branch
namespace is the single source of truth."* But `takenFruits()` (claim.js l.125–127)
scans only `git worktree list` — **worktree-attached** branches, not the full
namespace. This is the open #195/#194 inaccuracy (the `@todo #194` marker at
claim.js:119 documents the same gap). It matters because it's the mental model that
makes the #193 reuse-after-teardown collision *surprising* — the doc tells agents
the namespace is authoritative when behaviour is worktree-scoped.

---

## Recommendations (actionable, per-location, prioritized)

**R1 — Add "sync `main` before claiming" to the claim step.** *(highest value; fixes Finding 1)*
- `docs/claude_workflow.md` claim step (l.98) and memory `parallel-worktree-workflow`
  step 2: prepend *"Run `git pull --ff-only origin main` first — `claim.js` and its
  `CLAUDE_AGENT_NAME` support live on `main`; a stale local `main` silently runs the
  old auto-only script and can mis-identify or collide (evidence: #223)."*
- Tie it to the `puzzle-velocity` pickup protocol (the "capture start" step is the
  natural place to also "sync main").
- **Follow-up DEV puzzle (recommended):** make `claim.js` self-defending — `git fetch`
  and **warn/abort if local `main` is behind `origin/main`**, or default `--base
  origin/main`. A guard in the tool is more reliable than a doc note. File against the
  identity tracker (#179) or as a child of #188.

**R2 — De-stale memory `parallel-worktree-workflow` step 2.** Add `CLAUDE_AGENT_NAME`
as the primary identity mechanism (env var > `--as` > `auto`), plus the R1 sync-main
note, and cross-link `[[terminal-agent-name-vs-fruit]]` + the design doc. *(Finding 2, row 5)*

**R3 — Correct the "source of truth" overstatement.** In `claim.js` header (l.38–39)
and `design-agent-worktree-identity.md` (l.36, l.70–74): say identity is
**worktree-scoped** (`takenFruits()` reads `git worktree list`), not "the branch
namespace is the source of truth." Fold into the **#195** close (its scope already
names these exact lines). *(Finding 3)*

**R4 — Align the `puzzle-velocity` skill `agent`-column wording.** Change "the
worktree fruit name, uppercased" to "the human/terminal name the agent runs under —
which, once `CLAUDE_AGENT_NAME`/`--as` is set, **equals** the worktree fruit; the
old fruit-vs-terminal divergence only arises under bare `auto`." Cross-link
`terminal-agent-name-vs-fruit`. *(Finding 2, row 6)*

**R5 — Designate ONE canonical identity source; make the rest pointers.**
`design-agent-worktree-identity.md` is the home (it has the precedence table + race
model). `claude_workflow.md`, both memories, and the `claim.js` header should carry a
**one-line summary + link**, not a restated copy of the precedence ladder. Then the
next identity change (e.g. #194's session-sentinel) updates one place. *(Finding 2)*

**R6 — Add "pull `main` before claim" to the pre-flight checklist.** Extend memory
`process-adherence-fixes` (or a small new identity feedback memory) so the sync-main
step is part of the standing pickup discipline, not just buried in one doc. *(Finding 1)*

## What is already good (do not regress)
- The **precedence model** (`--as` > `CLAUDE_AGENT_NAME` > `auto`) is sound and well
  explained in the design doc and `claim.js` header.
- `docs/claude_workflow.md` l.98–99 and memory `terminal-agent-name-vs-fruit` are
  current and correct post-#212.
- The dogfood loop works: once on current `main`, `CLAUDE_AGENT_NAME=cherry` produced
  the correct `cherry` identity — the mechanism itself is fine.

## Suggested follow-up tickets
- **DOCS** (R2+R3+R5): reconcile identity guidance to one canonical source + de-stale
  the memory + fix the source-of-truth lines. R3 can ride #195; R2/R5 are new.
- **DEV** (R1 tool guard): `claim.js` warns/aborts on stale local `main`.
- **SKILL** (R4): one-line wording fix to the `puzzle-velocity` `agent`-column rule.
