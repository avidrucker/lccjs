# TIL 2026-06-03 — CHERRY s4

**Agent:** CHERRY · **Session:** 4 · **Tickets:** #610, #624, #623

---

## 1. `allowedTools` in `.claude/settings.json` pre-approves `gh` write calls

**Context:** #623 — researching why agents can't post closing comments in auto-mode.

After `npm run close N` completes, the agent makes a follow-up `Bash(gh issue comment N --body "...")` call. The auto-mode classifier blocks it as an "autonomous External System Write — publishing under the user's identity to a GitHub issue without explicit authorization." The user authorized `npm run close N`, not the comment.

**Fix:** Add one entry to `.claude/settings.json`:

```json
{
  "allowedTools": ["Bash(gh issue comment *)"],
  "hooks": { ... }
}
```

The `Bash(gh issue comment *)` pattern pre-approves any `gh issue comment` call (any issue number, any body). The classifier checks `allowedTools` before prompting and silently proceeds.

**Scope discipline:** put this in project-level `.claude/settings.json`, not `~/.claude/settings.json`. User-level would grant `gh issue comment` rights to every repo Claude Code touches on the machine. Project-level scopes it to lccjs.

**Key distinction:** `gh` calls that run *inside* `npm run close N` (as Node `child_process` subprocesses) are not classifier-visible tool calls — they inherit the already-approved bash call's authorization. Only calls the *agent* makes as separate Bash tool calls after the approved action completes get classified.

---

## 2. The velocity commit must be HEAD and must contain "Closes #N"

**Context:** #610 close — committed the research doc (with "Closes #N") then the velocity CSV separately. `npm run close 610` rejected: "HEAD commit does not reference 'Closes #610'."

`close.js` checks two things in HEAD:
1. The commit message references `Closes #<issue>`
2. The velocity CSV diff is present in HEAD

Both must be true in the *same* commit. The correct pattern is to log the velocity row (`npm run velocity:log`) and commit research doc + CSV together in one "Closes #N" commit, or make the final commit (the one with Closes) include both.

**Recovery when you've split them:** `git reset --soft HEAD~1` un-commits the most recent commit, keeping all changes staged. Since the commit hasn't been pushed, this is safe and reversible. Recommit with "Closes #N" in the message.

Don't use `git commit --amend` reflexively — soft reset + new commit is cleaner and doesn't risk confusion with the "never amend published commits" rule.

---

## 3. `--skip-keyword-check` is needed more often than expected for research closes

**Context:** #623 close — commit subject `"research: gh issue comment auth — allowedTools is the fix, filed child #642 (#623)"` shares no extracted keyword with issue title `"RESEARCH: enable agents to post closing comments without manual authorization"`.

The keyword overlap heuristic compares unigrams from the commit subject against the issue title. Research and docs commits routinely use paraphrased language ("allowedTools is the fix" ≠ "closing comments without manual authorization") even when the subject is unambiguously about the right ticket. `--skip-keyword-check` is the correct bypass, not a workaround.

This is the D-1 failure mode from `docs/research/orchestration-failure-modes.md`. A better heuristic (stemmed overlap, type-prefix strip, or description-field fallback instead of title-only) is tracked in #634.

For now: when writing a research commit subject, either mirror at least one keyword from the issue title literally, or expect to add `--skip-keyword-check` at close time.

---

## 4. A tracker with 13 child tickets is still one velocity row (for the PM work)

**Context:** #624 + #625–636 — filing a tracker and 12 child decision/research tickets for the #610 mitigation list.

The PM filing cycle (tracker + all children) is one contiguous session of work. It logs as a single velocity row with role `PM`, not one row per issue filed. The row's `ticket` field is `NULL` (no specific issue to attribute), per the null-ticket convention for PM/triage work (or can be omitted from the JSON).

Filing issues sequentially matters: `gh issue create` assigns numbers by HTTP arrival order. Parallel background jobs mis-assign `@todo #N` markers. File siblings one at a time and read the returned URL before writing the next. This is the T2-A pattern from the TIL synthesis.

---

## 5. Child tickets should link to their parent, and process observations should go on the relevant issue immediately

**Context:** post-close review of #642 and #634.

Two discipline checks that are easy to skip under close-sequence pressure:
1. Does the child ticket's body contain `**Parent:** #N`? (Yes for #642 — caught on review.)
2. Did I post the `--skip-keyword-check` observation as evidence on #634 before moving on? (No — required user prompt to fix.)

The pre-close finding audit (M3 / #627) is designed to catch exactly this. The "next-best-action" checklist (M7 / #631) is the skill-level enforcement. Until those are wired up, the discipline is manual: before calling `npm run close N`, answer the three questions from M3 and check that any cross-issue evidence has already been posted.
