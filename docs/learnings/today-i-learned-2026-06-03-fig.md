# Today I Learned — 2026-06-03 (FIG)

Short session: PM tickets (#507, #537, #542) and a follow-up on Elderberry's close-script
fix (#541). Two sharp lessons came out of the day.

---

## 1. Never put real email addresses in public GitHub issue comments

When drafting a bug-report email for review in a GitHub issue, the temptation is to
write a realistic draft — recipient address, sender address, the works. Don't.

GitHub issue text is public and indexed. A real email address in a comment will be
crawled, scraped, and added to spam lists within days. The owner didn't consent to
publishing it there, and there's no "un-ring the bell" — even after editing the
comment, the original content may be cached.

The right approach: use placeholders (`[your email]`, `[Prof. Dos Reis's email]`) in
any draft posted for review. The human fills in the real addresses in their mail client
just before hitting send — the only place where an email address belongs in plaintext.

**The distinction worth remembering:** a repo file intended to become an offline PDF
artifact (like `docs/cuh63-*.md`) is different from inline GitHub content. Author
attribution in a formatted report is normal; the same email pasted into an issue comment
is an exposure. Same text, different channel, very different risk.

---

## 2. Moving a step out-of-band makes its failures invisible

`npm run close` used to delete the worktree synchronously, which caused a spurious
`pwd: error` from npm's own post-run cleanup (#533). The fix (#541) was to spawn the
teardown (`git worktree remove` + `git branch -D` + `git worktree prune`) as a detached
subprocess and let `close.js` exit first — no more `pwd` error.

It works. But the tradeoff is that any failure in the detached subprocess produces no
output. If the worktree removal fails silently, the user has no signal until they run
`git worktree list` and notice the stray.

This is a general pattern: when you defer work to keep the happy path clean, you often
push error visibility off the critical path too. The error doesn't disappear — it just
surfaces somewhere less obvious, or not at all unless you go looking.

**The rule:** whenever a step is moved out-of-band (detached subprocess, fire-and-forget
callback, background job), ask: *how will I know if it failed?* If the answer is
"I won't," that's worth a follow-up check mechanism. (#542 tracks the assessment for
this specific case.)

---

## What landed

| Artifact | Change |
|---|---|
| [#507](https://github.com/avidrucker/lccjs/issues/507) | Email draft posted for OG BUG #13 (long-line silent split); personal email stripped after initial post. |
| [#537](https://github.com/avidrucker/lccjs/issues/537) | Ticket filed: document "no PII in issues/comments" rule in workflow docs. |
| [#542](https://github.com/avidrucker/lccjs/issues/542) | Ticket filed: assess silent-failure risk of deferred worktree removal in close.js. |
| [#545](https://github.com/avidrucker/lccjs/issues/545) | This TIL. |
