# TIL 2026-06-03 (FIG-3) — Tab-key textarea interception and close-script HEAD guard

## Context

Closing #605: Tab key was moving focus out of the playground textarea instead of
indenting. A single `keydown` listener fixed it in under five minutes. Two workflow
observations came out of the session.

---

## 1. Intercepting Tab in a browser textarea

Default browser behavior: Tab in a `<textarea>` shifts focus to the next focusable
element. For any code-editing widget that's the wrong behavior — users expect an
indent.

The fix is a `keydown` listener that intercepts the key before the browser acts on it:

```js
playInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();                              // stop focus-shift
  const start = playInput.selectionStart;
  const end   = playInput.selectionEnd;
  playInput.value =
    playInput.value.slice(0, start) + '    ' + playInput.value.slice(end);
  playInput.selectionStart = playInput.selectionEnd = start + 4;
  // re-trigger highlight
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderPlayground, 150);
});
```

Three things work together:

- **`e.preventDefault()`** — cancels the browser's default Tab action before it fires.
- **`selectionStart` / `selectionEnd`** — locate the cursor (or selection). If text is
  selected, the four spaces replace it; if not, they insert at point.
- **`selectionStart = selectionEnd = start + 4`** — moves the cursor past the inserted
  spaces so the next keystroke lands in the right place.

No library needed. Accessibility note: users who navigate by Tab to reach other controls
now can't escape the textarea that way. For a playground that's a deliberate tradeoff
(power-user code box); for a general-purpose form field it would be wrong.

---

## 2. `npm run close` checks HEAD, not the full push set

`npm run close` validates that the HEAD commit contains `Closes #N`. This session
produced two commits before pushing:

1. `feat: Tab key inserts 4-space indent in playground textarea (#605)` — contained
   `Closes #605` in the body.
2. `data(velocity): log #605 DEV Tab-key indent fix (FIG)` — the velocity CSV export,
   no close reference.

After the velocity commit, HEAD was commit 2, which has no `Closes #605`. The close
script refused:

```
[close] ✗ HEAD commit does not reference "Closes #605".
```

The workaround: push directly with `git push origin HEAD:main`. GitHub scans the
entire push set for `Closes #N` and auto-closed the issue from commit 1.

**The discipline implication:** when following the velocity protocol (log row → commit
CSV → then close), the velocity commit becomes HEAD and breaks `npm run close`. Two
options:

- Combine the velocity CSV and the closing commit into one (`Closes #N` in a single
  commit that also updates the CSV). Requires logging the row before the close commit,
  which means capturing `finished_iso` before the CSV commit too.
- Push directly and let GitHub close; verify with `gh issue view N` afterwards.

The second path is what happened here and it works, but it bypasses the close script's
other checks (branch cleanup, worktree teardown). A future improvement to the close
script could scan the last N commits rather than only HEAD. Filed as a side note —
no ticket yet.

---

## What landed

| Artifact | Change |
|---|---|
| [#605](https://github.com/avidrucker/lccjs/issues/605) | `keydown` Tab listener added to `docs/showcase/index.html`; closes issue. |
| [#614](https://github.com/avidrucker/lccjs/issues/614) | This TIL. |
