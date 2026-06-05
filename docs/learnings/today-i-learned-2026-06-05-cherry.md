# TIL 2026-06-05 — CHERRY

**Context:** Single session covering two issues: #850 (label definition edge-case oracle parity suite) and #843 (WRITER: expand artifact quality rubric). #850 involved writing 8 fixture files, a new `isValidLabelDefinition` utility, 32 tests, and a grammar regex fix. #843 was a docs expansion — three new type-specific table sections in the quality rubric.

---

## 1. Col-0 no-colon is a valid label — oracle confirms it

**What happened:** The issue listed "col-0 label with no colon — `cheese mov r0, 5`" as an edge case to verify. Before testing I assumed it would be an error (no colon → not a label). Running the oracle showed exit 0 and a `.e` produced — the oracle treats any non-whitespace-leading token as a label definition even without a colon.

**What I learned:** The assembler's `isValidLabelDef` logic has two independent acceptance paths: `tokens[0].endsWith(':')` OR `!isWhitespace(originalLine[0])`. The colon is optional when the label starts at column 0. LCC.js mirrors this exactly; both tools agree.

**The rule:** Always run the oracle before assuming an edge case is an error — col-0 positioning is a second, independent way to signal a label definition in this ISA.

---

## 2. Grammar char-class gaps don't surface until you add a targeted test

**What happened:** The assembler's `isValidLabel` accepts `$`-prefixed labels (`[A-Za-z_$@]` first char). The tmLanguage grammar had `[@A-Za-z_]` — missing `$`. There was no test for `$cheese:` in the grammar suite, so the gap was invisible.

**What I learned:** The three label-related patterns (assembler `isValidLabel`, formatter regex, grammar `label_def`) each evolved independently and drifted apart. The assembler is the authority; the formatter and grammar were both behind. Adding a grammar test for `$cheese:` immediately exposed the gap.

**The rule:** For any input-validation regex that appears in multiple places (assembler, formatter, grammar), write a test that hits each copy with the same edge-case inputs — inconsistency only shows up when all copies are exercised together. See #870 to codify this as a `RULES.md` entry.

---

## 3. Extracting a pure utility from an instance method clarifies its contract

**What happened:** `isValidLabel` and `isValidLabelDef` already existed as methods on the `Assembler` class. The issue asked for a standalone `isValidLabelDefinition(str)` in `src/utils/`. Writing the failing test first forced me to specify: does the utility take a label name or a full source line? What does it return for col-0 no-colon inputs? For directives at col-0?

**What I learned:** The assembler methods split the concern across two calls (is-this-a-label-def-candidate + is-the-name-valid), each taking tokenized state and the original line as separate args. Combining them into `isValidLabelDefinition(str)` made the contract explicit: "would the assembler add this line's first token to the symbol table without error?" Writing the unit test first prevented accidentally leaking the class's internal `tokens` representation into the utility's interface.

**The rule:** When extracting a utility from an existing class method, write the unit test first — it forces you to define the input/output contract before you look at the implementation.

---

## 4. Oracle error cases still produce a partial `.e` — test the reject path separately

**What happened:** Cases 2 (indented no-colon), 4 (number-starting label), and 8 (period-starting label) all error on the oracle with exit 1 — but the oracle still writes a partial `.e` file (deviation §10 in `docs/parity_deviations.md`). The oracle parity test for valid cases does a golden `.e` comparison; that pattern doesn't apply to error cases.

**What I learned:** For error inputs, the right assertion is just "LCC.js throws" — no golden comparison, no oracle invocation needed. Documenting this split in the test file comments prevents a future agent from trying to add golden comparisons for the error cases and getting confused by the §10 deviation.

**The rule:** Oracle error cases get their own test shape: assert LCC.js throws, leave a comment referencing §10, skip the golden comparison. The deviation is already documented — don't invent new infrastructure to work around it.

---

## What landed

| Artifact | Change |
|---|---|
| `tests/fixtures/assembler-labels/` | 8 new fixture files (all label edge cases) |
| `src/utils/labelUtils.js` | New: `isValidLabelDefinition(str)` pure utility |
| `tests/new/label-utils.unit.spec.js` | 14 unit tests (TDD red → green) |
| `tests/new/assembler.label-edge-cases.oracle.e2e.spec.js` | 18 oracle parity tests + 6 golden files |
| `docs/lcc.tmLanguage.json`, `docs/site/lcc.tmLanguage.json` | Grammar: `$` added to `label_def` char class |
| `tests/new/grammar.unit.spec.js` | 4 edge-case label tests |
| `docs/research/839-artifact-quality-criteria-2026-06-05.md` | 3 new type-specific table sections (#843) |

## Open threads

- #870 — add lesson 2 as a `RULES.md` rule (cross-module validation parity)
- #798 — formatter label regex still missing `@`/`$` prefixes (blocked on human ratification)

## Related artifacts

- Issue #850 (closed)
- Issue #843 (closed)
- `docs/parity_deviations.md` §10 — oracle writes partial `.e` on assembly errors
- `src/utils/labelUtils.js` — the extracted utility
