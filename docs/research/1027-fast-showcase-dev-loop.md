# 1027 — Fast local feedback loop for the showcase / playground

**Type:** RESEARCH · **Lane:** area:web · **Agent:** ELDERBERRY
**Question:** Can the showcase/playground run on a local dev server with a *fast and
accurate* feedback loop, so CM6/editor changes show without a manual full
`npm run build` + server restart each time?

**Verdict: Yes, feasible and worth it.** Build a `--dev` (watch + live-reload) mode
that keeps serving the **built** `docs/site` artifact (preserving the #985/#986
fidelity guarantee) while removing the two real sources of friction: the manual
rebuild and the over-broad rebuild. Implementation = the already-filed DEV ticket
**#1028**, now unblocked. Recommended approach below; all of it is achievable with
**Node built-ins only** (no new runtime dep).

---

## 1. Anatomy of the current loop

The deployed Playground is one generated file: `docs/site/showcase/index.html`,
emitted by the `playgroundScript` template inside `scripts/build-site.js`. It pulls
from four distinct source→artifact chains, each with a *different* rebuild cost:

| You edit… | Feeds artifact… | Build step actually needed | Measured cost |
|---|---|---|---|
| `scripts/build-site.js` (the `playgroundScript` template) | `docs/site/showcase/index.html` | `build:site` only | **~1.0 s** |
| `src/browser/*` (`api.js`/`lcc-injector.js`/`lcc-worker.js` → `window.lcc`) | `docs/site/dist/lcc.bundle.js`, `showcase/lcc-worker.js` | `build:browser` **then** `build:site` (copies the bundle in) | **~2.5 s + ~1.0 s** |
| `docs/site/dist/lang-lcc.js` (CM6 LCC language support — **hand-maintained**, not regenerated) | itself | **none** | 0 s (refresh only) |
| `src/lang-lcc/lcc.grammar` (Lezer grammar) | `src/lang-lcc/lcc.js` (generated), then **manually ported** into `docs/site/dist/lang-lcc.js` | manual | n/a |

Runtime (browser-side) the page also imports **CM6 and Shiki from `esm.sh`** — these
are *not* bundled; they arrive over the network on page load.

### Two corrections to the issue's stated premise

1. **A server restart is NOT required.** `serve-site.js` is a plain static server:
   it `fs.readFile`s the target file on *every request* and sets
   `Cache-Control: no-cache` (serve-site.js:88, :110). After a rebuild, a **browser
   refresh alone** picks up the new files — the running server never needs
   restarting. The friction is the *manual rebuild* and the browser-refresh keypress,
   not the server lifecycle. (#1028's repro step 2 should be amended; I'll note this
   on the ticket rather than rewriting it.)

2. **The rebuild is often over-broad.** `npm run build` always runs *both*
   `build:browser` (~2.5 s) and `build:site` (~1 s). But a template-only edit (the
   most common showcase change) needs only `build:site`. Today the contributor
   either over-builds (~3.5 s) or has to remember which step applies. A watcher can
   pick the minimal step automatically.

So the *real* slow path today is: **remember to rebuild → run the right (or
over-broad) build → alt-tab → refresh**, repeated by hand on every change.

---

## 2. Options evaluated

### A. Watch / auto-rebuild mechanism

| Option | New dep? | Fit |
|---|---|---|
| **`fs.watch` (Node built-in)** | none | ✅ **Recommended.** Watch `scripts/build-site.js`, `src/browser/`, `src/lang-lcc/`, and `docs/site/dist/lang-lcc.js`; debounce ~150 ms; dispatch the *minimal* build step per the table above. Zero-dep, matches the repo's no-runtime-dep ethos. |
| `node --watch` | none | ❌ Only re-runs a single entry process on *its own* import graph; can't map "src/browser changed → run build:browser **and** build:site". Too coarse. |
| `webpack --watch` | none (webpack already a dev dep) | ⚠️ Optional enhancement. Gives sub-300 ms *incremental* bundle rebuilds vs the 2.5 s cold build, but only covers `build:browser`. Worth layering in **only** if engine (`src/browser`) iteration becomes a bottleneck; not needed for the common template loop. |
| `chokidar` | adds a dev dep | ❌ Nicer cross-platform watching, but `fs.watch` with a debounce is sufficient on Linux/macOS here and avoids the dep. |

**Recommendation: `fs.watch` + a debounced dispatcher that runs the minimal build
step.** A template edit reloads in ~1 s; a lang-lcc.js edit reloads in ~0 s; an
engine edit triggers browser+site.

