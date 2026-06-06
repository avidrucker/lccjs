# ICE Scores — lccjs open issues

**Generated:** 2026-06-06   **Issues scored:** 2



## Rubric

| Dimension | Scale |
|---|---|
| **I (Impact)** | 3=massive · 2=high · 1=medium · 0.5=low · 0.25=minimal |
| **C (Confidence)** | 1.0=high · 0.8=medium · 0.5=low |
| **E (Ease)** | 10=trivial · 7=easy · 5=moderate · 3=hard · 1=very hard |

**Formula:** `ICE = I × C / E`
**Tiebreaker:** `+ 1 / (issue × 1000)` — earlier issues win ties but cannot flip a higher-scored ticket.

## Override tiers

Two tiers sit above the normal ICE queue:

| Tier | Label | Who can set | Meaning |
|---|---|---|---|
| Critical | `priority:critical` | Human only | Do before everything else — SLA breach, legal risk, blocking all agents |
| Elevated | `priority:elevated` | Human or PM agent | Do this sprint, before all normal-queue items |

**Audit trail required:** every time `priority:critical` or `priority:elevated` is applied, post a comment on the issue with:
- **Who** escalated it
- **Why** (one sentence)
- **Expiry** — stays elevated until when, or until what event?

Use: `npm run ice:score -- --set-tier elevated --issue N`


## Normal queue

| Rank | Issue | Title | I | C | E | ICE | Act |
|---|---|---|---|---|---|---|---|
| 1 | #956 | feat: replace RICE with ICE scoring + override tiers + scoring script | 2 | 0.8 | 5 | 0.3200 | Y |
| 2 | #948 |  | 1 | 0.8 | 7 | 0.1143 | Y |
