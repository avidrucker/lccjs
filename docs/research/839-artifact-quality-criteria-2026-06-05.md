# Artifact Quality Criteria

**Date:** 2026-06-05
**Issue:** #839
**Origin:** Claude web app session (exact chat unknown); source file was `~/Documents/Study/Scratch/artifacts-quality.md`

---

## Overview

A rubric for reviewing any artifact — docs, tickets, issues, bug reports, design proposals, status updates — against observable quality signals. Developed to support AI-assisted review (AI assessability column) and human self-check before posting.

---

## Core criteria

| Tag | Explanation | AI assess? |
|---|---|---|
| **Clear** | The artifact's purpose and core content land immediately — no inference or scrolling required | ⚠️ Partial |
| **Unknowns flagged** | Gaps, uncertainties, and missing info are stated explicitly rather than papered over | ⚠️ Partial |
| **30-second read** | A reader can assess relevance and urgency within 30 seconds | ✅ Yes |
| **No noise** | Contains only what the reader needs — no author journey, no filler, no repetition | ✅ Yes |
| **Outcome defined** | The reader leaves knowing what success looks like or what action to take next | ⚠️ Partial |

---

## General items (all artifact types)

| Tag | Explanation | AI assess? |
|---|---|---|
| **Title quality** | Title contains no vague words ("fix", "update", "misc"), is an appropriate length, and is a complete thought | ✅ Yes |
| **No placeholders** | No "TBD", "TODO", "ask X", or "see Slack" — all context is embedded, not deferred | ✅ Yes |
| **Motivation present** | States why this matters, not just what it is | ⚠️ Partial |
| **Measurable outcome** | Acceptance criteria uses observable language ("user can X") rather than vague language ("works better") | ⚠️ Partial |
| **Single concern** | Does not bundle unrelated issues or requests | ⚠️ Partial |
| **Sized or flagged** | Effort is estimated or explicitly flagged as unknown | ✅ Yes |

---

## Bug report criteria

| Tag | Explanation | AI assess? |
|---|---|---|
| **Reproduce steps** | Numbered, ordered steps to reproduce are present | ✅ Yes |
| **Expected vs actual** | Both expected and actual behavior are explicitly stated | ✅ Yes |
| **Frequency noted** | States whether issue is always / sometimes / intermittent | ✅ Yes |
| **Environment stated** | OS, browser, version, or relevant environment context is specified | ✅ Yes |
| **Error included** | Error message, stack trace, or log snippet is attached where applicable | ✅ Yes |
| **Blast radius** | Severity and affected surface are stated | ⚠️ Partial |
| **Workaround noted** | Known workaround is stated if one exists | ✅ Yes |

---

## Identified gaps (future rubric work)

### Missing core criterion

- **Accurate** — factual correctness is distinct from flagging unknowns. An artifact can have no unknowns flagged because the author is confidently wrong. The original framing combined "accurate / honest" into one; splitting them may be warranted.

### Missing general items

- **Audience clear** — who should read or act on this is stated or obvious. Implicit in most tickets, critical in design docs and proposals.
- **Links present** — related tickets, PRs, or docs are referenced. Traceability is fully AI-assessable and not currently covered.

### Missing artifact-type sections

Bug reports are the only type-specific section developed so far. Candidates:

- **Feature tickets** — linked epic, priority stated, acceptance criteria present
- **Design docs / proposals** — alternatives considered, decision needed, deadline stated
- **Status updates** — period covered, decisions made vs. decisions still needed

See #840 for expanding the rubric to cover these types.

---

## How this rubric applies to lccjs

The Yegor BDD issue format (`## Have` / `## Should have` / `## Repro`) satisfies several core criteria structurally: **Outcome defined** (the "Should have" block), **Reproduce steps** and **Expected vs actual** (the "Repro" block). Gaps the rubric calls out that the BDD format does not enforce:

- **Motivation present** — BDD "Should have" states the desired end state but not always *why* it matters
- **Links present** — the BDD template has no mandatory `Related:` or `Blocks:` field
- **Blast radius** for bug reports — severity is ad hoc

*Agent: BANANA · Model: sonnet-4.6 · Date: 2026-06-05*
