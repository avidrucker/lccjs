# Research: an XState statechart for `iinterpreter.js`

**Status:** idea / research task — see `@todo #134` in `TODOS.md` and at the mode-flag
block in `src/interactive/iinterpreter.js`.

**One-line question:** Should the interactive stepping debugger's *modes and UI state*
be modelled as an explicit statechart (via [XState](https://stately.ai/docs)) instead
of the current collection of ad-hoc boolean/string flags?

---

## Why this came up

The core interpreter's fetch–decode–execute is a `switch (opcode)` and should stay
that way — it is the right, fast representation for a CPU inner loop, and a statechart
would add nothing there.

The opportunity is the **interactive debugger**, where "what mode are we in?" is spread
across several independent fields and reconstructed ad hoc at each prompt. Today
(`src/interactive/iinterpreter.js` + the parent `src/core/interpreter.js`) the relevant
state includes, roughly:

| Field | Meaning |
|---|---|
| `running` | main loop alive / halted |
| `debugMode`, `traceMode` | parent interpreter modes |
| `efficientMode` (`-e`) | snapshots disabled → forward-only (no time travel) |
| `colorblindMode` (`-c`) | palette choice |
| `currentIteration` | index into the snapshot log (time-travel cursor) |
| `hasJumped` | branch/jump bookkeeping |
| `stackAnchor`, `memDisplayBase`, `memDisplayRows` | display-pane configuration, mutated by prompt commands (`s…`, `a…`, `m…`) |

Plus inline parsing of prompt commands (`+N` / `-N` step, `0` reprint, `s` stack mode,
`q` quit). N independent booleans imply 2ᴺ implicit states that are reasoned about by
hand; several combinations are meaningless (e.g. "time-travel cursor < current" while
`efficientMode` is on, since no snapshots exist to travel to). A statechart makes the
**active-state set the single source of truth**, so illegal combinations become
unrepresentable rather than defended against.

## Proposed shape (sketch, not final)

A compound machine with an **orthogonal display region** — the key win, because display
configuration is genuinely independent of execution mode and today that independence is
implicit:

```
debugger
├─ exec (region)                  ← exactly one active
│   loaded
│   ├─ running        --halt/breakpoint--> paused
│   ├─ paused         --step(+1)--> stepping --done--> paused
│   │                 --back(-1)--> [guard: !efficient && cursor>0] paused
│   │                 --continue--> running
│   ├─ awaiting-input --char--> (return to prior exec state; history)
│   └─ halted (final)
│   (parent transition: quit -> halted, shared by all children)
└─ view (region, parallel)        ← independent of exec
    ├─ stack-anchor: sp ⇄ fp ⇄ {hex}
    └─ mem-pane: base/rows config
```

Mapping to the current code:

- `running`/`debugMode`/`hasJumped`/`currentIteration` → the `exec` region's active
  state + a small typed context (the cursor), instead of free-floating fields.
- `-e` efficient mode → a **guard** on the `back`/time-travel transitions (no snapshots →
  the guard is false → the transition is simply absent), rather than an `if` scattered
  through the step handler.
- `stackAnchor` / `memDisplay*` → the `view` parallel region; changing the stack anchor
  no longer has to reason about execution state at all.
- prompt commands (`+N`, `-N`, `0`, `s`, `q`) → **named events** sent to the machine;
  the giant prompt-dispatch `switch`/if-chain becomes `service.send({type, ...})`.

## Why XState specifically

- `iinterpreter.js` is JavaScript, so this port's Python `statecharts` library and the
  Clojure Fulcrologic original don't apply directly — **XState** is the idiomatic JS
  statechart library, with the same SCXML lineage. The chart above ports verbatim.
- XState gives **inspectable, serializable** machine definitions and a visualizer
  (stately.ai) — useful for an *educational* project: you could show students the
  debugger's own state machine.
- It separates the machine (pure data + guards/actions) from the React/CLI driver, which
  fits the project's "pure API + thin wrapper" direction already noted in `TODOS.md`.

## Payoff

- **Testability:** drive the debugger with an event list and assert the resulting state
  (`service.getSnapshot().value`) — pure, fast, no filesystem. (This is exactly how the
  statecharts port was validated against the W3C suite.)
- **Decomplecting:** removes the boolean cross-product; invalid mode combinations can't
  be constructed.
- **Onboarding:** one diagram replaces "read five files to learn the modes."

## Risks / scope to evaluate during the spike

- **Dependency weight & build:** XState is a runtime dependency; the project is currently
  near-zero-dep (only `jest`/`dotenv` dev). Is a prod dep acceptable, or should this be a
  tiny hand-rolled state machine following the same discipline (no library)?
- **Hot path:** keep the per-instruction `step()` out of the machine; the chart governs
  *modes/UI*, not per-opcode execution. Confirm no measurable overhead.
- **Snapshot/time-travel coupling:** the `currentIteration` cursor + `snapshot[]` log is
  the trickiest bit to express cleanly as context vs. state.
- **Scope creep:** decide up front whether LCC+ (`src/plus/…`) real-time modes are in or
  out for v1.

## Concrete first step for the spike

1. Enumerate every read/write of the fields in the table above (grep the interactive
   sources) and draw the actual current state graph.
2. Encode the sketch above as an XState machine in a throwaway `experiments/` file (no
   wiring), and a 10-line test that replays `step, step, back, continue, quit` and
   asserts the value at each step.
3. Decide: adopt XState, hand-roll an equivalent, or keep flags — and decompose the
   chosen path into build puzzles.

A worked end-to-end reference exists alongside this project: a faithful SCXML engine in
Python with an identical "events + guards + configuration" model and a test harness
(`~/Documents/Study/Python/statecharts-py`) — useful for borrowing the *modeling
discipline* even though the code is a different language.

## See Also

- `docs/research/ilcc-interactive_lccjs.md` — the interactive debugger feature set.
- `src/interactive/iinterpreter.js` — current implementation (mode flags near the top).
- XState docs: https://stately.ai/docs · W3C SCXML: https://www.w3.org/TR/scxml/
