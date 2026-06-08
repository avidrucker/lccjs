# TIL 2026-06-07 — BANANA (session 2)

**Context:** A toolchain-lane session. Fixed the `lccrun.sh` watchdog latency bug
(#1149), reframed the velocity/claim model+agent gates from *prevent* to *notice*
in a pair-work session (#1184), and ran a post-change test-coverage audit that filed
three follow-ups (#1183 superseded, #1195, #1196). The richest lessons came from the
lccrun diagnosis, the close-time rebase, and a small testing trap.

---

## 1. An orphaned `sleep` — not a missing kill — is why a fast program blocked for the full timeout

**What happened:** `scripts/lccrun.sh` ran its timeout watchdog as a backgrounded
subshell: `( sleep "$TIMEOUT"; … ) &`, then `kill "$WATCHDOG_PID"` once the child
finished. A `spawnSync(…, { encoding })` caller running an *instant* program still
blocked for the **entire** timeout (`timeout=10` → 10019ms). My first instinct was
"the kill isn't reaching the watchdog." It was — but `kill` terminates the *subshell*,
and the subshell's `sleep` child is **orphaned**, not reaped. That orphan inherited
lccrun's stdout/stderr, so the caller's pipe never saw **EOF** until the orphaned
`sleep` naturally elapsed.

**What I learned:** When a captured subprocess "hangs until a timer fires," reach for
*who still holds the write end of the pipe*, not *what didn't get killed*. `spawnSync`
with `encoding` waits for pipe EOF, and EOF only arrives when the **last** fd-holder
exits — a forgotten grandchild counts. The fix was one redirect:
`( sleep …; … ) >/dev/null 2>&1 &`, plus moving the user-facing timeout message into
the parent under the existing `[[ -s "$FLAG" ]]` check (the flag file already signalled
timeout independently). 10019ms → 59ms, identical output.

**The rule:** **A backgrounded watchdog must redirect its own stdio — an orphaned
`sleep`/child keeps the caller's captured pipe open until it dies, so the caller blocks
on EOF, not on the kill.**

---

## 2. A gate that keeps generating red-build incidents is the wrong tool — flip enforce→observe

**What happened:** A non-canonical `model="owl-alpha"` row turned `npm test` red
(#1183). The model-canonical guard had been *added* in #453 to reject such values, yet
the same data-quality problem had recurred six times (#314/#378/#381/#453/#540/#1183).
Rather than scrub the row and re-tighten the gate, #1184 flipped the policy:
`velocity-log.js` now **records** a non-canonical/new model with a one-line notice
instead of `die()`-ing, and the CSV canonical test became **report-only** (it
`console.warn`s drift but never fails). Roles stayed a hard reject — they're a
deliberately *closed* vocabulary, unlike models/agents which legitimately grow.

**What I learned:** "Open-growth vs closed vocabulary" is the deciding axis. Enforcing
canonical form on an open-growth field (model names, agent identities) means every new
member is a build break *by construction* — the gate manufactures incidents. Observe it
(notice + record) and let a human normalise later. The authority for this now lives in
`docs/do-this-not-that.md` (updated in #1184), so it outlives this session.

**The rule:** **Gate closed vocabularies; only *notice* open-growth ones — if a check
reds the build whenever a legitimately-new value appears, it's the wrong check.**

---

## 3. The shared global DB makes a `data(velocity)` commit vanish on rebase — and that's correct

**What happened:** Closing #1184, the `npm run close` rebase replayed my two commits;
the second — `data(velocity): log #1184 close row` — was **dropped as empty**. Brief
panic ("where did my row go?"), then: `git show origin/main:docs/puzzle-velocity.csv`
already contained my `#1184` row. The velocity store is a *global* SQLite DB
(`~/.lccjs/lccjs.db`), and another agent's close had run `velocity:export` after my
`velocity:log` inserted the row — so their CSV export carried my row onto `main` before
I rebased. My CSV commit was genuinely redundant; the rebase was right to drop it.

**What I learned:** With a shared global DB feeding a git-tracked export, your "own"
data commit can land via *someone else's* export. An empty/dropped commit on rebase is
a signal to **check the parent tree before re-creating the change**, not to force it
back in. (Compounding the day: the same close also hit a real content conflict in
`claim.js` from a concurrent lane-gate commit — resolved by keeping *both* sides.)

**The rule:** **Before resurrecting a commit the rebase dropped as empty, diff it
against `origin/main` — a shared-export artifact may already carry your change.**

---

## 4. Validation *order* decides which failure you can use as a test probe

**What happened:** Flipping the velocity-log tests, the canonical-accept cases used a
clever trick — pass `ticket:"bad"` so the script fails *after* the field under test,
proving that field passed without writing a DB row. I copied it for the new
model-notice tests… and they failed: the notice never printed. `ticket` is validated
**before** `model` in `velocity-log.js`, so a bad ticket dies first and never reaches
the model code. I switched the stopper to an invalid **role** (validated *after* the
model check), which both proved we got past the model code and halted before the insert.

**What I learned:** The "use an unrelated failure to probe past the thing under test"
pattern is only valid if the stopper is validated *downstream* of the target. Probe
direction is coupled to source order — copy the pattern, re-check the order.

**The rule:** **A fail-fast probe must trip on a check that runs *after* the behaviour
you're asserting — otherwise it short-circuits before your assertion is even reached.**

---

## What landed

| Artifact | Change |
|---|---|
| `scripts/lccrun.sh` | Redirect watchdog stdio; move timeout message to parent (#1149) |
| `tests/new/lccrun.e2e.spec.js` | New regression guard for the latency fix (#1149) |
| `scripts/velocity-log.js`, `scripts/claim.js` | Model/agent gates → notice-not-prevent (#1184) |
| `tests/new/{velocity-log,claim,puzzle-velocity-csv}.unit.spec.js` | Flipped to assert notice behavior; canonical test report-only (#1184) |
| `docs/do-this-not-that.md` | Corrected the "non-canonical is rejected" guidance (#1184) |

## Open threads

- #1195 — `error-log.js` carries the *same* model gate #1184 relaxed, plus thin tests
  (only the `message` branch is covered). Folded the consistency fix + coverage.
- #1196 — `claim.js` `main()` orchestration is ~34% line-covered; the pure seams are
  well-tested but the wiring isn't.

## Related artifacts

- Issues #1149, #1184, #1183, #1195, #1196
- Prior BANANA TIL (different lane, same day): [CM6 highlighting](./today-i-learned-2026-06-07-banana.md)
- [`docs/do-this-not-that.md`](../do-this-not-that.md) — notice-not-prevent guidance
