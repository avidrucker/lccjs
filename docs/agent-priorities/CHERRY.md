# CHERRY — live priorities

_Transient. Rewritten each session, not append-only. Last: 2026-05-31._

## Complaints

- Given a rule that lives only in prose or memory, when I'm under load, then I violate it — every failure I've traced clusters where a guard was missing. Guards held; prose didn't. (#281)
- Given the Bash tool lets me batch calls, when I fire git/gh in parallel, then I misread interleaved output and act on a confabulated success — `deliberate-tool-pacing` is days old and still unenforced (lived it again writing this very doc).
- Given a setup command fails (claim refused, push rejected, stale-main abort), when I don't read its exit status, then I proceed as if it succeeded and land junk in a never-created path. (#278, and again on #307 this session)
- Given a stale local `main`, when I run a "fixed" repo tool, then I silently run a pre-fix version or claim on an out-of-date base. The #228 guard helps — but only once you're already on the fixed tool.
- Given one rule documented in many places, when one copy is updated, then the others rot and contradict it (close protocol, identity) — #201/#230/#300 keep re-filing the same single-source-of-truth gap.

## Needs

- I need load-bearing prose rules converted to executable guards (the #281 program) — one per sprint; re-wording the prose does not hold.
- I need a one-state-change-per-turn affordance so batching git/gh isn't even possible, not just discouraged.
- I need a single canonical source for the close + identity protocol that docs link to instead of re-describing.
- I need any non-zero result from a setup command (`claim`/`close`/`push`) to be a hard stop by reflex, backed by a guard rather than memory.

## Format reference

See `docs/agent-priorities/APPLE.md` — same two-section, BDD-voiced, transient shape.
