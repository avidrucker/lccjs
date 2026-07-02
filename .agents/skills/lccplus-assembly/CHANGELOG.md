# Changelog — lccplus-assembly skill

## 0.0.1 — 2026-05-28

Initial stub. Not a router yet — a redirector with rationale.

Sibling-in-waiting to the base [`lccjs-assembly`](../lccjs-assembly) skill.
The base skill says "LCC+ is out of scope — say so and stop"; this stub fills
that referral gap so agents land somewhere helpful instead of inventing
extensions.

Contents:
- Triggers on LCC+ keywords (`.ap`, `.lccplus`, `rand`/`srand`/`millis`/
  `nbain`/`clear`/`resetc`/`sleep`/`cursor`/`bp`, `plusdemos/`, `src/plus/`)
- Fallback procedure: (1) invoke base `lccjs-assembly` skill for calling
  convention + pitfalls (identical between LCC and LCC+); (2) read
  `lccjs/docs/lccplus-isa.md` for LCC+ additions; (3) study `plusdemos/*.ap`
  for working patterns; (4) do not invent extensions — surface gaps as
  `@todo`s under the tracker
- Names the tracker for build work: [avidrucker/lccjs#154](https://github.com/avidrucker/lccjs/issues/154)

Will move to 0.1.0+ when the first real router lands per #154's build phase.
