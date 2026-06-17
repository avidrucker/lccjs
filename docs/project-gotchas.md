# Project Gotchas

Non-obvious foot-guns specific to developing in or with the lccjs codebase. For ISA-level assembly surprises (wrong encoding, runtime traps, range limits) see [`docs/pitfalls.md`](./pitfalls.md). For workflow and tooling preferences see [`docs/do-this-not-that.md`](./do-this-not-that.md).

---

## 1. Assembly instructions must be indented — col-0 is a label

Any token at column 0 that does not end in `:` is parsed as a label by the assembler. Instructions, directives (`.word`, `.string`, `.start`), and traps all require at least one leading space or tab.

**Symptom:** an instruction silently becomes a label; the intended mnemonic disappears from the listing and the program misbehaves or fails assembly with a confusing error on the next token.

```
; Wrong — "add" at col 0 becomes a label, not an instruction
add r0, r0, 1

; Right
  add r0, r0, 1
```

This applies to demo files, test fixtures, and any `.a`/`.ap` source written to exercise the toolchain.

---

## 2. Template literal `.templateContent` is raw source, not the evaluated string

When extracting the body of a JavaScript template literal via regex or string slicing, the result contains raw source characters — escape sequences like `\\\\` appear as four backslash characters, not as the runtime string they represent.

**Symptom:** writing `.templateContent` directly to disk produces a file with literal `\\n`, `\\t`, or `\\\\` sequences rather than the intended whitespace or single backslash.

**Fix:** evaluate the content before writing:

```js
const runtime = new Function('return `' + body + '`')();
```

Or use a proper AST tool (e.g. `@babel/parser`) that handles escape resolution.

---

## 3. Write-path bugs need a read-back regression test through the real write surface

When fixing or reviewing a write-path bug in a test harness, add a regression test that
**reads back what was written through the actual write surface** (e.g. `virtualFs`) and
asserts the bytes are intact.

**Why:** a test that only checks the producer's in-memory state leaves the write path
dark — serialization/encoding bugs slip straight through. Read-back through the real
surface is the only thing that catches them.

