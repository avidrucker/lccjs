# TIL 2026-06-05 — FIG

**Context:** Investigated path-level write-safety for parallel agent assignment,
triggered by the 2026-06-05 `/fruit-agent-orchestrate` session in which DRAGONFRUIT
and GRAPE were both assigned to `.claude/skills/` targets simultaneously. This TIL
records the concrete file-cluster rules derived from that analysis (#826), extending
the cluster-separation principle from [TIL 2026-06-04 GRAPE s3](./today-i-learned-2026-06-04-grape-3.md).

---

## 1. `.claude/skills/` is the strongest isolation guarantee in the repo

**What happened:** The orchestrator assigned DRAGONFRUIT to the
`fruit-agent-orchestrate` skill (#818) and GRAPE to the `lccjs-assembly` skill
(#814) in the same round. No conflict risk appeared. After the fact I confirmed
why: each skill is self-contained inside its own subdirectory with no shared
index, no shared state file, and no cross-skill imports.

**What I learned:** The structure is one subdirectory per skill, each containing
its own `SKILL.md`, optional `CHANGELOG.md`, and a `references/` subfolder.
Nothing at the `.claude/skills/` root is written during normal skill edits.
Two agents can simultaneously edit `lccjs-assembly/SKILL.md` and
`fruit-agent-orchestrate/SKILL.md` in parallel worktrees and the rebase will
be conflict-free — they literally touch no common file.

**The rule:** Assigning two agents to `/.claude/skills/<skillA>/` and
`/.claude/skills/<skillB>/` is always safe for concurrent work. No shared
files exist between skill directories.

---

## 2. `src/` is safe at the file level — with `src/utils/` as the shared exception

**What happened:** Mapping which source files most frequently appear in ticket
scopes showed a clear pattern: `src/core/assembler.js`,
`src/core/interpreter.js`, and `src/core/linker.js` are each touched by
largely disjoint ticket families. But `src/utils/` (errors.js, formatters.js,
hex-display helpers) is a shared import across core, plus, and cli.

**What I learned:** `src/` isolation is file-level, not directory-level. Two
tickets touching different module files (`assembler.js` vs `interpreter.js`)
never conflict. Two tickets both modifying `src/utils/errors.js` will conflict
on rebase even though they live in different worktrees.

The subdirectory breakdown:

| Path | Isolation | Notes |
|------|-----------|-------|
| `src/core/*.js` | Per-file | assembler/interpreter/linker are independent |
| `src/plus/*.js` | Per-file | plus subclasses are independent of each other |
| `src/cli/lcc.js` | Single file | Low-churn; rare conflict in practice |
| `src/interactive/` | Per-file | ilcc.js and iinterpreter.js are independent |
| `src/utils/` | **Single owner** | Shared imports — treat as one cluster |

**The rule:** Treat `src/utils/` as a single-owner cluster. Never assign two
concurrent tickets that both write to files under `src/utils/`. All other
`src/` files are safe for concurrent assignment when the tickets target
different files.

---

## 3. `tests/new/` spec files are per-module — fixtures are the shared surface

**What happened:** The tests directory maps spec files roughly one-to-one to
source modules (`assembler.unit.spec.js`, `interpreter.unit.spec.js`, etc.).
But shared infrastructure — test helpers, fixture files — is a conflict surface.

**What I learned:** Adding a new spec file or editing a module's dedicated spec
is always safe in parallel with other spec-file edits. The shared risk is
`tests/fixtures/` (assembly source files and golden caches): if two tickets
both update a golden file, the rebase conflict is in binary or near-binary
content and difficult to resolve manually.

**The rule:** `tests/new/*.spec.js` files are safe for parallel assignment when
they target different modules. Shared fixture directories and golden cache files
are single-owner — if a ticket regenerates or patches fixtures, no other ticket
should touch the same fixture concurrently.

---

## 4. `scripts/` is isolated per file — `claim.js` is the highest-churn target

**What happened:** Issues #821 (fix claim.js FRUITS list) and #796 (add test
coverage for claim.js) were both actionable in the same round. Assigning them
to concurrent agents would mean one agent modifying `scripts/claim.js` while
the other writes tests that assume the current behaviour — tests stale on merge.
I held #796 until #821 closed.

**What I learned:** Each file in `scripts/` is independent of the others —
`claim.js` and `puzzle-status.js` share nothing. The problem is within a single
file: two tickets that both write to `claim.js` must be serialised even in
separate worktrees, because their rebased merge produces a line-level conflict.

`claim.js` is the hottest target in `scripts/` — six issues in recent history
have touched it, and process-improvement rounds routinely produce `claim.js`
ticket pairs (the fix and its companion test).

**The rule:** `scripts/` files are isolated from each other. Within a single
script file, serialise. When a fix ticket and its companion test ticket both
target the same script, close the fix first and assign the test second.

---

## 5. Two `docs/` files are written by every closing agent regardless of ticket topic

**What happened:** Reviewing what every close commit touches, two files appeared
in every agent's closing commit: `docs/puzzle-velocity.csv` and
`docs/learnings/README.md`. These are not owned by any docs ticket — they are
infrastructure written on every close.

**What I learned:** `docs/puzzle-velocity.csv` gets a new row on every
`npm run velocity:log` call. `docs/learnings/README.md` gets a new row on
every TIL commit. Both will conflict whenever two agents push within the same
rebase window. This is expected and handled by `git pull --rebase`, which
resolves the append-only conflict cleanly. Skipping the rebase overwrites
another agent's row.

All other `docs/` files are isolated per file (individual learnings, research
docs, skill docs) — no conflict risk unless two tickets explicitly target the
same file.

**The rule:** Always `git pull --rebase` before `git push` when closing a
ticket. `docs/puzzle-velocity.csv` and `docs/learnings/README.md` will have
upstream additions from other agents; the rebase step is mandatory, not optional.

---

## The self-check: three questions before claiming

Before claiming any ticket, ask:

1. **What files will I write to?** (New files are almost always safe. Existing
   shared files need questions 2 and 3.)
2. **Is any live worktree (`git worktree list`) writing to the same file?**
3. **Is this a hot file** — velocity CSV, README index, `src/utils/`, or a
   shared script — that any active agent writes to regardless of their ticket?

If question 2 or 3 fires: serialise (hold one ticket until the other closes)
or assign both to the same agent sequentially.

---

## Authority path

The rules above are guidance-level. A follow-on ticket (#835) will evaluate
promoting the most actionable rules (the `src/utils/` single-owner rule and the
scripts-serialisation rule) to `docs/do-this-not-that.md`.

## Related artifacts

- Issue #826 — this TIL's parent ticket
- Issue #835 — follow-on: promote rules to do-this-not-that.md
- [TIL 2026-06-04 GRAPE s3](./today-i-learned-2026-06-04-grape-3.md) — established
  the cluster-per-ticket assignment principle this TIL extends
- [docs/do-this-not-that.md](../do-this-not-that.md) — target for rule promotion
