# TIL 2026-06-06 — ELDERBERRY

**Context:** A short maintenance session triggered by a single question — "what
are the last 3 models logged by ELDERBERRY?" Answering it wrong (then right)
surfaced a stale path in my own memory, which cascaded into a memory sweep, a new
testing ticket (#992 is this TIL; the guard is #990), and a cross-link comment on
#984.

---

## 1. Query the canonical store, not the file that merely looks canonical

**What happened:** Asked for ELDERBERRY's last 3 logged models, I queried
`~/.lccjs/velocity.db` — the path every one of my memory notes named — and got
zero rows. I reported "ELDERBERRY has no logged models; the only agent in the DB
is GRAPE." That was wrong. The user asked "did you look in `lccjs.db` too?" and
there it was: ELDERBERRY's three most recent rows, all `sonnet-4.6`.

The rename happened in #947: `velocity.db` → `lccjs.db`, with `scripts/db-path.js`
as the shared resolver and a one-time migration shim. The old `velocity.db` is now
an **orphan** holding a single stale row; the live multi-table store
(`velocity`, `errors`, `rice`, `ice_scores`) is `lccjs.db`.

**What I learned:** A "no rows" result is not the same as "no data" — it can mean
I opened the wrong database. The legacy file still *exists* and still *answers
queries*, so nothing errored to warn me. The honest move on a surprising empty
result is to question the source before reporting the conclusion.

**The rule:** **Before reporting "no data," confirm you queried the canonical
source — for lccjs that is `~/.lccjs/lccjs.db` (resolve via `scripts/db-path.js`),
never the orphaned `velocity.db`.**

---

## 2. When a fact changes, correct it *everywhere* it lives

**What happened:** The wrong query was downstream of a wrong memory. I had six
memory files naming `velocity.db` as canonical. Fixing only the one I happened to
read would have left five landmines for the next session. I grepped the whole
memory directory (`grep -rln "velocity\.db"`), found all six, and updated each —
including the `MEMORY.md` index lines and the description frontmatter, not just
the bodies.

**What I learned:** A single stale fact rarely lives in one place. The fix is not
"edit the file I'm looking at" but "find every copy of the claim." The grep took
seconds and was the difference between a real fix and a cosmetic one.

**The rule:** **After learning a fact has changed, grep for every occurrence of
the old fact and correct all of them in one pass — partial corrections are how
stale facts survive.**

---

## 3. File adjacent, not duplicate — find the distinct deliverable

**What happened:** Asked to file a ticket ensuring "lccjs.db usage compliance is
verified," I searched open issues first and found **#984** already open: it
retires the orphan and unifies `ice-score.js`'s divergent resolver. Re-filing the
same scope would have been noise. The genuinely missing piece was an *automated
guard* — a test that keeps compliance verified after #984 lands. So I filed
**#990** (a `testing` ticket) scoped to lock in #984's end-state: a red BDD test
if worked first, a stays-green guard if worked after.

**What I learned:** "File a ticket about X" doesn't mean "file a ticket even if X
is already filed." The search-first step turned a probable duplicate into a
complementary ticket with a clear ordering relationship.

**The rule:** **Before filing, search open issues; if the area is already
covered, file the distinct slice that's missing (here: the regression guard) and
cross-link it — don't duplicate the scope.**

---

## 4. Re-verify a flag is still live before you comment on it

**What happened:** Asked to comment on #984 about the divergence I'd flagged, I
first re-ran the checks against `main` (`sed -n` on `ice-score.js`, `git grep` for
the env-var names) rather than commenting from memory. Confirmed both foot-guns
were still present — the `velocity.db` fallback and the `LCCJS_DB`-vs-`VELOCITY_DB`
env-var fork — then wrote a comment that *added* (re-verification date +
cross-link to #990 + a nudge to settle one env-var name) instead of restating
what #984's body already documented.

**What I learned:** A flag I raised earlier in the session can already be stale by
the time I comment (APPLE is actively working #984 in a worktree). A 10-second
re-check buys an accurate, dated claim; restating the issue's own body buys
nothing.

**The rule:** **Before commenting on an issue, re-verify the claim against current
`main` and make the comment additive — restating the body is noise.**

---

## Open threads

- #990 needs the single env-var name decided in #984 (`LCCJS_DB` is the more
  accurate post-rename name) before the guard can assert against it.
- Memory corrections live under `~/.claude/` (gitignored) — they are not part of
  any commit, so this TIL is the only durable, reviewable record that the sweep
  happened.

## Related artifacts

- Issue #984 — retire the orphaned `velocity.db`, unify on `lccjs.db`
- Issue #990 — the compliance-guard test this session filed
- Issue #947 — the original rename
- `scripts/db-path.js`, `scripts/ice-score.js:43-48`
