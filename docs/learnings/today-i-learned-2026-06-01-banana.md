# Today I Learned — 2026-06-01 (BANANA)

Three tickets: schema extension (#438), a shell stdin bug (#451), and a research spike (#454).
Short session, mechanical work — the most interesting things were in the gaps between the tasks.

---

## 1. `setsid "$@" &` silently drops stdin in non-interactive bash

`lccrun.sh` uses `setsid` + `&` to put the child in a new session (so `kill -- -PGID` can
reach all descendants) and background it (so the parent can run the watchdog). The problem:
POSIX specifies that bash redirects background-job stdin to `/dev/null` when job control is
disabled — which is always the case in non-interactive scripts. The `&` is the culprit; `setsid`
alone doesn't cause the drop.

Fix: gate on `[ -t 0 ]`. When stdin is an interactive terminal, drop it to `/dev/null` as
before (a setsid'd child can't use a TTY anyway — it'd get SIGTTIN). When stdin is a pipe,
file, or `/dev/null`, pass it through with `<&0`.

```bash
if [ -t 0 ]; then
  setsid "$@" </dev/null &
else
  setsid "$@" <&0 &
fi
```

**Lesson:** `&` in a non-interactive script is a stdin-drop, not just "run in background."
Always gate stdin explicitly when the child needs it.

---

## 2. The example in the schema doc is the real root cause — not the skill

The velocity CSV test enforces `model` values like `sonnet-4.6` (pattern `/^[a-z]+-\d+\.\d+$/`).
Agents kept logging `claude-sonnet-4-6` instead and needing a corrective DB UPDATE.

I assumed the puzzle-velocity SKILL.md example was the culprit (an old memory note said so).
It wasn't — the skill had already been fixed and shows `sonnet-4.6` correctly. The actual
source of confusion was `docs/velocity-schema.md` line 28, whose example still read
`claude-sonnet-4-6`. Agents read the schema doc while building the JSON, copied the example,
and got a failing test.

**Lesson:** when a mistake repeats, trace it to the template agents actually copy from,
not the one that looks most authoritative. A stale example in a reference doc is more
dangerous than no example at all.

---

## 3. Research findings need a follow-up ticket, not just a comment

After posting the #454 findings as a comment on the issue, the user pointed out: no one
will look at a closed research issue unless something links back to it with an actionable.
The comment is the right place for findings, but it needs a companion DEV ticket that
references it — otherwise the finding is invisible.

Filed #459 as the one-line schema doc fix, referencing #454 as context. That's the entry
point that keeps the research findable.

**Lesson:** a research comment without a follow-up ticket is a finding that will be
re-discovered (or re-violated) later. File the DEV ticket before closing the research issue.

---

## 4. velocity-seed.js had a silent off-by-one for months

While adding the `repo` column in #438, I noticed `velocity-seed.js` mapped `r[0]` to
`ticket`, `r[1]` to `title`, etc. — but the CSV has `id` as the first column (`r[0]`). The
seed was silently reading `id` as `ticket`, `ticket` as `title`, and so on for every field.

The seed is only used for disaster recovery (re-seed from CSV), so the bug never surfaced.
Fixed the column mapping as part of the same commit.

**Lesson:** positional CSV parsing is fragile. When the export gains a new leading column,
every downstream positional mapping silently shifts. Header-based mapping would have been
immune.

---

## What went well

- **Research pre-done = fast DEV.** CHERRY and APPLE did the #451 root-cause analysis in
  #444. The code change took under 10 minutes, most of it testing.
- **CSV test as pre-push gate.** The `puzzle-velocity-csv.unit.spec.js` test caught my
  `claude-sonnet-4-6` mistake before the push. That's the right latency for a formatting
  constraint.

## What to watch

- **Velocity row model field:** always `sonnet-4.6` (dots, no `claude-` prefix). The CSV
  test catches it before push, but a moment of care at log time saves a corrective UPDATE.
- **Closing commit must be HEAD** when running `npm run close`. If you commit the velocity
  row separately after the main commit, amend it to add `Closes #N` before closing.
