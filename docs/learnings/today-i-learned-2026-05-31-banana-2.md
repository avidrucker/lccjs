# Today I Learned — 2026-05-31 (BANANA s2)

A short PM + research session: cleaned up 5 stale worktrees, filed two tickets (#294, #297),
worked #294 (closed-issue audit), and filed the follow-up ARCHITECT ticket (#301).

---

## 1. A dirty `package-lock.json` is not a reason to pause

Two worktrees (#290, #291) had "modified or untracked files" blocking a plain `git worktree remove`.
The only modified file in each was `package-lock.json` — a side-effect of node resolution, not real
work. Force-removing was the right call. The heuristic: if `git status` shows only `package-lock.json`
and nothing in `src/` or `docs/`, it's safe to force-remove.

## 2. Do the data-integrity audit before the process-mapping research

#294 (audit closed issues for mis-closes) was done before #297 (map the full workflow).
The reason: #294 produces concrete evidence (#278 as a confirmed real failure) that #297 can anchor its
recommendations on. Doing them in reverse order means #297 theorizes about a problem whose
actual frequency and shape are unknown. Audit first, then map.

## 3. A keyword-overlap heuristic catches gross mismatches — but produces false positives

To find `Closes #N` transpositions, I extracted all commit→issue pairs from git log and
compared content-word overlap between each commit subject and its issue title.
Of 9 flagged cases, 7 were false positives: commits that abbreviated the finding
(`#126`: ".bst is binary listing"), intentionally closed multiple issues, or used PM language
that genuinely doesn't share keywords with the underlying work.

Only 2 were real: #278 (confirmed transposition, already OPEN/REOPENED) and #188 (partial-scope
close, also already OPEN/REOPENED). Both were already caught by the human who reviewed them.
The system is more robust than feared — 233 issues, 1 unrecovered drop.

## 4. File the ARCHITECT ticket immediately; don't leave guard recommendations as stranded prose

The audit doc produced two guard recommendations. The natural next move was to treat them as done
and move on. Instead, a follow-up ARCHITECT ticket (#301) was filed immediately while the audit
findings were still fresh context. A recommendation that lives only in a research doc is easy to
forget; a ticket is a claim on future work that the scheduler can see.
