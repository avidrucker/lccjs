# Today I Learned — 2026-06-01 (FIG)

First session as FIG. Five tickets across bug fixing, research, and docs cleanup.
Most of the day was investigation-first work: read the code, run it live, then write
the finding. Several lessons came from the gap between what the code *looks like* and
what it *actually does*.

---

## 1. A warning that fires on a known-good name is itself the bug

`claim.js --as ELDERBERRY` printed "not in the known fruit list" even though `'elderberry'`
is slot 5 in `FRUITS`. The fix was one line: the `--as` path skipped `normalizeIdentity()`
(which lowercases), while the env path called it. The check is case-sensitive; the input
was uppercase; no match.

The irony: the warning said "using it anyway" and then used `ELDERBERRY` as-is — producing
a branch named `ELDERBERRY/issue-...` which wouldn't round-trip through the lowercase
branch inference path. The code was both wrong AND self-consistent in the wrong direction.

**Lesson:** when a warning fires on a value that *should* be valid, check whether the
comparison is case-sensitive before concluding the value is genuinely unknown.

---

## 2. The GitHub push warning is not enforcement — read the API, not the text

`push origin HEAD:main` prints "Changes must be made through a pull request" on every
push. This looks alarming if you're deciding whether to switch to a PR workflow. The
GitHub branch protection API tells a different story: `enforce_admins: false` means
the repo owner is explicitly exempt. The push succeeds anyway; the warning is advisory.

**Lesson:** for any "is this enforced?" question about GitHub branch protection, call
`gh api repos/OWNER/REPO/branches/BRANCH/protection` and read `enforce_admins.enabled`.
The push warning text is not a reliable signal — it fires even when the rule doesn't
apply to you.

---

## 3. "Calls assembleFile()" ≠ "runs two-pass assembly" — trace the branch

`.hex` files route through `handleSingleFile()` → `assembleFile()` → `assembler.assemble()`.
That looks like full assembly from the outside. Inside `assemble()`, the `.hex` branch
returns early at line 327 — `parseHexFile()` runs, then `return`. Pass 1 and Pass 2 never
execute. The method name `assembleFile()` is accurate for `.a` files but misleading when
called for `.hex`/`.bin`.

This is why the `"Assembling foo.hex"` console message is confusing: same verb, completely
different pipeline.

**Lesson:** when tracing "what does X do for input Y," follow the *branch*, not the
method name. An early `return` inside a general-purpose method can mean the method's
normal behavior is skipped entirely.

---

## 4. The data for better feedback already exists — it's just not surfaced

`parseHexFile()` sets `this.locCtr` to the word count as it loops. After the parse, `locCtr`
is exactly the number of words loaded. A "Loaded N words → foo.e" line is a 1-line
addition after the parse call, using data that's already there. No new state needed.

More generally: before designing a new mechanism to answer a user's question, check
whether the answer is already computed and simply not printed.

---

## 5. FIXED vs DOCUMENTED are different resolution kinds — the status line should say which

When reconciling `open_bugs.md`, most entries got `FIXED in <sha>`. But OB-019 (the `ct=0`
shift corner) and OB-026 (multi-file `.a` input) were closed by documentation, not code.
The commits said "no guard needed" and "document as research divergence." Marking these
`DOCUMENTED (wontfix-by-design)` is more accurate than `FIXED` — a reader looking for
the guard code won't find it, and shouldn't be confused into thinking they missed it.

**Lesson:** distinguish resolution kinds in status lines. `FIXED` means the problem
was corrected. `DOCUMENTED` means the problem was understood and accepted. These look
the same in a closed ticket but mean different things to someone reading the bug list
later.

---

## What went well

- **Empirical before analytical.** For #368, running `lcc.js` on a real `.hex` file (after
  looking at the code) produced concrete output that made the recommendation unambiguous.
  Code-reading alone would have missed the exact wording of the current message.
- **Tight follow-on tickets.** Filing #363 and #371 immediately, with the spec already
  worked out, kept scope clean — nothing was left as stranded prose.
- **Batch commit verification (#170).** One `git log --oneline <sha1> <sha2> ...` call
  verified all 17 commits at once. No need to check them one by one.

## What didn't go well

- **velocity-log flag confusion.** Tried `--ticket 355 --role RESEARCH` instead of the
  required JSON positional arg `'{"ticket":355,...}'`. Took two failed attempts to read the
  usage. The script's CLI convention is unusual and easy to mis-remember.
- **Iterating to a valid .hex test program.** Getting a working minimal `.hex` file took
  three tries (wrong trap vector, then finding the right opcode). Should have grepped the
  assembler for `'halt'` first rather than guessing `F025`.
- **`--skip-keyword-check` needed twice on close.** When the HEAD commit is the velocity
  row (not the feature commit), the keyword check fires because "log #355 RESEARCH row"
  doesn't match the ticket title. This is expected behavior but adds friction. The pattern
  to remember: amend the velocity commit to include `Closes #N`, OR use `--skip-keyword-check`.
