# Issue title convention

Every GitHub issue title must begin with an uppercase role word followed by a colon and a space:

```
ROLE: short description of the work
```

The commit-message format (`type(scope): description`) is **never** valid as an issue title.

## Canonical role vocabulary

| Role | When to use |
|------|-------------|
| `DEV` | Implementation work, bug fixes, refactors |
| `TEST` | Adding or fixing tests |
| `WRITER` | Documentation, workflow, RULES.md edits |
| `PM` | Project management, triage, tracker upkeep |
| `SPIKE` | Time-boxed research with a concrete deliverable |
| `ARCHITECT` | Design decisions, ADRs (not `ARCH` or `ARC`) |
| `RESEARCH` | Open-ended investigation, no immediate code change |
| `REVIEW` | Code or PR review tasks |
| `DATA` | Data re-runs, notebook analysis, CSV/stats output |
| `TIL` | Today-I-Learned entry — exempt from `ROLE:` format; use `TIL YYYY-MM-DD AGENT — description` instead (see #640) |

## Non-standard prefix → canonical mapping

When you want to file…                   | Use this prefix instead
-----------------------------------------|------------------------
An audit or code-review task             | `REVIEW:`
An architecture decision or ADR          | `ARCHITECT:`
An open question or time-boxed probe     | `SPIKE:`
A human-review gate or approval request  | `REVIEW:`
A tracker / umbrella issue               | `PM:`
A bug fix, implementation change         | `DEV:`
A today-I-learned entry                  | `TIL YYYY-MM-DD AGENT — …`

Non-standard prefixes seen in the wild and their redirects: `AUDIT:` → `REVIEW`, `DECISION:` → `ARCHITECT`, `Q:` → `SPIKE`, `HUMAN REVIEW:` → `REVIEW`, `Tracker:` / `TRACKER:` → `PM`, `FIX:` → `DEV`.

## Decision rule

When in doubt, pick the role whose velocity `role` column you'd use for the work — the issue prefix and the CSV role column should always agree.

---

## Why ROLE: is not a commit type

`ROLE:` and commit types (`fix:`, `feat:`, `docs:`, `refactor:`) answer **different questions**:

| System | Answers | Example |
|--------|---------|---------|
| `ROLE:` prefix | Who does the work? What kind of effort? | `DEV:`, `WRITER:`, `RESEARCH:` |
| Commit type | What kind of code change resulted? | `fix:`, `feat:`, `docs:` |

A bug fix produces a commit typed `fix:` and closes a ticket titled `DEV: …`. The commit type describes the *output*; the role describes the *work*. They operate on different objects and are never interchangeable.

**Cheat-sheet — commit prefix → correct issue prefix:**

| If you're tempted to write… | Write this instead | Optionally add label |
|---|---|---|
| `fix: …` | `DEV: …` | `bug` |
| `feat: …` | `DEV: …` | `enhancement` |
| `docs: …` | `WRITER: …` | — |
| `refactor: …` | `DEV: …` | `refactor` |
| `test: …` | `TEST: …` | — |
| `UX: …` | `DEV: …` | `ux` |
| `bug: …` | `DEV: …` | `bug` |
| `FIX: …` | `DEV: …` | `bug` |

The commit goes in the commit message. The label goes on the issue. The title gets the role.

---

## Label schema

Labels complement the role prefix — they add dimensions the role vocabulary doesn't cover. Use the role prefix to say *what kind of effort*; use labels to say *what kind of thing* or *which domain*.

### Nature labels (what kind of issue)

| Label | When to use |
|-------|-------------|
| `bug` | Incorrect behavior — something that worked (or should work) doesn't |
| `enhancement` | Improvement to existing behavior |
| `proposal` | Possible future feature, not yet scheduled |
| `ux` | Affects user-facing behavior or aesthetics (CLI output, playground display, error messages) |
| `cleanup` | Code-quality improvement with no behavior change |
| `refactor` | Structural change, no behavior change |
| `experiment` | Exploratory change — outcome uncertain, treat as a trial |

These pair with `DEV:` or `TEST:` role prefixes. A `DEV: …` ticket can carry `bug` + `severity:high` to communicate both what needs doing and how bad it is.

### Severity labels (how bad)

`severity:high`, `severity:medium`, `severity:low` — use on `DEV:` and `TEST:` bug tickets. See existing label descriptions for thresholds.

### Domain labels (which area)

| Label | When to use |
|-------|-------------|
| `parity` | Concerns oracle (OG-LCC) vs LCC.js behavioral parity |
| `cicd` | CI/CD pipeline, GitHub Actions, deployment |
| `data` | Data analysis, CSV enrichment, notebook re-runs |
| `research` | Investigation or scoping ticket — maps to `RESEARCH:` role |
| `scope` | Scoping/umbrella ticket defining sites and ROI before implementation |
| `testing` | Cross-cutting testing infrastructure (not a single test addition) |
| `documentation` | Documentation-only change — maps to `WRITER:` role |

Code-area domains (assembler, interpreter, linker, browser, plus) belong in **commit scopes**, not labels — e.g. `fix(assembler): …` in the commit message, not an `assembler` label on the issue.

### Status / gating labels

`blocked`, `deferred`, `human-decision-required`, `decision`, `humans-only` — added to any issue that can't proceed for external reasons. Remove when the blocker clears.

### What labels are NOT for

Labels do not replace the `ROLE:` prefix, the `severity:` label, or the velocity CSV `role` column. Do not invent a new label to express what a role word already covers. If no existing label fits, the dimension probably belongs in the issue body, not a label.

---

**See also:** [`docs/claude_workflow.md`](./claude_workflow.md) — "While continuing" section, issue-title convention bullet (#641).
