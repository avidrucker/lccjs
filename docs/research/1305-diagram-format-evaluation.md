# RESEARCH #1305 — diagram-as-text formats: ASCII-friendly source + accessible rendering

**Agent:** GRAPE · **Date:** 2026-06-15 · Research-only, no production code.
**Related:** #741 (accessibility/quality review of the *existing* Mermaid diagrams — narrower; this is the broader format survey).

## TL;DR — recommendation

**Keep Mermaid as the diagram-as-code format, and pair it with mandatory accessibility hygiene.** Mermaid is the *only* diagram-as-code language GitHub renders natively (the others would show every reader a raw, unrendered code block), and it needs no build step — so it is the only candidate that satisfies this repo's "no runtime deps / no external service" ethos while still producing a rendered figure. Every alternative diagram-as-code tool (D2, Graphviz/DOT, PlantUML, ditaa, Mingrammer) requires either an external binary, a JVM, a server, or a CI build step, and none render on GitHub — so adopting one would *regress* the reader experience, not improve it.

The right "ASCII-friendly" win is not a different rendering engine — it is to **hand-author small structural sketches as literal fenced ASCII** (svgbob/asciiflow-style box art committed as plain text) where the diagram is simple enough, since that text *is* the diagram: it renders identically everywhere, is maximally diffable, and is screen-reader-presentable inside a labelled block. Mermaid stays for the two large diagrams that ASCII can't carry.

Net: **a two-format house style, not a switch.**

1. **Mermaid** — for genuinely structural/complex diagrams (the architecture graph, the user-flow tree). Add the accessibility hygiene below. This is the scope #741 already owns.
2. **Literal fenced ASCII** — for small sketches (≤ ~6 nodes, a single pipeline, a state pair). Zero tooling, perfectly diffable, no rendering gap.

No new dependency, no build step, no follow-on DEV puzzle for tooling. The only follow-on is the accessibility hygiene, which is **#741's** job — this survey hands it concrete acceptance criteria (below) rather than opening a duplicate.

---

## The decision is driven by one fact about how diagrams are actually used here

A `grep -rl '```mermaid' docs/` finds diagrams in **exactly one file** — `docs/orientation.md` — holding **two** diagrams: a `graph TD` architecture diagram and a `flowchart TD` user-flow decision tree. Both are *structural* (nodes + edges + nested subgraphs), both contain file-path labels, and both are read **on GitHub**, where they render natively today.

That single fact reframes the whole survey. The question is not "which diagram language is best in the abstract" — it is:

> For two structural diagrams read on GitHub, in a repo that forbids runtime deps and prefers no build step, which format renders for every reader *and* meets accessibility bars — and where is hand-drawn ASCII actually the better tool?

That immediately makes **GitHub-native rendering** the hard constraint, because it is the only axis where a wrong choice silently degrades the artifact for 100% of readers.

## Hard constraint first (eliminates most candidates)

GitHub renders only three diagram syntaxes inside fenced code blocks: **Mermaid**, **GeoJSON/TopoJSON**, and **ASCII STL** ([GitHub Docs](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)). GeoJSON (maps) and STL (3-D meshes) are irrelevant to architecture/flow diagrams. So among diagram-as-code *languages*, **only Mermaid renders on GitHub**.

Every other candidate, when committed to a `.md` file in this repo, displays to a GitHub reader as an **unrendered block of source** unless a build step or external service turns it into an image first:

