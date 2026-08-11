# LCC.js — The Whole Picture

> A field guide for newcomers + a note-to-self on where to steer next.
> Compiled from the live issue tracker, the EPIC INDEX (#1551), and the repo's own docs
> (`README.md`, `who_lccjs_is_for.md`, `lccjs-unique-features.md`, `status.md`).
> Ticket counts are a roadmap snapshot and drift as the backlog moves.

**At a glance:** 16-bit target ISA · **0** runtime deps · ~11.5k lines of source · 127 test files · 2 toolchains · 15 roadmap epics.

---

## 0x00 — What LCC.js actually is

If you've never touched assembly, here's the whole idea in three sentences:

- **A computer only understands numbers.** "Assembly" is the thinnest human-readable layer on top — instead of `0x1421` you write `add r2, r0, r1`.
- **The LCC ("Low-Cost Computer") is a deliberately small, made-up 16-bit machine** used to *teach* exactly this: how source text becomes machine code, and how a CPU runs it one step at a time.
- **LCC.js rebuilds the original LCC toolchain in JavaScript** — so it runs anywhere Node runs, and (the killer feature) right in a browser with nothing to install.

The original LCC is a C program by Prof. Anthony Dos Reis, written to accompany his textbook. A "toolchain" here means three cooperating programs:

```
file.a  →  Assembler  →  .o / .e  →  Linker  →  Interpreter  →  output
(you    (text becomes  (object /   (joins .o  (runs it,
 write)  machine code)  executable) modules)   step by step)
```

Because it's built for teaching, the whole point is that **every step is visible**: the assembler emits human-readable listing files (`.lst`/`.bst`) that line up your source against the exact bytes and addresses produced, and the interpreter can single-step through execution showing each register change. Nothing is a black box.

---

## 0x01 — The pieces it's built from

Everything under `src/` — the shippable parts, and where each one lives.

| Subproject | What it is | Lives in | Status |
|---|---|---|---|
| **The LCC toolchain (Core)** | Assembler, linker, and interpreter for the 16-bit ISA. The heart of everything else, driven by a top-level CLI orchestrator. | `src/core/`, `src/cli/lcc.js` | shipped |
| **LCC+ (lccplusjs)** | A parallel toolchain that *subclasses* core to add richer pseudo-instructions — `clear`, `sleep`, `cursor`, `rand`, sound. Source is `.ap` → `.ep`. | `src/plus/` | shipped (no linker yet) |
| **ilcc — stepping debugger** | Interactive time-travel debugger: breakpoints, memory/register inspection, reverse-step. A separate execution path from the batch interpreter. | `src/interactive/`, `lcc.js -i` | shipped |
| **Playground & Showcase** | Browser bundle + a CodeMirror 6 language (Lezer grammar) generated into the GitHub Pages site — write and run LCC assembly with zero install. | `src/browser/`, `src/lang-lcc/`, `/showcase/` | shipped |
| **Extra teaching tools** | Disassembler (`.e` back to assembly) and a linker "steps printer" that narrates how object files get joined. | `src/extra/` | shipped |
| **Shared utils** | Cross-cutting concerns kept out of core: `.lst`/`.bst` generation, artifact naming, hex display, typed-error classes. | `src/utils/` | shipped |
| **Oracle differential test suite** | 127 spec files, including a suite comparing JS output *byte-for-byte* against the original LCC binary via committed golden caches. The project's quality backbone. | `tests/`, `src/testrunner/` | shipped |
| **Pure in-memory API** | `assembleSource()`, `executeBuffer()` and friends — throw typed errors, return data, no file I/O. The testable boundary the codebase is refactoring toward. | `docs/api.md` | shipped |

---

## 0x02 — Two toolchains, chosen by file extension

One of the first things that confuses newcomers: **the file extension picks which toolchain runs.**

### Core — LCC (`.a → .e/.o → link → run`)
- The faithful reimplementation of the original.
- North-star is **parity** — matching OG LCC's output exactly, so coursework transfers.
- Has a real linker for combining `.o` modules.
- Entry point: `src/cli/lcc.js`

### Plus — LCC+ (`.ap → .ep`)
- A **superset** that subclasses core to add extended instructions.
- Requires a `.lccplus` directive to produce valid output.
- **No linker yet** — multi-module `.ap` linking is planned, not built.
- Entry point: `src/plus/lccplus.js`

**Why it matters:** a change to core assembler/interpreter behavior can silently break — or be shadowed by — the plus subclasses. The two are wired together on purpose, and the codebase documents exactly where they touch (see `CLAUDE.md` → "Two toolchains").

---

## 0x03 — The single most important thing to grasp

**LCC.js is really two projects wearing one repo.**

1. An **educational toolchain** — assembler, LCC+, debugger, playground.
2. An **agentic software-development laboratory** — a Puzzle-Driven-Development system where multiple AI agents work the backlog concurrently, with velocity telemetry, a skills ecosystem, and its own project-management tooling.

The toolchain is the substrate the lab experiments on. And the balance is lopsided:

```
Product / toolchain epics   ~32 open children   ████████░░░░░░░░░░░░░░░░
Process / meta epics        ~68 open children   ████████████████████████
```

Open child tickets by tier, from the EPIC INDEX (#1551). Agentic orchestration (#1544) alone carries **35**; skills (#1545) another **21**. The project's center of gravity currently sits on the "how we build" side, not the "what we ship" side.

---

## 0x04 — The roadmap: 15 epics, three tiers

Every open initiative rolls up under one of these umbrellas. Counts are open child tickets.

### Product · toolchain features
| Epic | Title | Open children |
|---|---|---|
| #1536 | Core toolchain correctness & oracle parity | 7 |
| #1537 | Interactive debugger — ilcc | 6 |
| #1540 | Architecture / DDD refactoring (pure seams) | 7 |
| #1538 | Verbose errors & `--explain` / diagnostics | 4 |
| #1539 | LCC+ extended toolchain | 3 |
| #1541 | Test infrastructure | 3 |
| #1542 | Web / browser experience (playground & site) | 2 |
| #1543 | **Educational content & curriculum** | **0** |

### Process · the self-running machine
| Epic | Title | Open children |
|---|---|---|
| #1544 | Agentic orchestration & multi-agent workflow | **35** |
| #1545 | Skill ecosystem & cross-provider ports | 21 |
| #1548 | Data analysis, velocity & error telemetry | 9 |
| #1546 | PM-harness migration → pmtools | 7 |
| #1547 | RULES system | 3 |

### Debt · waiting on a human or external party
| Epic | Title | Open children |
|---|---|---|
| #1549 | Human-decision / review queue | 16 |
| #1550 | Upstream comms (cuh63 → Prof. Dos Reis) | 6 |

> The **EPIC INDEX is #1551**. Epics carry the `epic` label + an `area:*` label + an `EPIC:` title prefix; they do no distinct work and earn no velocity row. Narrow cluster trackers nest under the relevant epic. There are also **7 standalone trackers** open (`label:tracker`), several of which orbit the pmtools migration.

---

## 0x05 — What LCC.js gives you beyond the original

Parity is the floor. These teaching-oriented features are the superset OG LCC doesn't have:

- **`--explain` coaching** — on a known error, appends a student-friendly explanation of the concept + a correct form (off by default so plain output stays parity-faithful).
- **"Did you mean?" hints** — typo suggestions on unknown mnemonics/labels, automatically.
- **Browser playground** — the single biggest reach-extender: write and run LCC assembly with zero install.
- **ilcc time-travel debugger** — step forward *and backward*, watch registers/memory change live.
- **Disassembler + linking explainer** — round-trip an executable back to source; narrate how object files get stitched together.
- **Programmatic API** — use the assembler/interpreter as in-memory libraries, with typed errors and structured returns.

---

## 0x06 — Recommendations from here on out

Grounded in what's actually in the backlog today. Ordered by leverage — the first three are about **focus**, the rest about **hygiene**.

### 01 · Feed the reason the project exists — the self-taught learner
**Impact: high · Effort: medium**

Your own tie-breaker doc (`who_lccjs_is_for.md`) ranks the **self-taught learner as audience #1**. Yet the **Educational content & curriculum epic (#1543) has zero open children** — the north-star audience has no active work queued. Everything downstream (the playground, `--explain`, the debugger) exists to serve that learner, but nobody is writing the tutorials, worked examples, or guided paths that turn those tools into actual learning.

> **Do this:** seed #1543 with 3–4 concrete tickets — a "your first program" guided path, a pitfalls-driven mini-course, a playground-embedded lesson. Give the project's stated purpose a live lane.

### 02 · Put a budget on process so it stops out-competing product
**Impact: high · Effort: low**

Process/meta work outweighs product roughly **68 to 32** in open child tickets — and you already have a research ticket (**#1221**) worried about exactly this ("so process doesn't starve product"). The agentic-orchestration machinery is genuinely valuable, but a lab that mostly improves its own lab equipment risks never shipping the experiment.

> **Do this:** close out #1221 with an actual ratio target (e.g. ≥50% of claimed tickets must be product/toolchain) and let the PDD scan or a weekly check enforce it. Cheap to decide, compounding to keep.

### 03 · Collapse the pmtools-migration umbrella sprawl
**Impact: medium · Effort: low**

The move to `pmtools` is spread across **two near-duplicate epics (#1546 and #1591)** plus three trackers (#1456, #1466, #1461) — five umbrellas for one theme, and #1456 is the *only* `priority:critical` umbrella open. Fragmented ownership is how a migration stalls halfway and leaves the repo running two half-wired systems.

> **Do this:** pick one epic as canonical, redline the duplicate closed (per the project's strikethrough convention), and nest the trackers under it so there's a single migration front with a single finish line.

### 04 · Repair the prioritization plumbing (ICE scoring)
**Impact: medium · Effort: low**

**#1558** flags that ~30 open tickets have no ICE score and the score-at-file-time process (#1322) regressed. Un-scored tickets can't be ranked, so "what's most worth doing" quietly degrades into "what's most recent" — corrosive in a multi-agent setup where several agents pull from the same pool.

> **Do this:** back-fill the 30 unscored tickets in one triage pass, then restore the file-time scoring gate so it can't silently regress again.

### 05 · Run a backlog-reduction pass — 135 open is a lot to reason about
**Impact: medium · Effort: medium**

135 open issues against ~11.5k lines of source is a high issue-to-code ratio. Some is healthy (rich research culture); some is likely stale trackers and answered spikes. A large backlog isn't free — it's cognitive load on every triage, and it hides the genuinely ready work (an earlier hunt turned up only *one* grab-and-go bug).

> **Do this:** a timeboxed close-or-merge sweep — collapse duplicate trackers, close spikes that were answered, and consider a soft WIP cap given how many agents claim concurrently.

### 06 · Batch-clear the human-decision queue — you are the bottleneck resource
**Impact: medium · Effort: low**

The Human-decision / review queue (**#1549**) holds **16 blocked items** — design forks (#1405, #1447) and oracle rulings waiting on Prof. Dos Reis. Agents can't unblock these; only you can. Every one looks "in progress" but is actually parked, inflating apparent activity.

> **Do this:** set a recurring 30-minute "decision review" to rule on a batch at once. Fast to run, and it unsticks work agents literally cannot touch.

---

## Don't touch these — they're working

- **Oracle parity testing** — byte-for-byte differential testing against the original binary is a rare, high-discipline quality bar. Guard it.
- **Zero runtime deps** — a teaching tool that installs with just Node is a real feature. Keep resisting dependency creep.
- **Pure-seam boundary** — the "typed errors + return data, no I/O" refactor makes the core testable and embeddable. Worth finishing.
- **Inspectability ethos** — the `.lst` listings and step-debugger are the pedagogical soul. Every new feature should stay legible.
- **Documentation culture** — the `docs/` tree is unusually thorough. It's what makes onboarding — human or agent — possible.
- **The playground** — zero-install browser execution is the widest on-ramp you have. Invest in it before almost anything else product-side.
