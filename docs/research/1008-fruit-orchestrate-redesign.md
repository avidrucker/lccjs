# Redesign /fruit-agent-orchestrate for lower token cost (#1008)

**Author:** BANANA · **Date:** 2026-06-06 · **Type:** RESEARCH (research-only)

Investigates how to produce the same `/fruit-agent-orchestrate` output (pre-flight
cleanup → ranked table → human/blocked/icebox/in-flight sections → seven
copy-pasteable assignment paragraphs) at materially lower main-context token cost
and better latency. No production change here; recommends a redesign and files
implementation children. Read-only contract and output shape are hard constraints.

---

## 1. Where the cost actually goes

The SKILL.md is only ~150 lines — the file isn't the cost. The cost is what a
single invocation *does* in the main loop:

| Stage | Today | Main-loop cost |
|---|---|---|
| Step 1 | `gh issue list --limit 100 -q '…'` (TSV via `-q`, ~1 line/issue) + `puzzle:status` + `git worktree list` | ~75 issues × ~35 tok ≈ **2.5–4k tok** of raw rows, all into main context |
| Step 2 | **N sequential** `gh issue view N --json state` — one per worktree branch and per `[STALE]` marker | ~6–12 separate tool round-trips (latency-bound), each with call+result overhead |
| Steps 3–5 | puzzle-triage ranking **re-derived inline** + area bin-packing + 7 paragraphs | the bulk of **output** tokens, all reasoned in the top-level window |

Two structural problems: (a) raw data and N small `gh` calls land in the expensive
main context, and (b) the heavy multi-stage reasoning runs token-by-token at the
top level. Both scale poorly as the open-issue count grows.

## 2. The key finding: most of the fix already exists in `scripts/puzzle-status.js`

`puzzle-status.js` already:

- supports **`--json`** (`node scripts/puzzle-status.js --json`, machine-readable dump);
- resolves issue state for **all** candidate numbers in **one batched `gh api
  graphql` call** (`iN: issue(number:N){ state title labels }`), not N round-trips;
- **joins** markers × worktrees × issue-state and derives `STALE` / `BLOCKED` /
  `CLAIMED` / `IN-PROGRESS` states already.

So Direction 1 (push raw data out of main context) and Direction 4 (batch the
stale checks) are **not new work** — they are *already implemented in a tested
script the skill simply doesn't consume.* Step 2's per-issue `gh issue view` loop
duplicates, sequentially and more expensively, what one `puzzle:status --json`
call already produced in a single batched query.

Likewise Direction 3: `puzzle-triage` is a **standalone skill** that owns the
severity→Yegor ranking. Step 3 re-embeds that algorithm verbatim — pure
duplication with drift risk.

## 3. Recommendation (ranked)

### R1 — Consume `puzzle:status --json`; delete the raw dump + per-issue loop  ⟵ headline
Replace Step 1's raw `gh issue list` + Step 2's N `gh issue view` calls with a
**single** `npm run puzzle:status -- --json` read. That one call already returns
the joined, state-resolved digest via one batched GraphQL query. The skill reads a
compact pre-digested JSON instead of ~75 raw rows + a fan of sequential calls.
Highest leverage, lowest risk — it reuses tested code. *Likely small enhancement
needed:* have `puzzle-status.js --json` also emit the open-issue list with labels
and `createdAt` (for ranking + area clustering) if it doesn't already, so the skill
needs no second fetch.

### R2 — Delegate Steps 3–5 reasoning to one subagent  (conditional)
Spawn a single Explore/general subagent that ingests the R1 digest and returns
**only** the final assignment block (ranked table + sections + 7 paragraphs),
keeping the bin-packing and seven paragraph-generations out of the main window.
Tradeoff: a subagent spawn has its own cost and adds moving parts to a read-only
skill. **Sequence after R1** and adopt only if the post-R1 main-loop cost is still
high — R1 alone may suffice. Output-shape constraint is preserved (the subagent
returns the block verbatim for copy-paste).

### R3 — Compose `puzzle-triage` instead of re-embedding its algorithm
Have Step 3 reference/compose the `puzzle-triage` skill for the severity→Yegor
ranking rather than copy-pasting it. One source of truth, less drift, smaller
SKILL.md. Cheap; correctness/maintainability win rather than a cost win.

**Order:** R1 → R3 (both cheap and independent) → R2 (conditional, measured against
R1's result). R2 carries a `Sequenced after:` annotation on R1 so the orchestrator
holds it until R1 lands (exercising the #978 convention).

## 4. What stays fixed (constraints honored by all three)

- **Read-only:** none of R1–R3 add a claim/label/mutation. `puzzle:status` and
  `puzzle-triage` are both already read-only.
- **Output shape:** R1/R3 don't touch the rendered format; R2 reproduces it verbatim.

## 5. Children filed

See closing comment for the verified numbers. R1 (consume the digest), R3 (compose
puzzle-triage), and R2 (conditional subagent delegation, sequenced after R1).

## 6. Headline conclusion

The biggest win isn't new infrastructure — it's **deleting duplication**. The
expensive parts of the skill (raw issue dump, N sequential state checks, re-derived
ranking) are already solved by `scripts/puzzle-status.js --json` and the
`puzzle-triage` skill. Wiring the skill to consume them (R1 + R3) captures most of
the cost and latency reduction with minimal risk; subagent delegation (R2) is a
conditional second step only if needed.
