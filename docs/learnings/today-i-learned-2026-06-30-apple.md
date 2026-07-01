# TIL 2026-06-30 — APPLE

**Context:** A single long thread that started as "review #1561" and turned into a full plan-mode effort to make `stats/week-04-analysis.ipynb` honest: verify which skills actually apply, then hands-on remediate the notebook across two tickets — #1561 (correctness gate) and #1563 (analytical rigor). The connective tissue: hunting bogus claims, and not manufacturing new ones in the process.

---

## 1. Verify a skill from its `SKILL.md` — never infer capability from its name

**What happened:** Asked which skills could improve a data-analysis notebook, I confidently proposed **`tufte`** for "better visuals" — reasoning from the name (Edward Tufte). The user corrected me: `tufte` is the **Clojure profiling library** (`taoensso.tufte`), nothing to do with visualization. When I later dispatched an Explore agent to read the actual files, it confirmed: `~/.../skills/tufte/SKILL.md` instruments Clojure code for timing percentiles.

**What I learned:** Recommending a skill from its name is the *exact* hallucination the whole task was about — a fluent, plausible, invented capability. The fix is cheap and total: open the `SKILL.md`, summarize what it *actually* does, cite the path. The verification pass also paid off twice more — it found that the only genuinely relevant skills were the `author-*` critical-reading family, and that **no** skill (and no project doc) covers visuals or statistics quality, so those needed explicit written criteria instead.

**The rule:** **Before naming a skill/tool/API as fit-for-purpose, read its definition and cite the path — a name is a hypothesis, not evidence.** (This is `murphy-hallucinated-output`'s "treat fluent confidence as a red flag" applied to myself.)

---

## 2. Review a ticket against the *user's* goal, not the ticket's own framing

**What happened:** I filed #1561 as a "QC + refine pass" (mirroring #1337 for week-03). When asked to review it, my first instinct was to score it as a QC ticket — where it looked fine (~14/15). But the user's stated goal was *rigorous analytical enhancement* (better hypotheses, valid stats, no wishy-washy claims). Against **that**, the ticket was **NEEDS WORK (11/15)** — it was scoped for correctness, not rigor.

**What I learned:** A ticket can be internally well-formed and still be the wrong ticket. The review's job is agent-readiness *for the intended work*, and the intended work is the human's goal, not the artifact's self-description. The irony compounded: a ticket I authored an hour earlier already missed the goal — so "my framing ≠ the user's goal" (a #1559 lesson) applies to my own tickets, immediately.

**The rule:** **Review a ticket against the requester's goal, not the ticket's own framing; a competent QC ticket is still NEEDS-WORK if the goal was enhancement.** (Ref #1561 → split into #1561 gate + #1563 rigor.)

---

## 3. Multiple-comparison correction can flip a headline — the highest-leverage honesty catch

**What happened:** §6 of the notebook ran **8** per-role Mann–Whitney tests and reported two as "significant": WRITER (p=0.0003) and **DEV (p=0.0133)**. Adding a Benjamini–Hochberg correction (#1563), DEV moved to **p_bh=0.0532 — no longer significant**; only WRITER survived (p_bh=0.0024). The "DEV also significant" claim was a family-wise false positive that survived only because nobody corrected for running eight tests.

**What I learned:** This was the single most valuable correction of the whole effort, and it's invisible without the discipline — the raw p-value *looks* fine. The same family of thinking caught two siblings: a §9 ICE distribution that **blended 30 provisional auto-scores (median 2.60) with 144 human-judged (2.00)**, inflating the reading (split before reporting), and a §0 claim of "roughly half" that was actually **~10%** (a 5× fabrication) and a §9 "driven by Ease" that was a **scale artifact** (Ease has the biggest *raw* magnitude; Impact actually varies most, CV 0.49 > 0.28).

**The rule:** **When a section runs a family of tests, correct for it (BH/Bonferroni) before calling anything significant; and never report a blended distribution over authoritative + heuristic rows without splitting them.** (Ref #1563; these belong in `stats/CLAUDE.md` via #1523.)

---

## 4. A live-windowed notebook is a re-sync treadmill; hand-transcribed stats are the root cause

**What happened:** The notebook's date `CEILING` includes the current, in-progress day, so each re-execution ingested new rows (1,040 → 1,068 → 1,071) and shifted the headline (median 2.67× → 2.50×). Worse, the prose stats were **hand-transcribed into markdown from computations that were never printed** — so Cell 30 had *mixed numbers from different runs* (an old §1 next to a newer §2), all unverifiable, and re-execution couldn't auto-fix them. I re-synced every figure from freshly-*printed* cell output, but the drift will recur on the next run.

**What I learned:** The reproducibility problem (#1523) and the honesty problem (#982) are the same root: a number that lives only in prose can't be checked and will drift. The durable fix isn't "re-transcribe carefully" (that just moves the bug) — it's to make each headline stat **printed by a cell** so the narrative cites a computed value. I surfaced this as the structural finding rather than grinding, and got the user's windowing decision before committing.

**The rule:** **Prefer stats that a cell *prints* over stats typed into prose; a hand-transcribed number is a drift-and-hallucination waiting to happen. Surface a windowing/re-sync fork to the human instead of silently re-transcribing.** (Flagged on EPIC #1548.)

---

## 5. In plan mode, ground the plan in Explore-agent facts before writing it

**What happened:** Rather than plan from memory, I dispatched two read-only Explore agents — one to read the actual skill files, one to read the notebook section-by-section + the prior quality tickets. That's what caught the `tufte` error, established that the visuals were already strong (labeled, colorblind-safe — *not* the weak axis, despite the user asking for "better visuals"), and produced the verified defect list the whole plan hung on.

**The rule:** **Plan-mode Phase 1 is for facts, not assumptions — send Explore agents to read the real files, and let their findings (even inconvenient ones, like "visuals are fine") reshape the plan.**

---

## What landed

| Artifact | Change |
|---|---|
| `stats/week-04-analysis.ipynb` | §0/§9 false claims fixed, stale week-three labels, §10 headless banner, full prose re-sync (#1561) |
| `stats/week-04-analysis.ipynb` | §4 KW test added, §6 BH correction (DEV→n.s.), §9 provisional/human split + scale-free CV (#1563) |
| Tickets | #1561 rewritten to correctness-gate + #1563 filed for rigor, both 15/15; nested under EPIC #1548 |

## Related artifacts

- Sibling TIL earlier this session: [TIL 2026-06-29 APPLE (session 3)](./today-i-learned-2026-06-29-apple-3.md)
- Issues #1561, #1563, #1548 (telemetry epic), #1523 (stats footguns), #982 (uncited claims), #1516 (provisional ICE)
