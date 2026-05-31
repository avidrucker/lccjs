# OG-LCC author-name handling & non-interactive `.o` production (#241)

**Role:** RESEARCH · parent: #241 · for a design discussion with **Charlie**.
**Sibling theme:** non-interactive-hostile CLI across the toolchain (LCC+
interpreter off-TTY crash; discovered during #200 linker-fixture work).

## Question

When the core assembler writes a `.o` object module, it prompts on stdin for an
author name (embedded in the `.o`/report header). With no interactive input this
blocks or exits non-zero, so `.o` production in scripts/CI/test-fixtures is
hostile. What is the *right* non-interactive behavior, and — since the `.o`
author field is OG-LCC's convention — **how does OG LCC itself populate it
non-interactively?**

## Method

Clean-room differential test: a fresh temp dir per run (so no `name.nnn` cache
masks the prompt), `demos/m1.a` as the input (it has `.extern sub` / `.global`,
so both tools take the `.o`-producing path). Compared LCC.js
(`node src/core/assembler.js`) against the oracle (`cuh63/lcc`, via `LCC_ORACLE`)
under two stdin conditions: `/dev/null` (no input) and a piped `Tester, Auto`.

## Findings

### 1. OG LCC has NO flag / env / config for the author — only `name.nnn`

This is the headline answer to the issue's "OG-LCC angle." The oracle offers no
`--name`, no `LCC_AUTHOR`, no config file. Its sole non-interactive mechanism is
the **`name.nnn` cache file in the current working directory**: on the first
prompt it writes the entered name to `./name.nnn`, and every later invocation in
that cwd reads `name.nnn` and skips the prompt entirely.

**LCC.js already mirrors this faithfully.** `src/utils/name.js#createNameFile`
checks for `name.nnn` in cwd, returns its contents if present, otherwise prompts
and writes it. The resolution is deliberately cwd-relative (not input-file
relative) "so direct CLI use and oracle-driven tests stay aligned" (comment at
`name.js:10`). So the parity-correct non-interactive recipe **already works
today**: drop a `name.nnn` in the working dir (or run once interactively to
create it), and all subsequent `.o` builds are silent and exit cleanly.

### 2. Clean-room behavior matrix (no `name.nnn` in cwd)

| stdin | LCC.js | Oracle |
|---|---|---|
| `/dev/null` | prompt → `Name cannot be empty` → **exit 1**; **`m1.o` written anyway**, no `.lst`/`.bst`, no `name.nnn` | prompt → `Unable to read name` → **exit 1**; **no artifacts**, no `name.nnn` |
| piped `Tester, Auto\n` | assembles → `m1.o` + `m1.lst` + `m1.bst` + `name.nnn` → **exit 0** | assembles → `m1.o` + `m1.lst` + `m1.bst` + `name.nnn` → **exit 1** |

With a pre-existing `name.nnn` in cwd, **both** tools skip the prompt and assemble
non-interactively — the intended path.

### 3. Two parity deltas surfaced (candidate follow-ups, not in #241 scope)

- **(A) Non-atomic output on name failure.** LCC.js calls `writeOutputFile()`
  (`assembler.js:555`) **before** `createNameFile()` (`assembler.js:561`). So when
  the name prompt fails (empty/EOF), the `.o` is *already on disk* even though the
  process exits 1 — the "wrote a valid `.o` but exited non-zero" symptom in the
  issue. The oracle writes nothing in the same failure. Fix would be to resolve
  the name **before** `writeOutputFile()` so a name failure aborts atomically.
- **(B) Success exit-code divergence.** On a *successful* `.o` assemble LCC.js
  exits **0**; the oracle exits **1**. This looks like a pre-existing,
  separate deviation (not the subject of #241) and should be characterized on its
  own ticket if parity matters here.

## Recommendation (for the Charlie design discussion)

1. **Primary: do nothing to the mechanism — document `name.nnn`.** The
   parity-correct, already-implemented non-interactive path is the cwd
   `name.nnn` cache. The real gap is discoverability: CI/scripts/fixtures should
   seed a `name.nnn`. This matches the oracle exactly and needs no code change.
   (The repo's own test helpers already do this — see `tests/helpers/`.)

2. **Optional ergonomic add (LCC.js-only, non-parity): `LCC_AUTHOR` env var.**
   If a friendlier knob is wanted, honor `process.env.LCC_AUTHOR` (and/or a
   `--name` flag) in `createNameFile` *before* the prompt, falling back to
   `name.nnn` then the prompt. This is a deliberate **extension** beyond the
   oracle (which has no such knob), so it must be documented as an LCC.js-only
   convenience, not parity. Low cost, isolated to `name.js`.

3. **Avoid: silently defaulting to a placeholder when stdin is not a TTY.**
   It diverges from the oracle (which errors), and a wrong/blank author silently
   baked into a `.o` header is worse than a clear failure. If anything, prefer a
   clear typed error on EOF over a placeholder.

4. **Independently of #241, fix delta (A)** — resolve the name before writing the
   `.o` so failures are atomic and match the oracle's all-or-nothing output.
   Worth its own small DEV puzzle.

## Status

Researched and characterized. No code change under #241 (research role). The
non-interactive answer is **`name.nnn` in cwd** (already supported, oracle-faithful);
deltas (A) and (B) are candidate follow-up tickets for the owner to file.

**Evidence:** clean-room runs reproduced above; `src/utils/name.js`,
`src/core/assembler.js:548-576`, `src/core/lcc.js:31-37`.
