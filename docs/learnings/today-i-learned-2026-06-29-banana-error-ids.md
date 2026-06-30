# TIL 2026-06-29 — BANANA (error-ID epic)

**Context:** A long session delivering the `--show-err-id` error-ID epic (#1480): the assembler mechanism + registry (#1552, #1553), the interpreter seam + registry (#1562, #1554), and the linker registry (#1555) — plus some PM detours (#1405 split, #1506 stale-close, #1529 audience doc). 57 citable error IDs (`asm-` 30, `int-` 16, `lnk-` 11) now surface as `Error [<id>]: …` under the flag, each module guarded by a coverage test. This is a *second* BANANA session on the same day — see the sibling [TIL 2026-06-29 BANANA](./today-i-learned-2026-06-29-banana.md).

---

## 1. The same feature needs different mechanics in different modules

**What happened:** I built "give every diagnostic a unique ID" three times. The obvious move was to copy the assembler's approach (#1553) into the interpreter (#1554) and linker (#1555). It didn't transfer. The assembler resolves an ID by **looking the message up in a registry table** — it has ~104 error sites but only ~30 distinct, *clean* messages, so one table entry covers ~20 duplicate sites and `failAssembly` (which has no `id` param) gets IDs for free. The interpreter and linker are the opposite shape: ~11–16 **discrete** typed-error throws, with messages that don't normalize (mid-string `"sin: …"`, front-interpolated filenames) — and the linker even has a real collision (`Invalid ${entryType} entry` renders `"Invalid S entry"`, which *also* exists as a literal elsewhere). Message-lookup is ambiguous there. So those two carry the ID **inline** on the throw, with the registry table demoted to "canonical record + validation + coverage."

**What I learned:** "Reuse the pattern" is a trap when the pattern's fitness depends on the code's *structure*, not the feature. Site-count and message-shape decided the mechanism, not the goal. I ran the linker call through `yegor-architect` and the collision evidence made it unambiguous — that's exactly the kind of fork where writing the decision down first (before coding) paid off.

**The rule:** **Before copying a sibling module's approach, check whether the property that made it work (here: many sites + clean wording) actually holds in the new module; if not, pick the mechanism that fits the new structure.**

---

## 2. When a ticket's premise cracks under investigation, stop and surface — don't plow

**What happened:** Three times the ticket-as-written was wrong, and investigation revealed it: #1506 ("revise sound mnemonics") was **stale** — its `deep` mnemonic didn't exist and its `beep` path was already taken (overtaken by the merged #1499), so I closed it not-planned with evidence instead of "fixing" phantom things. #1553's prescribed "thread an `id` through every call site" turned out to mean ~104 edits and was the wrong architecture once I counted the real sites. #1554 looked like a small backfill but actually bundled a *mechanism* (no interpreter display seam existed) — so it became #1562 + #1554. Each time I paused, showed the evidence, and re-scoped; each time that was the right call.

**What I learned:** The cost of surfacing a scope/design crack (a few messages) is tiny next to the cost of shipping the wrong thing. The signal to stop is concrete: the ticket's stated premise contradicts what the code actually shows.

**The rule:** **If investigation contradicts the ticket's premise (stale facts, wrong site-count, a missing prerequisite), stop and surface it with evidence before writing code — re-scope or split, don't power through.**

---

## 3. Split the mechanism from the backfill when the display seam doesn't exist yet

**What happened:** The assembler already had a `formatAssemblerError` seam + `showErrIdOn` flag from #1552, so #1553 was *just* the registry. The interpreter had no such seam — errors printed through the shared `cliExit` with a parity-locked `Runtime Error:` wrapper across multiple paths. Trying to do "the interpreter backfill" meant first building the seam. I split it: #1562 (build `cliExit`'s `showErrId` + `Error [int-NNN]:` format) then #1554 (the registry on top) — mirroring the assembler's own #1552/#1553 split.

**What I learned:** Asymmetry between modules ("the assembler already had X") is a decomposition signal. A "backfill" that secretly contains a "build the mechanism" is two tickets.

**The rule:** **When a backfill needs infrastructure a sibling already had, split the infrastructure into its own prerequisite ticket rather than smuggling it into the backfill.**

---

## 4. Parity-locked strings are design-around constraints, and source scanners must be comment-aware

**What happened:** `Runtime Error: <msg>` was asserted byte-for-byte in three test files + a documented contract. So the inline-ID format had to *fold* that prefix under the flag (`Error [int-001]: …`) while keeping default output identical and the *thrown* text unchanged (so the existing `.toThrow('Runtime Error: …')` assertions still passed). Separately, the assembler's coverage-scan flagged a false positive — a **commented-out** `// this.error(…)` line — until I made the scanner drop full-line comments.

**What I learned:** Two concrete gotchas: (a) a string asserted in tests/oracle is a hard boundary — add behind a flag, fold, never change the default; (b) a regex source-scanner will happily match dead code in comments.

**The rule:** **Treat test-asserted output strings as immutable defaults (gate new behavior behind an off-by-default flag); and make any source-scanning guard comment-aware before trusting its hit list.**

---

## 5. A bidirectional coverage-guard test is what makes "low rot" real

**What happened:** Each module got a `scripts/check-error-ids.js` test that cross-checks source against the registry: every emitted error literal/id resolves to a registered entry, and every registry entry is actually used — both directions, with a planted-failure "teeth" test. This is the mechanism that turns silent drift (a reworded message, a typo'd id, a dead table row) into a red CI run.

**What I learned:** A registry without a guard rots silently. The guard is not optional polish — it's the thing that delivers the "low rot" the registry promised. The `murphy-jutsu` pre-mortem named message-drift as the top risk, and the guard is its direct mitigation.

**The rule:** **Any source-of-truth table that source code must stay in sync with needs a bidirectional coverage test (source⊆table and table⊆source) with a teeth check — ship it in the same change as the table.**

---

## What landed

| Artifact | Change |
|---|---|
| `src/utils/errorIds.js` | `ASM_`/`INT_`/`LNK_ERROR_IDS` registries (57 ids) + `validateErrorIds` (#1553/#1554/#1555) |
| `src/utils/cliExit.js` | `showErrIdOn` + `setShowErrId` + `Error [int-NNN]:` fold in `cliErrorExit`/`cliWrappedErrorExit` (#1562) |
| `src/core/{assembler,interpreter,linker}.js` | id resolution/inline-id wiring per module's structure |
| `scripts/check-error-ids.js` | three coverage scanners (asm message-scan; int/lnk inline-id bidirectional) |
| `docs/agent-patterns.md` | promoted rules 1–3 (authority path) |

## Open threads

- **#1556** remains: the docs catalog of all 57 ids + the stability-policy / prefix-registry doc.
- Rules 4–5 are concrete enough to consider for `RULES.md` if they recur; left in `agent-patterns.md` for now.

## Related artifacts

- Tracker [#1480](https://github.com/avidrucker/lccjs/issues/1480); children #1552/#1553/#1562/#1554/#1555
- Sibling [TIL 2026-06-29 BANANA](./today-i-learned-2026-06-29-banana.md)
