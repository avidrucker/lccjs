# Who LCC.js Is For

A quick way to find your starting point. LCC.js is an educational
assembler + linker + interpreter for the Low-Cost Computer (LCC) — so its
audience ranges from someone writing their first `mov` instruction to someone
hacking on the toolchain itself. Find yourself below and jump straight to the
material that matters most for you.

> New here and not sure where you fit? The **Learner → Self-taught** path is the
> safest default: install, run a demo, work the tutorial.

| You are a… | Go to |
|---|---|
| Student or self-teacher learning LCC assembly from scratch | [Learner](#learner) |
| Instructor using LCC.js in a course | [Teacher / Educator](#teacher--educator) |
| Tinkerer who wants to write programs, build games, or extend the toolchain | [Hobbyist](#hobbyist) |

---

## Learner

You want to **learn LCC assembly from step 0** — registers, moving data,
printing, labels, control flow, the stack. LCC.js is a good place to do it
because the whole pipeline (assemble → link → run) is on your machine and the
listing files (`.lst`/`.bst`) show you exactly what your source became.

**Start here (everyone):**
1. [Install LCC.js](../README.md#installation) and skim the [Quick Start](../README.md#quick-start).
2. Assemble and run a provided demo to confirm your setup works:
   `node src/core/lcc.js demos/demoA.a` (the `demos/` folder has `demoA.a`
   through `demoZ.a`, smallest first).
3. Work through [docs/tutorial_01_intro.md](./tutorial_01_intro.md) — the
   step-by-step intro to registers, I/O, directives, control structures, and the
   stack.
4. Keep the [LCC ISA summary](./lcc-isa.md) open as a reference while you write.

Then pick the sub-path that fits how you're learning:

### Self-taught learner

No instructor, no grader, no syllabus — just you and the machine. Your biggest
risk is hitting a confusing assembler/runtime quirk and not knowing whether it's
your bug or the tool's. So front-load the gotchas: after the tutorial, read the
[common challenges](#common-challenges-for-first-time-learners) list below so the
usual first-timer surprises (the `mov` immediate range, the small string-escape
set, forgetting `.start`) don't cost you an afternoon. Then write tiny programs
of your own and diff your `.lst` output against what you expected.

### Course student

You're learning LCC alongside a class — likely Professor Dos Reis's LCC textbook.
LCC.js mirrors the original LCC closely, so your coursework transfers directly.
First steps: do the **Start here** path above, then anchor your studying on the
[annotated cuh63 exercise index](./cuh63/README.md) — one doc per textbook
chapter (ch3–ch19) covering the `.a` examples. When your output and the
textbook's disagree, check [parity deviations](./parity_deviations.md): a handful
of differences from the original LCC are intentional and documented there.

---

## Teacher / Educator

You're considering or already using LCC.js to teach assembly. The draw: it's
cross-platform (just Node.js), needs no special hardware, and every step is
inspectable.

**First steps:**
1. Read [onboarding.md](../onboarding.md) for the architecture and workflow, then
   the [tutorial](./tutorial_01_intro.md) to see the on-ramp your students will
   follow.
2. Try the **interactive interpreter** (`ilcc`) — run a program step by step,
   inspecting registers and memory as you go. It's the most effective live-demo
   tool for a classroom. See the [interpreter docs](./interpreter.md) and
   `src/interactive/`.
3. Map your curriculum onto the [cuh63 exercise index](./cuh63/README.md), which
   already organizes example programs by textbook chapter.
4. Review the common-challenges list below so you can anticipate where students
   get stuck.

### Common challenges for first-time learners

The full catalog lives in **[docs/pitfalls.md](./pitfalls.md)** — point students
there. The recurring greatest hits, so you know what to watch for:

- **`mov` immediates are tiny** — 9-bit signed (≈ −256…255); bigger constants
  need `.word` + `ld`, not `mov`.
- **`.start <label>` is the only entry point** — omit it and execution begins at
  address 0, usually not what was intended.
- **Branch suffixes test flags, not English** — they read the flags set by the
  *last* flag-setting instruction, a classic "my `if` does the opposite" trap.
- **`r5`/`r6`/`r7` are reserved** (`fp`/`sp`/`lr`) — using them as scratch
  corrupts the frame the moment a function is called from another.

---

## Hobbyist

You're here for fun or curiosity rather than a course. Four common flavors —
pick whichever fits (you may be more than one):

### Assembly enthusiast

You enjoy low-level, retro-flavored programming and want to write small programs
close to the metal. **First steps:** do the [Learner](#learner) Start-here path
to get fluent, then browse `demos/` and `plusdemos/` for ideas and write your
own. The [LCC ISA](./lcc-isa.md) and [LCC+ ISA addendum](./lccplus-isa.md) are
your instruction menus.

### Toolchain / compiler tinkerer

You care about *how the machinery works* — how source becomes bytes and bytes
become behavior. **First steps:** read the internals docs in pipeline order —
[assembler](./assembler.md) → [linker](./linker.md) → [interpreter](./interpreter.md),
with [lcc.js orchestrator](./lcc.md) tying them together. A notable open frontier
is the LCC+ multi-module toolchain: `src/plus/linkerplus.js` is planned but not
yet written, so the `.ap` linking story is a real place to dig in.

### Game / demo maker

You want to *build* things — games and interactive demos. LCC+ (`.ap` files) adds
non-blocking input, cursor control, screen clearing, `rand`, and `sleep`, which
is enough for real terminal games. **First steps:** run an existing game
(`node src/plus/lccplus.js plusdemos/gameSnake.ap`), read its commented source,
then check the table below for what the platform supports today versus what's
still missing.

#### What LCC.js can do today vs. not yet

| ✅ Works today | 🚧 Not yet (open work) |
|---|---|
| Full base ISA: arithmetic, I/O, strings, control flow, stack (`demos/demoA.a`…`demoZ.a` + tutorial) | Hangman, Tiny Roguelike (planned in [ROADMAP](../ROADMAP.md)) |
| LCC+ interactivity (non-blocking input, cursor, screen clear, `rand`, `sleep`) + a symbolic/stepping debugger (`-d`, interactive `ilcc`, 500k-instruction auto-activation) | Game niceties: pause, win-state, replay, high-score ([gameSnake backlog #143](https://github.com/avidrucker/lccjs/issues/143)) |
| Playable games: Snake, Flappy Bird, Rock-Paper-Scissors, Tic-Tac-Toe (in `plusdemos/`) | Terminal graphics utilities (sprite/tile rendering) |
| Interactive demos: 1D/2D player walk, find-the-fruit, typewriters, char polling | Browser playground / browserified interpreter ([#12](https://github.com/avidrucker/lccjs/issues/12)) |
| Single-file assemble → link → run for both `.a` and `.ap` | Multi-file `.a` source input; `.ap` multi-module linking (`linkerplus.js`) |

> Note: the [ROADMAP](../ROADMAP.md) lists Rock-Paper-Scissors and Flappy Bird as
> "planned," but both already ship in `plusdemos/` — when in doubt, trust the
> `demos/` and `plusdemos/` folders over the roadmap.

#### Pick a starting template

Every game and demo lives in `plusdemos/`. Find the closest one to what you want
to build and start from its source:

**Building blocks (one technique each)**
- `charCycling.ap` — timed single-character loop (`cursor`, `clear`, `sleep`)
- `charTypewriter.ap` / `stringTypewriter.ap` — typewriter-style timed output (`sleep`)
- `charPolling.ap` — non-blocking key polling, echo until Enter (`nbain`)
- `randDeterministic.ap` — reproducible RNG from a fixed seed (`srand` + `rand`)
- `randNondeterministic.ap` — time-seeded RNG, varies each run (`millis` + `srand` + `rand`)

**Movement & rendering**
- `playerWalk1D.ap` — left/right movement with redraw-only-on-move optimization (`resetc`)
- `playerWalk2D.ap` — `wasd` movement on a 2D board (`nbain` + `resetc` + `sleep`)

**Full game loops (least → most scaffolding)**
- `findTheFruitStep.ap` — step movement + collision + random fruit placement (Snake precursor)
- `findTheFruitSlide.ap` — same idea, with continuous/animated movement
- `gameflappyBird.ap` — Flappy Bird: flap/gravity and smooth side-scroll render
- `tictactoe.ap` — turn-based hot-seat: `clear` redraw, single-key `nbain`, table-driven win detection, clean function decomposition, the pointer-alias idiom
- `rock-paper-scissors.ap` — human vs computer: `clear`/`sleep`/`nbain`/`rand`/`srand`+`millis`
- `gameSnake.ap` — full Snake: linked-list body, growth, collision, complete game loop

> Fuller prose descriptions of each demo: [plusdemos/plusdemos.md](../plusdemos/plusdemos.md).


### Open-source contributor

You want to help LCC.js grow — fix bugs, add demos, improve docs, or implement
missing features. **First steps:** read the
[Contributing section of the ROADMAP](../ROADMAP.md#-contributing) and the
[Areas for Improvement](../onboarding.md) in onboarding.md, then browse the
[issue tracker](https://github.com/avidrucker/lccjs/issues). The project uses
Puzzle-Driven Development: small `@todo #N` markers in the source mark bite-sized
tasks — `npm run puzzle:status` lists the available ones. Good starter areas:
expanding linker test coverage, adding instructions, and writing new demos.

---

*Don't see your exact situation? The closest match above will still get you
oriented — and if a section is missing or thin for your use case, that's worth an
[issue](https://github.com/avidrucker/lccjs/issues).*
