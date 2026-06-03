# Research: velocity row eligibility — tracker vs scope-spike (#225)

**Status:** Confirmed. Rule codified in `docs/puzzle-velocity.md` §"What gets logged".

## Question

Which issues earn a velocity CSV row? Specifically: do tracker/epic issues
(umbrella issues that collect children) get a row, or only their children?

## Finding

The deciding test is not "is this a parent issue?" but **"does this issue
represent distinct work, or is it just an umbrella over rows that already
exist?"**

Confirmed via audit of existing rows (APPLE, #549):

| Pattern | Row? | Precedent |
|---|---|---|
| Pure tracker/epic (no work of its own) | No | #108, #144 — zero rows in CSV |
| Scope-decomposition spike (inventory + child breakdown deliverable) | One row | #166 (SPIKE, 20 min actual), #171 (SPIKE, 4 min actual) |
| Spike / RESEARCH (findings, no children) | One row | #203, #193, #216 |
| Child puzzle | One row each | All implementation tickets |

## Audit findings

No violations found:

- **#108, #144** (pure trackers): 0 rows — correct.
- **#166** (scope-decomp SPIKE: file 5 children for plus/extra coverage): 1 SPIKE row, `actual_min=20` — legitimate; the 5 children (#196–#200) log implementation separately.
- **#171** (scope-decomp SPIKE: scope linker test decomposition): 1 SPIKE row, `actual_min=4` — legitimate.
- **#221** (PM: create 3 trackers): 1 PM row for the curation act — correct; the 3 trackers themselves get no rows.

## Rule

A scope-spike row is **not double-logging** — it records the scoping act; the
children's rows record their implementation. The constraint is that
`actual_min` on the scope-spike must never absorb child work time.

Rule written into `docs/puzzle-velocity.md` "What gets logged" and the
`puzzle-velocity` skill "Skip when". See #225.
