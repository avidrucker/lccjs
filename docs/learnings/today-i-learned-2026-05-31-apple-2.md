# Today I Learned — 2026-05-31 (APPLE, session 2)

Afternoon session: #295 (stale-artifact cleanup post-SQLite migration), #281 (agent instruction non-compliance root-cause research), #299 (velocity-log null-ticket gap), and a PM sprint — puzzle triage, 4-agent work assignment, bug-label audit, severity labeling.

---

## 1. The CSV is read-only — don't hand-edit it to resolve a rebase conflict

When `git pull --rebase` conflicted on `docs/puzzle-velocity.csv`, I reflexively opened the Edit tool to resolve the conflict markers by hand. The user stopped me. **The CSV is a generated export from `~/.lccjs/velocity.db` — it must never be hand-edited.** The correct resolution is:

1. Abort the rebase (`git rebase --abort`).
2. Drop the offending commit (`git reset --hard origin/main`).
3. Re-export from the DB at close time (`npm run velocity:export` inside the closing worktree) — the DB already has the rows, so the export produces the correct file without any manual touching.

Root cause: I committed the CSV from the main checkout after a direct `sqlite3` insert (needed because `velocity-log.js` rejects null tickets). That out-of-band commit created exactly the split-checkout conflict it was trying to avoid. The right path was always: DB rows live in `~/.lccjs/velocity.db`; let the closing worktree's export pick them up at commit time.

## 2. velocity-log.js had a null-ticket gap — now fixed (#299)

`velocity-log.js` listed `ticket` as a required positive integer, but `docs/velocity-schema.md` marks it nullable. Issueless PM/triage rows need `ticket = NULL`. Workaround had been `sqlite3` direct insert. Fixed in the same session: removed `ticket` from `REQUIRED`, guard the type-check only when the field is provided. Closes #299.

## 3. merge=union doesn't fire on rebase — it only fires on merge

Encountered this twice in one session. `docs/puzzle-velocity.csv` carries `merge=union` in `.gitattributes`, but that driver fires for `git merge`, not `git rebase`. Under rebase, standard three-way merge applies and parallel CSV appends conflict. The mitigation is what the worktree workflow already prescribes: export only from the closing worktree, one writer at a time. Don't export ad-hoc from the main checkout.

## 4. Guards held; prose didn't — the #281 research finding in one sentence

Root-cause analysis across 8 violation instances from the 2026-05-29–31 period confirmed: every executable guard (claim refusing a closed issue, claim refusing a stale main, close.js verify-then-cleanup gate) caught its violation with zero misses. Every rule that lived only in prose or memory (`deliberate-tool-pacing`, "tool failure means stop") was violated. The mitigation is converting load-bearing prose rules to guards, not rewriting the prose. Five follow-up puzzles filed in `docs/research/agent-instruction-compliance.md`.