- **D2** (terrastruct) — needs the `d2` binary; no GitHub-native render ([community feature request still open](https://github.com/orgs/community/discussions/176562)).
- **Graphviz/DOT** — needs the `graphviz` binary; not GitHub-native.
- **PlantUML** — needs a JVM + (usually) a PlantUML server; not GitHub-native.
- **ditaa** — Java CLI that converts ASCII art → PNG; not GitHub-native ([ditaa](https://github.com/stathissideris/ditaa)).
- **Mingrammer `diagrams`** — a Python library needing Python + Graphviz; emits PNG; not GitHub-native.

All five also violate the **zero-dependency / no-build-step ethos** in `CLAUDE.md`: each adds either a runtime/CI toolchain or commits a generated binary image (which is then undiffable and can drift from its source). They are eliminated on *two* independent grounds.

**Survivors** that need neither a dependency nor a build step *and* show something useful on GitHub:

- **Mermaid** — renders natively; source is semi-legible as text.
- **Literal fenced ASCII** (hand-drawn, svgbob/asciiflow/Diagon-authored, or just typed) — the committed text *is* the rendered diagram; nothing to render, nothing to install.

Everything below scores those two against the rest for completeness, but the constraint already decided it.

## The two axes, made precise

The ticket asks for two goals *simultaneously*. Pinning them down:

1. **ASCII-friendly source** — when viewed unrendered (raw `.md`, `git diff`, a plain terminal, a code review), does the text communicate the diagram's structure? A literal box-drawing is 10/10; Mermaid is partial (you can read node names and edges but must mentally lay it out); DOT/PlantUML are lower (boilerplate noise).
2. **Accessible rendering** — does the rendered output meet WCAG 2.1 AA contrast (4.5:1 text / 3:1 graphical objects), survive a color-blind check, and expose a screen-reader story (alt-text / `accDescr`)?

These pull in *opposite* directions for complex diagrams: the more structure a diagram has, the less its raw source reads as ASCII art, and the more it needs a real renderer (which then must be made accessible). That tension is why the answer is two formats keyed to diagram complexity, not one universal winner.

## Comparison matrix

Axes: **Src** = source legibility when unrendered · **GH** = renders natively on GitHub · **Dep** = zero-dep / no-build fit · **A11y** = accessibility ceiling of the rendered output · **Fit** = fit for *this* repo's two structural diagrams.
Scale: ✅ strong · 🟡 partial / caveated · ❌ weak or disqualifying.

| Format | Src | GH | Dep | A11y | Fit | One-line verdict |
|---|:--:|:--:|:--:|:--:|:--:|---|
| **Mermaid** | 🟡 | ✅ | ✅ | 🟡 | ✅ | Incumbent; only GitHub-native code-diagram. A11y is workable with hygiene. **Keep.** |
| **Literal fenced ASCII** | ✅ | ✅ | ✅ | 🟡 | 🟡 | Source *is* the diagram; perfect for small sketches, doesn't scale to the arch graph. **Adopt for small diagrams.** |
| **D2** | 🟡 | ❌ | ❌ | 🟡 | ❌ | Cleaner language than Mermaid, but needs the `d2` binary + build; no GitHub render. ASCII output is **alpha**. |
| **Graphviz/DOT** | ❌ | ❌ | ❌ | 🟡 | ❌ | Powerful layout, noisy source, binary dependency, no GitHub render. |
| **PlantUML** | ❌ | ❌ | ❌ | 🟡 | ❌ | JVM + server; heaviest toolchain; no GitHub render. |
| **ditaa** | ✅ | ❌ | ❌ | ❌ | ❌ | You hand-draw ASCII anyway, then a Java step turns it into a non-diffable PNG — worst of both ends. |
| **Mingrammer `diagrams`** | ❌ | ❌ | ❌ | 🟡 | ❌ | Python program that emits PNG cloud-icon diagrams; wrong domain, wrong toolchain. |
| **"m2"** | — | — | — | — | — | Not a resolvable tool name (see note). The markdown-ASCII family it gestured at is below. |

### On the "ASCII-friendly" end of the spectrum

The ticket grouped several "source is the diagram" tools. They split into two kinds:

- **Drawing aids** — `asciiflow` (web canvas → exports ASCII text), `Diagon` (expression → ASCII art, C++/WASM), `Monodraw` (macOS). These *help you produce* literal ASCII; the **output is plain text you paste into a fenced block**, so the repo gains zero dependency. They are good authoring tools for the "literal fenced ASCII" recommendation — use them as scratchpads, commit only the text.
- **Render-from-ASCII tools** — `ditaa`, `Markdeep`, `Typograms`, `Svgbob`. These take ASCII art and produce SVG/PNG. They re-introduce a build step or a client-side JS renderer GitHub won't run, defeating the point. Skip for committed docs.

### "m2" — could not be resolved

No tool named **"m2"** surfaced as a markdown/diagram dialect in any source consulted. It is most likely a placeholder or typo in the ticket for the *markdown-flavored ASCII* family — **Markdeep**, **Typograms**, or **Svgbob** — which are covered as "render-from-ASCII tools" above. If the requester meant a specific tool, the disambiguation should be confirmed before any future work cites it; this survey treats the family, not a single phantom name.

## Mermaid accessibility — workable, with mandatory hygiene

Mermaid's accessibility ceiling is the only real knock against keeping it, and it is the substance of #741. The findings, grounded:

- **Screen readers:** Mermaid's *rendered SVG* is effectively opaque to assistive tech — a screen reader reads it as a jumble of disconnected labels with no edge/relationship information. Mermaid exposes `accTitle` and `accDescr` keywords that set the SVG `aria-roledescription`/title/desc, but those describe the figure; they don't make the graph navigable ([Mermaid a11y docs](http://mermaid.js.org/config/accessibility.html), [a11y in GitHub Markdown](https://pulibrary.github.io/2023-03-29-accessible-mermaid)).
- **Theme / dark mode:** hardcoding a theme in `%%{init}%%` can make the diagram unreadable in the opposite color scheme. Best practice is to specify *no* theme and let GitHub's light/dark adapt.
- **Color-blind / contrast:** Mermaid's default palette is generally acceptable but its blue/green accents can fail deuteranopia and the 3:1 graphical-contrast bar in some renders; don't rely on color alone to carry meaning.

**Concrete acceptance criteria this survey hands to #741** (so #741 closes against a checklist, not a vibe):

1. Each Mermaid block is immediately preceded or followed by a **prose description** of the same structure (this doubles as the screen-reader story and as the unrendered-source fallback). The `orientation.md` diagrams already pair with tables — formalize that as the rule.
2. Add `accTitle`/`accDescr` to each diagram.
3. **No** hardcoded `theme` in `%%{init}%%`; verify legibility in both GitHub light and dark.
4. Don't encode meaning in color alone (labels/shapes carry it); spot-check the palette against a deuteranopia simulator and the 4.5:1 / 3:1 WCAG 2.1 AA bars.

## Recommendation

1. **Keep Mermaid** for the two structural diagrams in `docs/orientation.md` and any future genuinely-complex diagram. It is the only zero-dep, GitHub-native, no-build option; switching to D2/DOT/PlantUML would *remove* native rendering and *add* a toolchain — a strict regression on both the accessibility and the zero-dep goals.
2. **Adopt literal fenced ASCII** as the house format for *small* structural sketches (a short pipeline, a 2–3 state diagram, a directory tree). The committed text is the diagram: maximally diffable, renders identically everywhere, no tooling. Use `asciiflow`/`Diagon` as offline scratchpads to *produce* the text; commit only the text.
3. **Reject** D2, Graphviz/DOT, PlantUML, ditaa, and Mingrammer for committed docs — each fails GitHub-native rendering *and* the zero-dep/no-build ethos. (D2 is the strongest of these and worth re-evaluating *if* GitHub ever ships native D2 rendering; its ASCII output is alpha as of 2025 and not yet a reason to switch.)
4. **No new tooling puzzle is warranted.** The only follow-on work is the Mermaid accessibility hygiene, which **#741 already owns** — this doc supplies its acceptance criteria (the four-item checklist above) so the two tickets don't overlap. A one-line house-style note ("Mermaid for complex diagrams + a11y hygiene; literal fenced ASCII for small ones") could be added to a contributor/docs-style guide if one is later created, but that is optional and out of scope here.

## Follow-on @todo puzzles

None required. The format question is settled in favor of the incumbent + a lightweight ASCII convention, so there is no DEV migration to puzzle. The adjacent accessibility work is tracked by **#741**; this survey deliberately avoids filing a duplicate and instead feeds #741 the concrete checklist above.

## Sources

- [GitHub Docs — Creating diagrams (Mermaid, GeoJSON/TopoJSON, ASCII STL)](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
- [GitHub Community — D2 diagram support feature request (open)](https://github.com/orgs/community/discussions/176562)
- [Mermaid — Accessibility Options (accTitle/accDescr, theme guidance)](http://mermaid.js.org/config/accessibility.html)
- [Accessible Mermaid charts in GitHub Markdown — Princeton University Library](https://pulibrary.github.io/2023-03-29-accessible-mermaid)
- [terrastruct/d2 — README & releases](https://github.com/terrastruct/d2)
- [D2 — ASCII output (alpha)](https://d2lang.com/blog/ascii/)
- [stathissideris/ditaa](https://github.com/stathissideris/ditaa)
- [ArthurSonzogni/Diagon — interactive ASCII art diagram generator](https://github.com/ArthurSonzogni/Diagon)
- [ASCIIFlow](https://asciiflow.com/)
- [XOSH — list of online text-to-diagram tools](https://xosh.org/text-to-diagram/)
- [WebAIM — Contrast and Color Accessibility (WCAG 2 contrast requirements)](https://webaim.org/articles/contrast/)
