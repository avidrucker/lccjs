# SPIKE: GitHub Repo Visualization Tools — lccjs applicability survey

**Issue:** #837 · **Agent:** GRAPE · **Date:** 2026-06-05 · **Role:** SPIKE

---

## Scope

Survey tools that can visualize GitHub repository activity, assess fit against lccjs's actual workflow signals, identify gaps requiring custom work, and recommend a path forward.

### lccjs workflow signals worth visualizing

| Signal | Source | Why it matters |
|---|---|---|
| Closed tickets/week by agent | `velocity.db` + GitHub Issues | Primary velocity metric; shows throughput per fruit agent |
| Closed tickets/week by role | `velocity.db` (`role` column) | Distinguishes DEV vs WRITER vs RESEARCH cadence |
| Estimate accuracy (delta_c_min) | `velocity.db` | Calibration over time per agent/role |
| PDD marker turnover | `git log` + `@todo`/`@inprogress` grep | How fast puzzles move from filed → active → closed |
| Commit-type distribution | `git log --format='%s'` + regex | feat/fix/docs/research/data/pdd breakdown |
| Issue blocker/dependency graph | GitHub Issues API (labels + body) | Visualise the `blocked` chain; surface human-gate accumulation |
| Human-gate queue depth | GitHub Issues API | Rate of `human-decision-required` tickets growing vs being resolved |

---

## Tool survey

### 1. GitHub built-in Insights

**What it is:** Free graphs baked into every GitHub repo: Pulse, Contributors, Traffic, Code Frequency, Dependency Graph, Network.

