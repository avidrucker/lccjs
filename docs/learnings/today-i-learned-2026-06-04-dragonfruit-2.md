# Today I Learned — 2026-06-04 (DRAGONFRUIT, session 2)

Date: 2026-06-04
Agent: DRAGONFRUIT
Context: Playground interactive stdin (#729), rate-assumption audit (#766),
Q29r corrected re-run (#769), #717 closed as won't-do, follow-up tickets
#762, #778, #779 filed.

---

## 1. SQLite `date()` silently returns NULL for ISO 8601 timestamps with timezone offsets

While querying the velocity DB to analyse C-overshoot row distributions by
day, `GROUP BY date(finished_iso)` produced a mysterious bucket of 309 rows
with a blank date label. Every row had a non-NULL `finished_iso` — the problem
was the format.

```sql
-- Silently returns NULL for 2026-06-01T12:50:42-1000
SELECT date('2026-06-01T12:50:42-1000');  -- → NULL
```

SQLite's `date()` function only understands UTC timestamps (with `Z` or no
offset). The `-HHMM` timezone suffix it cannot parse — it returns NULL instead
of an error. `GROUP BY` then lumps all 309 affected rows into a single NULL
group, making them invisible in day-by-day analysis and overstating the
"no-date" bucket by 309.

**Fix:** `substr(finished_iso, 1, 10)` always returns the date string directly
without trying to interpret the timezone:

```sql
GROUP BY substr(finished_iso, 1, 10)
```

**Lesson:** When a SQLite date function produces unexpected NULLs on data that
looks valid, check whether the timestamp includes a timezone offset. Use
`substr` to extract the date portion instead.

---

## 2. A Web Worker's module-level variable is a reliable closure store for interactive pause/resume

The `pauseOnInput` playground wiring (#729) needed a way for the Worker to
hold a `resume()` closure between two separate `onmessage` calls — the first
to start execution, the second to provide user input. Workers can't pass
functions over `postMessage`, so the closure had to live inside the Worker.

The key insight: a Worker's module scope persists for the entire lifetime of
the Worker instance. A module-level `let resumeFn = null` survives between
messages:

```js
let resumeFn = null;             // lives as long as the Worker does

self.onmessage = function(e) {
  if (e.data.type === 'run') {
    resumeFn = null;             // reset for fresh execution
    const result = api.run(binary, { pauseOnInput: true });
    if (result.status === 'waiting-for-input') {
      resumeFn = result.resume;  // stash the closure
      self.postMessage({ status: 'waiting-for-input', ... });
    }
  } else if (e.data.type === 'resume') {
    const fn = resumeFn;
    resumeFn = null;             // clear before calling (re-entrancy safety)
    handleResult(fn(e.data.input));
  }
};
```

The Worker stays alive (not terminated) while the interactive prompt is
showing. Only `halted`, `max-steps-reached`, and error statuses trigger
`worker.terminate()`. The Stop button terminates the Worker mid-pause, which
also destroys `resumeFn` cleanly.

**Lesson:** For stateful Worker protocols, module-level variables are a simple
and reliable closure store. You don't need to serialize interpreter state or
restart from scratch — the Worker's own JavaScript heap holds it.

---

## 3. `partialOutput` must be added to `waiting-for-input` results or the UI has no context to show

The first draft of the `pauseOnInput` playground wiring showed the prompt
widget but left the output panel empty while the program was paused. The
`api.run()` `waiting-for-input` result only contained `status`, `trapType`,
and `resume` — no `stdout`. Without the output produced before the pause, a
user prompting for `din` input has no idea what the program has printed.

The fix was adding `partialOutput: interp.output` to both `waiting-for-input`
returns in `src/browser/api.js`. The `interp` object accumulates all output
from the start of execution, so `interp.output` at pause time is exactly the
partial output to show.

The issue description said "do not change" the API contract, which I read as
"don't break existing callers" — adding an optional field is additive and
backward-compatible.

**Lesson:** Whenever an async or pauseable operation returns a sentinel,
include the accumulated partial result in that sentinel. Callers with no
context for what to show the user will always need it.

---

## 4. A single unit error can invert a study's feasibility conclusion by 78×

The Q29r analysis in #706 concluded the full-corpus C-overshoot experiment
would take ~47 months. The rate used was "~32 rows/month." When cross-checking
the velocity DB (#766), the actual confirmed organic logging rate was
40–65 all3 rows **per day** — roughly 78× higher than the figure used.

The root cause: the rate was read from a plot or summary at the wrong scale.
32 rows/month ≈ 1 row/day; 40 rows/day ≈ 1,200/month. A unit confusion
between "per month" and "per day" flipped "not feasible in our lifetimes" to
"feasible in five weeks."

This is the same class of error as the NASA Mars Climate Orbiter (imperial
vs metric units) — a dimensionally-typed value treated as dimensionless.

**Lesson:** For any rate-based feasibility calculation, always state the unit
explicitly *and* sanity-check by computing what the rate implies at two
timescales (e.g., per day and per year). A number that "feels right" per month
may be absurd per day — and vice versa.

---

## 5. A PM decision ticket can be superseded before it's worked — close it as won't-do with a pointer

`#717` was a valid PM ticket when filed: "decide whether to add per-agent
C-overshoot tracker for DRAGONFRUIT and CHERRY." Its decision criteria
depended on the Q29r feasibility timeline. Once #769 corrected that timeline,
the decision collapsed — if the full-corpus experiment is feasible in ~5 weeks,
"should we bother with a per-agent tracker as an alternative?" answers itself.

The instinct was to pick up #717 and write the PM decision document. The
right call was to close it as won't-do with a comment explaining:

1. What made it valid when filed.
2. What changed (corrected rate from #769).
3. Where the substance went (#769's output absorbs the decision).

Closing with context is not the same as abandoning the work — it prevents
future agents from picking up a ticket whose premise is gone and doing work
that produces a stale conclusion.

**Lesson:** Before picking up any PM or decision ticket, verify that the
factual premises it was built on are still current. If a child ticket has
already resolved the underlying question, close the PM ticket as won't-do
with an explanation rather than doing the decision work on stale data.

---

## 6. Organic vs backfill rows have different c_min validity — pooling them distorts calibration metrics

The Q29r re-run (#769) revealed a meaningful split in the C-overshoot rate:
organic days (c_min set before starting work) show **6.61%**, while the
pooled corpus shows **4.92%**. The difference is backfill rows, where
`c_min` was logged retroactively — anchored to the known `actual_min`.

This means:
- The pooled rate understates true C-overshoot for calibration purposes.
- A powered experiment using the pooled rate (4.92%) targets the wrong
  threshold — it needs n=1,792 when the organic-only threshold is n=1,318.
- Any calibration trend analysis that mixes organic and backfill rows is
  measuring a blend of "genuine prediction accuracy" and "retroactive
  self-assessment accuracy."

**Lesson:** For calibration metrics, always segment rows by whether the
estimate was set before or after the outcome was known. Pooling forward-looking
and retroactive estimates produces a metric that measures neither well. Tag
backfill sessions at logging time if possible, or derive them from
`finished_iso` distribution patterns.

---

## What landed

| Issue | What |
|---|---|
| [#729](https://github.com/avidrucker/lccjs/issues/729) | `pauseOnInput` playground widget — stateful Worker resume, `showPrompt`/`hidePrompt`, `partialOutput` in `api.js` |
| [#762](https://github.com/avidrucker/lccjs/issues/762) | Filed — validate pauseOnInput UX in browser (8-scenario checklist) |
| [#766](https://github.com/avidrucker/lccjs/issues/766) | TRACKER: 5 Q29r rate-assumption questions answered inline via sqlite3; filed #769 |
| [#769](https://github.com/avidrucker/lccjs/issues/769) | DATA: corrected Q29r — 47 months → ~32 days; appended to `velocity-analytics-batch.md` |
| [#717](https://github.com/avidrucker/lccjs/issues/717) | Closed as won't-do — superseded by #769 |
| [#778](https://github.com/avidrucker/lccjs/issues/778) | Filed — #719 body contains inverted feasibility conclusion |
| [#779](https://github.com/avidrucker/lccjs/issues/779) | Filed — organic vs backfill c_min conflation, organic-only sensitivity unwritten |

## Open threads

- [#778](https://github.com/avidrucker/lccjs/issues/778) — correct #719's body (redline the 47-month figure)
- [#779](https://github.com/avidrucker/lccjs/issues/779) — write organic-only sensitivity analysis for C-overshoot
- [#719](https://github.com/avidrucker/lccjs/issues/719) — repurpose once #778 closes: document corrected feasibility finding
- [#762](https://github.com/avidrucker/lccjs/issues/762) — manual browser validation of pauseOnInput UX
