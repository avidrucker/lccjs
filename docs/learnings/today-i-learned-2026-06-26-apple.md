# TIL 2026-06-26 — APPLE

**Context:** A long lccjs→pmtools migration session. I landed the ratified br-/wt-
naming scheme into pmtools (pmtools#17), then flipped all six lccjs PM commands
onto the central pmtools harness — status (#1454), error+velocity logging (#1453),
and finally close (#1467) — each gated by a no-regression differential (#1466).
Along the way I fixed a cluster of pmtools close-tooling bugs (pmtools#56/#57/#61/
#55/#49/#68/#70/#31) and ran several `/fruit-agent-orchestrate` rounds.

---

## 1. Verify live state — never assert a ticket/file/coverage from memory

**What happened:** Twice in one session I stated state I hadn't re-checked, and was
caught both times. (a) Doing pmtools#31 I "remembered" that `run_close_parent_tracker_suite`
already existed at my base — but `git show fc43ea7:tests/integration.sh | grep parent-tracker`
was **0**. That confabulation led me to cover only the markdown guard, **overclaim**
"all four guards pinned," and **prematurely close #31**. (b) In a user-facing summary
I said pmtools#53 and #45 were "open/available" — both were CLOSED; I'd carried a
stale "nearly-empty queue" picture while the fleet had filed #71–#80.

**What I learned:** In a multi-agent repo, state decays between turns faster than I
model it — other agents close, file, and land constantly. A remembered grep or an
earlier turn's issue list is a guess, not a fact, and the cost of a wrong one is an
overclaim or a double-assignment.

**The rule:** **Before asserting any issue's OPEN/CLOSED status, who's in-flight, a
file's contents, or test coverage — re-query it in the same turn (`gh`, `git`, Read).
Never from memory.** (Authority: RULES.json promotion filed as #1486; also captured in agent memory.)

---

## 2. Conflict resolution is integration, not "keep both"

**What happened:** Landing pmtools#17 (rebased onto a `main` that moved **twice**
under me) the conflicts were not blind keep-both. In `status.js`/`status.py` I
**dropped** the branch's `MARKER_RE`/`ISSUE_RE` because GRAPE's `status_core`
refactor (`e1b9a1b`) had already moved marker parsing out — keeping them would have
been dead code. In `close.js` I had to **integrate** the concurrent #37 security
fix's *anchored* injection guard with my *widened* br-/wt- shape — and the merged
anchored guard incidentally fixed pmtools#50 (a slug-embedded `-issue-M` could
masquerade as the issue token under the unanchored form).

**What I learned:** "Keep both sides" is the wrong default for a rebase that crosses
another agent's refactor. The right move is to understand *why* each side changed and
synthesize — sometimes that means deleting one side, sometimes weaving two intents
into one stronger result. And when `main` advances mid-landing, re-rebase onto the
true current tip; don't trust the SHA the ticket cites.

**The rule:** **Resolve a conflict by integrating intents (which may mean dropping a
now-dead side or weaving two), and adversarially review the merge — never default to
keep-both; re-rebase when the base moved.**

---

## 3. Gate each tool-migration flip with a live differential, then dogfood the switch

**What happened:** The migration tracker (#1456) made each flip a config edit, but
the risk was *cross-tool parity* — does pmtools do what lccjs did, against the live
DB/`.pddignore`/conventions? For logging (#1453) I diffed a pmtools-written row vs an
npm-shim row on copies of the live DB (byte-identical). For close (#1467, gated by
#1466) I ran a four-class differential — velocity-CSV, union, parent-tracker,
learnings-README — confirming pmtools `close` resolves each the same as `npm run
close` (two minor, documented, accepted divergences). Then I **closed #1453 and
#1467 *through* the newly-switched `pmtools close` itself** — the live confirmation.

**What I learned:** Per-tool tests (lccjs jest, pmtools fixtures) don't prove
cross-*tool* equivalence; an explicit live differential does. And dogfooding the
switch by using the just-flipped command on its own switch-ticket is the cheapest,
strongest end-to-end proof you can get.

**The rule:** **Before flipping a command to a new tool, run a live differential
(new vs incumbent on the real data) across every behavior class; then exercise the
switch by using the new tool on its own switch-ticket.** (Authority: #1466.)

---

## 4. Only the reporter closes a contract/verification ticket — and not on partial coverage

**What happened:** I closed pmtools#31 (the claim/close contract test) with a
`Closes #31` footer when (per lesson 1) it covered only one of four guards, and GRAPE
correctly flagged that a contract ticket "stays with the reporter to verify all four
arms and close." I reopened it, and only closed it later — reporter-directed — after
**reading `tests/integration.sh` AND running the full suite** to confirm all four
guards fire + both contracts are pinned.

**What I learned:** A contract/umbrella ticket isn't "done" when *my* piece lands; it's
done when the whole contract is verified — and that verification + close belongs to
the reporter (yegor-bdd). Closing it from a worker's partial view is an overstep.

**The rule:** **Don't `Closes #N` a contract/verification/umbrella ticket from
partial coverage; leave it for the reporter, and verify by reading + running, not by
memory.**

---

## 5. Fix recurring derived-artifact friction at its source

**What happened:** The tracked CSV mirror `docs/pmtools-velocity.csv` went dirty after
every velocity log; I hand-reverted it ~3 times, and once a dirty mirror **aborted a
`pmtools close`'s auto ff-pull of main** (#1467). The real fix was pmtools#68:
`git rm --cached` the mirror + `.gitignore docs/pmtools-*.csv` (the DB is the source
of truth; CSVs are derived). After it, a velocity log left main clean. I filed
lccjs#1484 for the same R2 untrack on the lccjs side.

**What I learned:** When I find myself manually undoing the same side-effect more than
once, that's a signal to fix the generator/policy, not to keep reverting. A derived,
git-tracked artifact is a standing friction + conflict source.

**The rule:** **If you revert the same derived-artifact churn twice, stop reverting and
fix the source (gitignore the mirror / change the policy).** (Authority: pmtools#68,
ruling R2 from pmtools#65.)

---

## What landed

| Artifact | Change |
|---|---|
| lccjs `.claude/orchestrate.json` | All 6 PM commands → pmtools (status #1454, logging #1453, close #1467 + `close.autoResolve`) |
| pmtools `close.{js,py}` | NULL-ticket-safe velocity guard (#56), velocity-CSV auto-resolve (#57) |
| pmtools `status`/`claim` | hyphenated `apple-2` identity parse (#49); `status --json` `claims` in-flight signal (#70) |
| pmtools `velocity.{js,py}` | repo-basename default parity (#61) |
| pmtools `tests/integration.sh` | `git -C` seed-commit guard (#55); markdown-guard arm (#31) |
| pmtools `.gitignore` | untrack CSV mirrors (#68) |
| claude-config `fruit-agent-orchestrate/SKILL.md` | consume `status.claims` as primary in-flight signal + warned fallback (#70) |

## Open threads

- The `claims` signal should be intersected with **OPEN** issues — a claim ref for a
  closed issue (saw a live `refs/claims/issue-44` for closed #44) is *stale*, not
  in-flight. Folds into pmtools#71 (sweep) + a Step-4 skill tweak.
- lccjs#1484 — R2 lccjs-side CSV-mirror untrack (policy call: history-in-git vs friction).
- Commit *before* clone-verifying — I clone-verified an uncommitted/wrong tip more than
  once and tested the baseline instead of the fix; the clone only sees committed state.

## Related artifacts

- Migration tracker: #1456 · close gate: #1466 · naming: #1460/#1461
- Sibling: [TIL 2026-06-24 APPLE](./today-i-learned-2026-06-24-apple.md)
