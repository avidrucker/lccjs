# Report-artifact parity: lccjs vs oracle LCC (`.lst` / `.bst`, `.a` vs `.e`)

Findings for **#145** (spike under #13). Reproducible via
[`experiments/debugger-report-parity-probe.sh`](../../experiments/debugger-report-parity-probe.sh),
which runs the 2×2 matrix — `{oracle, lccjs} × {run on .a, run on .e}` — snapshots all
eight artifacts, and diffs the oracle-vs-lccjs pairs. Oracle = cuh63 `lcc` Ver 6.3
(via `LCC_ORACLE`). Sample demo: `textbook_demos/ch03…/demo-009-static-linked-list.a`.

## TL;DR

- **No missing artifact.** All four cases (`.lst`+`.bst` on `.a`, `.lst`+`.bst` on `.e`)
  are produced by **both** tools, with identical addresses / machine code / statistic
  *values*. The remembered "missing `.bst` or `.lst`" does **not** reproduce on a normal
  run **nor** under `-d` (both tools still write both files in debug mode).
- The real divergences are **report *formatting***, not content or presence. Six of them,
  catalogued below. One (`.a` source-line truncation) changes rendered content; the rest
  are whitespace/column geometry.
- `#13`'s premise should be re-framed: the gap is **report-format parity**, not a missing
  file. The one place that *does* deliberately differ (debug-trace output isn't folded into
  the listing) is by design and matches between tools at the file level.

## The matrix (demo-009, bytes)

| artifact | oracle | lccjs | present both? | values match? |
|---|---|---|---|---|
| `.lst` on `.a` | 3141 | 4020 | yes | yes (see diff E) |
| `.bst` on `.a` | 3885 | 4353 | yes | yes |
| `.lst` on `.e` |  935 |  925 | yes | yes |
| `.bst` on `.e` | 1534 | 1480 | yes | yes |

Both also write `.lst`+`.bst` under `-d` (debug) on `.e`.

## Observable differences (oracle ⇒ lccjs)

| id | where | oracle | lccjs | kind |
|---|---|---|---|---|
| **A** | banner (line 1) | `LCC … Ver 6.3  Thu May 28 19:38:16 2026` (ctime-style date) | `LCC.js … Ver 0.1  Thu, May 28, 2026, 19:38:16` | product + **date format** |
| **B** | Header `A`/`S` lines | `A     0000` (addr right-aligned in 5-wide field) | `A 0000` (single space) | whitespace |
| **C** | Program-statistics block | label padded to ~22, value right-aligned (`Input file name       =      d.e`) | label padded wider, value left-set (`Input file name          =   d.e`) | column widths |
| **D** | Source/Code column geometry | LST source gutter starts ~col 11; BST header `Loc          Code` | gutter ~col 20; `Loc   Code` | column widths |
| **E** | `.a` Source-Code column | **truncates** each source line to the listing width (~67 cols; comments cut mid-word) | prints the **full** source line (≤109 cols) | **rendered content** |
| **F** | BST data rows | trailing space after the binary word | trimmed | trailing whitespace |

A is expected (different product) except the gratuitous date-format difference. B–D + F are
pure formatting. **E is the only content-affecting one** and is the most interesting: lccjs's
untruncated output is arguably *better* for humans, so "match the oracle exactly" is a
**decision**, not an obvious fix — flagged for the owner.

## Hypotheses ruled out

- *"Debug mode suppresses `.lst`/`.bst`."* — No. `-d` still writes both, on both tools.
  (`interpreter.js:364` `generateStats=false` is under `-nostats`, a separate branch from
  `-d` at `:366`; the default `generateStats=false` at `:157` is overridden to `true` by the
  CLI main at `:1749`, and `lcc.js:46` sets it `true`.)
- *"The `.e` path drops an artifact."* — No. `.e` runs produce both files on both tools.

## Still open (cheap follow-ups, if the missing-artifact memory matters)

The missing-artifact symptom wasn't reproduced in CLI `.a`/`.e`/`-d` runs. If it was real it
likely lives in a path this probe didn't drive:
- the **interactive `ilcc`/`iinterpreter`** stepping session (not the `-d` core path);
- the **500k-instruction auto-activation** of the debugger (the probe demos are tiny);
- a now-fixed earlier state (the memory may predate a fix).

Driving those is a small extension of the probe — folded into the #13 decomposition below.

## Decomposition → build puzzles on #13

Report-format parity, smallest-first (each ≤60m; **all gated by re-running the probe**):

1. **B** — Header `A`/`S` address-line padding parity. (~20m)
2. **F** — match the oracle's trailing space on BST data rows (or normalize it in goldens). (~15m)
3. **D** — Source/Code column geometry (gutter + `Loc/Code` header width). (~30m)
4. **C** — Program-statistics block label/value alignment parity. (~30m)
5. **A** — banner date-format parity (keep `LCC.js`/version; match the date shape). (~20m)
6. **E** — *decision* + impl: match the oracle's source-line truncation, or keep
   lccjs's full lines and normalize goldens instead. Owner call first. (~30m once decided)
7. **probe extension** — drive the interactive `ilcc` + 500k auto-debug paths to rule the
   missing-artifact symptom fully in or out. (~30m) — overlaps the DRY spike #146.

Add a `.e`-path oracle-parity test (the suite's `runOracle.js` only ever runs the oracle on
`.a`; nothing exercises oracle-on-`.e` report parity today).
