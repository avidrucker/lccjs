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

**Updated 2026-06-04 (ELDERBERRY, #714 checklist pass):** Sections A–C reflect the original #700 audit state. Section D and the gap table below have been updated to reflect features shipped since then (#715, #734, #735, #736).

---

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

### D. Playground page (`docs/playground/index.html`) — added via #715, #734, #735, #736

A standalone page combining editor + run + output. Ships with CM6 (`basicSetup`) for editing.

| Feature | State | Notes |
|---------|-------|-------|
| Code editor (CM6 EditorView) | ✅ | `basicSetup` + ViewPlugin syntax highlighting |
| Syntax highlighting | ✅ | Custom ViewPlugin tokenizer (mnemonics, registers, labels, directives, strings, comments) |
| Run / assemble / execute | ✅ | `▶ Run` button via `lcc.bundle.js` API |
| Terminal output panel | ✅ | Dark bg / green text; shows stdout |
| Assembly error display | ✅ | "Assembly error:\n" + errors shown in output panel |
| Pre-supplied stdin | ✅ | `stdin-input` text field; newline-separated |
| Interactive stdin | ❌ | Pre-supply only; no runtime prompt |
| File naming | ✅ | Filename input; validated as safe `.a` name |
| Tabs / multi-file | ✅ | Tab bar with `+` (new) and `×` (close); each tab has independent CM6 state |
| Auto-format / prettify | ✅ | `⌥ Format` button calls `api.formatLccSource()` |
| Line numbers | ✅ | Provided by CM6 `basicSetup` |
| Share as link | ❌ | Not yet (tracked in #732, deferred) |
| Download as `.a` | ❌ | Not yet (tracked in #733, deferred) |
| LCC+ (`.ap`) support | ~ | LCC+ mnemonics highlighted; no LCC+ execution path in UI |
| Dark / light theme | ❌ | Dark theme only; no toggle |
| Save to localStorage | ❌ | No persistence across reloads |

---

## Gap table — ILCC dashboard vs lccjs (updated 2026-06-04)

`✅` = present · `❌` = absent · `~` = partial · `?` = unverified (ILCC, needs human)

| Feature | ILCC dashboard | lccjs (best surface) |
|---------|:--------------:|:--------------------:|
| Code editor (writable) | ✅ | ✅ playground (CM6) |
| Syntax highlighting | ❌ | ✅ playground (ViewPlugin) + showcase (Shiki) |
| Run / assemble / execute | ✅ | ✅ playground |
| Terminal output panel | ✅ | ✅ playground + injector |
| Interactive stdin | ? | ❌ |
| Pre-supplied stdin | ? | ✅ playground + injector |
| Assembly error display | ? | ✅ playground + injector |
| File naming | ✅ | ✅ playground |
| Tabs / multi-file | ✅ | ✅ playground |
| Share as link | ✅ | ❌ (#732, deferred) |
| Download as `.a` | ✅ | ❌ (#733, deferred) |
| Auto-format / prettify | ✅ | ✅ playground |
| Line numbers (editor) | ? | ✅ playground (CM6 basicSetup) |
| LCC+ (`.ap`) support | ? | ~ playground highlights; no LCC+ run path |
| Standalone playground page | ✅ | ✅ playground |
| Embeddable in slides | ? | ✅ injector + reveal-md |
| Browser API for custom tools | ? | ✅ `lcc.bundle.js` |

---

## Key finding (updated 2026-06-04)

~~lccjs and the ILCC dashboard have **complementary** strengths that do not yet overlap into a single surface~~

The primary gap (no run-in-browser playground) has been closed by #715. lccjs now has a standalone playground that exceeds the ILCC dashboard on syntax highlighting and matches it on editor, run, output, file naming, tabs, and auto-format. The two remaining feature gaps are share-as-link (#732) and download-as-.a (#733), both deferred. Interactive stdin and LCC+ execution in the playground are also absent.

---

## What this audit does not cover

- ILCC dashboard features that require login or session state (unknown)
- ILCC dashboard's backend / server-side execution vs. lccjs's client-side WASM/JS approach
- Performance comparison
- Accessibility (ARIA, keyboard-nav completeness)
- Mobile / responsive behaviour
- LCC+ support status in the ILCC dashboard
