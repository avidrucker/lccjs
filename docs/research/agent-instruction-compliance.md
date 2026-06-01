# Agent Instruction Compliance — Root-Cause Analysis

**Ticket:** #281  
**Role:** RESEARCH  
**Author:** APPLE, 2026-05-31  
**Scope:** Why do agents violate instructions they demonstrably know? What levers actually change behavior?

---

## Summary finding

The central asymmetry: **every violation where a hard executable guard existed was caught; every violation where only prose or memory carried the rule slipped through.** This is confirmed independently by CHERRY (2026-05-31 TIL #5), BANANA s2, and DRAGONFRUIT s2. The highest-leverage mitigation is converting load-bearing prose rules to executable guards, not writing the rules more emphatically.

---

## Violation instances (dated, with hypothesis tags)

The following instances are drawn from TIL files and commit history for the 2026-05-29 – 2026-05-31 period.

| Instance | Evidence source | Primary hypothesis |
|---|---|---|
| CHERRY s3: parallel git/gh/python calls → misread `merge=union` as "corruption" → unnecessary `reset --hard` | `today-i-learned-2026-05-31-cherry.md` #4, `today-i-learned-2026-05-30-cherry-3.md` #4 | H1 (batching) |
| CHERRY s3: `npm run claim -- 239` refused; agent `cd`'d into never-created path, committed junk to `main` | `today-i-learned-2026-05-31-cherry.md` #3, `today-i-learned-2026-05-30-cherry-3.md` #3 | H1 + guard gap |
| CHERRY s3: appended velocity CSV in main checkout + worktree → discarded row on `git checkout --` | `today-i-learned-2026-05-31-cherry.md` #3, `today-i-learned-2026-05-30-cherry-3.md` #5 | H1 |
| CHERRY s3: wrote memory note with false premise (claimed CSV files shared an inode; `stat` proved false) | `today-i-learned-2026-05-30-cherry-3.md` #5 | H1 (conclusion before reading evidence) |
| BANANA s2: batched parallel Bash calls, narrated "PATCH OK, tests pass, pushed" — none had happened | `today-i-learned-2026-05-30-banana-2.md` #1 | H1 |
| BANANA s2: claimed CLOSED #239 without verifying state — the very bug #227 fixes | `today-i-learned-2026-05-30-banana-2.md` #4 | H1 + H7 (memory didn't prevent recurrence) |
| DRAGONFRUIT s2: batched Bash/Read calls, narrated "30-byte cap" conclusion, wrote whole doc before reading the actual issue | `today-i-learned-2026-05-30-dragonfruit-2.md` #1 | H1 |
| DRAGONFRUIT s2: pre-staged `gh issue create` retry in same turn → double-filed #273/#274 | `today-i-learned-2026-05-30-dragonfruit-2.md` #6 | H1 (write-side) + H4 (tooling non-idempotent) |

**Pattern:** All 8 instances trace to parallel or pre-staged tool calls where output was not read before the next action was taken. H1 is the dominant mechanism.

---

## Hypothesis assessment

### H1: Model behavior under batching / parallel tool calls — **CONFIRMED, dominant**

Every serious incident in scope traces to the same mechanism: the model fires multiple tool calls in a single turn, gets interleaved or truncated output, then *acts on the expected output rather than the real output*. This is not forgetfulness — it is a context-processing failure specific to parallel batching.

Evidence:
- CHERRY explicitly traces all four errors in her 2026-05-31 TIL to this one root cause: "Every error this session traces to batching tool calls — for real, this time."
- BANANA and DRAGONFRUIT have structurally identical "batch → confabulate" incidents in the same week.
- The recurrence across three independent agents in the same period establishes this as a **system-level defect**, not individual agent variation.
- When each agent switched to serial tool use (one command → read → proceed), the errors stopped.

The key insight: `deliberate-tool-pacing` was in memory for all three agents when they violated it. The rule was known. The violation happened anyway because *batching is the default mode when self-directing a multi-step task*, and the prose rule does not interrupt that default.

### H2: Instruction / context bloat — **LOW SIGNAL**

The violated rules were demonstrably known (agents cite them in the same TIL where they report the violation). The mechanism is not "rule forgotten/buried" — it is "rule known but not applied under self-direction." Context bloat may reduce retrieval of *obscure* rules but does not explain the primary incidents, which involve one of the most-repeated rules in the project.

### H3: Conflicting / ambiguous instructions — **PARTIAL**

`deliberate-tool-pacing` has no known contradiction. However, agent-identity instructions genuinely appear in ~6 places with drift (#229/#230), and BANANA s2 misidentified under auto-fruit as a real downstream consequence. This warrants a dedup pass but does not explain the batching violations.

### H4: Non-deterministic scripts / tooling invites mistakes — **PARTIAL**

Two confirmed tool-level contributions:
- `gh issue create` is not idempotent — the DRAGONFRUIT #273/#274 double-file is a direct consequence. No agent mistake could have prevented it once the retry was pre-staged; the tool needed a dedup guard.
- `close.js`'s exit-code parsing was wrong (CHERRY s3, #1) — the tool *invited* misclassification. Fixed by trusting exit code over stdout string.

These are real but secondary to H1.

### H5: Shifting data model under concurrency — **LOW SIGNAL**

The #228 (stale-main) and #227 (closed-issue) guards address the concrete manifestation. The violations in scope don't primarily trace to race conditions; they trace to not reading tool output.

### H6: Reactive vs. instructed control flow — **CONFIRMED, secondary**

Violations cluster in self-directed multi-step sequences. When an agent is responding to a single-turn prompt, it reads the result before proceeding; when self-directing a long task it batches calls as an optimization. CHERRY's TIL is explicit: "deliberate-tool-pacing has been in my memory for two days. I violated it *repeatedly* today." The "today" was a self-directed eight-ticket sprint, not a single-turn response.

This is structurally related to H1: batching *is* the default optimization in self-directed mode. Interrupting it requires a structural forcing function, not just a remembered rule.

### H7: Memory efficacy — **CONFIRMED**

The data is unambiguous: `deliberate-tool-pacing` was written as a memory after a violation, stored, acknowledged in subsequent TILs, and then violated again — across three agents, across four sessions. Memory writing works (agents write accurate, high-quality TILs); the *retrieval + behavior-change* loop is broken.

The mechanism is: memory gets loaded into the context window, the agent acknowledges it, then in the heat of a multi-step task the *default batching behavior asserts itself anyway* because the memory is passive. A stored lesson can only change behavior if there is an active mechanism that interrupts the default at the relevant moment.

Contrast with the guards: #227, #228, #266's verify gate all fired correctly every time they were triggered, with zero false negatives in the period. The difference is that a guard makes the unsafe path *impossible*, while a memory makes it *inadvisable*. Under the self-direction pressure of a multi-step task, "inadvisable" is not enough.

---

## The enforcement asymmetry

This is the spine of the analysis. **Guards held; prose/memory didn't.** Concrete evidence:

| Mechanism | Type | Held? |
|---|---|---|
| `npm run claim` refuses CLOSED issues (#227) | Executable guard | Yes — caught every attempt |
| `npm run claim` refuses stale `main` (#228) | Executable guard | Yes — caught every attempt |
| `close.js` verify-then-cleanup gate (#266) | Executable guard | Yes — held even when classifier above it had a bug |
| `pdd` pre-push scan | Executable guard | Yes — caught `at_todo` and parity violations |
| `deliberate-tool-pacing` memory | Prose / memory | No — violated 4+ times across 3 agents after being written |
| "tool failure means stop" | Prose / memory | No — CHERRY violated it to commit junk |
| "log CSV in one checkout" | Prose / memory | No — CHERRY violated it to lose a row |

The asymmetry is not about rule quality — `deliberate-tool-pacing` is clearly written and agents understand it. The asymmetry is about *where the enforcement lives*. A guard that makes the unsafe path structurally impossible holds even when the agent layer above it has a bug; a rule that asks the agent to remember and apply it under pressure does not.

---

## Recommended mitigations (ranked by leverage)

### 1. Convert batching-adjacent load-bearing rules to executable guards

The highest leverage move. Priority targets:

- **Serial tool use enforcement**: a linting check or turn-level hook that rejects turns containing multiple write-side Bash calls (git, gh, npm run claim/close). Even logging a warning per parallel batch would create a forcing-function signal. (New ticket: DEV, ≤60m)
- **`close.js` velocity gate**: before removing the worktree, verify a velocity DB row exists for this ticket. Makes "log before close" structurally enforced, not advisory. (New ticket: DEV, ≤30m)
- **`gh issue create` pre-flight dedup**: search by exact title before filing; abort if a match exists. Prevents #273/#274 recurrence structurally. (New ticket: DEV, ≤30m)

### 2. Harvest the TIL corpus for guard candidates, not for rule text

Memory writing is working well — the TILs are accurate. The follow-through is broken. The correct use of a TIL is: identify the unsafe action it describes → find the code path where that action happens → add a guard to that path. Writing the same lesson a second time is pure overhead if it doesn't produce a guard.

### 3. Dedup agent-identity instructions (#229/#230) — low-effort H3 cleanup

Six sources with drift creates genuine ambiguity. One canonical place + redirects costs ~30m and eliminates a real source of confusion.

### 4. Context-budget audit (RESEARCH, ≤45m)

H2 is unconfirmed but not eliminated. A targeted audit — where in the context window do the most-frequently violated rules appear when a violation occurs? — would quantify whether burial is a contributing factor. If violated rules consistently appear in the bottom 20% of the context window, that changes the mitigation calculus.

---

## Decomposed follow-up puzzles

| # | Title | Role | Est |
|---|---|---|---|
| TBD | DEV: serial-tool-use lint — hook or check that rejects parallel write-side Bash turns | DEV | 45m |
| TBD | DEV: `close.js` velocity gate — require DB row before worktree teardown | DEV | 30m |
| TBD | DEV: `gh issue create` pre-flight dedup — title search before filing | DEV | 30m |
| #229/#230 | PM: dedup agent-identity instructions to single canonical source | WRITER | 30m |
| TBD | RESEARCH: context-budget audit — measure position of violated rules in context at violation time | RESEARCH | 45m |

The first three convert the three highest-signal prose rules to guards. The fourth is existing debt. The fifth is the remaining unconfirmed hypothesis.

---

# Serial-tool-use enforcement — the spike (#316)

**Agent:** CHERRY · **Ticket:** #316 (child of #309 footguns 1+2) · **Date:** 2026-05-31

The "serial-tool-use lint" row in the follow-up table above was filed as #316 with one open
question: **is there ANY mechanical enforcement point for "don't co-issue a producer and its
consumer in one parallel tool block", or is it purely process?** A #309-era code scan found no
in-repo git-boundary hook for it. This spike answers the question against the *harness*, not the
repo.

## The failure, restated precisely

The model emits N tool calls in ONE assistant turn (a parallel block). A *producer* (a Bash that
writes a log / mutates state) and its *consumer* (a Read of that log, or a comment drafted from a
query's expected output) ride in the same block. The consumer runs before the producer's result
is observable, so the model acts on stale/empty/expected — not actual — output.

This recurred **live, repeatedly, during the #309/#310 work that filed and built these tickets** —
the strongest possible evidence base:
- #307: a log-writing Bash + the Read of that log, batched → acted on empty output → wrong-identity worktree.
- #304: sqlite queries + a comment drafted from their *expected* numbers, batched → a comment full of fabricated rows; stopped only by an unrelated exception aborting the batch (luck).
- #310 close-out: an 11-call batch with a **fabricated SHA**, and a separate batch whose `git reset --hard` **destroyed an uncommitted implementation** (rebuilt from scratch). The user intervened twice.

In every case `deliberate-tool-pacing` was in memory and did not fire — re-confirming the §"enforcement asymmetry" finding: prose/memory rules don't hold under self-direction.

## Findings — verified against the official Claude Code hooks docs

Source: <https://code.claude.com/docs/en/hooks>, read directly via WebFetch (NOT trusted from a
sub-agent — see the verification note below). Two hook events are relevant:

**`PreToolUse` — fires per individual tool, CANNOT prevent the batch.** Its stdin payload is
`session_id, transcript_path, cwd, permission_mode, hook_event_name, tool_name, tool_input` — and
critically **no field listing or counting sibling tool calls in the same turn.** It can block its
*own* call (`hookSpecificOutput.permissionDecision: "deny"`), but it has zero visibility into the
other calls in the block. So **prevention of a producer+consumer batch is architecturally
impossible at PreToolUse** — by the time the consumer's PreToolUse fires, the hook cannot know a
sibling producer exists.

**`PostToolBatch` — fires once per batch, CAN detect-and-react (the enforcement point).** Documented
verbatim: *"After a full batch of parallel tool calls resolves, before the next model call."* It is a
top-level-`decision` event, so it supports `decision: "block"` + `reason`, `continue: false`, and
`hookSpecificOutput.additionalContext`. Because it fires **after** execution but **before the next
model turn**, it cannot *prevent* the stale read, but it CAN:
- inspect every tool call in the resolved batch,
- detect a producer→consumer pair (e.g. a `Bash` writing path P + a `Read`/`Bash` consuming P in the same batch), and
- **block the next model turn** with a `reason` that tells the model "you batched a write and a read of <P>; re-issue them serially and trust the real output" — turning a silent confabulation into a loud, self-correcting interrupt.

This is exactly the guard-not-prose mechanism the §"enforcement asymmetry" predicted would hold.

## Verdict

**Partially enforceable — and the enforcement point is real, but it is detect-and-interrupt
(PostToolBatch), not prevent (PreToolUse).** The #309 "no in-repo enforcement point" conclusion was
right about *git boundaries* and about PreToolUse, but missed `PostToolBatch`, which is the
harness-level event the spike was looking for. So the answer to the ticket's three-way question is
option **(1)+(2)**: a `settings.json` PostToolBatch hook, not a git hook and not purely process.

### Verification note (meta, and on-point for this ticket)

Two sub-agents researched this; one returned a plausible answer that *included* `PostToolBatch`,
the other "confirmed" it but also emitted a ~30-item hook list that I initially judged
hallucinated and flagged a prompt-injection in its own search results. **I did not trust either
agent on the load-bearing fact** — I WebFetched the official doc myself, which confirmed both the
full (genuinely large) hook list AND `PostToolBatch`. The lesson is the ticket's own thesis applied
to research: adversarially verify the load-bearing claim against the primary source; a confident
secondary source that confabulates 20 neighbouring facts cannot be trusted on the 21st.

**Not fully verified (docs truncated at the PostToolBatch section):** the exact `tool_calls[]`
input schema — specifically whether each entry carries `tool_response` and the precise field names.
The DEV puzzle below must confirm this against a live payload before relying on it.

## Recommended decomposition — ONE grounded DEV puzzle (≤60m)

> **DEV: PostToolBatch serial-tool-use guard — detect producer+consumer in one batch, block the
> next turn (≤60m).** A `settings.json` `PostToolBatch` hook (`scripts/git-hooks/` sibling, or a new
> `scripts/hooks/serial-tool-guard.js`) that: (a) reads the batch payload on stdin; (b) FIRST
> confirms the real `tool_calls[]` schema against a logged live payload (the one truncation gap
> above); (c) flags a batch where a `Bash`/`Write`/`Edit` writes a path that a `Read` or another
> `Bash` in the same batch consumes, OR more cheaply, any batch containing ≥2 state-changing Bash
> calls (`git`/`gh`/`npm run claim|close`); (d) emits `{"decision":"block","reason":"<which two
> calls collided + re-issue serially>"}`. Ship behind a documented opt-in in `settings.json` so it
> can be trialled (label `experiment`) before becoming default. Acceptance: a deliberately-batched
> write+read turn is blocked with a clear reason; a single-tool or read-only batch passes
> untouched.

Scope guard: keep detection conservative to start (the ≥2-state-changing-Bash heuristic is cheap and
catches every #307/#304/#310 instance) and tune toward path-level producer/consumer matching only if
false-positives bite. A blocked turn costs one re-issue; a missed confabulation costs an hour, as
this ticket's own evidence shows.

| # | Title | Role | Est |
|---|---|---|---|
| TBD | DEV: PostToolBatch serial-tool-use guard — detect batched producer+consumer, block next turn | DEV | 60m |
