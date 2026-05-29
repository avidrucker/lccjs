# Today I Learned — 2026-05-28-002

Date: 2026-05-28
Context: A long multi-thread session. PDD infra (`.pddignore` + wrapper, #141;
formalizing demo TODOs, #142); a new `puzzle-triage` skill; a `claude-config`
skills-hygiene pass; backlog triage + severity labeling; the **sext
research → bug-report-for-Prof-Dos-Reis** workflow (split #144 into #150–#153,
wrote the report under #150, opened follow-up #159); and the **debugger DRY**
thread (spike #146 → extractions #163 `format.js` and #164 `stateDelta.js`, with
red-green test follow-ups #168/#169). Sibling doc: `today-i-learned-2026-05-28-001.md`.

---

## 1. pdd's marker scan is a case-sensitive *substring* match — uppercase `TODO` trips even inside a larger token

The proposed "discussion placeholder" `AT_TODO` turned out to *be* the trap. pdd
aborts the entire scan on `AT_TODO` (`TODO must have a leading space…`) because it
finds the substring `TODO` after the `_`. Verified empirically in a temp dir:
**uppercase trips, lowercase `at_todo` is invisible.** So the only safe spelling
is lowercase, and any uppercase variant (`AT_TODO`, `AT-TODO`, …) reintroduces the
bug. Corollary discovered the hard way: the scanner's own config file
(`.pddignore`) gets scanned too, so it must list *itself* as an exclude and avoid
literal markers in its comments. (Recorded in the `pdd-yegor-pm-discipline` memory.)

## 2. Finished research = close the ticket; awaiting a human reply = a *new blocked follow-up*, not a reopen

When the sext report (#150) was written but pending Prof Dos Reis's answer, the
instinct was to reopen #150 and mark it blocked. That conflates two different
states: "deliverable done" (which is closeable + velocity-logged) and "waiting on
external input." The clean model — and the repo's own documented research-ticket
convention — is: **close #150** (the report was the work), and open a separate
**blocked** follow-up (#159) that *pre-scopes the actions for each possible reply*.

General rule that fell out:
- ticket still has actionable work → keep it **open/blocked** (e.g. #40);
- deliverable done, only an external reply remains → **close + open a blocked
  follow-up**.

Reopening a closed-with-deliverable ticket is the anti-pattern: it muddies
"closed = done," desyncs the velocity record, and (in BDD terms) reads as "the
work was rejected."

## 3. Extracting "duplicated" logic: share the substrate, not the presentation — and distrust *superficial* similarity

The debugger DRY work (#146 → #164) looked like "two debuggers diff machine
state; dedupe it." Reading **both** call sites in full changed the plan:

- the **register** diff *is* genuinely shared (element-wise value comparison) →
  extracted as pure `diffRegisters()`, routed through both;
- the **flag/pc** display only *looks* shared. The core debugger renders
  **fire-once** — it shows `<NZCV=…>`/`<pc=…>` when an instruction *set* them
  (`flagsSet`/`hasJumped`), not when the value changed — because that's what the
  real `lcc` does and the output is byte-exact-tested. The TUI renders on
  value-change. Extracting flag/pc "together" would have silently broken oracle
  parity.

So: extract the pure data/diff both *truly* compute; keep parity-sensitive
**presentation** per-consumer (documented the non-share in the module). Read both
sites before extracting — don't trust a spike's high-level "they're the same."
And because the TUI consumer (`displayRegisters`) had **no direct unit test**, I
added a throwaway equivalence check (a node one-liner asserting only-changed
regs/flags highlight, nothing on the initial snapshot) *and* logged the gap as a
real follow-up (#169) rather than letting "the suite is green" stand in for "this
path is tested."

## 4. Closing an issue isn't done until its source marker is gone — stale-marker debt is silent

Twice the pre-push gate caught a `@todo #N` left in `TODOS.md` after its issue had
closed (#116, closed by another agent; #146, closed by me) — `puzzle:status`
flagged them STALE. The close checklist has to include **removing/updating the
marker**, even markdown ones (pdd doesn't scan `*.md`, but the reconciler does).
The gate catching it is the backstop, not the plan — and a marker outliving its
issue looks like live work to every other agent until someone notices.

## 5. A measurement-method bug produces a *confident wrong claim* — verify the method, retract immediately

I stated the interpreter/linker glossaries were "empty stubs (0 definitions)."
Wrong — and not because the data was bad: I'd grepped `^#### `, but those files
use `###` for entries (only `assembler.md` uses `####` under lettered `###`
sections). The *count method* was broken, so a real, populated artifact read as
empty. Caught and retracted it the same turn. (The same `####`-vs-`###`
discrepancy bit `-001` §4 independently on the same day — it's a real footgun in
this repo.) Lesson: when a count or conclusion is surprising, suspect the
measurement before the data; and when you've asserted something false, say so
plainly and right away.

## 6. "Blocked" and "Icebox" are different kinds of *not now* (from building `puzzle-triage`)

Building the `puzzle-triage` skill (severity-ranked "what's next") forced a
distinction worth keeping: a **blocked** item re-enters the actionable queue
*automatically* the moment its blocker clears (no new decision); an **icebox**
item (`proposal`/`wontfix`) only re-enters when someone *schedules* it (a fresh
decision). Both are "not now," but conflating them hides which shelved work is
merely waiting vs. genuinely parked. (The user renamed my original "Parked" →
"Icebox" — the clearer word for "a decision put this aside.")

---

## What landed (this agent)

| Issue / item | Outcome |
|---|---|
| **#141** | `.pddignore` + `scripts/run-pdd.sh` wrapper — scan coverage as editable config; coined the lowercase `at_todo` placeholder rule |
| **#142** | Formalized 12 informal demo `TODO:` notes into `@todo` markers; un-ignored `demos/`+`plusdemos/` |
| **`puzzle-triage`** | New skill (0.1.0 → 0.1.1, in `claude-config`) — severity-ranked queue, ⛔ Blocked / 💤 Icebox sections |
| skills hygiene | Fixed `yegor-pdd` VERSION drift → 0.3.0; pushed the pending `puzzle-triage` commits; audited all skill repos |
| **#147** | Glossary README status table refreshed (stub → complete) — note: overlapped the other agent's #162 |
| **#9** | Closed as superseded by the (complete, closed) glossary effort #107 |
| **#144 → #150–#153** | Split the demo-research tracker into four `research` tickets |
| **#150** | sext **research & bug report** for Prof Dos Reis (`docs/research/sext-semantics-report.md`); **#159** opened to act on his reply |
| **#157 / #158** | Logged the two incidental findings (lccjs `.string \n`; broken `sext_sweep.a` fixture) |
| **#146** | Debugger DRY ARC spike (`docs/research/debugger-ilcc-dry.md`); decomposed into #163/#164 |
| **#163** | Extracted `src/core/debug/format.js` (h4 + register tables); deduped 5 copies |
| **#164** | Extracted `src/core/debug/stateDelta.js` (`diffRegisters`); routed core debugger + TUI |
| **#168 / #169** | Red-green TEST follow-ups for `format.js` / `stateDelta.js` (each its own ticket + `@todo`) |

## Related artifacts

- `docs/research/sext-semantics-report.md` — the report for Prof Dos Reis (awaiting reply, tracked by blocked #159).
- `docs/research/debugger-ilcc-dry.md` — the DRY spike's ROI map.
- `src/core/debug/format.js`, `src/core/debug/stateDelta.js` — the new shared substrate (consumed next by #134's statechart).
- `.pddignore`, `scripts/run-pdd.sh` — the #141 scan-config infra.
- `puzzle-triage` skill (in `avidrucker/claude-config`).
- `docs/puzzle-velocity.csv` — rows for #141, #142, #147, #150, #146, #163, #164.
- `pdd-yegor-pm-discipline` memory — updated with the substring-trap + `.pddignore` mechanism.

## Open threads for tomorrow

- **#134** — the iinterpreter statechart spike now has consolidated code to target.
- **#168 / #169** — quick red-green TEST puzzles to lock the `format`/`stateDelta` contracts.
- **#159** — blocked until Prof Dos Reis replies on sext (report is ready to send).
- **#151 / #152 / #153** — the other three demo-research questions (jmp suffixes, cea, malloc/free leak).
