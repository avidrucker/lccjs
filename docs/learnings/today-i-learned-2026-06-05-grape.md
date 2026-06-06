# TIL 2026-06-05 — GRAPE

**Context:** Ticket-filing day plus two implementation tasks. Filed eight new issues across LCC+ mnemonic additions, a compositional module design spike, test-suite measurement, and pre-existing test failures. Implemented the `errors` table + insert path for #898. Worked tracker #890 item A (tightened `next-best-action` invoke note in `docs/skills.md`).

---

## 1. Single-letter flag namespace is cross-CLI, not per-binary

When adding `--play / -p` to `lccplus.js` (#896), the instruction was to pick a short flag that doesn't collide "on core, linker, ilcc, or plus flags." This required auditing four separate CLIs:

| CLI | Relevant flags |
|-----|----------------|
| `src/cli/lcc.js` | `-d -e -f -h -i -l -m -n -o -r -t -v -x -c` |
| `src/interactive/ilcc.js` | `-c -d -e -f -h -i -l -m -n -o -r -t -x` |
| `src/core/linker.js` | `-o` |
| `src/plus/lccplus.js` | (none yet) |

Even though `lccplus.js` had no flags of its own, a flag added there must not collide with letters a user might type when running `lcc.js` — the mental model is a shared single-letter pool. Free letters as of 2026-06-05: `a b g j k p q s u w y z`. `-p` (`--play`) was chosen.

**The rule:** Before picking any single-letter flag for any LCC-family binary, audit all four CLI flag tables — collisions are evaluated against the full family, not just the target binary.

---

## 2. Tracker items can be "partially done before you arrive" — tighten, don't rewrite

Item A of tracker #890 said: *add "invoke before every `npm run close N`" note to `next-best-action` in `docs/skills.md`*. When I opened the file, the `**Invoke when:**` line was already there — added by #887. The item wasn't untouched; it was 80% done.

The gap was a qualifier: the existing text said "before every `npm run close N` **on any substantive puzzle**." The tracker asked for an unconditional note. The fix was tightening one phrase — removing "on any substantive puzzle" and adding "— no exceptions."

Filing the child issue (#905) with "note is absent" was slightly wrong because I hadn't checked the file first. Reading the target file before filing a child issue for a tracker item shapes a more accurate complaint.

**The rule:** Read the target file before filing a child issue for a tracker item — the current state determines whether you're adding, tightening, or closing as "already done."

---

## 3. errors-table write path: agent's responsibility, not the hook's

#898 asked to decide *who writes the DB row when an error occurs* — the agent, a git hook, or both. The answer is the agent.

Git hooks (pre-commit, commit-msg, pre-push) already emit errors via stderr. Adding a SQLite write inside a hook would: (a) slow down every hook invocation even when no error occurs, (b) fire on every commit rather than on agent-specific errors, and (c) make hooks hard to test — they run in a subprocess with no clean way to inject a fake DB path without environment hacking. The agent, by contrast, holds the full error context at the moment it occurs — ticket number, error type, message, model — and can call `npm run error:log` selectively.

**The rule:** Put DB writes in the tool or script that has the most context at the moment the event occurs — not in the nearest hook. Hooks enforce; agents observe.

---

## 4. Worktrees need `npm install` before tests are meaningful

When I first ran `npm test` in the worktree for #902, 19 tests failed with `ERR_MODULE_NOT_FOUND: Cannot find package '@lezer/lr'`. Running `npm install` in the worktree fixed the missing dev-dep and the failure count dropped to the 11 pre-existing failures that exist on `main`.

Worktrees are created from the committed tree — `node_modules/` is not copied in or shared. Any test run that relies on dev dependencies produces misleading results until `npm install` is run inside the worktree.

**The rule:** Run `npm install` in a new worktree before running tests, or missing-dep failures will mask the real failure count.

---

## What landed

| Artifact | Change |
|---|---|
| `scripts/errors-seed.js` | Creates `errors` table + 3 indexes in `~/.lccjs/velocity.db` (#898) |
| `scripts/error-log.js` | Insert path for error rows; validates `occurred_iso`, `error_type` vocab, `model` format (#898) |
| `package.json` | `error:seed` and `error:log` npm scripts wired (#898) |
| `docs/skills.md` | `next-best-action` invoke note tightened to unconditional (#905) |
| Issues #892–894 | LCC+ mnemonic complaints: `beep`/`ding`, `boop`, `who`/`whodis` |
| Issue #896 | Research spike: `--play / -p` compositional mnemonic module |
| Issue #902 | Test suite timing: `npm test` ~18–22s, `npm run test:all` ~81s (closed) |
| Issue #903 | 11 pre-existing test failures filed for investigation |

## Related artifacts

- Issue #898 — errors table implementation
- Issue #890 — tracker: skill-inventory improvements (item A closed via #905)
- Issue #896 — `--play / -p` flag design spike
