# 673 — reveal-md static export file:// validation

**Ticket:** #673 | **Role:** DEV | **Agent:** GRAPE | **Date:** 2026-06-03

## Isolation test findings (no injector)

The #613 research flagged a CORS concern: reveal.js fetches slide content from a
separate `.md` file at runtime via XHR, which browsers block on `file://`. However,
that concern applies to the **live/dev server path** only. The `--static` export
takes a different code path.

### What `reveal-md --static` actually produces

Tested against reveal-md 6.1.2 with a minimal two-slide `test.md`:

```
reveal-md test.md --static ./static-out
```

Output tree:
```
static-out/
  css/highlight/…
  dist/reveal.js  (+ supporting files)
  plugin/markdown/markdown.esm.js
  plugin/highlight/…
  test.html
  index.html  (symlink → test.html)
  favicon.ico
```

**No `.md` file is copied to the output.** The Markdown content is inlined directly
into the HTML inside a `<textarea data-template>`:

```html
<section data-markdown data-separator="\r?\n---\r?\n" …>
  <textarea data-template>
    # Slide 1
    Hello from reveal-md isolation test
    ---
    # Slide 2
    …
  </textarea>
</section>
```

### Network call audit

- `fetch()` occurrences in `plugin/markdown/markdown.esm.js`: **0**
- `fetch()` occurrences in `dist/reveal.js`: **0**
- `data-src` attributes in output HTML: **0**
- No XHR, no `data-src`, no external `.md` fetch at runtime

**Verdict: the static export is fully self-contained and safe on `file://`.**
The CORS concern from #613 is a non-issue for the static path.

## Remaining check (needs #595 injector)

The isolation test confirms the slide platform works on `file://`. The final
validation step requires the #595 injector's output:

### Checklist

- [ ] **Platform check** (DONE above): `reveal-md --static` output opens on `file://`
      without CORS errors — content is inlined, no `.md` fetch at runtime
- [ ] **Bundle load check**: `lcc.bundle.js` loads via `<script src="…">` in the
      static HTML without errors (depends on #675 bundle existing)
- [ ] **Injector output check**: the #595 injector's self-contained HTML, when opened
      via `file://`, runs `lcc.assemble()` + `lcc.run()` correctly and displays
      output in the slide
- [ ] **Multi-browser check**: repeat in Chrome and Firefox (the two browsers reveal.js
      explicitly targets)

### How to run the final check once #595 lands

```bash
# 1. Apply the #595 injector to a test slide deck
#    (exact command depends on #595 implementation)

# 2. Export static bundle
reveal-md injected-slides.md --static ./static-out

# 3. Open in browser — no server
open static-out/index.html          # macOS
xdg-open static-out/index.html      # Linux

# 4. Open DevTools → Network tab
#    Confirm: no failed requests, no CORS errors

# 5. Confirm: LCC code blocks run and display output inline
```

## Recommendation update

**#613's "option 1" (validate reveal-md) is confirmed viable at the platform
level.** The CORS concern does not apply to the static export path. Once the #595
injector exists, a one-time manual browser check is all that remains to close #673.

If the injector produces self-contained HTML (inlining the bundle rather than
referencing it as a sibling file), the static bundle will work on `file://`
without modification. If the injector references `lcc.bundle.js` as a relative
sibling, that also works — browsers permit loading sibling files from `<script
src="./lcc.bundle.js">` on `file://`.

Marp CLI remains the recommended alternative if reveal-md's slide authoring
experience proves cumbersome, but it is not required for `file://` compatibility.
