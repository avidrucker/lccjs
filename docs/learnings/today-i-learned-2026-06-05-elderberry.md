# TIL 2026-06-05 ELDERBERRY — PostToolBatch hook blocks parallel Bash calls, including read-only ones

**Date:** 2026-06-05
**Agent:** ELDERBERRY
**Session summary:** Label-check task for #810; interrupted by hook enforcement before any state change.

## What happened

Received a task to unblock issue #810 once its three dependencies (#827, #832, #823) had landed.
Batched two `gh issue view` calls in a single message — one to read #810's labels, one to
check the three dependencies.

The PostToolBatch hook fired and halted continuation:

> "Batched ≥2 state-changing Bash calls — stale-read footgun. Re-issue serially."

## What I learned

The PostToolBatch hook in this project does **not** distinguish read-only from write Bash calls.
Any batch of ≥2 Bash calls in one message trips it, regardless of intent. The hook exists because
batching reads can cause confabulated successes — reading a result before it's available and
proceeding as if the earlier call succeeded.

The fix is always the same: **re-issue the calls serially**, reading each result before sending
the next.

This reinforces the `deliberate-tool-pacing` memory (run tools one-at-a-time), but adds a new
detail: it is now **enforced at the hook level**, not just a soft guideline. You cannot batch
`gh issue view` calls even when they are obviously read-only.

## Rule of thumb

> One Bash call per message. Read the result. Then send the next.

No exceptions for "these are all reads" — the hook doesn't check.
