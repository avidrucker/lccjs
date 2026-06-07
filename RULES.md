# RULES

These are the rules that bind **every agent on every task**, regardless of what kind of
work it is. They are re-read constantly, so this file is kept lean on purpose.

**Inclusion criterion — what belongs here:** a rule earns a spot in `RULES.md` only if
violating it on a *random* task is both plausible and harmful. That means universal
**safety** (don't destroy the repo or the database, don't leak PII) and universal
**workflow integrity** (worktree, velocity, scope, close protocol) — disciplines that
apply no matter whether the task is code, docs, research, or PM.

**What does NOT belong here:** task-type-specific technical guidance — assembly encoding
quirks, test-harness conventions, fixture formats, toolchain-invocation footguns. Those
are real and still binding *when the relevant work is in front of you*, but they waste
tokens on the ~99% of tasks that never touch them. They live in
[`docs/pitfalls.md`](./docs/pitfalls.md) (assembly/ISA/fixtures) and
[`docs/project-gotchas.md`](./docs/project-gotchas.md) (test-harness/toolchain). See the
relocation note at the bottom.

---

1. I will not run `rm` on the main branch without explicit permission.
2. I will not run `rmSync()` on the main branch without explicit permission.
3. I will never ever ever delete the main branch, or the entire project folder, no matter what, so help me God.
4. I will always work on a worktree, no matter what — including TIL docs, velocity CSV updates, and PM-only tickets. Any git commit to this repo must come from a worktree. There are no small-enough exceptions.
5. I will always log and track my time, no matter what. Every closed ticket gets a velocity row via `npm run velocity:log` before the closing commit.
6. I will not do work I was not scoped/authorized to do, though I will file a ticket if I have a question or concern.
7. I will not delete data from the database unless I am given explicit permission by a human user.
8. I will always close via `npm run close <N>`. I will never `git push` directly to main.
9. Every worktree must be tied to an open GitHub issue. If none exists, I will file one before claiming.
10. At close time, any work discovered but not done — deferred scope, a found bug, or an open design question — must become a ticket before the closing commit. The closing comment cites the ticket number(s) instead of describing the work in prose. Prose in a closing comment is not discoverable; a ticket is. (See `docs/research/followup-trigger-brainstorming.md` for the options considered.)
11. For any tracker ticket (one that says "stays open until children resolve"), I will always file a concrete child issue for the chosen sub-item before doing any work — unconditionally, not just "if the item is large enough." The child issue is where velocity is logged and where the work is tracked. No exceptions for "small" or "obvious" items. *(Formerly Rule 12.)*
12. One deliverable per close. Before writing the close commit, audit `git diff origin/main`: every change must fall within the ticket's stated "Should have." Out-of-scope changes get their own ticket (filed before the close commit), their own worktree, and their own velocity row. Fixes absorbed silently into another ticket's close are invisible to the tracker and corrupt calibration data. (FM-1: bug tax; FM-2: discovery bleed; FM-3: multi-fix bundling — see `docs/research/601-scope-discipline.md`.) *(Formerly Rule 14.)*
13. The commit containing "Closes #N" must ALSO include the velocity CSV export in the same commit. Do not commit the work with "Closes #N" and then commit the CSV separately — `close.js` checks HEAD only, and the second commit becomes HEAD without "Closes #N", breaking the close gate. Recovery: `git reset --soft HEAD~1` un-commits the top commit (changes stay staged); then recommit everything together with "Closes #N" in the message. (#654) *(Formerly Rule 15.)*
14. **TIL entries are an exempt sub-genre** — they are diary-style learning notes, not bug reports, and are intentionally exempt from BDD structure (no Have/Should have/Repro required) and from the `ROLE:` title prefix convention. Required format: `TIL YYYY-MM-DD AGENT — one-line topic` (em-dash, not colon). Rules 4, 5, 8, 9 still apply unconditionally: a GitHub issue is required for the worktree claim, velocity is logged, and the entry is closed via `npm run close`. A corresponding `docs/learnings/today-i-learned-*.md` file must accompany each TIL issue. Hygiene audits and BDD coverage scores must exclude TIL issues from their denominator. (#640) *(Formerly Rule 16.)*
15. I will never post personally identifiable information — email addresses, credentials, API keys/tokens, passwords, phone numbers, or anything that uniquely identifies a real person — in a GitHub issue, comment, or commit message. These channels are public and indexed by web crawlers; a leak is permanent even after deletion. I use bracketed placeholders instead (`[your email]`, `[Prof. Dos Reis's email]`). Repo *files* meant as offline artifacts (e.g. `docs/cuh63-*.md`) may carry real author attribution; inline issue/comment/commit text never does. (origin #537, audit #1007; full policy: `docs/claude_workflow.md` → "What NOT to post publicly") *(Formerly Rule 22.)*
16. I will run a **pre-close error self-audit** before every closing commit: I re-read my session history from the point I claimed the ticket to now, enumerate every loggable error (per the `log-error` triggers — failed tool/Bash/git/`gh`/claim calls, hook blocks, denied permissions, validation failures, even ones I retried and resolved), log any not yet in the `errors` table via `npm run error:log`, and state the outcome explicitly in my closing comment — either *"error self-audit: N row(s) logged"* or *"error self-audit: no loggable errors this session."* `close.js` cannot see the transcript, but I can, so the audit is mine to run; silence is not an acceptable close — an unaudited close silently under-reports the discipline (the #1108 repro: 3 errors went unlogged until a human asked). (#1117)

---

## Numbering & relocation note (2026-06-06, #1059)

This file was trimmed from 22 rules to 15 universally-binding ones; #1117 then added a
16th (display 16 / stable `R021`, the pre-close error self-audit). Seven
task-type-specific rules were **relocated, not deleted** — they remain binding when the
relevant work is in front of you:

| Former rule | Topic | New home |
|---|---|---|
| 11 | Write-path bug → read-back regression test | [`docs/project-gotchas.md`](./docs/project-gotchas.md) |
| 13 | Wrap toolchain invocations in `scripts/lccrun.sh` | [`docs/pitfalls.md`](./docs/pitfalls.md) §6 |
| 17 | `.hex`/`.bin` fixtures use raw 16-bit words | [`docs/pitfalls.md`](./docs/pitfalls.md) §2 |
| 18 | One mnemonic per source line | [`docs/pitfalls.md`](./docs/pitfalls.md) §2 |
| 19 | Cross-runtime stdout tests via `spawnSync({input})` | [`docs/project-gotchas.md`](./docs/project-gotchas.md) |
| 20 | `test.failing` vs `test.skip` | [`docs/project-gotchas.md`](./docs/project-gotchas.md) |
| 21 | Cross-module validation parity | [`docs/project-gotchas.md`](./docs/project-gotchas.md) |

**Stable IDs:** `RULES.json` assigns each rule a stable `R0NN` id that does **not**
renumber when this list is trimmed (see `docs/research/842-rules-json-spike.md`). Cite
rules by their `R0NN` id when you need a reference that survives future edits. Note that
the surviving rules' display numbers above shifted (former 12→11, 14→12, 15→13, 16→14,
22→15); rules 1–10 are unchanged. Older "Rule N" citations in dated `docs/learnings/`
TIL entries refer to the pre-2026-06-06 numbering and are left as historical record.
