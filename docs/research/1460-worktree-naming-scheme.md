# RESEARCH #1460 — A self-describing worktree/branch naming scheme

**Agent:** BANANA · **Role:** RESEARCH · **Date:** 2026-06-23
**Goal:** design one naming scheme so any agent can tell at a glance: **(1) agent**, **(2) project**, **(3) issue number**, **(4) primary language**, plus an optional **(5) theme/concept** descriptor — and inventory every place that must change to adopt it across **lccjs**, **pmtools**, and the custom PM **skills**.

> Scope note: research-only. This doc produces the design + the change surface. It does **not** edit any construction/parse site — those are follow-on implementation tickets (see §7). The canonical implementation lands in **pmtools** (avidrucker/pmtools#13); lccjs consumes it. This supports the lccjs → full-pmtools migration (#1456).

---

## 1. Current scheme (verified)

| Artifact | Format | Example |
|---|---|---|
| **branch** | `<fruit>/issue-<N>[-<slug>]` | `banana/issue-1452-test-smoke-test` |
| **worktree dir** | `<worktreeDir>/<fruit>-issue-<N>` (no slug) | `.claude/worktrees/banana-issue-1452` |
| **claim ref** | `refs/claims/issue-<N>` (no fruit) | `refs/claims/issue-1452` |
| **session sentinel** | `<fruit>/session` | `banana/session` |

**Encoded today:** agent (fruit), issue number, optional slug. **Not encoded:** project, language. So `banana-issue-1452` is ambiguous about *which* project/language once an agent works across repos — exactly the gap this ticket targets.

**Consistency:** the *branch* and *worktree* forms are consistent across lccjs and pmtools (the pmtools port was extracted from lccjs). The friction is not inconsistency — it's that the scheme is **under-specified** (no project/lang) and **defined in three independent places** (§3).

---

## 2. Two load-bearing invariants

Every parse site in all three codebases depends on exactly two things:

1. **Agent = `branch.split('/')[0]`** — the fruit is the first `/`-delimited segment.
2. **Issue = `/issue-(\d+)/`** — the literal token `issue-<N>` appears in the branch *and* the worktree dir name.

> **Design lever:** preserving the `issue-<N>` token keeps every `/issue-(\d+)/` parse site working untouched (invariant #2). The ratified scheme (§5) adds a `br-`/`wt-` type prefix, so agent-extraction (invariant #1) moves from `split('/')[0]` to a prefix-tolerant regex — a small, bounded set of edits. Making both the `br-`/`wt-` prefix and the `project-lang` fields *optional in the parse regex* keeps old names resolving, so the migration needs no flag day.

---

## 3. Inventory — every construction & parse site

### 3a. lccjs (`/home/avi/Documents/Study/JavaScript/lccjs`)

| File:line | C/P | Verbatim | Encodes/Extracts |
|---|---|---|---|
| `scripts/claim.js:691` | **construct** | `` `${fruit}/issue-${issue}${slug ? '-' + slug : ''}` `` | branch: fruit, issue, slug |
| `scripts/claim.js:692` | **construct** | `` path.join(root, '.claude', 'worktrees', `${fruit}-issue-${issue}`) `` | worktree dir: fruit, issue |
| `scripts/claim.js:134` | construct | `` `${fruit}/session` `` | sentinel: fruit |
| `scripts/claim.js:219` | parse | `/^([a-z]+)\/issue-\d+/` (`inferFruitFromBranch`) | fruit |
| `scripts/claim.js:114` | parse | `/\/issue-(\d+)/` | issue |
| `scripts/claim.js:100` | parse | `branch.split('/')[0]` | fruit |
| `scripts/close.js:860` | **construct** | `` branch.split('/')[0] + '-issue-' + issue `` (worktree path) | worktree dir: fruit, issue |
| `scripts/close.js:514` | parse | `branch.split('/')[0]` | fruit (velocity attribution) |
| `scripts/close.js:848` | validate | `/\/issue-\d+/` | branch shape gate |
| `scripts/close.js:852` | validate | `` /issue-${issue}\b/ `` | issue match gate |
| `scripts/puzzle-status.js:101` | parse | `branch.split('/')[0]` | fruit |
| `scripts/puzzle-status.js:108` | parse | `/issue-(\d+)/` (over `branch + path`) | issue |

lccjs has **no named pattern constant** — the regexes are inline. Header contract documented in `scripts/claim.js:11-16` (points at `docs/design-agent-worktree-identity.md`); constraints in `docs/claude_workflow.md:211`.

### 3b. pmtools (`/home/avi/code/pmtools`) — js + py twins, parity confirmed

| File:line | C/P | Verbatim | Notes |
|---|---|---|---|
| `js/status.js:12` / `py/status.py:21` | parse (default) | `'^(?<agent>[a-z]+)/issue-(?<issue>\\d+)'` = `DEFAULT_BRANCH_PATTERN` | the only **named** pattern anywhere |
| `js/status.js:83` | parse (override) | `--branch-pattern <regex>` CLI flag overrides the default | **not** read from `orchestrate.json` (see drift note) |
| `js/claim.js` (`mkBranch`/`mkPath`) | **construct** | `` `${fruit}/issue-${issue}${slug?'-'+slug:''}` `` / `` `${fruit}-issue-${issue}` `` | mirrors lccjs |
| `js/claim.js:177` | construct | `` `${fruit}-issue-${issue}` `` (orphan-worktree scan) | |
| `js/claim_core.js:46` | parse | `/^([a-z]+)\/issue-\d+/` | fruit |
| `js/claim_core.js:84` | parse | `/\/issue-(\d+)/` | issue |
| `js/close.js:327` / `:331` | validate | `/\/issue-\d+/` , `` /issue-${issue}\b/ `` | branch gates |
| `js/close.js:337` | **construct** | `` path.join(root, worktreeDir, `${fruit}-issue-${issue}`) `` | worktree dir |
| `CONTRACT.md:125-126` | spec | `branch = <fruit>/issue-<N>[-<slug>]` / `worktree = <worktreeDir>/<fruit>-issue-<N>` | canonical written spec |
| `--worktree-dir` (claim+close) | config | default `.claude/worktrees` | parameterized ✓ |
| `fixtures/two-worktrees.input.json` | data | `apple/issue-200-foo`, `banana/issue-201-bar` | golden cases to update |

py twins (`py/claim.py`, `py/claim_core.py`, `py/close.py`) carry identical patterns — any change is **×2 ports** + fixtures (the CONTRACT-parity rule).

**Project/language today:** neither is in the name. The repo basename *is* used elsewhere (preflight scratch dir `~/.pmtools/<repo>/…`, store `repo` column) via `git toplevel` basename — but note the preflight bug (#1454 / APPLE): under a worktree the basename is the *worktree* dir, not the repo. A naming scheme that needs the project name must resolve it robustly (see §6).

### 3c. Custom PM skills (symlinks → real sources)

| Skill (real source) | File:line | Role | Quote |
|---|---|---|---|
| **fruit-agent-orchestrate** (`~/Documents/claude-config/skills/...`) | `references/orchestrate-config.md:33,102`; `SKILL.md:110-111,116,263` | **documents a config key** | `worktreeBranchPattern` default `^(?<agent>[a-z]+)/issue-(?<issue>\d+)`; `worktreeDir` default `.claude/worktrees` — used to derive busy agents from `git worktree list` (fleet mode) |
| puzzle-velocity | `SKILL.md:72,133` | documents | logs `agent` field (e.g. `BANANA`) — the terminal/worktree name |
| log-error | `SKILL.md:48,59,178` | documents | `agent` field in the error row |
| write-til-doc | `SKILL.md:14,58,75` | documents | `claim <N> --as <fruit>`; TIL filename `today-i-learned-YYYY-MM-DD-<agent>.md` |
| puzzle-triage / next-best-action | resp. `SKILL.md:78-79` / `:17-18` | delegate | call the status/close commands; don't parse names directly |

All skills are **symlinks** into `~/Documents/claude-config/skills/` (PM family) and `~/Documents/Study/AI/yegor-pm-skills/skills/` (yegor-*). Edit the real sources, not `~/.claude/skills/`.

---

## 4. Analysis — why a redesign is non-trivial

1. **Three independent definitions of "the pattern", no single source of truth:**
   - lccjs: inline regexes (no constant).
   - pmtools: `DEFAULT_BRANCH_PATTERN` (status only) + inline regexes in `claim_core` + hardcoded templates in `claim.js`.
   - skills: `worktreeBranchPattern` default in `orchestrate-config.md`.
   These must agree but drift independently.
2. **Drift already latent:** pmtools `status` accepts `--branch-pattern` and the orchestrate skill documents `worktreeBranchPattern`, but **pmtools never reads `worktreeBranchPattern` from `orchestrate.json`** (grep across `js/`+`py/` = 0 hits). So the config key is consumer-side decoration; the tool uses its hardcoded default unless a CLI flag is passed.
3. **Parse is half-parameterized; construction is fully hardcoded.** You can override *parsing* (status `--branch-pattern`) but `mkBranch`/`mkPath` (both repos) and `close.js` worktree reconstruction are string templates with no knob.
4. **`×2 ports` + fixtures + contract** for every pmtools change.

---

## 5. Proposed scheme (recommendation)

**RATIFIED (maintainer, 2026-06-23): Option A + `br-`/`wt-` type prefixes.**

The artifact gets a 3-char **type prefix** so a name is self-identifying as a *branch* vs a *worktree* even out of context (`br-` / `wt-`):

```
branch       = br-<agent>/<project>-<lang>-issue-<N>[-<theme>]
worktree dir = <worktreeDir>/wt-<agent>-<project>-<lang>-issue-<N>
```

Examples:
- branch `br-banana/lccjs-js-issue-1460-naming-scheme`
- worktree `.claude/worktrees/wt-banana-lccjs-js-issue-1460`

**Parse regexes (named groups), back-compatible — the `br-`/`wt-` prefix and the `project-lang-` group are both optional, so legacy names still resolve:**
```
branch:   ^(?:br-)?(?<agent>[a-z0-9]+)/(?:(?<project>[a-z0-9]+)-(?<lang>[a-z0-9]+)-)?issue-(?<issue>\d+)(?:-(?<theme>.+))?$
worktree: ^(?:wt-)?(?<agent>[a-z0-9]+)-(?:(?<project>[a-z0-9]+)-(?<lang>[a-z0-9]+)-)?issue-(?<issue>\d+)$
```
- The `issue-<N>` token is preserved → every `/issue-(\d+)/` parse site keeps working **unchanged** (invariant #2 intact).
- **Invariant #1 shifts slightly:** the agent is no longer `split('/')[0]` verbatim — it's that segment with the `br-` prefix stripped. Agent-extraction sites change from `branch.split('/')[0]` / `/^([a-z]+)\/issue/` to a prefix-tolerant form, e.g. `/^(?:br-)?([a-z0-9]+)\//`. This is the one extra cost of the type prefix; it's bounded (the agent-extraction sites listed in §3) and stays back-compatible by making `br-` optional.

**Why this shape:**
- **Keeps both invariants (§2)** → only construction + the explicit `<fruit>/issue-<N>` validator messages need changes; all parsing is forward+backward compatible.
- **Agent stays the `/`-prefix** → preserves git's per-agent branch grouping (`git branch --list 'banana/*'`) and the session sentinel `<agent>/session`.
- **`project` and `lang` are single `[a-z0-9]` tokens** (delimiter is `-`) → no ambiguity when splitting; avoids the regex-special-char-in-path footgun (#224, a `+` in a worktree path broke `.pddignore`).
- **`theme` is the greedy trailing field** → may contain `-`, fully optional, matches today's slug behavior.

**Field sourcing (no new user input required):**
- `agent` — `--as <fruit>` / `CLAUDE_AGENT_NAME` (today).
- `issue` — CLI arg (today).
- `lang` — **already in `.claude/orchestrate.json` → `languages[0]`** (`"javascript"` → normalize to a short token `js`). A `languageTag` map (javascript→js, python→py, clojure→clj) keeps it terse.
- `project` — `orchestrate.json` (add an explicit `"project": "lccjs"` key; fall back to git-toplevel basename). An explicit key avoids the worktree-basename hazard (§3b).
- `theme` — optional CLI slug (today's `slug`), or derived from issue title.

### Alternatives considered (not recommended)
- **Option B — project-first** (`<project>/<lang>/<agent>/issue-<N>`): groups by project in git, but **breaks invariant #1** (`split('/')[0]` would yield the project, not the agent) → every fruit-extraction site changes. Higher blast radius.
- **Option C — all-dash, no `/`** (`<agent>-<project>-<lang>-issue-<N>` for *both* branch and dir): loses git per-agent grouping and the `<agent>/session` sentinel convention; breaks `split('/')[0]`. Rejected.
- **Option D — keep names short, push project/lang into a sidecar** (e.g. a `.claim` metadata file): zero name change, but fails the actual goal ("clear at a glance" from `git worktree list` / branch name). Rejected.

---

## 6. Back-compat & migration

- **Parsers:** ship the §5 optional-group regex everywhere; old and new branches both resolve. No flag day.
- **Constructors:** flip `mkBranch`/`mkPath` (both repos) + `close.js` worktree reconstruction to emit the full new form. Existing live worktrees keep their old names until they close naturally (no rename needed — parsers accept both).
- **Validators:** the `<fruit>/issue-<N>` gate messages (lccjs `close.js:848-852`, pmtools `close.js:327/331`) still pass (they only assert the `issue-<N>` token), but update the human-readable text to the new canonical form.
- **`project` resolution hazard:** resolve project name from an explicit `orchestrate.json` key, not `basename(git toplevel)`, because under a worktree the basename is the worktree dir (the live #1454/preflight bug). Fixing both together is sensible.
- **Constraints honored:** git ref rules (no spaces/`~^:?*[`, no `..`, no trailing `/`); tokens restricted to `[a-z0-9]`; worktree dir is one path component; longer names are still well under path limits.

---

## 7. Change surface → follow-on implementation tickets

Adopting Option A touches (file precise tickets per repo after this research is accepted):

1. **pmtools (canonical, do first):** `js/claim.js` (`mkBranch`/`mkPath`, orphan scan `:177`), `js/claim_core.js` (`:46`,`:84`), `js/status.js` (`DEFAULT_BRANCH_PATTERN:12`, `--branch-pattern`), `js/close.js` (`:327`,`:331`,`:337`) + **all py twins** + `CONTRACT.md:125-126` + `fixtures/*`. Add `project`/`lang` resolution from config; expose construction helpers so consumers don't re-template. (Belongs to the pmtools design doc, #13.)
2. **pmtools config-read:** make `status` actually read `worktreeBranchPattern`/scheme from `.claude/orchestrate.json` (close the drift in §4.2).
3. **lccjs:** `scripts/claim.js:691-692,134`, `scripts/close.js:860,514,848-852`, `scripts/puzzle-status.js:101,108` → adopt the shared regex + new construction (ideally by *consuming pmtools*, per the migration goal, not re-implementing).
4. **skills:** update `fruit-agent-orchestrate/references/orchestrate-config.md:33,102` + `SKILL.md:110-111` default pattern to the §5 regex; refresh examples in `write-til-doc`, `puzzle-velocity`, `log-error` if they show branch/worktree names.
5. **docs:** `docs/claude_workflow.md:211`, `docs/design-agent-worktree-identity.md`, pmtools `CONTRACT.md`.

---

## 8. Recommendation (one line)

Adopt **Option A with `br-`/`wt-` type prefixes** (branch `br-<agent>/<project>-<lang>-issue-<N>[-<theme>]`, worktree `wt-<agent>-<project>-<lang>-issue-<N>`) — **RATIFIED**. Define it **once in pmtools** (the §5 regexes + construction helpers + `orchestrate.json` `project`/`languages` sourcing) and have lccjs + the skills consume that single definition. It satisfies all five fields, preserves invariant #2 outright and invariant #1 with a bounded prefix-tolerant edit, and migrates with no flag day (optional `br-`/`wt-` + optional `project-lang` in the parse regex).

---

*Related: #1456 (migration tracker), #1451 (go/no-go), #1452 (smoke-test), #1454/#1458 (status + preflight fidelity, incl. the basename hazard), #1457 (store blocker), pmtools#13 (design doc that implements §5/§7).*
