# TIL 2026-06-16 — ELDERBERRY

**Context:** A long glossary-modernization session under umbrella #1354 — re-anchoring
`Source:` refs to symbols (#1414/#1416), a scoping spike (#1417), linker vocabulary
modernization (#1418), a rot-prevention checker (#1362), a re-section (#1364), and test
cleanup (#1419). Closed the umbrella at the end.

---

## 1. The grill earns its keep by catching forks *before* they become rework

**What happened:** In nearly every chunk, `grill-with-docs` surfaced a decision I'd otherwise
have steamrolled. The §(d) grill caught that `assembleLea` is the lone non-CAPS encoder
(→ #1412) and that the opcode constants live cross-file in `constants.js`. The linker work
uncovered that the glossary's *defined terms* (`GTable`, `ETable`…) were renamed away by #879
— not line-number drift but **symbol drift**. The #1418 grill caught that putting a
`(formerly X)` alias *in the header* poisons the GitHub anchor.

**What I learned:** None of these were visible from reading the diff — they came from being
forced to justify each choice against the code and the docs. The cost of skipping the grill
isn't a worse plan, it's silent rework two tickets later.

**The rule:** **Grill design-bearing chunks against the code before editing; the forks you
can't see are the expensive ones.**

---

## 2. Separate architect from courier — spike-gate fuzzy work, don't balloon the ticket

**What happened:** Mid-*courier* execution of the linker re-anchor, I hit a *design* question
(the whole table vocabulary was stale, spanning code + two glossaries). yegor-pm said: stop,
don't expand the in-flight ticket. I shipped the unblocked 17 entries (#1416), filed a ≤60min
spike (#1417) to scope the rest, recorded four decisions in writing, then decomposed into
#1418/#1419.

**What I learned:** The instinct to "just fix it all now" would have produced a sprawling,
un-reviewable ticket. The spike→architect→decompose pipeline also avoided *double-touch*:
I deferred the 6 entangled entries instead of re-anchoring them now and rewriting them again
under modernization.

**The rule:** **When a design question appears mid-implementation, drop a spike and
decompose — never widen the ticket you're inside.**

---

## 3. A rot-detector must be green-by-default *and* able to fail

**What happened:** Building the #1362 glossary checker, I made the parser lenient (skip
wildcards/ranges, verify only identifier-like symbols + `grep` literals) so it stays green and
trustworthy. But lenient risks a no-op, so the Jest spec includes a *teeth* test feeding a
fabricated stale symbol and asserting it's flagged. The checker even caught a real bug in
*its own* first-draft parser (a `.js` `grep`-landmark misread as a cited file).

**What I learned:** A check that can't fail is theater. Proving it can fail — with a synthetic
bad input — matters as much as proving it passes on real data.

**The rule:** **Every guard ships with a test that makes it fail on purpose — otherwise you
don't know it works.**

---

## 4. In cross-linked docs, a heading rename is a link-breaking event

**What happened:** Renaming `### GTable` → `### globalSymbolTable` changes its GitHub anchor
(`#gtable` → `#globalsymboltable`), breaking every inbound link at once — intra-doc *and* the
6 cross-glossary links in assembler.md. GitHub also slugs ` / ` to a **double** hyphen
(`#etable--etable--vtable`). I fixed all inbound links in the same commit, and kept the
transitional `(formerly X)` alias on its own line so the *durable* anchor never encodes a
phrase I'll later delete.

**What I learned:** Anchors derive from heading text, so heading edits ripple to every linker.
Atomicity (rename + link-fix in one commit) is the only way to avoid a broken-link window on
`main`.

**The rule:** **Rename a doc heading and fix all inbound links in the same commit; keep
temporary text out of the heading so the anchor stays stable.** (Authority: #1435 folds this
into `docs/glossary/README.md`.)

---

## 5. Two recurring traps, re-confirmed

**What happened:** (a) My first Edit in #1364's worktree hit `EDIT_PRECOND` — I'd read
assembler.md in *main* and in *another* worktree, but the Read precondition is per-absolute-
path (logged err #327). (b) `npm run claim` refused #1419 because I'd filed it with only a
`test` label and no `area:*` lane (logged err #328).

**What I learned:** Both are cheap to avoid and I still hit them — worth keeping in muscle
memory.

**The rule:** **Read the file at *this* worktree's path before editing; give every filed
ticket an `area:*` label so it's claimable.**

---

## What landed

| Artifact | Change |
|---|---|
| `docs/glossary/{assembler,interpreter,linker}.md` | Fully symbol-anchored; linker terms modernized to #879 names |
| `scripts/check-glossary-symbols.js` + `tests/new/glossary-source-refs.spec.js` | Rot-guard (#1362) |
| `docs/research/1417-linker-vocabulary-modernization-spike.md` | Spike decisions |
| `docs/adr/0001-symbol-anchored-glossary-source-refs.md` | Deferred-check note → delivered |

## Open threads

- #1435 — fold the glossary-authoring conventions (Source: shapes, anchor stability, marker
  preservation) into `docs/glossary/README.md`.

## Related artifacts

- Umbrella #1354 (closed); spike #1417; checker #1362; modernization #1418
- Side-findings: #1412, #1413, #1374, #1395
