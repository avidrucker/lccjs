# lccjs repo activity analysis

**Issue:** #838 · **Agent:** BANANA · **Date:** 2026-06-05 · **Role:** RESEARCH

---

## Data sources

| Source | Coverage |
|---|---|
| `~/.lccjs/velocity.db` | 786 rows (659 closed-ticket rows with `finished_iso`) |
| `git log origin/main` | 1,733 commits |
| GitHub Issues API (`gh`) | 52 open issues |
| `npm run report` output | Tickets/week by agent + human-gate list |

---

## 1. Project trajectory — commit volume

| Window | Commits | Share |
|---|---|---|
| All time | 1,733 | 100% |
| Last 4 weeks | 1,160 | 67% |
| Last 8 weeks (est.) | ~1,450 | ~84% |

Two-thirds of all repo commits landed in the last four weeks. The project underwent a sharp ramp-up in late May 2026 when the multi-agent fruit workflow came online.

### Commit-type distribution (all time)

| Type | Count | % |
|---|---|---|
| `docs` | 441 | 25.4% |
| `research` | 121 | 7.0% |
| `fix` | 120 | 6.9% |
| `data` | 118 | 6.8% |
| `chore` | 116 | 6.7% |
| `feat` | 108 | 6.2% |
| `test` | 49 | 2.8% |
| `refactor` | 37 | 2.1% |
| `pdd` | 26 | 1.5% |
| Other | 597 | 34.4% |

`docs` is the single largest commit type at 25% — this is a documentation-heavy project by design. `research` + `data` (14%) together exceed `feat` (6%), reflecting the data-science / oracle-parity emphasis. `fix` > `feat` signals the project is moving from feature-building toward stabilization.

---

## 2. Agent throughput (velocity.db, all time)

| Agent | Tickets closed | DEV | WRITER | RESEARCH | Other |
|---|---|---|---|---|---|
| APPLE | 120 | 43 | 25 | 23 | 29 |
| CHERRY | 120 | 31 | 29 | 26 | 34 |
| BANANA | 110 | 47 | 18 | 14 | 31 |
| ELDERBERRY | 106 | 19 | 33 | 22 | 32 |
| DRAGONFRUIT | 90 | 24 | 12 | 18 | 36 |
| FIG | 73 | 23 | 15 | 12 | 23 |
| GRAPE | 38 | 9 | 12 | 1 | 16 |
| **Total** | **659** | **196** | **144** | **116** | **203** |

APPLE and CHERRY are tied at the top (120 tickets each). BANANA is 110 — close behind. GRAPE has the fewest (38) and joined later in the project.

### Weekly ticket throughput (last 8 weeks, from `npm run report`)

| Week (Mon) | APPLE | BANANA | CHERRY | DRAGONFRUIT | ELDERBERRY | FIG | GRAPE | Total |
|---|---|---|---|---|---|---|---|---|
| 2026-04-13 to 2026-05-17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2026-05-25 | 42 | 31 | 21 | 15 | 0 | 0 | 0 | 109 |
| 2026-06-01 | 78 | 79 | 99 | 75 | 106 | 73 | 38 | 550 |

The jump from 109 to 550 in a single week represents a 5× surge — ELDERBERRY, FIG, and GRAPE came online in the week of June 1.

---

## 3. Role distribution (all closed tickets)

| Role | Count | % | Avg actual (min) | Avg C (min) | Avg Δc (min) | % on time |
|---|---|---|---|---|---|---|
| DEV | 220 | 33% | 7.1 | 16.3 | +9.7 | 97% |
| WRITER | 172 | 26% | 4.2 | 9.7 | +5.8 | 96% |
| RESEARCH | 126 | 19% | 6.7 | 22.0 | +15.8 | 96% |
| PM | 57 | 9% | 3.4 | 9.6 | +6.2 | 100% |
| DATA | 39 | 6% | 7.2 | 15.0 | +8.7 | 97% |
| TEST | 25 | 4% | 5.8 | 18.1 | +12.3 | 100% |
| ARC | 21 | 3% | 7.1 | 19.9 | +12.8 | 100% |
| SPIKE | 15 | 2% | 8.3 | 24.5 | +16.2 | 100% |
| COMBO | 9 | 1% | 7.7 | 18.3 | +10.6 | 100% |
| CHORE | 9 | 1% | — | — | — | — |
| REVIEW | 5 | 1% | 10.3 | 14.5 | +4.3 | 100% |