**Fit for lccjs:**
- ✅ Zero setup, always available
- ❌ No issue-level velocity; contributor graph merges all authors (can't distinguish agents — lccjs commits all land under one GitHub user)
- ❌ No label/role breakdowns; no blocker chain; no PDD marker awareness
- ❌ Read-only; can't extend with custom metrics

**Verdict:** Good for a quick sanity check on commit cadence. Not useful for lccjs-specific workflow signals.

---

### 2. Gource

**What it is:** Open-source animated visualization of commit history — renders the repo as a tree with files growing/changing and contributor avatars flying around, exportable as a video.

**Fit for lccjs:**
- ✅ Visually compelling; useful for demos or README recordings
- ❌ No issue-level data; no agent breakdown; no quantitative output
- ❌ Aesthetic only — the animation shows *that* work happened, not *what kind* or *how efficiently*

**Verdict:** Worth running once for a demo video. Zero analytical value for workflow metrics.

---

### 3. Orbit (orbit.love)

**What it is:** SaaS community-analytics platform. Aggregates GitHub issues/PRs/stars, Discord messages, Twitter mentions, etc. into a member-activity feed with engagement scoring.

**Fit for lccjs:**
- ✅ Understands GitHub Issues and PRs natively
- ❌ Designed for OSS community managers tracking *external* contributors, not internal agent workflows
- ❌ Cloud-hosted SaaS with account requirements; all data leaves the local environment
- ❌ No awareness of PDD markers, velocity.db, agent identity conventions, or commit-type taxonomy
- ❌ Cost and privacy overhead for a single-developer project

**Verdict:** Wrong use case. Built for "how engaged are our community members?" not "how efficiently is each agent closing puzzles?"

---

### 4. git-heat-map / git-quick-stats

**What it is:** CLI tools (`git-heat-map`, `git-quick-stats`, `onefetch`) that compute per-author commit statistics from `git log`: commit count, lines added/deleted, files changed, activity heatmap.

**Fit for lccjs:**
- ✅ Zero external dependencies; runs from `git log`
- ✅ `onefetch` renders a pretty summary in the terminal
- ❌ Operates at the commit level only — no issue data, no role/agent breakdown from velocity.db
- ❌ All commits are from one GitHub user (`avidrucker`); author-level stats are meaningless without the `agent` field from velocity.db
- ❌ No label, blocker, or PDD marker awareness

**Verdict:** `onefetch` is pleasant for a README badge. `git-quick-stats` has niche use for commit-frequency analysis if joined with the velocity data by date range. Neither covers lccjs's primary signals on its own.

---

### 5. gh-stats / GitHub CLI + GraphQL API

**What it is:** `gh api graphql` gives programmatic access to GitHub's full data model: issues, labels, comments, milestones, PR reviews, commit statuses. The `gh` CLI wraps this with convenience commands (`gh issue list`, `gh pr list`, etc.).

**Fit for lccjs:**
- ✅ Already in use in this repo — `gh` is the standard tool for all issue/PR operations
- ✅ Full access to labels, `blocked` status, `human-decision-required` tagging, parent/child relationships in issue bodies
- ✅ Can be joined with `velocity.db` by ticket number to produce per-ticket combined records
- ✅ No external service; runs locally with existing credentials
- ✅ GraphQL pagination supports full history export
- ⚠️ Raw JSON output — requires a rendering layer (markdown report, HTML, Observable notebook) to be *visual*

**Verdict:** Best data source for lccjs-specific signals. The gap is a rendering/visualization layer on top, not the data access itself.

---

### 6. Gitinspector

**What it is:** Per-author blame-weighted statistics: lines of code, commit count, stability score (how long code survives before being changed), age. Produces HTML and XML reports.

**Fit for lccjs:**
- ✅ HTML report is self-contained and browsable
- ❌ Author-level stats suffer the same problem as git-heat-map: all commits are one GitHub user
- ❌ No issue data, no velocity.db integration, no commit-type taxonomy

**Verdict:** Skip. The per-author angle doesn't apply when all commits share one author identity.

---

### 7. GrimoireLab (Bitergia)

**What it is:** Open-source software development analytics stack: Perceval (data collector), Mordred (orchestrator), MariaDB/Elasticsearch storage, Kibana dashboards. Used by CNCF projects, Apache, Eclipse.

**Fit for lccjs:**
- ✅ Handles GitHub Issues, PRs, commits natively; produces rich Kibana dashboards
- ✅ Self-hostable via Docker Compose
- ✅ Issue-level analytics with label filtering
- ❌ Significant operational overhead: requires running Elasticsearch + Kibana + MariaDB + Perceval continuously
- ❌ Designed for large projects (hundreds of contributors, thousands of issues); setup cost dwarfs value at lccjs scale
- ❌ No velocity.db integration without custom ETL

**Verdict:** Future option if the project scales significantly. Not justified now.

---

### 8. Observable notebooks / D3.js

**What it is:** Observable is a JavaScript notebook environment with first-class support for D3.js, Vega-Lite, and Plot. Notebooks can fetch live data from the GitHub API or consume uploaded CSV/JSON files. Notebooks can be published and embedded.

**Fit for lccjs:**
- ✅ Can consume `docs/puzzle-velocity.csv` directly (already exported from velocity.db)
- ✅ Can query the GitHub API for issue labels, blocker chains, human-gate queue depth
- ✅ Interactive: filter by agent, date range, role — no server required once built
- ✅ Embeddable in `docs/site/` (the existing Jekyll site)
- ✅ `Plot` library (Observable's own) makes common charts trivial (bar, line, area)
- ⚠️ Requires one-time authoring effort; not zero-setup
- ⚠️ Published notebooks expose data publicly if hosted on observablehq.com — use local/embedded mode for private data

**Verdict:** Best fit for a persistent, interactive dashboard. `puzzle-velocity.csv` is already the right shape for a velocity-over-time chart. Blocker graph requires a custom D3 force layout but is tractable.

---

### 9. Custom script (gh API + velocity.db → markdown/HTML report)

**What it is:** A Node.js or Python script that: (1) queries `~/.lccjs/velocity.db` for velocity data, (2) calls `gh api graphql` for current issue states and labels, (3) produces a markdown or static HTML report.

**Fit for lccjs:**
- ✅ Full control over every metric; no external service
- ✅ Can produce a `docs/velocity-report.md` that agents can read during triage
- ✅ Can be run on-demand (`npm run report`) or via a GitHub Actions cron
- ✅ Lowest setup friction of all custom approaches — a 100-line script covers the top 3 signals
- ⚠️ Text/table output only unless a chart library is added

**Verdict:** Best first step. A script producing a velocity table + issue-state summary is immediately useful with minimal investment.

---

## Gap analysis

| Signal | Covered by off-the-shelf tool? | Notes |
|---|---|---|
| Closed tickets/week by agent | ❌ | All commits = one GitHub user; agent identity lives only in velocity.db |
| Closed tickets by role | ❌ | Role is a velocity.db column; no tool reads it |
| Estimate accuracy (delta_c_min) | ❌ | velocity.db only |
| PDD marker turnover | ❌ | Requires `git log` + grep for `@todo`/`@inprogress` pattern; no tool does this |
| Commit-type distribution | ⚠️ partial | `git log` regex gives the data; needs a renderer |
| Blocker dependency graph | ⚠️ partial | GitHub API has the edges; needs a graph renderer (D3 force or Mermaid) |
| Human-gate queue depth over time | ⚠️ partial | GitHub Issues API + label filter; needs a time-series renderer |

**Core gap:** lccjs's agent-identity model (fruit names in velocity.db, not GitHub user accounts) means no off-the-shelf tool understands the primary breakdown axis. Everything useful requires joining velocity.db with the GitHub API by ticket number.

---

## Recommendation

### Tier 1 — immediate (1–2 days, custom script)

Write `scripts/report.js` (or `scripts/report.py`): query velocity.db + `gh api` → emit `docs/velocity-report.md` with:
- Table: closed tickets/week for the past 8 weeks
- Table: tickets closed by agent (all time and last 4 weeks)
- Table: tickets closed by role
- List: current human-gate queue (open `human-decision-required` + `humans-only` issues)

Register as `npm run report`. No external service, immediate signal, feeds directly into triage.

### Tier 2 — medium term (Observable notebook)

Author an Observable notebook that consumes `docs/puzzle-velocity.csv` + a static GitHub Issues JSON export:
- Velocity sparkline over time (Plot.lineY)
- Agent activity bar chart
- Estimate accuracy scatter (c_min vs actual_min)
- Blocker chain graph (D3 force layout, edges from `blocked` label + "Blocked by #N" in issue bodies)

Embed the notebook (or its iframe) in `docs/site/` for persistent access.

### Tier 3 — if scale demands it

GrimoireLab + Kibana if the project grows to where the Tier 1/2 investment no longer keeps up with data volume.

### Not recommended

Orbit (wrong use case), Devstats (too heavy), Gitinspector/git-heat-map as primary tools (single-author blind spot).

---

## Next steps for #838 (parent tracker)

1. File **DEV: implement `npm run report` script** — Tier 1 custom script (Node or Python, ~60m)
2. File **SPIKE: prototype Observable notebook for velocity.csv** — Tier 2 interactive dashboard (~60m spike)
3. File **DEV: export GitHub Issues to JSON for Observable consumption** — prerequisite for Tier 2 blocker graph

Closes #837
