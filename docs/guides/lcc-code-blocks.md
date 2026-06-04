# LCC code block options — syntax highlighting vs runnable execution

This guide covers every way to embed LCC assembly code blocks in a web page, slide deck, or editor. Each option is described by what it does, where it works, when to prefer it, how to wire it up, and why it works (or doesn't) in a given context.

## Quick-reference matrix

| Option | Syntax highlight | Runnable | Interactive stdin | Works on `file://` | GitHub Pages | Reveal.js slides | Build step |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `lcc.tmLanguage.json` + Shiki (site builder) | ✓ | — | — | ✓ | ✓ | — | `build:site` |
| `lcc-injector.js` script tag | ✓ | ✓ | pre-supply only | ✓ | ✓ | ✓ | `build:browser` |
| Playground page (`/showcase/`) | — | ✓ | pre-supply only | ✓ | ✓ | — | `build:browser` + `build:site` |
| `lcc.bundle.js` API (custom) | — | ✓ | pre-supply only | ✓ | ✓ | ✓ | `build:browser` |
| VS Code grammar | ✓ | — | — | n/a | — | — | none |
| GitHub markdown | — | — | — | n/a | — | — | none |

**Interactive stdin** (programs that call `DIN`/`SIN`/`AIN`/`HIN` beyond the pre-supplied buffer) is not yet supported in any in-browser option — see [#702](https://github.com/avidrucker/lccjs/issues/702).

---

## Option 1 — `lcc.tmLanguage.json` + Shiki (static site builder)

**What:** The site build pipeline (`npm run build:site`) uses Shiki with `lcc.tmLanguage.json` to syntax-colour curated LCC assembly samples and emit static HTML. No JavaScript runs at page-load time; the highlighted HTML is baked in. The landing page (`docs/site/index.html`) displays the highlighted demos with a live theme switcher.

> **Note:** Arbitrary fenced `` ```lcc `` blocks in `.md` docs files are currently rendered via `marked` (plain HTML, no Shiki). Only the pre-configured samples in `scripts/build-site.js` (`CURATED_SAMPLES`, alphabet demos, `LCCPLUS_SAMPLES`) are Shiki-highlighted. Full `.md`-fenced-block Shiki support is tracked in #740.

**Where it works:** The landing page produced by `npm run build:site`, including the GitHub Pages site. Does **not** work for standalone HTML files or reveal-md without going through the build pipeline.

**When to prefer it:** The static landing page for demonstrating the grammar and syntax colouring across multiple themes.

**Minimal how-to:**

1. Add an entry to `CURATED_SAMPLES` in `scripts/build-site.js`:
   ```javascript
   { file: 'demos/myProgram.a', label: 'demos/myProgram.a', title: 'My program description' }
   ```
2. Run `npm run build:site`. The landing page (`docs/site/index.html`) now contains pre-coloured `<span>` elements for your sample, with all configured themes.

**Why it doesn't work elsewhere:** Shiki runs at build time in Node.js. A plain HTML page opened in a browser has no Shiki; neither does a GitHub repository's Markdown renderer (GitHub has no LCC grammar upstream — see below).

---

## Option 2 — `lcc-injector.js` script tag

**What:** A self-contained browser script that finds every `<code class="language-lcc">` element on the page, assembles and runs each one using the in-browser LCC bundle, and appends a `<pre class="lcc-output">` result block below it. Also provides Shiki-quality syntax highlighting for blocks that should be display-only (class `language-lcc-display`).

**Where it works:** Any HTML page — static exports, reveal-md slides, custom pages — opened over `file://` or served via HTTP/HTTPS.

**When to prefer it:**
- Reveal.js / reveal-md slide decks where live code demos are the goal
- Any standalone HTML file that needs both highlighting and execution without a server

**Minimal how-to:**

1. Build the injector: `npm run build:browser` → produces `dist/lcc-injector.js`
2. Add a code block and include the script at the bottom of `<body>`:
   ```html
   <pre><code class="language-lcc">
           mvi r0, 42
           dout r0
           nl
           halt
   </code></pre>

   <script src="dist/lcc-injector.js"></script>
   ```
3. Open in a browser. A `<pre class="lcc-output">` containing `42` appears below the block.

**Supplying stdin** (`DIN`/`SIN`/`AIN`/`HIN` programs): add a `data-stdin` attribute to the `<code>` element. Newline-separated values for multiple reads:

```html
<pre><code class="language-lcc" data-stdin="3&#10;4">
        din r0
        din r1
        add r0, r0, r1
        dout r0
        nl
        halt
</code></pre>
```

`&#10;` is a literal newline in HTML. Programs that exhaust `data-stdin` stall — supply all required input upfront.

**For reveal-md**, pass the script via `--scripts`:

```bash
reveal-md slides.md --static ./out --scripts dist/lcc-injector.js
```

See `docs/guides/reveal-md-lcc-slides.md` for the full reveal-md workflow.

**Why it doesn't work on GitHub.com:** GitHub's Markdown renderer sanitises `<script>` tags and custom attributes. The injector requires DOM access and is a browser-only tool.

---

## Option 3 — Playground page (`/showcase/`)

**What:** A hosted textarea on the GitHub Pages site where a user types or pastes LCC assembly, clicks Run, and sees the output. No code embedding — this is a standalone interactive tool, not an embeddable component.

**Where it works:** GitHub Pages (`/showcase/`) and locally over `file://` from the built site.

**When to prefer it:** Teaching sessions where students want to try programs without installing anything; quick one-off testing during slide demos.

**Minimal how-to:** Navigate to `https://<org>.github.io/lccjs/showcase/` (or open `docs/site/showcase/index.html` locally after running `npm run build:browser && npm run build:site`). Type assembly, click Run.

**Stdin:** Pre-supply input in the stdin textarea before clicking Run. Interactive mid-run prompts are not yet supported (#702).

**Why it isn't embeddable:** The playground is a full page, not a web component. Embedding it in another page requires an `<iframe>` (works but has styling constraints).

---

## Option 4 — `lcc.bundle.js` API (custom integrations)

**What:** `dist/lcc.bundle.js` exposes a `window.lcc` object with two functions:

```javascript
const result = lcc.assemble(src);
// result: { ok: true, binary: Buffer } | { ok: false, errors: string }

const output = lcc.run(binary, { stdin: ['42', '7'] });
// output: { stdout: string, exitCode: number }
```

**Where it works:** Any browser context where you can load a `<script>` tag — `file://`, GitHub Pages, custom sites.

**When to prefer it:** Building a custom UI (e.g. a notebook, an interactive tutorial, a grader widget) where you control the layout and want the raw assemble/run primitives without the injector's auto-discovery behaviour.

**Minimal how-to:**

```html
<script src="dist/lcc.bundle.js"></script>
<script>
  const src = `
        mvi r0, 99
        dout r0
        nl
        halt
  `;
  const { ok, binary, errors } = lcc.assemble(src);
  if (!ok) { console.error(errors); }
  else {
    const { stdout } = lcc.run(binary);
    document.getElementById('output').textContent = stdout;
  }
</script>
```

**Stdin:** Pass lines as an array to `lcc.run(binary, { stdin: ['first line', 'second line'] })`. The array is joined with `\n` and fed into `inputBuffer`. Same batch-only constraint as Option 2.

**Build step:** `npm run build:browser` → `dist/lcc.bundle.js`.

---

## Option 5 — VS Code grammar

**What:** `lcc.tmLanguage.json` is a TextMate grammar that VS Code (and other editors supporting TextMate grammars) uses to syntax-highlight `.a` and `.ap` files.

**Where it works:** Local VS Code with the grammar installed; no browser involvement.

**When to prefer it:** Writing LCC assembly locally. No web embedding use case.

**Minimal how-to:** Not covered here — see the VS Code extension packaging docs.

---

## Option 6 — GitHub markdown (`.md` files on github.com)

**What:** GitHub's Markdown renderer applies syntax highlighting via its own Linguist + highlight.js pipeline.

**Status:** LCC has no grammar registered in Linguist / highlight.js upstream. GitHub will render `` ```lcc `` blocks as plain text with no colouring. **This is a known gap** (#450).

**Workaround:** None currently. Use the static site builder (Option 1) or the injector (Option 2) for highlighted output.

---

## Choosing the right option

| Goal | Recommended option |
|------|-------------------|
| Docs site (syntax colour, no run) | Option 1 — Shiki + site builder |
| Reveal.js slides with live demo | Option 2 — injector + `data-stdin` |
| Student tries code in a browser | Option 3 — Playground page |
| Custom web app or notebook | Option 4 — bundle API |
| Writing assembly in VS Code | Option 5 — VS Code grammar |

## Status of planned features

- **Interactive stdin** (mid-run input prompt): not yet implemented — tracked in #702 (`pauseOnInput`)
- **Infinite-loop protection** (step cap, Web Worker): not yet implemented — tracked in #703
- **Web front-end feature parity tracking** vs web_ilcc dashboard: #707
