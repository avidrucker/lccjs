# 613 — reveal-md vs FOSS slide alternatives for LCCjs educational embeds

**Ticket:** #613 | **Role:** RESEARCH | **Closed:** 2026-06-03

## Context

The browser-embed arc (#591, #593, #595) targets a slide platform where LCCjs runs as live assembly code inside educational slides. The key constraint from #591: the platform must allow `<script>` injection that works on `file://` URLs with no COOP/COEP headers — rules out anything that requires a dev server for local preview.

## Comparison matrix

| Tool | Maintenance (2026) | `file://` works? | `<script>` injection | Markdown-first |
|---|---|---|---|---|
| **reveal-md** | Low (last release Nov 2024) | No — CORS blocks XHR on `file://` | Yes, `--scripts` flag | Yes |
| **Slidev** | Active | No — history-mode SPA requires HTTP | Yes, Vue SFC syntax | Yes |
| **Marp** | Active | **Yes** — plain HTML, no router | **Yes**, with `--html` flag | Yes |
| **Quarto (revealjs)** | Active | **Yes** — `embed-resources: true` | **Yes**, `include-in-header` | Yes (`.qmd` dialect) |
| **Presenterm** | Active (v0.16.1 Feb 2026) | N/A — terminal viewer only | No | Yes |
| **MDX Deck** | Dead (last release ~2020) | N/A | — | Yes |

## Findings per tool

### reveal-md (`github.com/webpro/reveal-md`)

Last release v6.1.4 (November 27, 2024). ~565 weekly npm downloads. Not dead but low activity. The critical failure: reveal.js fetches slide content from Markdown files at runtime via XHR/fetch. Browsers block `file://` XHR under CORS (upstream reveal.js issue #2875). The `--static` export is intended to be served via HTTP, not opened as a local file.

### Slidev

Actively maintained, built on Vite + Vue 3. `slidev build` produces a Vue SPA in `dist/` using history-mode routing — routes like `/2`, `/3` resolve against the filesystem on `file://` and fail. ES module `import()` calls in the SPA are also blocked under `file://` same-origin restrictions. Requires HTTP server.

### Marp CLI (`github.com/marp-team/marp-cli`)

Actively maintained. Generates a **plain HTML document** (not a SPA), which opens directly in a browser via `file://` — no router, no server required. The `--html` flag enables arbitrary `<script>` tags in Markdown output (disabled by default as a security measure). For a fully self-contained single-file distribution, pipe through `monolith` to inline all assets. The main server mode sets COOP/COEP headers, but the static HTML export never touches them.

### Quarto (revealjs output)

Actively maintained by Posit. With `embed-resources: true`, produces a single HTML file with all CSS/JS/images embedded as `data:` URIs — explicitly designed for offline/file distribution. `include-in-header` injects arbitrary `<script>` tags into the output HTML before embedding. Caveats: some dynamic reveal.js features (speaker notes zoom, `import()` calls) may fail offline; MathJax may still phone home even with `self-contained-math: true` (use KaTeX instead). For an assembler demo, neither caveat likely matters.

### Presenterm

Terminal TUI tool; the `--export-html` flag snapshots the terminal-aesthetic visual as static HTML. Not a web presentation framework; cannot host interactive JS interpreters in the browser.

### MDX Deck

Last npm publish ~2020; broken on current React and MDX v2/v3. Do not use.

## Recommendation

**Stick with reveal-md if the injector (#595) pre-bundles the Markdown inline.** If the injector writes a fully self-contained HTML (no separate `.md` file that reveal.js fetches at runtime), the `file://` CORS block disappears — the constraint is only violated when the runtime tries to fetch a separate file. However, this requires the injector to take ownership of bundling, which may be scope creep.

**Switch to Marp CLI if simplicity is the priority.** Marp produces a plain HTML document by default, `--html` enables script injection, and there is no bundling complexity. The authoring format is Markdown-first. For a self-contained distribution, `monolith` does the bundling step. This is the path of least resistance for `file://` compatibility.

**Quarto as an alternative** if richer slide layout (fragments, themes, speaker notes) is desired. The `embed-resources + include-in-header` combo works reliably for offline distribution. Requires installing Quarto CLI and learning `.qmd` dialect.

**Avoid Slidev and MDX Deck** for this constraint entirely.

### Actionable verdict

The browser-embed arc (#591, #593, #595) should either:
1. Validate that the #595 injector already produces fully self-contained HTML (no XHR at runtime) — if so, reveal-md static export works and no switch is needed; or
2. Adopt Marp CLI as the platform for new slide authoring, with `--html` for script injection.

Option 1 requires a concrete test: export a reveal-md static bundle and open it via `file://` with the injector's output in place. Option 2 avoids that test entirely.
