# Today I Learned — 2026-05-28-001

Date: 2026-05-28
Context: WRITER session — filed and closed #162, the QC pass over the
`docs/glossary/*` per-module glossaries (assembler / interpreter / linker +
README). Landed across four worktree passes: `c3c1717`, `08be918`, `7a231ff`,
`1273a13` (+ velocity row `73f3c53`).

---

## 1. Worktree isolation is not a per-task judgment call

The sharpest lesson of the day. I picked up #162 and reasoned that a single-file
docs edit on `main` was "low-risk enough" to skip the worktree, since the only
other live worktree (#146) was unrelated research. The user pushed back twice —
the second time explicitly: *"worktree always, pls don't even ask that."*

**The rule:** whenever parallel-agent activity exists, work in a worktree and
push trunk-based — full stop. Don't re-derive that decision from the apparent
risk of a given task, and don't frame "worktree vs. not" as a question. By the
end of the session three *other* agents had spun up worktrees (#163, #164, #165),
which is exactly why the discipline is load-bearing: the repo state I'd have been
editing on `main` was moving under me the whole time.

Cost of getting it wrong: I had to migrate the already-applied assembler.md edit
*off* `main` into a worktree and restore `main` to clean — pure rework that the
process would have avoided. (Recorded in the `parallel-worktree-workflow` memory.)

## 2. Spike "inventory" scaffolding is one-shot — delete it when definitions land

Each glossary carried a `## Candidate term inventory` section (the raw output of
the spike phase) sitting *above* the polished `## Definitions`. It was a rawer,
redundant restatement of the same terms — and it was huge:

| File | Inventory scaffolding | Share of file |
|---|---|---|
| `assembler.md` | 374 lines | ~24% |
| `interpreter.md` | 203 lines | ~41% |
| `linker.md` | 90 lines | ~34% |

A reader hit the scaffolding *first*, before any real definition. The spike→write
pipeline is great for *producing* the glossary, but the inventory is intermediate
work product — once the definitions exist it should be deleted, not archived in
place. Leaving both means the file says everything twice and ages badly.

## 3. When de-noising docs, separate useful refs from process noise

The user's complaint was "ticket numbers and links that seem unclear/unhelpful."
Not all references are noise. The distinction that held up:

- **Strip:** GitHub issue refs (`#31`, `see #102`), `populated by spike #109`
  headers, `resolved per #126` inline notes, date stamps (`oracle research,
  2026-05-26`), and refactor-provenance (`typed-error refactor, recent`).
- **Keep:** `**Source:**` line citations, cross-file `[term](other.md#anchor)`
  links, and *stable* bug IDs like `OB-001` (which point into `open_bugs.md` and
  carry meaning a reader can act on). A `#N` GitHub number is noise; an `OB-NNN`
  ID is a useful pointer.

Provenance that's actually a *fact* ("matches the original LCC as of 12/2024")
stays; provenance about *how the doc was built* goes.

## 4. Verify entry counts against real headings, not memory

The README's per-file counts were partly wrong: interpreter "39 entries" was
really 32, linker "26" was really 23. The inflation came from counting the
`### (a)`–`### (g)` *section dividers* as if they were entries. When a count
appears in docs, recompute it (`grep -c '^#### '` for the real entry level) — and
note that assembler uses `####` under lettered `###` sections while
interpreter/linker use flat `###` entries, so the right grep differs per file.

## 5. Deterministic, asserting edit scripts beat huge `old_string` blocks

Deleting a contiguous ~370-line block is painful and error-prone to express as an
Edit `old_string`. A tiny Python pass anchored on content markers
(`## Candidate term inventory … ## Definitions`) with `re.subn(...)` and an
**assert that exactly one replacement happened** was both safer and self-checking
— the assert catches the silent no-op where an anchor has drifted. I verified
each pass by diffing only the definitions body to prove I'd changed *nothing*
except the intended de-noising.

## 6. Velocity on a multi-pass ticket is murky — be candid in the notes

#162 wasn't one focused sitting; it was four passes (assembler, interpreter,
linker, README+close) interleaved with user approvals. `finished − started` as a
single span (~18m) overstates active work; the honest number was the *sum* of the
four active passes (~12m). I logged `actual=12`, `C=20` (aggregated from per-file
estimates), `H=60` (the WRITER cap, not a forecast), and used the notes field to
say plainly that the number includes the process-correction rework from lesson 1.
The CSV is only trustworthy if the notes own the asterisks.

---

## What landed

| Commit | Change |
|---|---|
| `c3c1717` | assembler.md — inventory removed, header slimmed, `(a)`–`(e)` dividers retitled |
| `08be918` | interpreter.md — inventory removed, header slimmed, `(see #102)` dropped |
| `7a231ff` | linker.md — inventory removed, header slimmed, `issue #3` reworded |
| `1273a13` | README — Status column → coverage descriptions; counts fixed; lineage line removed; `Closes #162` |
| `73f3c53` | velocity CSV row for #162 |

202 definitions (147 + 32 + 23) preserved verbatim across all passes.

## Related artifacts

- `docs/glossary/` — the four cleaned files.
- `docs/glossary/README.md` — entry conventions + rewritten Files table.
- `docs/puzzle-velocity.csv` — the #162 row (and its candid notes).
- `parallel-worktree-workflow` memory — updated with lesson 1.
