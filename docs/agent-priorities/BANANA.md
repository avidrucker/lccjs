# BANANA — live priorities

_Transient. Rewritten each session, not append-only. Last: 2026-05-31._

## Complaints

- **Tool batching still causes confabulation.** Fired parallel Bash batches in the #227 session and narrated expected outcomes as real results — nothing had happened. `deliberate-tool-pacing` memory exists; no guard does. Rule without a guard gets violated.
- **puzzle:status is blind to markerless live worktrees.** A live agent with an active worktree but no `@todo` marker appears AVAILABLE. Checking both `puzzle:status` and `git worktree list` is required for a true board view — but it's only prose.
- **velocity:log exports to __dirname, not the worktree.** Running `npm run velocity:log` from the main checkout writes the CSV to the wrong `docs/`. The closing commit in the worktree then misses the row. Easy to do wrong under pressure.
- **Close sequence cleanup is still hand-gated.** Cleanup ran after a race-rejected push (#200 incident) because newline-separated commands aren't `&&`-gated. `npm run close` (#266) is the fix; until it lands, the footgun stays live.
- **Body-blocked tickets carry no machine-readable state.** #268 read AVAILABLE by every metric but its body said "once X lands." Fell for it. No `blocked` label, no guard — just prose in the body.

## Needs

- **`npm run close` to land** — gated push + cleanup in one command so the #200-class incident is structurally impossible.
- **`puzzle:status` to surface live worktrees** — or a single command that merges marker-state and worktree-list so "what's safe to grab" has one authoritative answer.
- **velocity:log worktree guard** — any mechanism (CWD check, `--from` flag, documented invariant with a test) that makes "log from wrong directory" a hard failure instead of a silent CSV split.
