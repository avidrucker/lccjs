<!-- AUTOGEN'D FILE, DO NOT EDIT MANUALLY/DIRECTLY -->
<!-- Generated from RULES.json by `npm run rules:render`. Edit RULES.json, then re-render. -->

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
10. At close time, any work discovered but not done — deferred scope, a found bug, or an open design question — must become a ticket before the closing commit. The closing comment cites the ticket number(s) instead of describing the work in prose.
11. For any tracker ticket, I will always file a concrete child issue for the chosen sub-item before doing any work — unconditionally, not just 'if the item is large enough.' No exceptions.
12. One deliverable per close. Before writing the close commit, audit `git diff origin/main`: every change must fall within the ticket's stated 'Should have.' Out-of-scope changes get their own ticket, worktree, and velocity row.
13. The commit containing 'Closes #N' must ALSO include the velocity CSV export in the same commit.
14. TIL entries are an exempt sub-genre — diary-style learning notes, not bug reports. Exempt from BDD structure and from the ROLE: title prefix. Required format: `TIL YYYY-MM-DD AGENT — one-line topic`. Rules R004, R005, R008, R009 still apply unconditionally.
15. I will never post personally identifiable information — email addresses, credentials, API keys/tokens, passwords, phone numbers, or anything that uniquely identifies a real person — in a GitHub issue, comment, or commit message. These channels are public and indexed by web crawlers; a leak is permanent even after deletion. I use bracketed placeholders instead ([your email], [Prof. Dos Reis's email]). Repo files meant as offline artifacts (e.g. docs/cuh63-*.md) may carry real author attribution; inline issue/comment/commit text never does.
16. I will run a pre-close error self-audit before every closing commit: re-read my session history from claim to now, enumerate every loggable error, log any not yet in the errors table via `npm run error:log`, and state the outcome explicitly in the closing comment ("error self-audit: N row(s) logged" or "error self-audit: no loggable errors this session").
17. I will not claim a ticket whose active work I estimate at over 60 minutes without first decomposing it into child tickets each estimated at 60 minutes or less; the parent then becomes an umbrella tracker, worked only through its children and earning no velocity row of its own. Exception: a human may explicitly approve taking it whole, noted in the ticket.
18. I will not file implementation tickets for, or claim, a large or fuzzy ticket (no clear code site or scope) without first gating it behind a `spike`-labeled session of 60 minutes or less that produces scope, code sites, and ROI. Exception: a human may explicitly approve proceeding without a spike, noted in the ticket.
19. I will never claim or work an epic/tracker issue as a unit of work; only its bounded child tickets are claimed and worked, and the epic stays open until its children resolve. It earns no velocity row of its own.

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
