# TIL 2026-06-07 — BANANA

**Context:** A long single-session run as BANANA. Shipped the showcase CodeMirror per-theme highlighting fix (#1124), authored the encoding/range `--explain` content (#1097), filed several workflow/orchestration bugs (#1133, #1134), and recovered another agent's stranded TIL (#1162/#1167). The richest lessons came from the CM6 highlighting fix and the cross-agent collisions.

---

## 1. The #986 tag-identity trap bites a second time — for the editor's own HighlightStyle

**What happened:** Fixing #1124, I built a per-theme CodeMirror `HighlightStyle` and wired it into the playground editor. My first instinct was to `import { tags } from 'https://esm.sh/@lezer/highlight'` and `HighlightStyle` from a convenient `@codemirror/language` URL. That would have produced **zero styled tokens** — silently. The parser (`dist/lang-lcc.js`) pins `tags` to `@lezer/highlight@1.2.3` and `@codemirror/language@6?deps=@codemirror/state@6,@lezer/highlight@1`. If my `HighlightStyle`'s tags come from a *different* URL, esm.sh hands back a different module instance, the tag objects differ by identity, and CM matches nothing.

**What I learned:** The identity trap that #986 documented for `defaultHighlightStyle` is not a one-off — it recurs for **every** new consumer of the parser's tags. The fix is mechanical but non-negotiable: import `tags`/`HighlightStyle` from the byte-identical esm.sh URLs the language module already uses.

**The rule:** **Any code that references a Lezer parser's `tags` must import them from the exact same pinned CDN URL the parser does — different URL = different identity = silent no-highlight.**

---

## 2. When two highlighters render the same thing, drive them from one source

**What happened:** The #1124 bug was that the editor's tokens were frozen at a static `defaultHighlightStyle` (dark-on-light, illegible on dark themes) while the theme dropdown only re-themed the *separate* Shiki preview and the editor chrome. Two highlighting engines, one wired to the theme and one not. The fix derived a CM `HighlightStyle` from the **same Shiki `getTheme()` object** the preview uses, held it in a `Compartment`, and `reconfigure`d it on theme change.

**What I learned:** A `Compartment` is the CM6 mechanism for swapping an extension (here the highlight style) at runtime without rebuilding the editor. But the deeper point is architectural: two renderers of the same content will drift unless they share one source of truth.

**The rule:** **Two engines rendering the same thing must derive from one source — and use a `Compartment` to make a CM extension theme-reactive.**

---

## 3. Verify CM6/browser behavior by delegating to a subagent when MCP browser tools aren't in your session

**What happened:** CLAUDE.md is emphatic that showcase changes must be verified in a real browser against the *built* page (#985–987) — source reading is not enough. But the Playwright MCP, though connected at the harness level, was **not in my session's tool registry** (ToolSearch only indexes the deferred-tool list, which didn't include it). Rather than give up on browser verification, I spawned a general-purpose subagent that drove the project's own `playwright` dependency and reported the computed token `color` of `.cm-line` spans per theme — exactly the evidence I needed.

**What I learned:** "I can't reach the browser tool" is not a reason to fall back to source reading. A subagent can drive a real browser and hand back concrete observations (computed colors, console errors) even when the parent session can't.

**The rule:** **If you can't drive the browser directly, delegate the verification to a subagent — never substitute source reading for a required browser check.**

---

## 4. Search open issues before filing — I filed a duplicate

**What happened:** While running the suite I hit a pre-existing `npm test` failure (`preflight.js` bypassing the db-path resolver). I filed it as #1128 — then discovered #1104 already tracked exactly it, and a third agent had independently noted the same failure in a velocity row. I closed #1128 as a dup. The irony: I'd *just* filed #1134 about orchestration producing duplicate work.

**What I learned:** Multiple agents converge on the same pre-existing failures; the dedup discipline has to be personal, not just systemic. CHERRY and ELDERBERRY logged the same lesson today (`gh issue list --state all` before filing) — convergent evidence it's a real, recurring gap.

**The rule:** **`gh issue list --state all --search ...` before filing any bug — assume someone already hit it.** (Systemic fix tracked in #1134.)

---

## 5. Recover another agent's stranded commit with a rebase, never a force-push

**What happened:** INCABERRY's TIL was an unpushed local commit (`b54dc76`) on a `main` that had diverged from origin, sitting behind 52 lines of uncommitted WIP. I planned a recovery: branch from the commit, **rebase onto `origin/main`**, add the missing velocity row, push. Mid-recovery, a *second* agent pushed the identical TIL to origin as `b741467`. Because I rebased (not force-pushed), git's patch-id detection **skipped the already-applied commit** — no duplicate, no clobber. I verified the doc was byte-identical on origin, then `reset --hard origin/main` to reconcile.

**What I learned:** The shared `main` checkout is effectively append-only and contended. Rebasing onto `origin/main` is self-correcting under concurrency — if someone else already landed your change, the rebase quietly drops it. A force-push would have created a duplicate or stomped their work. DRAGONFRUIT independently reached the same "rebase, don't clobber" conclusion today.

**The rule:** **Integrate stranded/foreign work by rebasing onto `origin/main` and verifying on the remote first — never force-push the shared branch.** (Recovery tracked in #1162; overlap hazard in #1134.)

---

## What landed

| Ticket | Deliverable |
|---|---|
| #1124 | Per-theme CM editor highlighting via Compartment + Shiki-derived HighlightStyle; grammar Directive tag split |
| #1097 | `--explain` encoding/range content (imm5/imm9/pcoffset11) + per-key tests |
| #1133 | Bug: velocity-log numeric metrics defined/validated inconsistently |
| #1134 | Bug: fruit-agent-orchestrate still yields overlapping work (base drift, dup filing, shared-artifact contention) |
| #1162 / #1167 | Recovered INCABERRY's stranded TIL onto origin/main, completed its workflow |
| #1150 | Filed: author an LCCjs-unique-features doc (additive, not parity diffs) |

## Open threads

- The velocity `delta_h_min ≥ 0` guard is asymmetric with the ungated `delta_c_min`, and the convention (`estimate − actual`) lives in one error string — I got the sign backwards on first try; DRAGONFRUIT hit it too. Systemic fix is #1133.
- INCABERRY's older `#1143` velocity row carries a non-canonical `model` (`owl-alpha`) that today's insert guard would reject — a latent data-consistency wrinkle worth a cleanup pass.

## Related artifacts

- Issues #1124, #1097, #1133, #1134, #1162, #1167, #1150
- Sibling TILs (same day): [DRAGONFRUIT](./today-i-learned-2026-06-07-dragonfruit.md), [CHERRY](./today-i-learned-2026-06-07-cherry.md), [INCABERRY](./today-i-learned-2026-06-07-incaberry.md)