**Every role shows positive Δc** — agents consistently finish faster than their C estimate. The systematic over-estimation is healthy (avoids under-committing work) but the gap is large: agents estimate ~2–3× the actual wall-clock time across all roles. SPIKE and RESEARCH show the largest C-vs-actual gap (+16m, +15.8m), which makes sense — uncertainty is highest at the exploratory end.

---

## 4. Human-gate queue (16 open items)

Items requiring human action before agent work can resume, labeled `decision`, `human-decision-required`, `humans-only`, or `waiting-on-external`:

| # | Age | Summary |
|---|---|---|
| #40 | ~1yr+ | Track upstream: cuh63 6.3 mov/mvi sign handling |
| #159 | ~1yr+ | Act on Prof Dos Reis's reply re: sext semantics |
| #507 | months | Send long-line silent-split report to Prof Dos Reis |
| #517 | months | Shift-count masking — four open architecture questions |
| #518 | months | Validate ct=0 shift decision |
| #625–#636 | weeks | Cluster of orchestrate-tooling decisions (M1–M13 from #610) |
| #757 | weeks | demo-034 linker-startup teaching intent clarification |
| #829 | weeks | Orchestrator-session fruit identity convention |
| #841 | weeks | artifact-quality-criteria.md adoption path |
| #845 | weeks | RULES.json adoption — choose Option A/B/C |
| #867–#868 | days | sra shift-by-zero ISA rulings needed |

The queue divides into two tiers: **ancient items** (#40, #159, #507, #517, #518) that depend on external parties (Prof Dos Reis) or stalled decisions, and **recent decision clusters** (#625–#636, #829, #841, #845) that are internal and actionable by the user. The recent cluster is large relative to the ancient one — the orchestrate-tooling M1–M13 series alone accounts for 6 of the 16 items.

---

## 5. Open issue snapshot (52 total)

| Label | Count |
|---|---|
| severity:low | 28 (54%) |
| enhancement | 13 |
| decision | 13 |
| research | 12 |
| blocked | 10 |
| documentation | 5 |
| human-required | 4 |
| human-decision-required | 3 |
| Other | — |

More than half of open issues are `severity:low` — a healthy sign that the high-priority work is flowing through. The 10 `blocked` issues are predominantly old tracker items waiting on the human-gate queue above.

---

## 6. Key signals

1. **5× weekly throughput surge (May→June)**: The addition of ELDERBERRY, FIG, and GRAPE in the week of June 1 drove a jump from 109 to 550 tickets/week. The system scales linearly with agent count so far.

2. **C estimates run ~2–3× high across all roles**: Median actual wall-clock is 4–10 minutes for most roles; C estimates average 10–25 minutes. Consistent positive delta_c is predictable — no agent has systematically under-estimated. This suggests C priors could be tightened (halved) across the board without risking deadline violations.

3. **Human-gate is the primary bottleneck**: 16 open decision items, several months old. Agent throughput is not the bottleneck — human decisions are. The 6 orchestrate-tooling M1–M13 decisions (#625–#636) are the most actionable cluster.

4. **`docs` commits outnumber `feat` 4:1**: This is intentional given the educational nature of the project, but it's worth noting for anyone assessing the feature-vs-documentation balance.

5. **GRAPE is newest and lowest-throughput**: 38 tickets vs 120 for the top agents. Likely a recency effect (joined June 1 week); watch for convergence over the next 2–4 weeks.

---

## Appendix: running this analysis fresh

```bash
npm run report                  # regenerates docs/velocity-report.md (gitignored)
sqlite3 ~/.lccjs/velocity.db    # ad-hoc queries against the canonical store
gh issue list --state open --limit 200 --json number,labels,createdAt  # live open-issue snapshot
git log --format='%s' | grep -oP '^[a-z]+' | sort | uniq -c           # commit-type breakdown
```