*(Was `RULES.md` rule `golden-walrus` — relocated #1059, origin #548.)*

---

## 4. Cross-runtime stdout tests: drive lccjs via `spawnSync({input})`, not `inputBuffer`

For tests that compare lccjs stdout against another runtime (C, oracle, etc.), drive
lccjs via `spawnSync` with `{ input: stdinString }` — **not** via `lcc.inputBuffer`.

**Why:** `inputBuffer` triggers "simulated" mode in `readLineFromStdin()`, which echoes
each input line back through `writeOutput`, producing extra output that C programs never
emit — causing false parity failures on any demo that reads stdin. Piped stdin takes the
non-simulated path and avoids that false echo. It is still subject to documented
runtime-parity deviations such as `din`/`hin` EOF handling and `sin` after a retained
line-input newline (#1415; see `docs/parity_deviations.md` §29).

*(Was `RULES.md` rule `lilac-civet` — relocated #1059, origin #760.)*

---

## 5. Jest: `test.failing` for fixable bugs, `test.skip` only for by-design incompatibility

Use `test.failing` for tests covering **confirmed bugs with open fix tickets** — the test
runs, documents the broken behavior, and alerts when the fix lands (it flips to a test
failure, signalling the annotation can be removed). Use `test.skip` only for tests that
are fundamentally incompatible by design (e.g. platform-specific behavior that can never
match). **Never** use `test.skip` to silence a test for a fixable bug.

*(Was `RULES.md` rule `ochre-quokka` — relocated #1059, origin #761.)*

---

## 6. Cross-module validation parity — test every copy together

Any input-validation pattern (character class, regex, or predicate) that appears in more
than one module — assembler, formatter, tmLanguage grammar, or elsewhere — must be
covered by a test that runs the same edge-case inputs against **every** copy. Divergence
is only detectable when all copies are exercised together.

See `tests/new/grammar.unit.spec.js` (label edge-case tests from #850 are the concrete
example). **Known gap:** the formatter's label regex (`/^([A-Za-z_]\w*)\s*:(.*)/s` in
`src/utils/formatter.js`) does not cover `@`- or `$`-prefixed labels — tracked in #798.

*(Was `RULES.md` rule `violet-marmot` — relocated #1059, origin #850/#870.)*

---

## 7. Adding an npm dep inside a worktree — don't `--ignore-scripts`

A freshly-claimed worktree (`<repo>/.claude/worktrees/<agent>-issue-N/`) has **no `node_modules`** of its own — Node resolves modules from the **main checkout's `node_modules`** via parent-directory walk, which is why `npm test` works in a worktree with no install. Most worktree work needs no `npm install` at all.

If you *do* add a dependency in a worktree, `npm install <pkg> --save-dev` builds a full, separate `node_modules` there. **Do not add `--ignore-scripts`** (tempting, to skip Playwright's browser download): it also skips `better-sqlite3`'s native build (prebuild-install / node-gyp), leaving its binding unbuilt. The install exits 0, but the next full `npm test` then fails ~16 db-touching suites with `Could not locate the bindings file` — which looks like a regression but is not. Remedy: `npm rebuild better-sqlite3`.

`node_modules` is gitignored: only `package.json` + `package-lock.json` are committed, and `npm ci` (CI) builds natives from them. But a **stale main `node_modules` fails `npm test` until you run `npm install` on main** — so after a dep lands, sync the main checkout (cf. #1214, a declared-but-not-installed devDep that reddened the suite).

*(Origin: #1252 jest-cucumber dev-dep; errors-table row 134. Filed as #1256.)*

---

## 8. Flag-setting `error()` vs throwing `raiseRuntimeError()` — opposite control-flow contracts

A class can have two error-reporting calls that look interchangeable but are not:

- A flag-setting `this.error(msg)` sets `this.running = false` and **returns** — callers
  typically follow it with a `return;` to bail out of the current function.
- A throwing `this.raiseRuntimeError(typedError)` sets `running = false` and ends in
  `throw error` — control leaves the function via exception, so any following `return;` is dead.

Swapping one for the other is therefore **never a local edit**: it changes how control
leaves the function, putting the *callers* inside the change surface. A throw needs a
catcher. The interpreter's load path models this — `loadExecutableBuffer` raises typed
errors and its caller (`interpreter.js` ~`:555-561`) wraps the call in `try/catch` to
forward `error.explainKey`. When converting bare flag-setting error sites to a throwing
reporter, audit the call chain for a catch and add one (route it through the existing error
funnel, e.g. `InterpreterPlus.handleRuntimeError`) rather than only editing the error sites.

**Status on the interpreter:** the `Interpreter` class now has *only* the throwing
`raiseRuntimeError` — its old non-throwing `error()` was removed (#1301) once #1273 retired
its last caller, so this footgun is structurally eliminated there. The lesson still applies
to `Assembler` and `Linker`, which retain their own non-throwing-then-throw `error()`
reporters (different methods, with `explainKey` support).

*(Origin: #1273 — converting `InterpreterPlus.loadExecutableBuffer`'s six file-format
errors; the `:165` caller needed a new try/catch the ticket hadn't mentioned. The dead
`Interpreter.error()` it exposed was removed in #1301.)*

---

## 9. `REPORT_MULTI_ERRORS` is assembler-only — the linker is always fail-fast

The assembler has a module-level switch `REPORT_MULTI_ERRORS` (`assembler.js:40`,
a `const`, currently `false`). When `false`, `Assembler.error()` logs the error,
records it, then calls `abortAssembly` immediately — so assembly stops at the
**first** error. The dormant `true` path would instead collect errors in
`this.errors[]` and keep going (multi-error reporting).

The **linker has no equivalent**. `Linker.error()` (`linker.js:error()`) logs
(unless `silent`) and then **unconditionally `throw`s** a `LinkerError`; its
callers in `processModule` ("Multiple entry points", "More than one global
declaration", etc.) hit it mid-loop, so the first error aborts the whole link.
There is no flag, no `errors[]` accumulation, no multi-error mode.

**Why this matters:** today the two halves *agree* — both report exactly one
error and stop — and both deliberately match the oracle, which reports one error
at a time (see `parity_deviations.md §8` for the linker's matching exit-0
behavior). The asymmetry is **latent**: if someone flips `REPORT_MULTI_ERRORS`
to `true` to get multi-error assembler output, the linker will *not* follow, and
the assembler will also diverge from the oracle. So the flag is intentionally
off, and adding multi-error reporting is a both-halves (and parity) decision, not
a one-line assembler toggle. This is distinct from §8 (which is about
*flag-setting vs throwing* control flow); here both `error()`s throw on the first
error — the gotcha is the **missing multi-error symmetry**.

*(Origin: #1389 — verify-first triage of the claude-bugs-audit P2 note under
tracker #1180. Behavior confirmed intentional and oracle-matching; documented
rather than changed.)*

---

## 10. Backticks / `${` inside `build-site.js` embedded scripts close the template literal early

`scripts/build-site.js` embeds whole browser scripts as JavaScript **template-literal
constants** — `HEAD_SCRIPT` (`:282`), `JS` (`:303`), and the sandbox `playgroundScript`
(`:617`). Everything between those backticks is *inside* a template literal, including any
comments and string contents you add while editing.

**Symptom:** a stray backtick `` ` `` or unescaped `${` *anywhere* in that span — even inside
a `//` comment — terminates the literal at that character. The rest of the intended script
becomes stray JS, and you get a `SyntaxError: Unexpected identifier` (or similar) that only
surfaces at `npm run build`, far from the edit and with a misleading location.

```js
const JS = `
  // Wrong — the backtick-quoted token closes the JS literal here:
  // toggle the `sel` class on the active tab
  ...
`;

const JS = `
  // Right — plain quotes (or none) in comments inside embedded scripts:
  // toggle the 'sel' class on the active tab
  ...
`;
```

**Rule:** when editing these embedded browser scripts, do not use backticks or unescaped
`${` inside comments or strings within the literal. Use plain quotes in comments; escape a
genuinely needed `` \` `` / `\${`. This is distinct from §2 (which is about *extracting* a
template literal's raw source); here the hazard is *authoring* inside one.

*(Origin: #1334 — a backtick-quoted token in an added comment closed the literal and broke
`npm run build`; self-resolved, error row logged. Referenced from the 2026-06-15 BANANA TIL.
Documented per #1409.)*

---

*(More entries to be added as they surface.)*
