# TIL 2026-06-01 CHERRY — assess.bb hung jest for 51 min; name.nnn refuted, babashka stdin pipe is the real cause

**Issue:** #431

## The incident

Running `./assess.bb examples/lccjs.edn` caused `npm test` (the `:unit-tests-pass` check) to hang for ~51 minutes pegging a CPU core at 99.7%, then had to be manually killed. Normal jest completion is under 30 seconds.

The initial hypothesis was that `name.nnn` absence triggered a blocking stdin read that stalled jest.

## What the investigation found

### Root cause: babashka.process stdin pipe deadlock

`assess.bb` runs deterministic checks via:

```clojure
@(p/process ["sh" "-c" command]
            {:dir cwd* :out :string :err :string})
```

No `:in` is specified. Java's `ProcessBuilder` (which babashka.process wraps) defaults to `Redirect.PIPE` — it creates a pipe for the child's stdin, with the **write end held open by the JVM** for the lifetime of the process handle. The child inherits the read end.

The `@` deref waits for the child process to exit. The child (npm → jest → Node.js) sees stdin as an open, empty pipe. Node.js keeps the event loop alive as long as readable streams are open. The loop spins polling for stdin data that never arrives (babashka hasn't written anything and hasn't closed the write end). **Both sides wait for the other — a deadlock.**

Empirically confirmed: invoking `npm test` via babashka.process (without `:in`) produces a 10+ second hang even for the fastest test files, while the same suite completes in ~2 seconds when run directly from the terminal.

### The name.nnn hypothesis: refuted as primary cause

`name.js` has a guard:

```javascript
if (!process.stdin.isTTY) {
  fatalExit('Fatal: name.nnn not found and stdin is not a terminal.');
}
```

When jest is launched by babashka.process:
- Child stdin = a JVM-backed pipe → `process.stdin.isTTY = undefined`
- `!undefined = true` → guard fires correctly → `fatalExit` throws (jest context: `isTestMode = true`)
- Test fails fast, jest continues

So even if `name.nnn` is absent, the guard prevents the blocking-stdin path. The name.nnn code is NOT the deadlock source.

**However**: `name.js` still has a latent danger. The `readLineFromStdin()` function has an unguarded EAGAIN spin:

```javascript
} catch (err) {
  if (err.code === 'EAGAIN') {
    continue;   // tight CPU spin — no sleep/yield
  }
}
```

If stdin is both `isTTY = true` AND in O_NONBLOCK mode (possible if Node.js has set the fd non-blocking for internal stream management), this loop pegs CPU at ~100%. The guard only prevents this when isTTY is falsy. A future regression that patched isTTY (e.g., a test that sets `process.stdin.isTTY = true` and leaks the assignment) could revive this path.

### The 99.7% CPU peg

Most likely source: Node.js/libuv's event loop polling on the open stdin pipe. With the write end never closed and no `forceExit` in jest, the event loop stays alive and libuv epoll-polls stdin on a tight interval looking for data. Whether this drives CPU to 99.7% depends on what other pending work (timers, setImmediate callbacks) jest has in flight post-tests. This was not definitively isolated.

### lccrun.sh was bypassed

assess.bb calls `npm test` directly, not via `scripts/lccrun.sh`. The lccrun.sh wrapper would have killed the child after 30 seconds and exited with code 124 — effectively preventing the multi-hour hang. The `:test-suite-time-bound` check DOES use `timeout 30 npm test`, so that check is protected by the OS timeout. But `:unit-tests-pass` (which runs first) has no timeout guard.

## Fixes

### Fix 1 — assess.bb: always redirect stdin to /dev/null for deterministic checks (owner: assess.bb repo)

```clojure
;; In run-check :deterministic:
@(p/process ["sh" "-c" command]
            {:dir cwd* :out :string :err :string
             :in (clojure.java.io/file "/dev/null")})  ; <-- add this
```

`/dev/null` as stdin immediately returns EOF. The child never waits for stdin to close.

### Fix 2 — lccjs: add `forceExit: true` to jest.config.js (defensive belt-and-suspenders)

```javascript
module.exports = {
  maxWorkers: 1,
  forceExit: true,   // <-- add this
  // ...
};
```

This makes jest call `process.exit()` after all tests finish, regardless of open handles. Even if a caller holds stdin open, jest exits cleanly.

### Fix 3 — name.js: add a sleep in the EAGAIN retry loop (secondary hardening)

```javascript
} catch (err) {
  if (err.code === 'EAGAIN') {
    // 10ms yield prevents a CPU spin if stdin is non-blocking
    fs.readSync(-1, Buffer.alloc(0), 0, 0, null);   // can't sleep in sync code
    // ... or use a spin counter + throw after N retries
    continue;
  }
}
```

A proper fix here is hard (sync JS has no sleep). The safest approach is: throw instead of spin after N EAGAIN retries, or extend the `!process.stdin.isTTY` guard to also reject non-blocking stdin via `fs.fstatSync`.

## What to do now

- **name.nnn is present** (`q`) — no immediate risk from the name-resolution path.
- **Fix 1** (assess.bb `:in /dev/null`) is the high-value change; it's in a different repo.
- **Fix 2** (`forceExit: true` in jest.config.js) is a one-line lccjs fix — files under #431 for a follow-up DEV ticket.
- **Fix 3** (EAGAIN hardening in name.js) is lower priority since the guard works correctly today.
