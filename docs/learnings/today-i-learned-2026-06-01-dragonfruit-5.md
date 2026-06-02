# Today I Learned — 2026-06-01 (DRAGONFRUIT, session 5)

Two tickets: #134 (statechart research for the interactive debugger) and #447
(Shiki syntax highlighting build step + GitHub Actions deployment). Plus bug
filing after the first Pages workflow run failed.

---

## 1. Eight flags can be three states — display config isn't a state at all

`iinterpreter.js` has eight independent mode fields. That looks like a 2^8 state
space. When you map the actual transitions, the execution region has exactly three
states: `PAUSED`, `STEPPING` (transient), and `HALTED`. `efficientMode` is a guard
on one transition, not a state. The five display fields (`memDisplayBase`,
`memDisplayRows`, `stackAnchor`, `paneLayout`, `codeContextRows`) are a mutable
context struct — they update independently of exec state and never trigger a state
change.

**Lesson:** before counting states, ask which fields *cause* a transition vs. which
are just *data* any state can read. The latter belong in context, not in the machine.

---

## 2. Hand-roll beats XState when the machine fits in ~50 lines

XState's visualizer and serialization are genuine selling points. But the repo is
intentionally near-zero-dep, and a 3-state exec machine is small enough that a pure
`transition(state, event, ctx)` function covers it without the framework overhead.
The key benefit of XState — making illegal states unrepresentable — is achievable
with a plain object too.

**Lesson:** reach for a statechart library when the machine is large or needs
tooling. For small machines the structure alone is the win; the library is optional.

---

## 3. Shiki accepts a TextMate grammar JSON object directly — no port needed

Passing the grammar to `createHighlighter({ langs: [grammar] })` just works. The
only wrinkle: Shiki uses the `name` field as the lang ID for `codeToHtml`, so
`"name": "LCC Assembly"` (with spaces) is valid but awkward. Setting `"name": "lcc"`
with `"displayName": "LCC Assembly"` gives a clean `lang: 'lcc'` call site.

**Lesson:** test `createHighlighter({ langs: [yourGrammar] })` before assuming a
conversion step is needed. The answer is often "drop it in and it works."

---

## 4. A GitHub Actions 404 on deploy is a config issue, not a code bug

The first `pages.yml` run failed with HTTP 404 on the deploy step. The workflow
code was correct; GitHub Pages simply wasn't enabled under Settings → Pages. No
commit needed — it's a one-time owner action.

**Lesson:** a 404 from `actions/deploy-pages` almost always means Pages isn't
turned on yet. Check the repo setting before touching the YAML.

---

## 5. One failed run can hide two independent bugs — file them separately

The same run produced two distinct problems: Pages not enabled (404) and Node.js 20
actions deprecated (forced cutover June 16). Different owners, different fixes,
different timelines. Filing them together would have blurred which fix unblocks
the other.

**Lesson:** when a run fails with multiple error types, ask "do these share a root
cause?" before deciding how many tickets to open. If not, separate them.

---

## 6. Racing another agent isn't always a conflict — it can be a diff

CHERRY closed #448 (grammar move) while my #447 worktree was open. On rebase,
`docs/lcc.tmLanguage.json` conflicted. Both edits were intentional; the difference
was meaningful (`"name": "LCC Assembly"` vs `"name": "lcc"`). I kept mine (cleaner
Shiki lang ID) and posted a comment explaining why.

**Lesson:** treat a rebase conflict as a diff review, not an error to undo. One
version may be strictly better; pick deliberately and leave a trace.

---

## 7. `puzzle:status` sees markers, not issue state — check both

`puzzle:status` reported #448 as AVAILABLE (unclaimed `@todo` in the source). But
CHERRY had already closed #448 on GitHub without leaving a marker. The scanner only
reads the local source tree, not GitHub. I duplicated the grammar-move work and hit
a conflict on rebase.

**Lesson:** for prerequisite issues, `gh issue view N` is the authoritative check —
`puzzle:status` is only reliable for marker-tracked open work.

---

## What went well

- **Parallel Explore agents before writing any code.** Reading `iinterpreter.js` and
  the spike doc simultaneously meant both the statechart sketch and build script were
  written with full context on the first attempt.
- **`npm run build:highlight` worked on the first run.** Testing Shiki with a small
  snippet before the full script caught no surprises — because there were none.
- **Separate bug tickets for separate causes.** #456 and #457 are independently
  actionable; no one has to untangle a shared fix path.

## What didn't go well

- **`--custom` flag needed on every DRAGONFRUIT claim.** `dragonfruit` isn't in the
  known fruits list, so each claim bounces once before `--custom` is added.
- **Didn't check `gh issue view 448` before duplicating the work.** `puzzle:status`
  showed #448 as AVAILABLE, but the issue was already closed. One extra `gh issue view`
  call at the start would have saved the rebase conflict.
