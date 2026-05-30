# Today I Learned — 2026-05-29 (DRAGONFRUIT)

Date: 2026-05-29
Agent: DRAGONFRUIT
Context: A short, pure-PM session. Ran `/puzzle-triage` to rank the backlog, then
executed a small backlog-curation call: closed **#143** (gameSnake feature
backlog) and **#153** (free-stub memory-leak research) as `wontfix`, reframed the
gameSnake work as a code-quality research ticket (**#202**), and logged the whole
thing as one PM unit — first keyed to #143 as a workaround, then re-keyed to its
own ticket **#204** once the user authorized filing it. No production code
touched; the lessons are all about *process boundaries*.

---

## 1. Triage tooling ranks importance; it can't tell you what's already taken

`puzzle-triage` orders the backlog by severity × Yegor priority, and `puzzle:status`
lifts out work that's `CLAIMED`/`IN-PROGRESS`. But the user had to tell me directly
that APPLE held #193, BANANA #161, CHERRY #166 — and only two of those (#161, #166)
showed as claimed in `puzzle:status`. #193 was invisible: it has no `@todo` marker
and its owner sat between worktrees, exactly the worktree-liveness ≠ session-liveness
gap that **#193 itself documents**. So the "what's safe to grab" reconciler and the
"what's most important" ranker, *together*, still didn't capture the real claim set.

**The rule:** the backlog tooling answers *importance* and *marker/worktree* state,
not *who's actually sitting on what right now*. Out-of-band assignment (a human
saying "X has that one") overrides the ranked queue — fold it in before
recommending, and don't treat an item's absence from `puzzle:status` as "free".

## 2. Precedent is not authorization for an external-system write

Convention (#191/#192) said ad-hoc PM/data work gets a *retroactive ticket* filed +
closed same cycle, and I reached for that reflexively — tried to `gh issue create` a
PM tracker ticket. The auto-classifier **blocked it**: the user had asked to log the
work *in the CSV ledger*, not to create an issue, so filing one was an unrequested
write to an external system. The right move was to adapt **within the requested
scope** — key the velocity row to #143 (a ticket the cycle actually closed) — and
say so in the notes, rather than route around the block. When the user later said
"yes, file it as an issue too," *that* was the authorization, and #204 got filed.

**The rule:** a documented convention tells you the *shape* of the right artifact;
it does not grant permission to write to GitHub / Slack / any external system. The
user's explicit ask sets the scope. Blocked on an outward write → adapt inside the
asked-for scope and surface the tradeoff, don't work around the denial.

## 3. Closing a ticket has a footprint beyond the issue tracker

`gh issue close 143` is the *least* of closing #143. The real close meant:
- deleting the **8 stale `@todo #143`/`#153` markers** in `plusdemos/gameSnake.ap` —
  otherwise `puzzle:status` would flag live markers pointing at closed tickets
  (manufacturing the exact STALE-marker debt other TILs complain about), and
- logging the PM unit in `docs/puzzle-velocity.csv`.

A close that touches only the tracker leaves code and ledger out of sync.

**The rule:** "close the ticket" = tracker state **+** any `@todo` markers that
reference it **+** the velocity row. Sweep all three in the same commit, or the
reconcilers will surface the half-done close tomorrow.

## 4. A velocity row belongs to its *own* unit's ticket, not a ticket it happened to touch

I keyed the PM row to #143 first — a deliberate workaround while issue-creation was
blocked, and an honest closed-ticket anchor. But it conflated "PM curation cycle"
with "the gameSnake feature backlog." Once #204 existed, re-keying it made the row
map 1:1 to the work it actually describes; #143/#153 stayed as the *business* closes,
#202 as the follow-up. The re-key was itself a logged change (its own commit,
`Closes #204`), and I re-validated the row at 13/13 columns with a quote-aware
counter before committing — a raw `>>` append to a `merge=union` CSV is easy to
malform.

**The rule:** a velocity/ledger row should be anchored to the ticket that *is* that
unit of work, not to a sibling ticket it modified. If a workaround forced a
mismatched key, re-key once the real anchor exists — and treat the ledger like the
schema'd data it is (column-count check before every append).

## 5. `wontfix` with a forward path beats `wontfix` as a dead-end

We didn't just kill #143 and #153. The gameSnake feature list became **#202** —
"assess the file's code quality against stricter metrics, and let *that* decide what
(if anything) to build" — and #153's leak question was pointed at **#144** + #202.
Even the deleted markers were *replaced with pointer comments* to #202/#144, not
silently removed. Low-priority closes are cleanest when they name where the value
re-enters the system.

**The rule:** when you close something as `wontfix` that still holds a real question,
name its successor (a new ticket, an existing one) in the close comment **and** at
the code site. The thread survives the close; future readers find the live anchor
instead of a dead reference.

---

## What landed

| Artifact | Change |
|---|---|
| [#143](https://github.com/avidrucker/lccjs/issues/143) | **Closed `wontfix`** — gameSnake feature backlog, priority too low. Superseded by #202. Commit `a25ce38`. |
| [#153](https://github.com/avidrucker/lccjs/issues/153) | **Closed `wontfix`** — free-stub memory-leak research; question lives on in #144/#202. Commit `a25ce38`. |
| [#202](https://github.com/avidrucker/lccjs/issues/202) | **Filed** — research: assess `gameSnake.ap` code quality against stricter conventions/metrics (code-quality-analysis repo). Reframes #143. Open. |
| [#204](https://github.com/avidrucker/lccjs/issues/204) | **Filed + closed** — the PM curation unit's own ticket (user-authorized after the classifier block). Commit `d2029dc`. |
| `plusdemos/gameSnake.ap` | Removed 8 stale `@todo #143`/`#153` markers; replaced with pointer comments to #202/#144. |
| `docs/puzzle-velocity.csv` | One PM row (role `PM`, ~3m, wall-clock only, `closed_commit` empty per #186), re-keyed #143 → #204. |

## Open threads for tomorrow

- **#202** is the live follow-up: run the gameSnake code-quality audit (size,
  duplication, register-role discipline, dead/commented-out code like the free-stub
  block), decide whether any dropped #143 features are worth reviving, and decompose
  into ≤60m child puzzles.
- The free-stub memory-leak question (ex-#153) is now only anchored in #144 + #202 —
  make sure #202's audit actually picks it up so it doesn't get lost a second time.

## Related artifacts

- [TIL 2026-05-29 (CHERRY)](./today-i-learned-2026-05-29-cherry.md) — lesson 2
  ("don't store a value the rebase will rewrite") is the sibling of my lesson 4: both
  are about treating the velocity CSV as real, schema'd data rather than free text.
- `docs/puzzle-velocity.md` — role-code table (`PM` = "project management work:
  tracker updates, issue triage") and the #186 single-commit / empty-`closed_commit`
  close protocol both governed this session.
- [#193](https://github.com/avidrucker/lccjs/issues/193) — the worktree-liveness ≠
  session-liveness finding that explains why lesson 1's claim set wasn't fully
  visible to `puzzle:status`.
