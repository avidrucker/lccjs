# TIL 2026-06-05 — APPLE (session 2)

**Context:** Three tickets closed — #888 (add human-routing filter to `fruit-agent-orchestrate`), #714 (web feature parity audit, caught stale checklist), #904 (stale-tracker-body-read failure mode research). Session was tooling/process-oriented with no production code changes.

---

## 1. Tracker body checkboxes are frozen — always verify child states with `gh issue view`

**What happened:** Assigned to audit tracker #714 ("lccjs web feature parity"), I found a prior APPLE comment from earlier the same day reporting "no advancement possible — #732 and #733 remain deferred." The comment was wrong: both children had been closed ~7 hours earlier. The prior agent had read the issue body's unchecked markdown boxes (`- [ ] #732`) and reported their state without calling `gh issue view 732`.

**What I learned:** GitHub does not auto-check boxes in a parent tracker body when a child issue closes. A `[ ]` in a tracker body is a manually-maintained cache — it reflects the state at the last time a human or agent edited the body, which may be days or weeks stale. Reading the body in good faith produces plausible but wrong output.

**The rule:** **When auditing a tracker, call `gh issue view N --json state -q .state` for every child referenced in the checklist before reporting or acting on their status. Never report a child as open because the box is unchecked — verify live.** (Follow-up: #906 adds this to `do-this-not-that.md`.)

---

## 2. `grep -c` exits 1 when the count is zero — this silently breaks `&&` chains

**What happened:** During a rebase conflict resolution I wrote a compound safety check:

```bash
grep -c '^<<<<<<<\|^=======\|^>>>>>>>' docs/puzzle-velocity.csv && git add docs/puzzle-velocity.csv && git rebase --continue
```

The file had no conflict markers (count: 0). `grep -c` printed `0` but exited with code 1 (standard grep behaviour — exit 1 means "no match"). The `&&` chain stopped immediately; `git add` and `git rebase --continue` never ran. The rebase stayed broken and I only noticed when the next command errored.

**What I learned:** `grep` (including `grep -c`) exits 0 when at least one line matched and 1 when zero lines matched. For a safety gate ("confirm there are NO markers"), zero matches is the *success* case, but the exit code signals failure. The `&&` chain interprets that as an error and halts.

**The rule:** **For "assert absence" safety checks with `grep`, run `git add` and `git rebase --continue` as separate sequential commands after confirming the count output is 0 — don't chain them with `&&` off a grep call.**

---

## 3. A skipped worktree claim is a leading indicator of a skipped verification step

**What happened:** The prior APPLE session audited #714 without claiming a worktree. Without a worktree there is no commit, no velocity row, and — crucially — no deliberate work structure that would have prompted `gh issue view` calls. The agent read the issue body, formed a conclusion, and filed a comment. The conclusion was wrong and sat in the tracker until the next session (with a worktree) corrected it.

**What I learned:** The worktree requirement structures the work: pre-flight reads, `gh issue view --comments`, deliberate tool calls whose results you read one at a time. Skipping the worktree makes it easy to skip verification steps, and skipped verification steps produce plausible-but-wrong outputs that look authoritative because they're filed as issue comments.

**The rule:** **If you find a prior comment on an issue that was filed without a corresponding worktree claim, treat its content as unverified before relying on it.**

---

## 4. Stale-read errors are a distinct failure mode — not a sub-case of batching confabulation

**What happened:** While writing the findings doc for #904 I tried to classify the #714 incident under the existing D-4 (tool-call batching → confabulated state) category in `docs/research/orchestration-failure-modes.md`. The fit was wrong — D-4 is specifically about parallel tool calls producing expected-outcome narration without reading real results. The #714 error had no batching; the agent made one real read, got real output (the issue body), and simply trusted the wrong source.

**What I learned:** The underlying cognitive error is the same (trusting cached state over real state) but the mechanism and the fix are different. D-4 is fixed by not batching. F-1 (the new category I wrote up) is fixed by a discipline rule: any document that describes live state must be verified against the live source before acting on it. Lumping them together would have produced a mis-scoped fix.

**The rule:** **When classifying an agent error, check both the mechanism (how did the wrong state enter?) and the fix (what prevents it?). Two errors with the same root cause need separate catalog entries if their prevention strategies differ.**

---

## What landed

| Artifact | Change |
|---|---|
| `~/.claude/skills/fruit-agent-orchestrate/SKILL.md` | Added `🧑 Requires human routing` partition — filters `humans-only`, `decision`, `human-decision-required` before assignment (#888) |
| `docs/skills.md` | Updated `fruit-agent-orchestrate` notes; struck prior open improvement candidate (#888) |
| `docs/research/ilcc-dashboard-feature-audit.md` | Sections A + D updated: #732/#733 closed, showcase CM6+Lezer upgrade, gap table current (#714) |
| `docs/research/904-stale-tracker-body-read.md` | New failure mode F-1 documented: incident, root causes, protocol fix proposals (#904) |
| errors table | Row id=2 logged via `npm run error:log` — first use of the new `log-error` skill (#904) |

## Related artifacts

- #888 (closed), #714 (open — awaiting #731), #904 (closed)
- #906 — WRITER: add "verify child states" rule to `do-this-not-that.md`
- #907 — DEV: `close.js` scan for parent tracker on child close
- `docs/research/orchestration-failure-modes.md` — existing D-4 entry for comparison
- [TIL 2026-06-05 APPLE session 1](./today-i-learned-2026-06-05-apple.md)
