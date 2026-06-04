# Today I Learned — 2026-06-03 (BANANA, s2)

Date: 2026-06-03
Context: Session covering #617 (linker unit test — verboseModeOn survives resetState) and
#618 (showcase page guard — lang: 'source.lcc' regression).

---

## 1. Shiki v1 `lang:` must match `grammar.name`, not `grammar.scopeName`

Shiki v1 registers custom grammars under `grammar.name` (e.g. `"lcc"`). The
`grammar.scopeName` field (e.g. `"source.lcc"`) is a TextMate internal identifier —
Shiki does not expose it as a lookup key.

**The trap:** a warm browser session loads the grammar once and, as a side effect of
the TextMate registry, ends up with both `"lcc"` and `"source.lcc"` as working aliases.
So `lang: 'source.lcc'` appears to function when testing against a warm cache.
Only a cold headless load (fresh profile, no prior page visit) surfaces the real error:

```
Language `source.lcc` not found, you may need to load it first
```

**The fix:** always use `grammar.name` as the `lang:` value. A pure-string Jest test
that reads the HTML and rejects `/lang:\s*['"]source\.lcc['"]/` catches any regression
without needing a browser (see `tests/new/showcase.spec.js`, added in #618).

**Transferable rule:** when a library caches or aliases identifiers, wrong-but-similar
values may appear to work in development. Guard the canonical spelling with an
offline check — a grep or string-match test is enough and runs on every `npm test`.

---

## 2. close script HEAD guard: the split-commit trap

`npm run close N` validates that HEAD's commit subject or footer contains "Closes #N".
This is by design — the close script is a landing tool, not an authoring tool; it
expects the closing commit to already be in place.

**The trap:** if the test commit (`Closes #N` in its footer) is followed by a second
velocity-CSV commit, HEAD no longer references the close, and `npm run close` rejects:

```
[close] ✗ HEAD commit does not reference "Closes #N".
```

**What went wrong in #617:** the test commit had `Closes #617` in its footer, but a
separate `data(velocity): ...` commit was made on top. HEAD was the velocity commit,
which had no close reference.

**The clean fix:** put "Closes #N" in the velocity/CSV commit (the last one before
running `npm run close`). The test commit carries the implementation; the velocity
commit is the natural place for the footer since it's the final record.

**The workaround used in #617:** `git commit --allow-empty` with "Closes #N". Works
but adds a content-free commit to history. #618 applied the clean fix correctly —
"Closes #618" appeared in the velocity commit, so `npm run close` accepted it on
the first try.

---

## What landed

| Commit | Change |
|---|---|
| `95b34b0` | #617 — `linker.unit.spec.js`: pin verboseModeOn survives resetState() |
| `68caaf5` | #617 — velocity row |
| `84b9782` | #618 — `tests/new/showcase.spec.js`: guard lang: source.lcc regression |
| `ed5d416` | #618 — velocity row |
