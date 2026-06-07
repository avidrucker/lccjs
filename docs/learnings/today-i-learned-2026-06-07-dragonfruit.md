# TIL 2026-06-07 — DRAGONFRUIT

**Context:** A small DEV ticket — #1127 ("`npm test` red on main — `preflight.js` `~/.lccjs`
resolver missing from db-path `KNOWN_BYPASSERS`"), which also deduped #1104. The fix was
one line of test config, but getting it landed surfaced four reusable lessons about
compliance guards, the velocity tool's delta convention, the close script's exit code,
and working around a shared `main` checkout that another agent had left dirty.

---

## 1. A compliance guard's regex can flag a legitimate non-guarded use — add a documented exception, don't contort the code

**What happened:** `tests/new/db-path-compliance.unit.spec.js` was red on `main`. It enforces
the #947/#984 invariant that every script resolving `~/.lccjs` must route through the shared
`scripts/db-path.js` resolver — its regex matches `path.join(...homedir()...'.lccjs'...)`.
`scripts/preflight.js:65` tripped it, but **not** because it touches the database:
it writes a per-issue session scratch stamp (`~/.lccjs/preflight-<issue>.iso`, #652) — a
sidecar file that just happens to live in the same config dir as `lccjs.db`.

The issue offered two paths: (a) route the stamp dir through `db-path.js`, or (b) add
`preflight.js` to `KNOWN_BYPASSERS` with a rationale. Option (a) is tempting (`path.dirname(DB_PATH)`),
but `db-path.js`'s contract is *the DB file* — it even honours `LCCJS_DB` overrides. Deriving a
stamp location from the DB path would couple an unrelated session file to the DB's filepath, so
that an override aimed at the DB would silently relocate the stamp. That's a semantic mismatch.

**What I learned:** The guard exists to centralise *DB-path* resolution; a non-DB sidecar that
shares the directory is a false positive, not drift. The test's own comment already says the
allowlist is for "a deliberate, documented exception." Forcing the code through a helper whose
contract doesn't fit, just to satisfy a regex, is worse than the documented exception.

**The rule:** **When a compliance guard flags a use that isn't actually the resource it
guards, add a documented allowlist exception — don't contort the code to match the guard's
literal shape.** (Authority: the `KNOWN_BYPASSERS` comment in the test itself.)

---

## 2. `velocity:log` deltas are `estimate − actual` and must be ≥ 0

**What happened:** I logged the velocity row with `delta_h_min: -12` (I'd computed
`actual − estimate` = 3 − 15). The tool rejected it: *"delta_h_min must be >= 0 (got -12);
convention is estimate - actual."* Re-running with `12` and `5` worked.

**What I learned:** The sign convention is the opposite of what "delta = new − old" intuition
suggests. A **positive** delta means you came in **under** estimate (the good direction), and the
tool refuses negatives outright — so an overrun isn't a negative delta, it's a different shape of
row entirely (and a signal to split the task per the microtask cap).

**The rule:** **`delta_h_min = h_min − actual_min`, `delta_c_min = c_min − actual_min`,
both ≥ 0.** (Authority: enforced by `scripts/velocity-log.js` validation.)

---

## 3. `npm run close` exits 1 with a benign `getcwd` error *after* it has already succeeded

**What happened:** `npm run close 1127` printed the full `CLOSE OK ... #1127 is CLOSED ...
main checkout synced` banner, then exited non-zero with:
`pwd: error retrieving current directory: getcwd: cannot access parent directories`.

**What I learned:** The close tears down the worktree the shell is *currently sitting in*, so the
shell's CWD vanishes mid-command and the trailing `pwd` fails. The non-zero exit is cosmetic
teardown noise, not a failure of the close. The signal of success is the `CLOSE OK` line and the
`#N is CLOSED` confirmation — and you should immediately `cd` back to the main checkout
(the close prints the re-root command). This is now a **recurring** thread — ELDERBERRY
(2026-06-06 batch-close) and CHERRY (2026-06-06 s2, the stash→pop re-root recovery) hit the
same teardown behaviour; tracked for formalisation under #207.

**The rule:** **Trust `CLOSE OK` / `#N is CLOSED`, not the exit code; the post-teardown
`getcwd` error is cosmetic. Re-root to the main checkout right after.** (Authority: recurring
across TILs; promotion candidate for `docs/project-gotchas.md`, #207.)

---

## 4. Dual-close a duplicate by stacking `Closes #N` footers

**What happened:** #1127 superseded the older duplicate #1104 (same red test, same root cause).
Rather than close #1104 by hand, I put **both** `Closes #1127` and `Closes #1104` in the fix
commit's footer. On push to the default branch, GitHub auto-closed both, and I added a
cross-referencing comment to each.

**What I learned:** A single commit can close any number of issues via repeated `Closes #N`
footers — the cleanest way to retire a duplicate, because the closure is tied to the exact
landing commit rather than a separate manual action that can drift or be forgotten.

**The rule:** **To retire a duplicate alongside its canonical fix, stack a second
`Closes #N` footer in the fix commit, then cross-link both issues in a comment.**

---

## 5. A shared `main` checkout left dirty by another agent: claim `--allow-stale-main`, then rebase the *worktree* onto `origin/main`

**What happened:** When I came back to write this TIL, the shared `main` checkout was both
**1 commit behind `origin/main`** and **dirty with another agent's uncommitted work**
(staged `dist/` bundles + `scripts/build-site.js`, a modified `docs/learnings/README.md`).
`npm run claim` refused — stale main risks a wrong base — and a `git pull --ff-only` would have
been blocked by the foreign uncommitted `README.md`. Stashing to force the FF would have meant
manipulating another agent's in-flight work.

**What I learned:** I don't have to fix the shared checkout to work safely. `git worktree add`
branches off a *commit*, so the dirty working tree of `main` is irrelevant to the worktree.
I claimed with `--allow-stale-main` (base = stale local HEAD), then ran `git rebase origin/main`
inside the fresh worktree — which, since the new branch has zero commits, simply fast-forwards
the branch to the true `origin/main` tip. My later push stays a clean fast-forward, and the
foreign dirt on `main` is never touched.

**The rule:** **Never stash or discard another agent's uncommitted work to satisfy a
stale-main guard. Claim `--allow-stale-main`, then `git rebase origin/main` inside the
worktree to base your branch on the real tip.** (Authority: scope-discipline + worktree
isolation already in `RULES.md` / parallel-worktree workflow.)

---

## What landed

| Artifact | Change |
|---|---|
| `tests/new/db-path-compliance.unit.spec.js` | Added `preflight.js` to `KNOWN_BYPASSERS` with a sidecar-stamp rationale (#1127, dedups #1104) |

## Open threads

- `docs/learnings/today-i-learned-2026-06-07-jackfruit.md` is committed (a815fd1, #1161) but has
  **no row in the `README.md` index table** — a missed mandatory step. Left for JACKFRUIT to fix
  (out of my scope); flagging here so it isn't lost.
- The shared `main` checkout still carries another agent's uncommitted `dist/` + `build-site.js`
  work; surfaced to the human rather than touched.

## Related artifacts

- Issues #1127, #1104 (duplicate), #652 (preflight stamp), #947/#984 (db-path centralisation), #207 (recurring-thread formalisation)
- [TIL 2026-06-06 ELDERBERRY (session 2)](./today-i-learned-2026-06-06-elderberry-batch-close.md) — same "getcwd after teardown is cosmetic" observation
- [TIL 2026-06-06 CHERRY (session 2)](./today-i-learned-2026-06-06-cherry-2.md) — post-close re-root recovery
