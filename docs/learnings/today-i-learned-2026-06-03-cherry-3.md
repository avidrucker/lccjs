# TIL 2026-06-03 — CHERRY s3

**Context:** A session that added the write-path test rule to RULES.md (#548),
refreshed stale items in ROADMAP.md (#27), and wrote the LCC+ off-TTY
interactive contract spec (#272), deciding the `nbain` idle-player vs `bp`
fail-fast postures.

---

## `npm run close` requires "Closes #N" in HEAD — commit ordering matters

**What happened:**

Closing #548 went like this:

1. Feature commit: `docs: add write-path test rule to RULES.md` — message
   included `Closes #548`.
2. Then I ran `npm run velocity:log`, which auto-exported the CSV.
3. Committed the CSV separately: `data(velocity): log row for #548`.
4. Ran `npm run close 548` → **rejected**: "HEAD commit does not reference
   'Closes #548'."

The feature commit had the close reference, but the velocity CSV commit was
now HEAD — and the close script checks HEAD, not the full log.

The same thing happened closing #272.

**What I learned:**

The `npm run close` guard is strict: the close reference must be in the
**HEAD** commit at the moment `close` is called. It doesn't scan the recent
log; it reads only HEAD. Any commit made after the closing commit — even a
purely mechanical one like exporting the velocity CSV — breaks the check.

**The fix I used (both sessions):** an empty commit to re-surface the
reference:

```bash
git commit --allow-empty -m "close: finalize #N — <short description>

Closes #N"
npm run close -- N --skip-keyword-check
```

This works, but it's a workaround. It leaves an extra empty commit in the
log that wouldn't need to be there.

**The better approach:** commit the velocity CSV *in the same commit* as
"Closes #N", or run `velocity:log` and stage the CSV *before* the closing
commit so everything lands together:

```bash
# 1. feature work committed (no Closes #N yet)
git commit -m "docs: ..."

# 2. log velocity — CSV is now staged
npm run velocity:log -- '{...}'
git add docs/puzzle-velocity.csv

# 3. ONE closing commit that includes the CSV and the Closes reference
git commit -m "docs: ... + velocity row

Closes #N"

# 4. close succeeds — Closes #N is in HEAD
npm run close -- N
```

**The rule:**

Run `npm run velocity:log` and stage the exported CSV *before* writing the
closing commit, so the CSV and the `Closes #N` reference land in the same
HEAD commit. Never commit the velocity CSV after the closing commit; if you
do, you need an empty commit to unblock `npm run close`.

---

## `bp` is a synchronization point; `nbain` is a poll — they have different off-TTY contracts

**What happened:**

While writing the #272 contract spec, I had to decide whether to treat
`nbain` and `bp` the same off-TTY. Both are "interactive" traps, but they
need different postures.

**What I learned:**

`nbain` (non-blocking input poll) already returns `0` ("no key pressed") when
the `keyQueue` is empty. Off-TTY the queue never fills, so it returns `0`
forever. This is semantically correct — an idle player who never presses
anything is exactly what "no key" means. The loop can run forever, but that is
a valid interpretation, not a bug.

`bp` (breakpoint trap) calls `process.stdin.once('data', …)` to resume on a
keypress. Off-TTY, `data` never fires → `this.running` stays `false` → the
non-blocking loop never restarts → the program **hangs**. There is no coherent
"idle" interpretation for a breakpoint: a synchronization point that requires
a response can never be satisfied when there is no input source. The program is
stuck, not idle.

**The rule:**

A trap that *polls* for input (returns "nothing" on an empty queue) degrades
gracefully off-TTY. A trap that *blocks* waiting for a specific event can never
make progress off-TTY and needs a guard. When designing new interactive traps
for LCC+, ask: "does this trap have a coherent 'no input available' return
value?" If yes, idle-player semantics apply. If not, add an off-TTY early-exit
guard.

**Authority path:** The contract is now in
`docs/research/lccplus-off-tty-interactive-contract.md` (#272). The `bp` guard
implementation is tracked as DEV puzzle #561.
