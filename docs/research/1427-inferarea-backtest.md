# #1427 — `inferArea()` accuracy backtest against a labeled-issue corpus

**Agent:** BANANA · **Type:** DATA/research · **Target:** `scripts/infer-area-label.js` (#1246)

## TL;DR

Backtested `inferArea()` against **390 issues** (open+closed) carrying exactly one human-assigned
`area:*` label, across all six lanes. Baseline: **68.2% exact agreement, 14.4% abstained
(uncategorized), 17.4% wrong-lane.** The design's conservative ideal — *"a wrong lane is worse
than uncategorized"* — was **violated**: wrong (17.4%) > abstain (14.4%). The failure is
overwhelmingly one cluster: **`area:architecture` was 88% mis-filed as `area:toolchain`**,
because architecture tickets are dense with toolchain nouns (`assembler.md`, `interpreter`,
`linker`). A three-pattern, evidence-validated tuning (`ADR`, `re-anchor`, `symbol-anchored`)
recovered it: **70.8% exact / 14.4% wrong (+10 correct, −12 wrong-lane, +2 abstain)**, applied
here with regression tests. The tie→uncategorized policy was left unchanged (out of scope).

## Method

1. Corpus: `gh issue list --state all --limit 400` → 390 issues with exactly one real `area:*`
   label (excluding `area:uncategorized`). Per-lane: process 204, toolchain 88, architecture 42,
   web 27, lcc-non-core 19, education 10.
2. For each, call `inferArea(title, body, [])` — **area label stripped** so the early-return
   short-circuit can't trivially win.
3. Classify: exact-match / wrong-lane / abstained (`area:uncategorized`).

(Reproducible: the corpus is a plain `gh` pull; the backtest is a ~30-line Node script over the
committed `inferArea`. No committed data file — re-runnable on demand as the backlog grows.)

## Baseline results (n=390)

| metric | value |
|--------|-------|
| exact agreement | **68.2%** (266) |
| abstained (uncategorized) | 14.4% (56) |
| **wrong lane** | **17.4%** (68) |

### Per-lane (by human label)

| lane | n | exact | abstain | wrong |
|------|---|-------|---------|-------|
| area:process | 204 | 83.3% | 13.7% | **2.9%** |
| area:web | 27 | 81.5% | 11.1% | 7.4% |
| area:toolchain | 88 | 71.6% | 14.8% | 13.6% |
| area:education | 10 | 40.0% | 30.0% | 30.0% |
| area:lcc-non-core | 19 | 31.6% | 26.3% | **42.1%** |
| area:architecture | 42 | **2.4%** | 9.5% | **88.1%** |

### Confusion (wrong-lane pairs, human → inferred)

```
31x  architecture → toolchain     5x  process   → toolchain
 8x  lcc-non-core → toolchain      4x  architecture → lcc-non-core
 7x  toolchain    → lcc-non-core   2x  architecture → process
 5x  toolchain    → process        2x  education  → toolchain   … (tail)
```

## Analysis

**`toolchain` is the attractor.** 46 of 68 wrong-lane misfires land in `area:toolchain`. Its
patterns (`assembler`, `interpreter`, `linker`, `opcode`, `trap`, …) are common *nouns* that
appear in tickets whose *purpose* is architectural, LCC+, or educational. Two failure shapes:

1. **Architecture (the dominant miss).** 31 of 42 architecture tickets → toolchain. Almost all
   belong to **one campaign**: the ADR / symbol-anchoring glossary work (`re-anchor assembler.md
   §(x) … to symbols (ADR 0001)`, `adopt symbol-anchored Source: refs`). These are architecture
   *discipline* applied to toolchain *docs*, so toolchain nouns dominate the text and the narrow
   architecture patterns (`decomplect`, `seam`, `DDD`) rarely fire. (This is exactly the
   "architecture-phrased-as-toolchain" limitation #1246 flagged.)
2. **lcc-non-core (secondary).** 8 of 19 → toolchain: LCC+ tickets about sound mnemonics/traps
   (`boop`, `beep`, `sound trap`) whose text says `trap`/`ISA`/`mnemonic` (toolchain) more
   distinctively than `lcc+`/`.ap`.

**Note on ground truth.** The ADR-glossary cluster is *borderline* — "re-anchor a glossary doc's
Source: refs to symbols" could defensibly be `documentation` or `process`. Per the ticket, the
human label is ground truth, so tuning toward it is legitimate; but the size of this single
campaign inflates architecture's apparent error rate, and a chunk of the "fix" is really the
heuristic learning to recognize that campaign.

## Tuning (applied, with tests)

Candidate architecture patterns were simulated against the full corpus, keeping only those with
a clear net gain and **no exact-match regression**:

| candidate | Δexact | Δwrong | verdict |
|-----------|--------|--------|---------|
| `/\bADR\b/` + `/re-anchor/i` + `/symbol-anchored/i` (combined) | **+10** | **−12** | ✅ applied |
| `/pure seam/i` | 0 | **+5** | ❌ rejected (misfires on toolchain "linker pure seam") |
| `/inheritance/i`, `/composition/i` | 0 | −2 each | ⚪ marginal, not applied (false-positive risk on a larger corpus) |

**Applied:** added `/\bADR\b/`, `/re-anchor/i`, `/symbol-anchored/i` to `area:architecture` in
`AREA_RULES`, plus two regression rows in `infer-area-label.unit.spec.js` (real titles #1381,
#1358). Post-tuning over the same corpus: **exact 70.8%, abstain 14.9%, wrong 14.4%** — wrong-lane
now ≈ abstention, back in line with the conservative "wrong is worse than uncategorized" ideal.

*Caveat:* this is **in-sample** tuning (measured on the corpus it was fit to). The three tokens are
hyper-specific vocabulary, not fitted noise, so overfitting risk is low — but the headline gain is
concentrated on the one ADR campaign.

## Findings surfaced (not acted on)

- **The tie→`uncategorized` policy is sound and left unchanged** (#1246 out-of-scope). Abstention
  (14.4%) is doing its job — a low-confidence guess correctly defers to a human rather than
  guessing wrong.
- **`lcc-non-core` (42% wrong) and `education` (30% wrong, n=10) remain weak.** A future pass could
  add LCC+-distinctive sound tokens (`\bboop\b`, `\bbeep\b`, `sound (trap|mnemonic)`) to
  lcc-non-core; education is too small a sample to tune confidently. Deliberately **not** applied
  here — flagged for a follow-up if desired, rather than over-fitting on thin data.
- **`toolchain` as attractor** is structural: its keywords are the codebase's common nouns. The
  right long-term lever is more *distinctive* patterns for the other lanes (as done for
  architecture), not weakening toolchain.

## Acceptance criteria — status

- [x] Report with agreement / abstention / confusion over a ≥20-issue, multi-lane corpus (390).
- [x] Top mis-categorizations named (architecture→toolchain ×31; lcc-non-core→toolchain ×8) with
  proposed fixes (applied for architecture; surfaced-not-applied for lcc-non-core/education).
- [x] Agreed pattern changes landed with new rows in `infer-area-label.unit.spec.js` (no behavior
  change without a test).