### B. Live reload (auto-refresh the browser)

**Recommended: SSE (Server-Sent Events), zero-dep.** On `--dev`, `serve-site.js`
injects a tiny `<script>` into served HTML responses that opens an
`EventSource('/__livereload')`. The watcher, after a successful rebuild, pushes one
event on that endpoint; the snippet calls `location.reload()`. SSE is a browser
built-in and one `res.write('data: reload\n\n')` on the Node side — no websocket
library, no client framework. (A WebSocket would also work but needs more plumbing
for no benefit here.)

Guard the injection behind `--dev` so the deployed/served-without-dev artifact stays
byte-identical to what Pages ships.

### C. Skip the full rebuild — a thin dev HTML importing from source? **Rejected.**

The issue floats a dev-only HTML that imports the modules directly from source so a
plain refresh shows CM6 changes. **This trades away the one property the loop must
keep.** #985/#986 are the cautionary tale: CM6 line-numbers/highlighting were twice
declared working from a *source reading* while the *deployed generated page* lacked
them, because fixes landed on a non-deployed page. A separate source-importing dev
page recreates exactly that divergence class — you'd verify against an artifact that
isn't what ships. **Keep serving the generated `docs/site`; make *generating* it
fast instead of bypassing it.** The minimal-step watcher already makes the common
case ~1 s, so the fidelity sacrifice buys very little.

### D. esm.sh latency / local module cache? **Not worth it now.**

CM6 + Shiki load from `esm.sh` on page load. After the first load they're served
from the **browser HTTP cache**, so they cost a network round-trip only once per
session — negligible against the edit/rebuild/reload inner loop. A local cache or
import-map to vendored copies adds maintenance and, more importantly, would make dev
diverge from the deployed page (which uses esm.sh) — the same fidelity hazard as (C),
in miniature. **Recommend: do not vendor.** Revisit only if offline dev or first-load
latency becomes a real complaint, and if so, vendor for *both* dev and deploy so they
stay identical.

---

## 3. Recommended implementation (for #1028)

Add a **`--dev`** flag (alias `--watch`) to `serve-site.js`, surfaced as
`npm run dev:site` (`node scripts/serve-site.js --dev`). It composes three pieces,
all Node built-ins:

1. **Watcher (`fs.watch`)** over `scripts/build-site.js`, `src/browser/`,
   `src/lang-lcc/`, and `docs/site/dist/lang-lcc.js`; debounce ~150 ms; dispatch the
   **minimal** build step:
   - template change → `build:site`
   - `src/browser/*` change → `build:browser` then `build:site`
   - `docs/site/dist/lang-lcc.js` change → no build (reload only)
   - `src/lang-lcc/*` change → log a reminder that the parser must be regenerated and
     ported into `lang-lcc.js` (the chain is manual today; don't pretend to automate it)
2. **Live-reload endpoint** `/__livereload` (SSE) + a `<script>` injected into HTML
   responses **only when `--dev`**.
3. **Reload trigger:** on a successful rebuild, push one SSE event → browser reloads.

Keep non-`--dev` behaviour byte-identical (no injection, no extra routes), so the
existing `serve:site` verification path is unchanged.

### Acceptance / done-looks-like

- `npm run dev:site`, edit the `playgroundScript` template, save → browser reloads
  with the change in ~1 s, **no manual build, no server restart**.
- Editing `src/browser/api.js` → bundle rebuilds and the page reloads automatically.
- Editing `docs/site/dist/lang-lcc.js` → reloads with no rebuild.
- Plain `npm run serve:site` (no `--dev`) serves the exact same bytes as today.
- No new entry in `dependencies`; `devDependencies` unchanged (Node built-ins only).
- A note in `docs/showcase-local-dev.md`: `dev:site` is the *fast* loop;
  `serve:site` + the checklist remains the *authoritative pre-deploy* verification
  (run the checklist against the plain served artifact before shipping).

### Follow-up @todo

A `@todo #1028` marker is placed at the natural code site (`serve-site.js` arg
parsing) so `puzzle:status` surfaces the implementation work.

---

## 4. Risk / fidelity note

The whole point of #987 was *accurate* preview. `--dev` must not erode that: the
live-reload script and watcher are dev-only, the served artifact is still the
generated `docs/site`, and esm.sh stays the module source in both dev and deploy. The
pre-deploy checklist in `docs/showcase-local-dev.md` remains mandatory and runs
against the plain (non-dev) served page. `--dev` makes iteration fast; it does not
replace the authoritative verification step.
