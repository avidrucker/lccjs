# Skill Audit — Research for #886

**Agent:** DRAGONFRUIT · **Date:** 2026-06-05 · **Role:** RESEARCH

Sources mined: `docs/skills.md`, `docs/learnings/` (all TIL files + syntheses),
`docs/do-this-not-that.md`, `docs/claude_workflow.md`, key pivot issues
(#511, #537, #635, #726, #798, #848), velocity DB role distribution,
global `~/.claude/skills/` registry.

---

## 1. Skill-by-skill retrospective

### `puzzle-velocity`

**What went well:** Core to the project from day 1 (first TIL, 2026-05-28). The
dual H/C estimate model is well-understood. Guards added over time (model-field
validation, Guard 1 false-positive fix, velocity CSV conflict auto-resolve) harden
it progressively. 769 rows in the DB across all roles.

**What went poorly:** Three recurrent failure modes:
- Start timestamp (`started_iso`) routinely skipped or captured retroactively.
  Synthesis T2-B (2026-06-01) identified 2 agents; `do-this-not-that.md` now has
  the rule.
- Model field format errors: agents log `claude-sonnet-4-6` instead of
  `sonnet-4.6`; traced in BANANA (06-01) to a stale example row in
  `docs/velocity-schema.md` line 28 (#459). The example row was wrong, not the
  skill itself.
- `c_min` set retroactively rather than prospectively. The skill text is clear but
  the behavior drifts without enforcement.

**Known gaps:** No `--dry-run` flag prevents smoke-test rows from polluting the
global DB (C-1 from synthesis 2026-06-01, proposed P-4). No guard warns when
`started_iso` is implausibly old relative to `finished_iso`.

---

### `puzzle-triage`

**What went well:** Created 2026-05-28 (BANANA session). Immediately useful for a
growing backlog. The severity/Yegor-priority split and Blocked/Iceboxed sections
are well-designed distinctions — BANANA's TIL documents the "blocked vs. icebox"
clarity as a real finding.

**What went poorly:** The skill would occasionally fire on agent-readiness greetings
("you are agent X, are you ready?") until a guard note was added to `docs/skills.md`.
This is now documented.

**Known gaps:** None currently tracked.

---

### `fruit-agent-orchestrate`

**What went well:** Created 2026-05-31 (BANANA-3). BANANA's lesson #7 ("stubs make
a skill shippable before it is complete") validated the approach — shipping with
3 documented STUBs let the skill be immediately useful. Heavily used: multiple
TILs reference "two rounds of fruit-agent-orchestrate" within a session.

**What went poorly:**
- At creation, the `decision` label was not skipped — agents could be auto-assigned
  to human-decision tickets. Fixed via M2 ruling in #851 (CLOSED 2026-06-05).
- No sequencing-constraint check: `B after A` ticket pairs (e.g. fix+test) were
  handled ad-hoc by the orchestrator. Proposed protocol documented in #824 TIL
  (DRAGONFRUIT 2026-06-05); implementation is a pending WRITER child.

**Known gaps:** Sequencing-constraint check in Step 2 (proposed in #824 TIL).
Dynamic roster still a STUB. Agent-state detection from worktrees still a STUB.

---

### `guide-human-decision`

**What went well:** First formal use in FIG #851 session (2026-06-05). FIG's TIL
documents the pattern cleanly: context brief → scannable options table →
recommendation → wait for ruling → execute. The session resolved 7 architectural
decisions in one pass. The skill correctly distinguishes "directed claim by human"
from "orchestrator auto-assignment" — a load-bearing asymmetry.

**What went poorly:** The skill existed in `~/.claude/skills/` but was absent from
`docs/skills.md` until today (2026-06-05). DRAGONFRUIT's session-2 TIL confirms
it was used before being listed. The gap: skills can be in the global registry for
months before a session documents them to the project inventory.

**Known gaps:** WRITER child #887 will update the skill text based on #851 evidence.
The "execution after ruling" step needs clearer guidance — FIG had to be redirected
when it hedged a side-dependency instead of landing it immediately.

---

### `next-best-action`

**What went well:** Designed via RESEARCH #631 (CLOSED). The skill exists in
`~/.claude/skills/next-best-action/`. The 3–5 bullet pre-close checklist design is
the right shape.

**What went poorly:** Invocation discipline is weak. CHERRY-3's TIL (2026-06-03)
states explicitly: "The pre-close finding audit (M3 / #627) is designed to catch
exactly this. The 'next-best-action' checklist (M7 / #631) is the skill-level
enforcement. Until those are wired up, the discipline is manual." The skill exists
but agents don't consistently invoke it before every `npm run close N`.

**Known gaps:** The skill is not wired as a mandatory pre-close step. The
`docs/skills.md` entry should make the invocation point explicit: "before every
`npm run close N` on any substantive puzzle."

---

### `write-til-doc`

**What went well:** Core to the learning-capture workflow. TIL quality is high across
all agents. Synthesis docs (2026-06-01, 2026-06-04) confirm agents are writing
"specific, verifiable lessons" with "Why it matters" framing.

**What went poorly:** Early sessions had agents writing TILs without worktrees —
treated as "small docs changes." Memory `feedback_til_worktree.md` captures the
correction: "writing a TIL is work: claim a worktree, commit from it, log velocity,
close via npm run close. No exceptions for 'small' docs changes."

**Known gaps:** `docs/learnings/README.md` is 48 entries out of date (N-4 from
synthesis 2026-06-04). The index gap means the next synthesizer has no summaries
for ~48 entries.

---

### `lccjs-assembly` / `lccplus-assembly`

**What went well:** Domain skills used consistently when writing assembly programs.
No failure modes documented in any TIL. The calling-convention contract and
register-role discipline they encode prevent repeated rediscovery of ISA gotchas.

**What went poorly:** Nothing documented.

**Known gaps:** `lccplus-assembly` should note the `AssemblerPlus.handleInstruction`
no-longer-exists caveat (documented in CLAUDE.md #417 note).

---

### `yegor-pdd`

**What went well:** The `@todo #N:Est/ROLE description` format is universally
understood. The puzzle-status reconciler (AVAILABLE/CLAIMED/IN-PROGRESS/LOCKED/STALE)
works correctly and agents trust it. The `pdd` scan → marker flip → worktree
protocol is mature.

**What went poorly:** The `at_todo` substring trap is the most-cited failure mode in
the entire TIL corpus (T1-B, 7 sightings, 5 distinct surfaces): code comments,
CSV data fields, shell echo strings, TODOS.md filename in comments, velocity notes.
CLAUDE.md documents surfaces 1–2; surfaces 3–5 remain underdocumented.

**Known gaps:** Extend `at_todo` doc to shell-echo + CSV-field surfaces (proposed P-1
in synthesis 2026-06-01).

---

### `yegor-bdd`

**What went well:** The complaint shape ("have X / should have Y / repro") works well
for issue filing. BDD frame for "RESEARCH→confirmed-bug→fix-ticket" chain was
identified as T1-A in synthesis 2026-06-04 (4 agents, each closing research without
a fix ticket until Rule 10 / #490 landed).

**What went poorly:** "Only the reporter closes a ticket" is occasionally
misunderstood — agents close tickets they didn't file when they've done the
implementation work. Rule not always enforced.

**Known gaps:** The RESEARCH-confirms-bug→fix-ticket chain is addressed by Rule 10
but the specific BDD frame for research outputs is not codified in the skill text.
Proposed N-1 in synthesis 2026-06-04.

---

### `yegor-microtasks`

**What went well:** The 60m cap functions as a decomposition forcing function. When
agents are near the cap they correctly stop and drop `@todo` puzzles for the
remainder rather than overrunning. The skill text and docs are consistent.

**What went poorly:** Nothing specific documented. The H/C distinction creates
occasional confusion (H governs decomposition, C governs forecasting; not the same
number) — addressed in the puzzle-velocity skill text but not in yegor-microtasks.

---

### `yegor-tickets`

**What went well:** The "file tickets unilaterally" rule (#511) is well-followed
after being codified. Agents consistently cite "Filed #N for X — continuing." The
tracker-as-shared-memory principle is well-understood.

**What went poorly:** Before #511's WRITER pass, agents would ask "should I create a
ticket for X?" or "want me to file an issue?" — violating yegor-tickets and
yegor-bdd simultaneously. The fix required explicit prose in `claude_workflow.md`.

---

### `yegor-architect`

**What went well:** The separate-design-from-execution discipline is well-understood.
ARC tickets (21 in velocity DB) have clean deliverables (recommendation docs, options
tables). ELDERBERRY's TIL (2026-06-01) documents the correct ARC close sequence:
write recommendation → file decision follow-on → cross-reference → close parent.

**What went poorly:** The "ARC follow-on discipline" was initially missed (ELDERBERRY
lesson #1, 2026-06-01): closing an ARC without filing a decision-labeled follow-on
loses the user decision in the closed-issue archive. Caught by user; now documented.

---

### `yegor-velocity` / `yegor-nohelp` / `yegor-review` / `yegor-unit-tests` / `yegor-spikes`

**What went well:** These are consistently applied. `yegor-spikes` is the most active
(SPIKE: 15 rows in velocity DB). `yegor-review` and `yegor-unit-tests` anti-pattern
vocabulary are referenced in code review sessions. `yegor-nohelp` ("questions become
tickets") aligns with the unilateral-filing rule.

**Known gaps:** `yegor-unit-tests` doesn't currently capture the "inline assembly
source strings need indentation" footgun (APPLE 2026-06-05, lesson #2) which is
test-writing-specific.

---

### `handoff`

**What went well:** Exists in the global registry. Designed for mid-session agent
rotation.

**What went poorly:** No TIL explicitly documents invoking the `handoff` skill. The
skill exists but its lccjs-specific invocation protocol (when vs. just writing a TIL)
is unclear.

**Known gaps:** `docs/skills.md` entry doesn't specify when `handoff` is preferred
over `write-til-doc` for context preservation. They serve different purposes (mid-task
vs end-of-session) but the boundary is not documented.

---

### `setup-cowork`

**What went well:** Exists in the global registry.

**What went poorly:** No usage documented in any TIL. The skill's purpose in the
lccjs context (vs general setup) is unclear from the skills.md entry alone.

**Known gaps:** May be vestigial for lccjs at this stage of the project. Consider
annotating or retiring.

---

## 2. Skills added late / discovered organically

| Skill | When added to `docs/skills.md` | What triggered adoption | Adoption smooth? |
|---|---|---|---|
| `puzzle-triage` | 2026-05-28 | Created in-session (BANANA) to rank growing backlog | Yes — created same session as first use |
| `fruit-agent-orchestrate` | 2026-05-31 | Multi-agent coordination need; BANANA authored the skill | Yes — shipped with documented STUBs |
| `next-best-action` | Pre-existing (in skills.md from design) | Designed via #631 research | Gap: design done, invocation weak |
| `guide-human-decision` | **2026-06-05** (today, via #866) | FIG's #851 session demonstrated the pattern clearly | Gap: used for weeks before being listed |

The `guide-human-decision` adoption gap is the clearest case: the skill existed in `~/.claude/skills/`
and was in use before it appeared in `docs/skills.md`. DRAGONFRUIT's session-2 TIL explicitly
notes it was "used in a session before inventory listing." This is the project's primary
skills-discovery failure mode: **a skill can be useful and used while invisible to agents who haven't
personally encountered it**.

---

## 3. Untried global skills

Skills in `~/.claude/skills/` never used in lccjs:

**Potentially high value:**

| Skill | Relevance to lccjs | Why untried (hypothesis) |
|---|---|---|
| `io-layer-testing` | Very high — interpreter trap handlers (din, ain, dout, aout, sout, hout) are IO-heavy; the skill is named for exactly this | Never surfaced in workflow |
| `improve-codebase-architecture` | High — linker refactor, pure-seam boundary, plus/core split all benefit from structured architecture review | Organic ARC work via yegor-architect instead |
| `diagnose` | Medium — for tricky ISA/interpreter bugs where the failure mode is non-obvious | ad-hoc debugging instead |
| `statechart` | Medium — #134 statechart spike exists for the ilcc debugger; the skill could guide implementation | Research was done without invoking the skill |
| `tdd` | Medium — complements `yegor-unit-tests`; test-first for new features | yegor-unit-tests used instead |
| `avi-code-quality` | Medium — could be used for code-quality passes | `/code-review` and `/simplify` used instead |
| `decomplect` | Medium — relevant for the linker refactor and reducing entanglement | Architecture work done organically |
| `seed-data` | Low-medium — velocity DB seeding and test fixture data | `velocity-seed.js` script handles this |

**Not applicable to lccjs (wrong tech stack or context):**

`clj-stubs`, `clojure`, `clojure-repl`, `datomic`, `eql-processing`, `pathom`,
`fulcro*` (7 skills) — Clojure/ClojureScript ecosystem, irrelevant.

`macos-sandboxing` — platform-specific (lccjs runs on Linux).

`create-trello-card` — external tool integration, not used in this project.

`docx`, `pptx`, `xlsx`, `pdf` — document format conversion, not relevant.

`talk-*` (5 skills) — audio/transcript processing.

**Harness-level skills not in global registry but potentially useful and untried:**

| Skill | Relevance |
|---|---|
| `/code-review ultra` | Multi-agent cloud review — known but expensive; should be used for significant PRs |
| `/verify` | Running and observing the app — relevant for interpreter/assembler changes that affect behavior |
| `/simplify` | Post-implementation cleanup — could reduce accumulated complexity in core modules |

---

## 4. Process improvement candidates

Each is sized ≤60m and suitable for a WRITER or SPIKE ticket.

| # | Proposal | Role | Est | Priority |
|---|---|---|---|---|
| A | Update `docs/skills.md`: add explicit invocation note to `next-best-action` — "invoke before every `npm run close N` on any substantive puzzle" | WRITER | 10m | High |
| B | Update `docs/skills.md`: add `io-layer-testing` as a recommended skill for testing interpreter trap handlers | WRITER | 15m | High |
| C | Update `docs/skills.md`: add `improve-codebase-architecture` with a note on when to prefer it over `yegor-architect` | WRITER | 15m | Medium |
| D | Update `docs/skills.md`: `handoff` vs `write-til-doc` — document when each is appropriate (mid-task vs end-of-session) | WRITER | 10m | Medium |
| E | Update `fruit-agent-orchestrate/SKILL.md` Step 2: add sequencing-constraint check (proposed in #824 TIL) | WRITER | 20m | Medium |
| F | Annotate or retire `setup-cowork` in `docs/skills.md` — clarify lccjs-specific applicability | WRITER | 10m | Low |
| G | SPIKE: try `statechart` skill for #134 ilcc debugger statechart work — does it add value over the existing research doc? | SPIKE | 30m | Low |
| H | Add rule to `claude_workflow.md`: when a new skill is first used in lccjs, add it to `docs/skills.md` in the same session | WRITER | 10m | Medium |

**Proposal H** is the structural fix for the guide-human-decision adoption gap. Without it, the inventory will keep lagging behind actual usage.
