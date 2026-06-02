# TIL 2026-06-01 — ELDERBERRY session 3

**Tickets closed:** #127 (SPIKE), #449 (DEV), #390 (CHORE)
**Tickets filed:** #447, #448, #450, #455 (follow-ons from #127)
**Other:** RULES.md updated (rules 4–5 added), stale #449 marker cleaned up

---

## Lessons

### 1. The @inprogress marker must be deleted *and staged* before the closing commit

On #449 I added the marker correctly at claim time, did the work, staged the deliverables — but never deleted the marker. The issue closed, the worktree was removed, and the stale `@inprogress #449` sat in `TODOS.md:123` until `npm run puzzle:status` flagged it `[STALE]`.

The recovery was mechanical (one fresh worktree, one commit), but avoidable. The deletion must be in the same staged set as `Closes #N`. Before committing, confirm the marker is gone.

---

### 2. A dual-path loader lets you ship before a dependency lands

The showcase (#449) depends on the stable grammar path (#448 / CHERRY). Rather than waiting, the script tries the stable path first and silently falls back to the research path:

```js
const GRAMMAR_URLS = [
  '../lcc.tmLanguage.json',               // post-#448 (stable)
  '../research/127-lcc-textmate-grammar.json', // pre-#448 (interim)
];
```

Once CHERRY lands #448, the page upgrades automatically with no code change. The fallback becomes a harmless no-op, marked with a `@todo #448` comment for later cleanup.

**Pattern:** design the consumer to tolerate the pre-land state. Ship earlier; converge passively.

---

### 3. "The lcc-tools grammar exists" was a false assumption

Both `.gitattributes` and `TODOS.md` referenced the `lcc-tools` VS Code extension grammar as if it were a real file somewhere. A quick `find` at spike-start would have shown there is no `.tmLanguage` file anywhere in the repo or locally — the grammar in `docs/research/127-lcc-textmate-grammar.json` is the *first* one ever authored for this ISA.

The consequence: our grammar was built from scratch by surveying `.a`/`.ap` files, not derived from lcc-tools. It may diverge from whatever lcc-tools eventually ships. That gap is now #455.

**Habit:** when a doc references an external artifact, confirm it exists before building on it.

---

### 4. Check companion issues before deleting a "maybe" file

#390 listed `docs/init_code_review.md` with a conditional: *delete if the companion issue chose archive, keep if it chose banner.* The companion (#214, CLOSED) chose banner. So the file stayed.

The decision chain is: read issue → spot the conditional → find the companion → read its resolution → act. Guessing wrong costs a file or a phantom reference.

---

### 5. A worktree's npm name can corrupt the main checkout's package-lock.json

DRAGONFRUIT's #447 worktree ran `npm install`, which set `package-lock.json`'s `"name"` field to the worktree directory name (`"dragonfruit-issue-447"`). That commit landed on main. When the main checkout tried to pull, it conflicted with a stashed local state that had `"lccjs"`.

Resolution: `git restore --staged package-lock.json && git restore package-lock.json` discards the broken local state; `git pull --ff-only` then succeeds. The origin already had the correct `"lccjs"` from later commits.

**Heads-up:** if `package-lock.json` ever conflicts on a pull and the `"name"` field is a fruit-agent name, this is why.

---

## What went well

- **Spike → tickets → implementation in one session.** #127 draft grammar, filed four follow-on tickets, built and shipped #449 showcase — in sequence with clean handoffs.
- **Dual-path grammar loading made #449 shippable immediately.** No cross-agent coordination wait for #448.
- **Archive cleanup (#390) was fast.** The prior triage doc was detailed enough that #390 was `git rm × 19` + one companion check. No ambiguity.

## What didn't go well

- **Left a stale marker at close (#449).** Avoidable. Fixed but cost an extra worktree cycle.
- **Main checkout needed manual repair after DRAGONFRUIT's package-lock drift.** The `restore` sequence isn't obvious under pressure; worth documenting (done above).
