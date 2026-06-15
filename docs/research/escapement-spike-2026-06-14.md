# SPIKE — Evaluate Tony Kay's `escapement` for regulating lccjs's multi-agent workflow

- **Issue:** #1255 (SPIKE, `area:process` / `experiment` / `severity:low`)
- **Agent:** GRAPE
- **Date:** 2026-06-14
- **Time-box:** ≤60 min (paper spike + doc reads; no live run)
- **Source question (maintainer):** *"Can we convert Tony's escapement library into a usable workflow? If yes, how; if not, why not?"*
- **Repo evaluated:** <https://github.com/fulcrologic/escapement> (README + Guide.adoc on `main`, read 2026-06-14)
- **Builds on:** GRAPE's keyless/`ANTHROPIC_API_KEY` pre-spike comment on #1255.

---

## TL;DR / go-no-go

**Direct answer to the maintainer's question:** *Yes, you can build a usable escapement workflow — but it would **replace** lccjs's agent substrate, not **regulate** the one we run today.*

**Recommendation: QUALIFIED NO-GO** for adopting escapement to govern the **current** workflow, with a narrow optional GO for an exploratory prototype (see [§6](#6-recommendation--conditions)).

The decisive finding: escapement orchestrates **LLM API conversations it spawns itself over HTTP**. Our multi-agent discipline today is a fleet of **interactive Claude Code terminal sessions** governed by git hooks + `claim.sh`/`close` scripts + the `pdd` scan + skill prompts. Escapement is not a governor you bolt on top of those sessions — it is an *alternative runtime* that would run its own (API-billed, or local-Ollama) agents instead of them. That is a strategic substrate swap, not an incremental "add a regulator" change. The ROI of swapping is not justified today.

---

## 1. Current state — what escapement is and what it needs to run

**What it is.** A statechart-driven autonomous coding-agent framework in Clojure, by Tony Kay / fulcrologic. Tagline: *"Escapement regulates LLM agents the way a watch escapement regulates a mainspring."* The control-flow topology is fixed by an explicit Fulcrologic Statechart (SCXML semantics): **the chart, not the model, decides what happens next.**

**Runtime / install.**
- Runs on **Babashka** ("No JVM required"; `bb test` runs the suite). Also embeds in JVM Clojure.
- Install via `bbin`:
  ```bash
  brew install babashka/brew/bbin     # bootstrap (macOS example)
  bbin install io.github.fulcrologic/escapement
  ```
- Run a chart:
  ```bash
  escapement run escapement.examples.hello/agent
  ```
- Useful flags: `--backend api`, `--api-base-url`, `--api-key-env`, `--model`, `--no-tui`, `--api-server <port>`, `--param key=value`, `--resume`, `--debug`.

**Providers / billing (the key blocker, now characterized).**
- Backends are **all HTTP**: Anthropic (`claude-sonnet-4-6` default), OpenAI, OpenRouter, z.ai (GLM, "cheap dev option"), plus **Ollama** (local). Auth via env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ZAI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_API_KEY`).
- **There is no `claude` / `codex` CLI shell-out backend** (confirmed in GRAPE's prior comment from the `src/escapement/llm/` tree). So escapement **cannot piggyback on this Claude Code session's auth or subscription** out of the box.
- **Keyless path:** local **Ollama** (`OLLAMA_API_KEY` = any value, `--api-base-url http://localhost:11434`). This removes the `ANTHROPIC_API_KEY` billing blocker for a spike — at the cost of weaker local models.
- Running agents on Claude at quality = **pay-per-token Anthropic API billing**, which is separate from (and not substitutable by) a Claude Code / Pro / Max subscription.

**Mechanics worth noting (all confirmed from Guide.adoc):**
- **State-bound conversations:** `h/llm-conversation` binds an LLM to a state; "when the chart leaves the state the conversation dies."
- **Two tool kinds:**
  - *Real tools* — side-effecting, dispatched in the worker thread, invisible to the chart: `:fs/read|write|edit|multi-edit|glob|grep`, `:shell/run`, `:web/search|fetch`.
  - *Event tools* — synthesized one-per `:allowed-events`; the LLM calls `event__<name>(args)`, args are **Malli-validated**, and a chart event is posted. "The chart-author defines the LLM's vocabulary."
- **Budgets / self-cancel:** `:max-turns` → `:error.llm.max-turns`; `:budget-ms` → `:error.llm.timeout`; caught by `(transition {:event :error.llm.* :target :recover})`. `:resilience {:max-retries :backoff-ms}` for transient failures.
- **Multi-agent:** parallel regions, each its own worker thread + message history; `h/tell-llm` / `h/tell-other-llm` route `:target`-addressed messages between conversations.
- **Human-in-the-loop:** `:human-input` invocation (`:text|:select|:multi-select|:confirm|:progress|:custom`); answers schema-validated, returned as `:human.answer`.
- **Audit:** JSONL transcript of every request/response/tool-call/transition/checkpoint under `.escapement/<session>/`; full **replay** + `--resume`.
- **Config:** `.escapement.edn` (gitignored; copy from `.example`) holds `:llm/credentials`, `:llm/aliases`, `:llm/preferences`, `:llm/ratings`. Chart nodes reference models by **alias keyword only** (bare strings error).

## 2. Candidate integration model (paper sketch — no implementation)

Our `claim → scope → implement → review → close` discipline maps cleanly onto a chart. Sketch (illustrative EDN, not run):

```clojure
(chart/statechart {:initial :claim}
  (state {:id :claim}
    (h/llm-conversation
      {:id "claim" :system "Claim issue N: verify OPEN, clean main, claim worktree."
       :real-tools [:shell/run]                 ; gh issue view, npm run claim
       :allowed-events [{:event :claim/done :data-schema [:map [:branch :string]]}
                        {:event :claim/blocked}]})
    (transition {:event :claim/done :target :scope})
    (transition {:event :claim/blocked :target :aborted}))

  (state {:id :scope}                             ; spike/scope phase, ≤60m
    (h/llm-conversation
      {:id "scope" :max-turns 12 :budget-ms 3600000
       :real-tools [:fs/read :fs/grep :web/fetch]
       :allowed-events [{:event :scope/ready} {:event :scope/defer}]})
    (transition {:event :scope/ready  :target :implement})
    (transition {:event :scope/defer  :target :close}))

  (state {:id :implement}
    (h/llm-conversation
      {:id "impl" :real-tools [:fs/read :fs/write :fs/edit :shell/run]
       :allowed-events [{:event :impl/done}]})
    (transition {:event :impl/done :target :review}))

  (state {:id :review}                            ; gate: cannot reach :close until pass
    (h/llm-conversation
      {:id "review" :real-tools [:shell/run]      ; npm test
       :allowed-events [{:event :review/pass} {:event :review/reject}]})
    (transition {:event :review/pass   :target :close})
    (transition {:event :review/reject :target :implement}))

  (state {:id :close}
    (h/llm-conversation
      {:id "close" :real-tools [:shell/run]})     ; velocity:log + npm run close
    (transition {:event :close/done :target :done}))

  (final {:id :done}) (final {:id :aborted}))
```

**How the framework's primitives line up with what we already enforce by convention:**

| lccjs discipline (today, by convention) | escapement primitive (enforced by machine) |
|---|---|
| "Don't run `close` before tests pass" | `:review` state gates the only transition to `:close` |
| ≤60 min Yegor cap | `:budget-ms` / `:max-turns` per state → `:error.llm.*` |
| Velocity row + audit trail | JSONL transcript + checkpoints + `--resume` |
| Worktree claim / `puzzle:status` reconciler | `:claim` state with `:shell/run` to existing scripts |
| AskUserQuestion decision points | `:human-input` (`:select` / `:confirm`) |
| "agents stay in their lane" (tool restraint) | per-state `:real-tools` allow-list + Malli event tools |
| Multi-agent fruit fleet | parallel regions + `:target`-routed messages |

So the *vocabulary* is an excellent fit — escapement was built for exactly this "regulate the agent so it doesn't wander" problem, and almost every lccjs convention has a first-class machine-enforced analogue.

## 3. ROI vs. today's convention-based discipline

**What statechart enforcement would buy:**
- **Hard gates instead of soft prompts.** Today "run tests before close" is a skill instruction an agent *can* skip; in a chart it is structurally impossible to reach `:close` without a `:review/pass`. The bounded per-state tool vocabulary is similarly hard, not advisory.
- **Machine-enforced budgets** (the ≤60m cap becomes `:budget-ms`, not self-discipline).
- **Replayable, auditable transcripts** out of the box (richer than the velocity CSV; deterministic resume).
- **Author cost is unusually low *here*:** the maintainer is fluent in Clojure/Fulcro/Statecharts (this repo's whole skill ecosystem — fulcro, datomic, pathom, statechart — is Clojure). Chart authoring is not a foreign-stack tax for *this* author the way it would be for a typical JS shop.

**The friction (why it still doesn't pay off today):**
1. **Substrate swap, not a bolt-on (the crux).** Escapement governs **LLM conversations it spawns over HTTP**. lccjs's "agents" are **interactive Claude Code terminal sessions** (this very session). Escapement has no hook into those — it would *replace* them with its own API/Ollama-driven workers. You don't get to keep the Claude Code fleet *and* add escapement as a referee; you'd be rebuilding the workflow on a different execution model. **This is the "if not, why not".**
2. **Billing / model quality.** Running on Claude = metered Anthropic **API** billing (not the Claude Code subscription). Running keyless = local **Ollama** with weaker models — fine for a demo, questionable for real puzzle work in a 16-bit-ISA toolchain.
3. **Second runtime in a "no-runtime-deps" repo.** lccjs's identity is *"No runtime dependencies; Node ≥18 is all you need."* Escapement adds Babashka + `bbin` + a Clojure chart layer to dev/CI. Even if optional/external, it dilutes that property and complicates headless CI.
4. **The current discipline already mostly works** — and is partly machine-enforced *already* (git hooks block direct-to-main and bad commit types; `claim.sh` stakes worktrees; `pre-push` runs the pdd scan). The marginal gain from chart gating is real but incremental, against a large substrate-migration cost.

**Net:** high *conceptual* fit, low *near-term* ROI, because the only way to "use" it is to migrate the agent substrate.

## 4. Open questions (for a follow-up architect session, *if* this is ever revisited)

1. **Is the goal to replace the Claude Code fleet, or to run escapement agents *alongside* it for a narrow class of tasks?** (Determines everything; today's framing assumed "regulate" which isn't on offer.)
2. **Would a custom `claude -p` (print/non-interactive) provider be worth building?** That's the only ToS-clean way to reuse Claude Code session auth — but it's real Clojure dev work, not config (raised in GRAPE's prior comment, option 4).
3. **Acceptable model tier for real lccjs work on a keyless/local path** — can Ollama-class models actually do assembler/interpreter puzzle work, or is API billing mandatory for quality?
4. **CI/headless viability** — escapement TUI needs a TTY; how do unattended fruit-agent runs behave with `--no-tui` + budgets?
5. **Does machine-gating actually reduce the error classes we log** (the `errors` table), or do our real failures (overstep, wrong-checkout, stale claims) live *outside* what a chart gates?

## 5. Sources

- escapement `README.md` and `Guide.adoc` on `main`, read 2026-06-14 (chart authoring, real/event tools, budgets, providers, `.escapement.edn`).
- GRAPE pre-spike comment on #1255 (HTTP-only `src/escapement/llm/` tree; no CLI shell-out; Ollama keyless path; `claude -p` provider as candidate).
- lccjs `CLAUDE.md`, `docs/claude_workflow.md` discipline, git hooks (`scripts/git-hooks/`), `claim.sh` / `puzzle:status` for the "current state" comparison.

## 6. Recommendation & conditions

**QUALIFIED NO-GO for adoption as a regulator of the current workflow.** Escapement cannot regulate the existing Claude-Code-terminal multi-agent setup; it can only replace it with an API- or Ollama-driven Clojure agent runtime. The substrate-migration cost (new Babashka runtime in a no-deps repo + API billing or weaker local models) is not justified by the incremental gain over today's hook-and-script-enforced discipline, which already works.

**Narrow optional GO** *only if the maintainer wants to explore escapement as a future alternative substrate* (not as a fix for the current one): a single throwaway prototype — author the `claim→scope→implement→review→close` chart above, run it on **local Ollama** (keyless) against one trivial lccjs puzzle — to feel the substrate-swap reality firsthand. Strictly exploratory, non-blocking, time-boxed.

**This would flip to a real GO if:** lccjs decides to move toward a fully autonomous, API-driven agent fleet (away from interactive Claude Code sessions), **and** either a `claude -p` provider is built or metered Anthropic API billing is accepted.

Per #1255's acceptance criteria: **no child tickets, `@todo` puzzles, or decomposition are filed by this spike.** If the maintainer chooses the narrow prototype, that is a *separate* architect/experiment ticket — this spike only produces its inputs.
