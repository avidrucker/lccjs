# Research: trunk-based push vs PR/merge-queue (#355)

**Conclusion: stay trunk-based (Option A). Document the enforcement trigger.**

## What the GitHub API actually shows

```
enforce_admins:            { enabled: false }
required_pull_request_reviews:
  required_approving_review_count: 1
  require_code_owner_reviews:      true
required_status_checks:
  enforcement_level: "off"
```

The PR-review rule exists but `enforce_admins: false` means the repo owner
(`avidrucker`) is explicitly exempt. The "Changes must be made through a pull
request" warning on every push is advisory only — it fires because the rule
*exists*, not because it *blocks* the push. The push succeeds regardless.

This is the key fact: **the protection is not currently a threat to trunk-based
closes.** The situation has to actively get worse (owner enables `enforce_admins`)
before anything breaks.

## Why Option B (PR per close) is not worth the switch now

### 1. close.js Guard 2 breaks on squash

`close.js` verifies the close by checking that `HEAD`'s SHA appears in
`origin/main` after the retry loop:

```js
// shouldCleanup() — only teardown if HEAD is reachable from origin/main
const onRemote = sh(`git branch -r --contains HEAD`, true);
return onRemote && onRemote.includes('origin/main');
```

A `gh pr merge --squash` produces a *new* commit SHA on `origin/main` —
the local HEAD SHA is no longer in `origin/main`'s history. Guard 2 would
conclude the push failed and refuse to tear down the worktree. Fixing this
requires the close tool to distinguish "squash merge landed" from "push
rejected", which is a non-trivial rewrite (fetch + log search by commit message
or PR number).

### 2. SHA instability returns in a new form

Issue #3 in `docs/worktree-multi-agent-findings.md` documents that
`closed_commit` SHA is unreliable under concurrent rebases. Squash merges
rewrite the SHA *by design*. The velocity-log entry for `closed_commit` would
always be wrong unless derived post-squash — adding a second async lookup step.

### 3. Adds a GitHub API round-trip to every close

`gh pr create` + `gh pr merge` adds two GitHub API calls to the close path.
These can 50x/timeout independently of the push. The current retry loop handles
`git push` failures gracefully; adding API calls introduces a new failure mode
with no equivalent retry logic in the tool.

### 4. The tooling overhead is not offset by any current benefit

Branch protection on this repo is owner-bypassed. There is no CI gate, no
review requirement for the owner, no merge queue configured. The PR flow would
add overhead without gating anything that isn't already gated by `npm run close`
itself (pre-push hook, Guard 1, Guard 2, marker check, velocity-row check).

## Why Option C (merge queue) is further overkill

Merge queues exist for high-throughput teams where multiple PRs compete for the
same merge slot. The close tool's retry loop (`fetch → rebase → push`, up to 5
attempts) already solves concurrent-push serialization for trunk-based flow.
Adding a GitHub merge queue would duplicate that logic at the remote level, with
added setup cost and no new safety.

## Trigger condition: when to re-evaluate

Switch to Option B **only if** `enforce_admins` is set to `true`. That change
produces an immediate, loud failure (403 on every `npm run close` push step) —
not a creeping or silent breakage. It's observable and actionable.

When that happens, the bounded migration is:
1. After committing `Closes #N`, push the fruit branch: `git push origin HEAD`
2. Open a PR: `gh pr create --title "Closes #N" --body "…" --base main`
3. Auto-merge: `gh pr merge --squash --auto --delete-branch`
4. Patch `close.js` to derive the landed SHA from `gh pr view` rather than
   local HEAD, then verify via `git fetch + git merge-base --is-ancestor`.

This is a bounded, 30-40 line change to `close.js` that can be done as a single
ticket when the trigger fires.

## Decision

**Option A — stay trunk-based.**

Document this trigger condition in `docs/worktree-multi-agent-findings.md`
so the next session doesn't re-research it.

No code changes needed. Close #355.
