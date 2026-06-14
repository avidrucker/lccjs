---
name: write-til-doc
description: Guide an agent through writing, filing, and closing a TIL entry in docs/learnings/ when a session ends and a durable lesson belongs in the learning log.
---

# Write TIL Doc

Guide an agent through the repo's TIL workflow: capture a durable lesson from the end of a working session, write the TIL file, keep the README index current, and close the issue with the normal worktree + velocity protocol.

## When To Use

Use this skill when:

- the session is ending and a non-obvious lesson should be recorded
- the lesson is durable enough to live in `docs/learnings/`
- the work is a retrospective, process fix, or tooling gotcha rather than a mid-task handoff

Do not use this skill for:

- mid-task handoffs
- generic note-taking
- research findings that belong only in an issue comment

## Workflow

### 1. Decide Whether This Belongs In A TIL

Write a TIL only when the lesson is worth preserving for future agents and is not already captured clearly in an authority doc.

If the work is still in progress, use `handoff` instead.

### 2. File And Claim The Issue

Create or reuse a TIL issue with the repo's TIL title pattern:

`TIL YYYY-MM-DD AGENT — one-line topic`

Then claim the issue in a worktree with the normal `npm run claim -- <N> --as <fruit>` flow.

### 3. Write The TIL File

Create the matching markdown file in `docs/learnings/` using the established naming style for the session.

Keep the write-up narrative and concrete:

- what happened
- why it mattered
- what changed in practice
- what future agents should do differently

When a lesson hardens into a rule, point to the authority doc that should absorb it later instead of duplicating policy here.

### 4. Update The Index

If the new TIL is not already indexed, add it to `docs/learnings/README.md` so future agents can find it.

### 5. Finish The Close Protocol

Log velocity, include the generated CSV in the same closing commit, and close the issue with `npm run close <N>`.

## Style Notes

- Prefer explicit examples over abstract reflections.
- Use project terms consistently.
- Keep the TIL scoped to one session and one lesson cluster.
- If the lesson is really a broader process fix, file a follow-up ticket and link it from the TIL.
