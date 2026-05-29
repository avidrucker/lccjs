# Today I Learned — 2026-05-29 (BANANA)

Date: 2026-05-29
Agent: BANANA
Context: A long docs-then-code session. Wrote the persona onboarding guide
(**#175**) and the canonical pitfalls catalog (**#176**), fixed a public→private
link leak (**#177**), added the game-maker demo index (**#178**); spike-refreshed
the "symbolic debugger" epic and closed it by-design (**#13**); locked in
`.e`-path hex-only LST parity (**#156**) and researched the `jmp` suffix mystery
(**#151**); then turned a one-off `brb` glitch into a full branch-mnemonic parity
audit + lock-in test (**#190**) and the one-line fix it surfaced (**#187**).
Worked alongside APPLE and CHERRY the whole time — waited on their conventions,
rebased around their pushes, and cleaned up after my own oversight.

---

## 1. The oracle *runs* what it assembles — so assemble-parity test programs must always terminate

My branch-mnemonic parity test (#190) generated one program per mnemonic as a
**self-branch**: `main: brXX main`. For the mnemonics whose branch was *taken* at
runtime, that's an infinite loop — and because `lcc` (the oracle) assembles **and
interprets** in one invocation, those runs hung and got timeout-killed, surfacing
as **5 spurious byte "mismatches"** plus a baffling even-cc-passes/odd-cc-fails
pattern. The `.e` was actually written correctly at assembly time; the run was the
confound. Switching every program to a **forward branch to a halt**
(`main: brXX done` / `halt` / `done: halt`) — which terminates whether or not the
branch is taken — made the real picture appear instantly: full parity except `brb`.

**The rule:** when a test assembles via a tool that also *executes*, the test
program must halt on every path. For branch/jump parity, branch **forward to a
halt**, never to a self-loop — otherwise runtime divergence masquerades as
assembly divergence.

## 2. One glitch → audit the whole class; the systematic test both proves the bug and guards the rest

I could have just fixed `brb` (it was visibly missing from the dispatch). Instead
I wrote the parity test over **all** branch mnemonics first. That paid off three
ways at once: it went red on *exactly* `brb` (proving #187), it proved `brb` was
the **only** gap (the other 11 are byte-identical to the oracle — bounding the
blast radius), and it left a **regression test for the entire set**. The narrow
fix (#187) and the systematic guard (#190) then closed in one commit.

**The rule:** when you spot one instance of a class bug, the highest-leverage move
is the test over the whole class, written first (TDD). It confirms the instance,
bounds the problem, and regression-guards everything that was already correct.

## 3. Re-assess an "epic" against the current code before decomposing it — it may already be built

#13 ("implement the symbolic debugger") was sitting as a `severity:medium` epic.
The spike's first question wasn't "how do I decompose this" but "what's already
shipped" — and the answer was **12 of 13 acceptance boxes done**, the 13th
resolved by-design (deviation 11), residual = 5 cosmetic report-format deltas. So
the right move was **accept-as-by-design + close**, not decompose into build
puzzles. Decomposing would have manufactured work for a feature that already exists.

**The rule:** a spike on an old/large issue starts by reconciling the issue
against the code *today*. "Epic" is a label, not a measurement — confirm the work
isn't already done (or obsolete) before you architect or decompose it.

## 4. Closing a puzzle means deleting its marker *wherever it lives* — `grep` all paths, don't trust the label

When I closed #156 I removed nothing, because I assumed "no `@todo` marker
exists" — the issue wasn't labeled `pdd-tracked`, and I'd only grepped `src/` and
`tests/`. But a marker sat in **`TODOS.md`**, so `puzzle:status` flagged #156
STALE — and CHERRY found it before I did. Two failure points: the marker lived
outside the code dirs, and the missing `pdd-tracked` label hid that one existed.

**The rule:** before closing any ticket, `grep -rn '@todo #N'` across the **whole
tree** (including `TODOS.md`/`docs/`), not just source — and never infer "no
marker" from the absence of the `pdd-tracked` label. The reconciler is a backstop,
not a substitute for cleaning up on close.

## 5. A public doc must not link into a private repo — and facts get one public owner

`who_lccjs_is_for.md` (public) pointed readers at the `lccjs-assembly` skill's
`pitfalls` reference — which lives in the **private** `claude-config` repo. For
the exact newcomer the doc targets, that's a dead link (#177). The deeper fix
(#176) was a single-source-of-truth call: the pitfall *facts* are properties of
this public project, so the canonical `docs/pitfalls.md` lives **here**, and the
private agent-tuned skill becomes a *derivative that cites it* — never the reverse.

**The rule:** every link in a public doc must resolve publicly. When the same
knowledge exists in a tool repo and the project, the **public project owns the
facts** and each audience-specific rendering cites that one owner; dependencies
point derivative→source, not source→private-derivative.

## 6. `npm run` eats your flags without `--` — and that can silently mis-stamp your identity

Claiming my first worktree I ran `npm run claim 13 slug --as banana`. npm
**swallowed `--as banana`**, the script fell back to `auto` mode, and it assigned
me **`apple`** — another live agent's identity. Caught it in the output, rolled
back the mis-named worktree+branch, and re-ran with the separator:
`npm run claim -- 13 slug --as banana`.

**The rule:** anything after `npm run <script>` needs a `--` separator or npm
keeps the flags for itself. For identity/attribution tooling especially, **read
the tool's echo back** (`agent: apple (auto)` vs `banana (reuse)`) before trusting
it — a swallowed flag here means doing work under someone else's name. (See
CHERRY's lesson 3 — use the project's claim tool — and APPLE's lesson 5 — dogfood
the convention; this is the foot-gun in the convention's CLI.)

---

## What landed

| Issue | Change |
|---|---|
| [#175](https://github.com/avidrucker/lccjs/issues/175) | **Closed** — `docs/who_lccjs_is_for.md`, persona-based "start here" onboarding guide. |
| [#177](https://github.com/avidrucker/lccjs/issues/177) | **Closed** — repointed its pitfalls reference from the private skill repo to in-repo sources. |
| [#176](https://github.com/avidrucker/lccjs/issues/176) | **Closed** — canonical `docs/pitfalls.md` (single source of truth; skill becomes a derivative). |
| [#178](https://github.com/avidrucker/lccjs/issues/178) | **Closed** — per-demo "pick a starting template" index for the game-maker path. |
| [#13](https://github.com/avidrucker/lccjs/issues/13) | **Closed** — spike refresh; feature shipped, 5 cosmetic deltas accepted by-design (parity deviation 12). |
| [#156](https://github.com/avidrucker/lccjs/issues/156) | **Closed** — `.e`-path LST hex-only parity test (negative source-leakage guard) + later cleaned up its stale marker. |
| [#151](https://github.com/avidrucker/lccjs/issues/151) | **Closed** — research: `jmp` condition-suffix mnemonics are a textbook doc error; lccjs is parity-correct with the oracle. |
| [#190](https://github.com/avidrucker/lccjs/issues/190) | **Closed** — full branch-mnemonic OG-parity audit + lock-in test (`assembler.branch-mnemonics.oracle.e2e.spec.js`). |
| [#187](https://github.com/avidrucker/lccjs/issues/187) | **Closed** — `brb` dispatch fix (was in the codes map at cc=6 but unrouted); unblocked `happy-path.a`. |

## Open threads

- **`happy-path.a` now assembles past line 43** thanks to the `brb` fix — worth a
  quick check that it assembles *clean* end-to-end (it may surface the next latent
  issue the `brb` error was masking).
- The two-medium-then-all-low backlog shape: after this session the only
  `severity:medium` open is blocked (#40). A `/puzzle-triage` tomorrow will show a
  low-severity-only actionable queue.

## Related artifacts

- `docs/research/jmp-condition-suffix-mnemonics.md` — the #151 finding.
- `docs/pitfalls.md` — the canonical catalog from #176 (the public single source of truth).
- [TIL 2026-05-29 (apple)](./today-i-learned-2026-05-29-apple.md) — sibling session;
  its lesson 4 (prove your blast radius before alarming) is the flip side of my
  lesson 4 (I *was* the cause cherry flagged — and owning it beat deflecting).
- [TIL 2026-05-29 (cherry)](./today-i-learned-2026-05-29-cherry.md) — its lesson 3
  (use the project's claim tool) and lesson 2 (derive, don't store) frame my
  lesson 6 (the claim CLI's flag-swallowing foot-gun).
