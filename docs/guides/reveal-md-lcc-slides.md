# Authoring reveal-md slides with live LCC code blocks

This guide covers the full workflow for creating reveal-md slide decks where LCC assembly code blocks auto-assemble and run in the browser — no server required.

## Prerequisites

- Node ≥ 18 and `npm install` done in the repo root
- `reveal-md` installed globally: `npm install -g reveal-md`

## Step 1 — build the injector

```bash
npm run build:browser
```

This produces `dist/lcc-injector.js`. Rebuild whenever the assembler or interpreter source changes.

## Step 2 — write your slide deck

Create a `.md` file. Any fenced code block with the `lcc` language tag will be picked up by the injector and executed automatically when the slide is viewed.

```markdown
---
theme: white
---

## Hello, LCC

```lcc
        mvi r0, 42
        dout r0
        nl
        halt
```

---

## Reading input

Supply stdin via the `data-stdin` attribute on the code block's `<code>` tag.
In Markdown this is done with an HTML block directly:

<pre><code class="language-lcc" data-stdin="7">
        din r0
        dout r0
        nl
        halt
</code></pre>
```

### `data-stdin` constraint

Programs that read more input than is supplied via `data-stdin` will stall — the browser has no interactive console. Pre-supply all required input as a newline-separated string:

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

`&#10;` is a newline character in HTML. Alternatively, use a JavaScript multiline string in a custom reveal-md template.

## Step 3 — export a static bundle

```bash
reveal-md slides.md --static ./out --scripts dist/lcc-injector.js
```

This writes a self-contained `out/` directory. The `--scripts` flag injects `lcc-injector.js` into every generated HTML page.

**Important:** the path passed to `--scripts` must be relative to the current working directory, not the output directory. Copy or symlink `dist/lcc-injector.js` into `out/` if you need to distribute the bundle alongside the slides.

## Step 4 — open in a browser

```bash
open out/index.html        # macOS
xdg-open out/index.html    # Linux
```

No web server needed — the injector is built to work over `file://`. Each `language-lcc` code block renders its output in a `<pre class="lcc-output">` element injected directly below the block. Assembly errors appear in a styled error box instead.

## Minimal working example

Save as `demo.md` in the repo root:

```markdown
---
theme: white
---

## LCC Demo

```lcc
        mvi r0, 99
        dout r0
        nl
        halt
```
```

Then:

```bash
npm run build:browser
reveal-md demo.md --static ./demo-out --scripts dist/lcc-injector.js
open demo-out/index.html
```

Expected: the slide shows `99` beneath the code block.

## Reference

- Injector source: `src/browser/lcc-injector.js`
- Browser test fixture (standalone HTML, no reveal-md): `tests/browser/injector.html`
- Browser API: `docs/api.md`
- Related issues: #595 (injector), #682 (Reveal.ready hook), #673 (file:// validation)
