# Today I Learned — 2026-05-29 (banana, session 2)

**Agent:** banana · **Session theme:** demo-research close (#152 `cea`), docs-protocol
reconciliation (#161, #201), multi-agent-identity findings (#193 → #194/#195), and
the push-gating hook for #188 (#205). Second banana session of the day (cf.
`today-i-learned-2026-05-29-005.md` for banana session 1).

This was a courier-heavy session: pick available puzzles, close them, and surface
findings as new complaints rather than expanding scope.

---

## 1. The auto-claim handed me a *live* agent's identity (→ #193/#194/#195)

`npm run claim -- 152` (auto) returned **`apple`** while another agent was actively
working `#168` as apple. Re-claimed `--as banana`.

- **Why:** `takenFruits()` in `scripts/claim.js` derives the "taken" set from
  **live git worktrees** (`git worktree list`), not **live agent sessions**. apple
  had just removed its `#168` worktree at close, so `apple` looked free and was
  reassigned — even though the apple session was still alive.
- **Lesson:** fruit identity is *worktree-scoped, not session-scoped*. After an auto
  claim, **verify the returned fruit matches your terminal name**; if it collides
  with a live agent, re-claim `--as <yourname>`. Filed #193; APPLE then split it into
  #194 (session-sentinel fix) + #195 (docs).
- **Related:** the velocity-CSV `agent` column goes under the **terminal name**
  (BANANA), not the auto fruit — captured in the `terminal-agent-name-vs-fruit`
  memory.

## 2. The close protocol has drifted between two docs (→ #201)

`docs/claude_workflow.md` still documents the **pre-#186 two-commit close** (commit →
`pull --rebase` → capture post-rebase SHA → second `docs(velocity)` commit). The live
protocol (`docs/puzzle-velocity.md`, #186) is a **single commit** with `closed_commit`
left **empty** (the CSV's `merge=union` auto-resolves parallel rows).

- I followed the *stale* `claude_workflow.md` flow on #152 before noticing, then used
  the correct single-commit flow for #161/#205.
- **Lesson:** for the close sequence, **`puzzle-velocity.md` is the live authority**,
  not `claude_workflow.md` — even though the latter bills itself as "the authority
  when a summary and the detail disagree." Filed #201 with a `@todo` marker at the
  exact stale section.

## 3. `cea` is an fp-relative `lea` (→ #152)

`cea dr, imm5` is a pseudo-instruction for **`add dr, fp, imm5`** — the **fp-relative**
analogue of `lea` (which is PC-relative). `cea r0, 0` = address of the current frame
base. Verified from the listing: `cea r1,0`→`0x1360`, `cea r2,-1`→`0x157f`.

- **Doc bug found:** the immediate-width table in `glossary/assembler.md` listed `CEA`
  under **pcoffset9** (9-bit). It's an ADD-immediate, so the field is **imm5**
  (−16..15). Fixed.

## 4. The `Read` tool false-positives `.a`/`.ap` files as "binary"

`Read` refused `demos/happy-path.a` ("appears to be a binary .a file") even though
`file` reports UTF-8. Consequence: **`Edit` is unusable on `.a`/`.ap` files** (it
requires a prior successful `Read`).

- **Lesson:** to edit assembly source, fall back to `sed -i` (a documented exception
  to the "prefer dedicated tools" rule) and verify with `grep`/`awk` afterward.

## 5. Push-gating hook: bash + grep gotchas (→ #205, #188 mode #2)

Added a gem-free gate to `scripts/git-hooks/pre-push` that blocks a push when a
rebase/merge is in progress or a tracked file has a column-0 conflict marker.

- **`set -e` is suspended inside `if`/`while` conditions and `&&`/`||` chains.** So
  `if markers=$(git grep -nE '…') && [ -n "$markers" ]` is safe even though `git grep`
  **exits 1 when it finds nothing** — which would otherwise abort an `set -e` script.
- **Anchor conflict-marker greps at column 0** (`^<<<<<<<` / `^>>>>>>>`). Prose that
  *discusses* the markers (e.g. `claude_workflow.md` line 107) indents or quotes them,
  so the anchored pattern doesn't false-trip. Checking the two unambiguous markers is
  enough — a real conflict always contains all three, and bare `=======` risks
  matching heading underlines.
- **Run cheap local gates before networked/expensive ones** (the gate runs ahead of
  the `pdd` scan + `gh`-calling `puzzle:status`), and make them gem-free so they fire
  for contributors without the Ruby toolchain.

## 6. A stale marker I flagged was cleaned by another agent before I could act (#167)

I flagged a `STALE` `@todo #167` marker; by the time I went to clean it, another agent
had pushed `77a31bf` removing it.

- **Lesson:** in a multi-agent repo, **re-check shared state right before acting** on
  another agent's leftover — don't queue an action against a snapshot. Cheap fetch +
  grep saved a redundant (and potentially clobbering) commit.

## 7. Yegor-PM discipline, applied

- **BDD framing** for every new ticket (#193, #201, #205): title names what's *broken*,
  body is Have / Should / Repro — not "add X".
- **PDD marker at the *exact* defect site**, never a different file (#201's marker went
  into `claude_workflow.md` itself). Caveat surfaced: the `pdd` gem excludes
  `docs/**` + `*.md`, so markers there are tracked by `puzzle:status` but the **GH
  issue is the real backstop**.
- **Spike → recommendation → bounded child** for the #188 epic: its analysis was
  already written by APPLE, so I executed the one decision-free item as a child
  complaint (#205), logged a velocity row for *that*, and left #188 **open** for the
  user-owned #4 branch-protection decision. Only the reporter closes the parent.
- **Don't make the user's decision.** #188's branch-protection question (trunk-based
  vs PR/merge-queue once protection is enforced) is an owner decision; I documented it
  in the #188 comment for `@avidrucker` rather than picking one.

---

### Tickets this session

| Action | Ticket |
|---|---|
| Closed | #152 (`cea` research), #161 (cross-repo `closed_commit` docs), #205 (push-gating hook) |
| Filed | #193 (claim fruit-reuse → split by APPLE into #194/#195), #201 (stale close protocol in `claude_workflow.md`), #205 |
| Progressed, left open | #188 (mode #2 done via #205; #4 decision + #6 remain) |
