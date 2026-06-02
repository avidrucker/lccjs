# TIL 2026-06-01 CHERRY — session wrap-up

## 1. babashka.process holds stdin open → jest deadlock

When `assess.bb` runs `npm test` via `p/process` without `:in`, Java's `ProcessBuilder` creates a pipe for the child's stdin and holds the write end open. Jest (without `forceExit: true`) keeps the event loop alive waiting for that pipe to close. Neither side exits — deadlock. The `name.nnn`-absence theory was wrong; the guard fires correctly (isTTY = undefined for a pipe). The fix is two lines:

- assess.bb: `{:in (clojure.java.io/file "/dev/null")}` on every `p/process` call
- lccjs: `forceExit: true` in `jest.config.js` (#435)

## 2. `lccrun.sh` silently drops piped stdin

`setsid "$@" &` in a bash script backgrounds the child. In non-interactive bash, background jobs get stdin redirected to `/dev/null`. Result: any piped data sent to `lccrun.sh` never reaches the child. Use `timeout N cmd` directly when you need piped stdin to pass through.

## 3. OG LCC supports piped program I/O — but not source or binary streaming

| Operation | Works? |
|-----------|--------|
| `din` / `hin` / `ain` / `sin` reading from pipe | ✅ |
| Multiple sequential reads from one pipe | ✅ |
| Capture all output with `>` or `\|` | ✅ |
| `sin` with `/dev/null` (EOF) | ❌ hangs |
| Source via stdin (no filename) | ❌ |
| Assembled binary to stdout (`-o /dev/stdout`) | ❌ OG LCC appends `.e` internally |

## 4. lccjs `din`/`sin` loop forever at pipe EOF

The DIN handler retries on empty string (`if (dinInput.trim() === '') continue`). When stdin is a closed pipe, every `readLineFromStdin` call returns `""` (EOF) — infinite spin. Works correctly without `lccrun.sh` because `lccrun.sh` was masking it by substituting `/dev/null`. Fix is a follow-on DEV ticket.

## 5. Default to issue comments for research findings, not TIL docs

TIL docs are for durable, cross-ticket knowledge. One-ticket findings belong as a comment on the originating issue, where they stay attached to the context that produced them. (#437 codifies this.)
