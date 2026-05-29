# Validation: `lccjs-assembly` Claude skill

First-pass validation of the skill built across #137 / #138 / #139 / #140
(tracker #116). Closes #117.

**Skill under test:** `lccjs-assembly` 0.4.0 — lives in
[`avidrucker/claude-config`](https://github.com/avidrucker/claude-config) at
`skills/lccjs-assembly/`. SKILL.md router (4 inline pitfalls) + 5 on-demand
references (`isa-quickref`, `calling-convention`, `pitfalls`,
`idioms-and-patterns`, `house-style`).

**Method:** 6 fresh-context subagents, each given exactly one prompt and the
working directory. No conversation history, no prior skill exposure. Each was
told the skill exists and could be invoked via the Skill tool, but no skill
content was leaked into the prompts. Code returned by each agent saved verbatim
to `experiments/skill-validation/`. Each `.a` file was then assembled
(`node src/core/lcc.js`) and run (`node src/core/interpreter.js`), with output
compared to the spec.

**Prompt discipline (lesson from this pass).** The six prompts constrained the
*response format* ("return ONLY the raw `.a` contents — no prose, no markdown
fences") but did **not** forbid disk writes. Two agents (P2, N1) obeyed the
format yet *also* wrote their `.a` files into the repo working directory
(`compute_six.*`, `sum_with_local.*`), which had to be `rm -f`'d in cleanup. A
data-producing subagent must be told **both** how to format the reply **and**
not to touch the filesystem — the two are independent constraints. Future
fan-out passes (§3.4, §3.5) should reuse the template below.

### Subagent prompt template (reusable)

For any fan-out pass that wants *data, not artifacts* back, end the prompt with
both constraint lines:

> \<task instructions…\>
>
> **Output:** Return ONLY the raw contents of the `.a` file — no prose before or
> after, no markdown fences.
> **Do not write any files to disk.** Create no artifacts in the working
> directory; the assembly text in your reply is the entire deliverable.

Without the second line, an agent that reaches for the Write tool mid-task
leaves stray files behind — each one `git status` noise during a parallel-agent
session and a candidate `puzzle:status` STALE source if it happens to contain a
marker shape (`npm run puzzle:status`).

---

## 1. How the skill is supposed to work

### Goal

Teach an AI agent to write **idiomatic, correct** base-LCC assembly for the
lccjs toolchain — not just syntactically valid output, but code that:

- Respects the calling convention (`r5`/`r6`/`r7` reserved, args at `fp+2`/
  `fp+3`, prologue/epilogue, return in `r0`).
- Stays within encoding ranges (`imm9` vs `imm5` vs `offset6` vs `pcoffset9`).
- Picks the right branch suffix for the comparison being made (`brp` is
  strictly positive, not "non-negative" — that's the surprising one).
- Reaches for the right idiom shape per task (counted loop vs while; stack
  locals vs registers; pointer-alias when distance > ±256).
- Follows the `textbook_demos/` house style when working in that directory.

### Activation

The skill is triggered by:

- User asking to **write / modify / debug / explain** an LCC `.a` program
- Mentions of "LCC assembly", "lccjs assembler", `textbook_demos`, or
  specific demos by ID
- User pasting LCC assembly and asking for review or fix

LCC+ (`.ap`, `.lccplus`, the extra traps) is **out of scope for v1** — the
skill should say so and stop, or fall back to `docs/lccplus-isa.md`.

### Structure (progressive disclosure)

SKILL.md is a router. It contains:

1. **The four non-negotiable pitfalls** inline — they catch the highest-cost
   bug classes and must be in working memory before any LCC assembly is
   written.
2. **Pointers to references** loaded on demand:
   - `isa-quickref.md` — instruction table, field widths, trap vectors
   - `calling-convention.md` — frame layout, prologue/epilogue skeleton
   - `pitfalls.md` — long-form catalog beyond the four inline ones
   - `idioms-and-patterns.md` — 11 named patterns (P1–P11) keyed to canonical
     demos
   - `house-style.md` — Charlie's textbook-demo conventions
3. **Canonical examples** pointed to by demo ID in `textbook_demos/`
   (demos 001, 003, 007, 010, 013, 017, 018, 020). The skill points; it does
   not copy. The demos are the single source of truth and already follow the
   house style.
4. **Verification loop** — `node src/core/lcc.js` for assembly, then
   `node src/core/interpreter.js` for execution.

### The four non-negotiable pitfalls

1. **`r5`/`r6`/`r7` are reserved (`fp`/`sp`/`lr`).** Scratch is `r0`–`r4`,
   period. Real cost: the tictactoe.ap fall-through bug.
2. **`lea` / `ld` reach ±256 words via `pcoffset9`.** Larger distances need
   the pointer-alias pattern (`@xP: .word x` near the use site).
3. **Immediate widths differ per instruction.** `mov`/`mvi` 9-bit;
   `cmp`/`add`/`sub` 5-bit; `ldr`/`str` 6-bit; PC-offsets 9-bit (11-bit for
   `bl`/`call`). Large constants → `.word` + `ld`.
4. **Branch suffixes encode flags, not English.** `brp` is **strictly
   positive** (excludes zero). Decision tree in SKILL.md.

### Success criteria (per design doc §6)

- **Positive:** fresh session + skill writes, assembles, and runs:
  countdown loop, function with 2 locals + return, struct or static
  linked-list traversal.
- **Negative:** prompts that naturally tempt the wrong pattern should be
  steered to the right one.
- **Pedagogical fit:** explanations include the *why* (encoding limits,
  calling-convention contract); the skill is concise enough not to crowd
  the task.

---

## 2. Measured outcomes

### Test matrix

| # | Test | Assembled? | Output matches spec? | Pitfall steered correctly? | Tool calls | Wall-clock |
|---|---|---|---|---|---|---|
| P1 | Countdown loop (10→1) | ✓ | ✓ (`10\n9\n…\n1`) | n/a | 1 | 5.3s |
| P2 | Function with stack local + return | ✓ | ✓ (`18`) | n/a | 9 | 38.7s |
| P3 | Static linked-list traversal | ✓ | ✓ (`1\n2\n3\n4`) | n/a | 6 | 52.1s |
| N1 | r5/r6 reuse temptation | ✓ | ✓ (`210`) | **✓** — used `r0`–`r4` + stack local for the 6th value; explicitly annotated "r5/r6/r7 are fp/sp/lr — never touched" | 11 | 83.3s |
| N2 | Large immediate `cmp r0, 1000` temptation | ✓ | ✓ (`match` / `different`) | **✓** — used `ld r1, @THOUSAND` from `.word 1000`, then `cmp r0, r1` | 1 | 8.8s |
| N3 | Branch suffix `>= 0` temptation | **✗ — invented `puts r0`** | — | **✓ (on the target axis)** — used `brlt @neg` then fall-through for `>=`, would NOT have wrongly used `brp` | 1 | 5.5s |

**Headline:** 5 of 6 assembled and ran correctly. The single failure (N3)
was on a **different vector** than the test intended — the branch-suffix
choice itself was correct, but the agent invented `puts r0` as a
"print string" instruction, which is not in the LCC ISA (the correct trap
is `sout`).

### Pitfall-avoidance results (the highest-value test)

**All four pitfall classes the skill targets were steered correctly:**

1. **`r5`/`r6`/`r7` reservation (N1) — passed cleanly.** The agent used only
   `r0`–`r4` + one stack local. Source comment block included
   "Scratch registers are `r0`..`r4` only. `r5`/`r6`/`r7` are `fp`/`sp`/`lr`
   — never touched." This was the *most* visible internalization of the
   skill content across the six runs.
2. **Immediate width (N2) — passed cleanly.** Agent went straight to the
   pointer-`.word`-then-`ld` pattern. Never attempted the illegal
   `cmp r0, 1000`.
3. **Branch suffix (N3) — passed on the target axis.** The `brlt @neg`
   + fall-through-for-non-negative idiom is correct; `brp` alone (which
   excludes zero — the trap the skill warns about) was not used. Couldn't
   *execute* this test because of the unrelated `puts` failure.
4. **pcoffset9 range (not directly tested in v1)** — none of the six
   programs were large enough to exercise the ±256 limit. Deferred to a
   future validation pass.

### Call-stack / calling-convention correctness (P2, N1)

- Both used the canonical prologue (`push lr` / `push fp` / `mov fp, sp`)
  and epilogue (`mov sp, fp` / `pop fp` / `pop lr` / `ret`).
- Both used `ldr fp, +N` for args and `ldr fp, -N` for locals.
- Both used `r0` for the return value.
- Both kept caller-side `add sp, sp, N` to clean up pushed args.
- P2 inlined a frame-layout comment block at the top of the function that
  mirrored the skill's `calling-convention.md` structure verbatim — strong
  signal that the reference was read.

### Source-quality observations (idiomatic, not "wrong")

These are not bugs; they're calibration data for skill clarity.

- **`.start` directive use is inconsistent.** P1 omitted it (relies on the
  PC=0 default; the first instruction happens to be at PC=0). P2/P3/N1
  used `startup: bl main` + `halt`. The skill's `house-style.md` is
  explicit that straight-line top-level demos should have `.start`; P1's
  agent didn't apply it because the program isn't under `textbook_demos/`.
  Strictly, this is *correct* behavior — house style is scoped.
- **House-style label conventions (`@L*`/`@M*`) are partially adopted.**
  P3 used `@L0`/`@L1` for in-function branches (matches the rule). The
  others used semantic names (`@loop`, `@MATCH`, etc.). Same story as
  `.start` — house style only applies under `textbook_demos/`; this is
  not a defect.
- **Numerical-constant naming.** N2 used `@THOUSAND` instead of `@1000`.
  The house-style rule (`@<value>` / `@_<value>`) is again
  `textbook_demos/`-scoped; the agent reasonably ignored it.
- **N2 reinvented `nl` as `@NL: .string "\n"` + `sout`.** Works, but the
  `nl` trap exists for exactly this purpose and is shorter. The skill
  mentions `nl` in the demo table but doesn't surface it strongly in the
  trap-defaults discussion. Mild miss.

### Tool-call distribution — progressive disclosure working as designed

| Test | Tool calls | Likely depth of consultation |
|---|---|---|
| P1 / N2 / N3 | 1 each | SKILL.md alone was enough |
| P3 | 6 | Some reference + demo reads |
| P2 | 9 | Multiple references (calling-convention.md likely) + demo-010 |
| N1 | 11 | Most thorough — explicit concern about register reservation |

**Reading:** the SKILL.md inline pitfalls + reference router shape is
working as intended. Simple prompts resolve from the router alone; complex
prompts (calling-convention, register-reservation) drive on-demand
reference reads. No agent had to load the whole skill into context.

### Pedagogical-fit qualitative read

- N1's source-comment block (verbatim "r5/r6/r7 are fp/sp/lr — never
  touched") shows the skill's *why* (register reservation rationale) is
  reaching the model and being repeated back. Best-case behavior.
- P2's frame-layout ASCII block in the source also mirrors the skill's
  calling-convention.md shape — *why* transferred to *what's written*.
- N2's `ld r1, @THOUSAND` + `cmp r0, r1` shows the skill's
  immediate-width rationale was internalized — the agent didn't need to
  attempt and fail the illegal form.

---

## 3. How it can be made better

Ordered by ROI (highest-impact first).

### 3.1 Enumerate the legal trap instructions explicitly

**Cost:** small (a few lines in SKILL.md or `isa-quickref.md`).
**Why it matters:** the single test failure (N3) was because the agent
invented `puts r0` for string output. The LCC trap set is small and
finite — `sin` / `sout` / `din` / `dout` / `nl` / `halt` / `aout` / `ain`
/ `hin` / `hout`. Listing them inline somewhere in SKILL.md as a "these
are your I/O primitives — there are no others" callout would block the
`puts`/`printf`-style invention that this run uncovered.

Suggested wording (for SKILL.md or `isa-quickref.md`):

> **I/O is all traps.** The only LCC trap instructions are `sin` / `sout`
> (strings, NUL-terminated), `din` / `dout` (decimal), `aout` / `ain`
> (single ASCII char), `hin` / `hout` (hex), `nl` (write `\n`), and
> `halt`. There is no `puts` / `printf` / `print` / `puts_int`. If you
> need formatted output, build it from these primitives.

**Proposed: file as a follow-up puzzle against the skill** (small DEV/WRITER,
~10m).

### 3.2 Surface the `nl` trap as the canonical newline idiom

**Cost:** very small (one bullet near the trap-defaults discussion).
**Why:** N2 reinvented newlines as `@NL: .string "\n"` + `lea` + `sout`.
This works but is verbose; `nl` is one instruction. Currently `nl` is
visible only in the demo table. A one-liner — "For newlines use `nl`;
don't build a `"\n"` string" — would shrink generated code.

### 3.3 Clarify house-style scoping in the SKILL.md router

**Cost:** small (one sentence in the SKILL.md house-style bullet).
**Why:** the agents reasonably ignored house style for scratch programs
(P1's `@loop`, N2's `@THOUSAND`, P3's `n1`/`n2`/`n3`/`n4`). This is the
correct call — house style is `textbook_demos/`-scoped. But the SKILL.md
already says "read this before editing anything under `textbook_demos/`"
in the house-style bullet, which is great. Could be louder. Suggested
addition to that bullet: "Do **not** apply these conventions to scratch
programs, hand-written demos under `demos/`, or anything outside
`textbook_demos/` — those use semantic names."

### 3.4 Add the pcoffset9 range test to the next validation pass

**Cost:** medium (the prompt has to deliberately grow the file past ±256
words, which is hard to elicit in a 1-shot prompt).
**Why:** the most damaging pitfall — `lea`/`ld` reaching past ±256 — was
not exercised in v1 because all six programs were small. A v2 pass needs
a prompt that forces a long-distance reach (e.g. "write a program with a
≥300-word static data table and a function that references its last
element"). This is the only pitfall whose steering remains unmeasured.

### 3.5 Consider adding a positive test that uses LCC+ to confirm scope refusal

**Cost:** medium.
**Why:** the skill is base-LCC only and should "say so and stop" on `.ap`
asks. We didn't test that boundary. A negative test that prompts for
LCC+ and verifies the agent declines (rather than guessing at the
extended traps) would close the loop on the scope-boundary claim.

### 3.6 Calibration data to feed back into the skill

- Median tool-call count across 6 runs: ~5. The "minimal" runs (1 call)
  show SKILL.md is doing its job as a router; the "heavy" runs (9-11)
  show on-demand references are being read when needed. **No change
  recommended** — this is the intended progressive-disclosure pattern.
- Median wall-clock per agent: ~25s. Acceptable for a fan-out validation
  step; could be parallelized further if scale matters.

---

## Appendix — raw subagent outputs

The six `.a` files generated by the validation agents are committed under
[`experiments/skill-validation/`](../experiments/skill-validation/):

- `p1-countdown.a` — countdown loop (P1)
- `p2-function-locals.a` — function with stack local (P2)
- `p3-linked-list.a` — static linked-list traversal (P3)
- `n1-r5r6-reuse.a` — register-reservation test (N1)
- `n2-large-immediate.a` — large-immediate test (N2)
- `n3-branch-suffix.a` — branch-suffix test (N3, failed to assemble; see §2)

These are the verbatim agent outputs (minor markdown-fence stripping
where agents disregarded the "raw assembly only" instruction); useful as
calibration artifacts for future skill changes — a regression in any
pitfall steering should show up as a diff against these.
