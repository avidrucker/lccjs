# TIL 2026-06-07 — ELDERBERRY (session 2)

**Context:** A human+AI pair session driving #845 to a decision — *"RULES.json adoption path: choose Option A, B, or C and ratify R-prefix IDs"* — via the `guide-human-decision` skill. The session ratified Option B, refined the ID scheme with Avi, filed three implementation tickets (#1185, #1186, #1189), and closed #845. These are the non-obvious lessons.

---

## 1. Verify the load-bearing premise before ratifying a decision that inherits it

**What happened:** The #842 spike had already done the analysis and recommended **Option C** (RULES.json as a passive companion, RULES.md stays authoritative). The whole recommendation rested on one sentence: *"the Claude Code harness reads `.md`, not JSON — so RULES.md must stay the source of truth."* My job under `guide-human-decision` was to reformat that analysis and recommend — easy to just pass it through. Instead I ran one grep:

```bash
grep -rn 'RULES\.md\|@RULES' CLAUDE.md .claude/
```

It found **nothing** — `RULES.md` is not `@`-imported anywhere. It's not harness-auto-loaded *either*; it reaches agents only via memories, `claude_workflow.md`, and the greeting. Its real jobs are human reference + the GitHub-Pages render. The premise was false.

**What I learned:** Once "the harness can't load JSON, so keep MD" collapses, the spike's main objection to **Option B** (JSON primary, MD generated) collapses with it — neither format is privileged at runtime, so MD-as-generated-artifact is clean. The recommendation flipped C → B on the strength of a single grep. A prior agent's recommendation can be sound *reasoning* on a *wrong fact*.

**The rule:** **Before ratifying or extending a prior recommendation, verify the load-bearing premise it rests on — especially "the system can't do X" claims. One grep can flip the decision.** (Filed #1192 to home this in `do-this-not-that.md`.)

---

## 2. A content-SHA is a great *version* and a terrible *identity*

**What happened:** Avi first proposed using a 6-char content SHA as the rule's ID, then refined it to versioned IDs (`crimson-otter-001` → `crimson-otter-002`, SHA regenerated from the rule text). Both are appealing — they make versioning automatic. But they share a sharp edge: **anything that changes when the text changes cannot be the citation target.** If 50 docs say "see `crimson-otter-002`" and the rule is edited to `-003`, every citation is stale — the exact `#1061` breakage we were cleaning up.

**What I learned:** Identity and version are two different needs with opposite requirements:

| Concern | Must change on edit? |
|---|---|
| **Identity** (citation target) | **No** — must survive edits |
| **Version** (change tracking) | **Yes** — should change |

The resolution kept both ideas: a stable **stem** (`crimson-otter`) is the citation target; the **SHA drives** an auto-incremented `-NNN` version suffix (`text_sha` mismatch → bump). Prose cites the stem; `-NNN`/SHA are internal version metadata maintained by the render pass. Avi's instinct was right — it just belonged in the `version` slot, not the `id` slot.

**The rule:** **Cite by a stable stem that never changes; let the content hash drive the version, never the ID.** (Homed in the #845 ruling + #1185 schema spec.)

---

## 3. A decision ticket can be ratifying *already-shipped* state — read what closed since it was filed

**What happened:** #845 reads as an open question ("choose A, B, or C"). But #1061 — closed *the same day* — had already implemented an Option-C companion *with a recorded same-PR sync policy* baked into RULES.json's header `note`. So part of the "decision" was really *ratify or override what already shipped.* My greeting even flagged it: "#1061 just closed, so the sync state is fresh." I almost treated #845 as greenfield.

**What I learned:** Tickets are written at a point in time; the world moves under them. Reading the referenced-issue *comments and recent closures* (not just bodies) reframed the decision from "pick one" to "supersede #1061's policy, and update the stale `note` it left behind" — which became an explicit line in #1185.

**The rule:** **For any decision ticket, check what closed since it was filed; the "decision" may be to ratify or supersede an already-shipped state, not to choose from scratch.**

---

## 4. Process mechanics: validation guards are loggable, and decision tickets don't close like puzzles

Two small but non-obvious mechanics this session:

- **A self-corrected validation guard still gets an error row.** My first `npm run velocity:log` was rejected by the main-checkout guard ("logging from main while active worktrees exist"); I retried with `--from-main`. `docs/errors-schema.md` is explicit: *"resolution in the next step does not make the original error invisible."* So `next-best-action` Q6 → logged it as `VALIDATION_FAIL` (errors id=77), even though it resolved in one step.
- **`npm run close N` is for puzzles with a worktree commit + teardown.** #845 was a pure-decision ticket — no file deliverable; the ruling comment + filed tickets *are* the deliverable. It closes via `gh issue close` (which never touches `main`) plus a velocity row logged `--from-main`. Forcing a `Closes #N` commit would have been wrong.

**The rule:** **Log validation/guard rejections even when self-corrected; close a no-deliverable decision ticket with `gh issue close` + a `--from-main` velocity row, not `npm run close`.**

---

## What landed

| Artifact | Change |
|---|---|
| #845 | Ruling (Option B + animal-color stable IDs + SHA versions), addendum, closed |
| #1185 | DEV — RULES.json source-of-truth: schema migration, render script, ID generator |
| #1189 | DEV — auto-regenerate RULES.md on commit (pre-commit hook + pre-push backstop) |
| #1186 | WRITER — sweep `Rule N` / `R0NN` citations → stable animal-color stem |
| #1192 | WRITER — home lesson #1 in `do-this-not-that.md` |

## Related artifacts

- Issue #845 (decision), #842 (spike), #1061 (prior reconcile)
- [Sibling TIL — same day](./today-i-learned-2026-06-07-elderberry.md)
- `docs/research/842-rules-json-spike.md` — the spike assessment whose premise this session re-checked
