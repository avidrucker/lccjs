# ILCC Dashboard Feature Audit (#700)

**Date:** 2026-06-04 · **Agent:** ELDERBERRY  
**Reference:** https://hydra.newpaltz.edu/students/odonnela6/ilcc/dashboard

## Note on ILCC dashboard data

The ILCC dashboard is a JavaScript SPA; automated fetch returns only the shell
(`"client"`). The feature list below is compiled from the issue reporter's direct
observations. A human should verify and extend this list on next visit to the URL.

---

## ILCC Dashboard — features inventory

### Implemented

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Code editor** | Full-screen or paned text input area for writing LCC assembly |
| 2 | **File naming** | Can assign a name to the current file |
| 3 | **Tabs** | Tab-based navigation, likely for multiple open files |
| 4 | **Terminal / output window** | Displays program stdout after execution |
| 5 | **Run / execute** | Assembles and runs the code (implied by output window) |
| 6 | **Code auto-format / prettify** | Formats / re-indents source code |
| 7 | **Share as link ("codepen"-style)** | Encodes code in a URL for sharing |
| 8 | **Download as `.a` file** | Exports the current source as a `.a` assembly file |

### Not yet implemented (confirmed absent)

| # | Feature |
|---|---------|
| 1 | **Syntax highlighting** — editor displays plain text, no token colouring |

### Unknown (requires human verification)

- Line numbers in the editor
- Interactive stdin (typing input while program runs vs. pre-supplied)
- Assembly error display (inline or in the terminal)
- Multiple independent file buffers vs. named single buffer
- Dark / light theme toggle
- Keyboard shortcuts (Run, Format, etc.)
- Save to browser localStorage / IndexedDB
- LCC+ (`.ap`) support
- Linker / multi-file support

---

## lccjs web offerings — current state

lccjs has three distinct browser-facing components at different maturity levels.

### A. Showcase page (`docs/showcase/index.html`)

A static demo page served under `docs/` and included in the GitHub Pages site.

| Feature | State | Notes |
|---------|-------|-------|
| Code editor (textarea) | ✅ | Playground section: editable `<textarea>` |
| Syntax highlighting | ✅ | Shiki v1 + custom LCC TextMate grammar (`docs/lcc.tmLanguage.json`); live 150ms debounce |
| Side-by-side highlight preview | ✅ | Editor on left, highlighted read-only view on right |
| Tab → 4 spaces | ✅ | `keydown` Tab override in playground |
| Static code samples | ✅ | demoO.a, demoF.a, rock-paper-scissors.ap rendered highlighted |
| LCC+ (`.ap`) sample | ✅ | rock-paper-scissors.ap displayed |
| Run / execute | ❌ | No button; editor is highlight-only |
| Terminal output panel | ❌ | No execution, no output |
| Interactive / pre-supplied stdin | ❌ | Not applicable (no execution) |
| File naming | ❌ | — |
| Tabs | ❌ | — |
| Share as link | ❌ | — |
| Download as `.a` | ❌ | — |
| Auto-format / prettify | ❌ | — |
| Line numbers | ❌ (editor) / ✅ (preview) | Shiki adds line numbers to the highlight preview; the raw textarea has none |
| Assembly error display | ❌ | — |

### B. lcc-injector (`dist/lcc-injector.js`)

An embeddable script that finds `<code class="language-lcc">` blocks on any HTML
page and auto-assembles + runs them, appending an output `<pre>` below each one.

| Feature | State | Notes |
|---------|-------|-------|
| Auto-execute on page load | ✅ | Finds all `.language-lcc` blocks |
| Terminal output panel | ✅ | `<pre class="lcc-output">` appended per block; terminal aesthetic (dark bg / green text) |
| Assembly error display | ✅ | Error box shown when assembly fails |
| Pre-supplied stdin | ✅ | `data-stdin` attribute; newline-separated |
| Interactive stdin | ❌ | No runtime prompt; must pre-supply all input |
| Reveal.md slide integration | ✅ | `--scripts dist/lcc-injector.js` flag |
| Static export (file://) | ✅ | Works without a dev server |
| Standalone playground page | ❌ | Requires embedding; not a self-contained app |
| Code editor | ❌ | Code blocks are read-only on page load |
| Syntax highlighting | ❌ | Does not apply Shiki to injected blocks |
| File naming | ❌ | — |
| Share as link | ❌ | — |
| Download as `.a` | ❌ | — |

### C. Browser bundle API (`dist/lcc.bundle.js`)

Exposes `lcc.Assembler` and `lcc.Interpreter` as browser globals. Intended for
building custom tools, not direct use.

| Feature | State | Notes |
|---------|-------|-------|
| `assembleSource(src)` | ✅ | Returns binary buffer |
| `executeBuffer(buf, {write})` | ✅ | Runs with a custom write callback |
| Standalone UI | ❌ | API only — no built-in interface |

---

## Gap table — ILCC dashboard vs lccjs

`✅` = present · `❌` = absent · `~` = partial · `?` = unverified

| Feature | ILCC dashboard | lccjs (best surface) |
|---------|:--------------:|:--------------------:|
| Code editor (writable) | ✅ | ✅ showcase textarea |
| Syntax highlighting | ❌ | ✅ showcase (Shiki) |
| Run / assemble / execute | ✅ | ~ injector (read-only blocks only) |
| Terminal output panel | ✅ | ✅ injector |
| Interactive stdin | ? | ❌ |
| Pre-supplied stdin | ? | ✅ injector (`data-stdin`) |
| Assembly error display | ? | ✅ injector |
| File naming | ✅ | ❌ |
| Tabs / multi-file | ✅ | ❌ |
| Share as link | ✅ | ❌ |
| Download as `.a` | ✅ | ❌ |
| Auto-format / prettify | ✅ | ❌ |
| Line numbers (editor) | ? | ❌ |
| LCC+ (`.ap`) support | ? | ✅ showcase sample |
| Standalone playground page | ✅ | ❌ |
| Embeddable in slides | ? | ✅ injector + reveal-md |
| Browser API for custom tools | ? | ✅ `lcc.bundle.js` |

---

## Key finding

lccjs and the ILCC dashboard have **complementary** strengths that do not yet overlap
into a single surface:

- **lccjs has syntax highlighting; ILCC does not.**
- **ILCC has a run-in-browser playground; lccjs does not** (the showcase editor doesn't execute; the injector executes but doesn't have an editable input area).

The most impactful single addition to lccjs's web offering would be a **standalone
playground page** that combines the showcase's syntax-highlighted editor with the
injector's execution engine — a writable textarea, a Run button, a terminal output
panel, and pre-supplied stdin support. That closes the largest gap vs. the ILCC
dashboard in one ticket.

---

## What this audit does not cover

- ILCC dashboard features that require login or session state (unknown)
- ILCC dashboard's backend / server-side execution vs. lccjs's client-side WASM/JS approach
- Performance comparison
- Accessibility (ARIA, keyboard-nav completeness)
- Mobile / responsive behaviour
- LCC+ support status in the ILCC dashboard
